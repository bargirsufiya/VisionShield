from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Header
)

from fastapi.responses import FileResponse, StreamingResponse

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from typing import Optional
from notifier import dispatch_alerts_from_settings, send_email_alert, send_sms_alert

from datetime import datetime, timezone, timedelta

from bson import ObjectId

from database import db

from ai.ppe_detector import detect_ppe
from ai.video_detector import detect_ppe_video
from ai.process_detector import detect_process_video

from auth import (
    router as auth_router,
    verify_admin_token
)

from sensor_monitor import sensor_monitor

import os
import shutil
import uuid
from concurrent.futures import ThreadPoolExecutor
import io

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, black, white, grey
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib import colors


@asynccontextmanager
async def lifespan(app):
    sensor_monitor.configure(get_current_settings, ingest_sensor_reading)
    sensor_monitor.start()
    yield
    sensor_monitor.stop()


# =========================================
# FastAPI Application
# =========================================

app = FastAPI(lifespan=lifespan)

# Increase max request body size for large video uploads (100MB)
app.router.max_request_body_size = 100 * 1024 * 1024  # 100MB

app.include_router(auth_router)


# =========================================
# CORS Configuration
# =========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# Basic API
# =========================================

@app.get("/")
def home():

    return {
        "message": "Vision-Shield Backend is Running"
    }


@app.get("/api/test")
def test_api():

    return {
        "project": "Vision-Shield",
        "status": "Backend is working"
    }


# =========================================
# Database Test
# =========================================

@app.get("/api/database-test")
def database_test():

    result = db.command("ping")

    return {
        "database": "MongoDB",
        "status": "Connected",
        "ping": result["ok"]
    }


# =========================================
# Sensor Data Model
# =========================================

class SensorData(BaseModel):

    temperature: float
    weight: float


# =========================================
# System Settings Model
# =========================================

class SystemSettings(BaseModel):

    system_name: str

    min_temperature: float
    max_temperature: float

    min_weight: float
    max_weight: float

    refresh_interval: float

    session_token: str

    alert_email: Optional[str] = ""
    alert_phone: Optional[str] = ""
    enable_email_alerts: bool = False
    enable_sms_alerts: bool = False
    monitoring_enabled: bool = False

    # Process Detection Alert Email (Admin only)
    process_alert_email: Optional[str] = ""


class MonitoringControl(BaseModel):

    session_token: str
    monitoring_enabled: bool
    refresh_interval: Optional[float] = None


# =========================================
# Maintenance Models
# =========================================

class MaintenanceCreate(BaseModel):
    equipment_name: str
    equipment_id: str
    description: str
    last_maintenance_date: datetime
    next_due_date: datetime
    remarks: Optional[str] = ""


class MaintenanceUpdate(BaseModel):
    equipment_name: Optional[str] = None
    equipment_id: Optional[str] = None
    description: Optional[str] = None
    last_maintenance_date: Optional[datetime] = None
    next_due_date: Optional[datetime] = None
    remarks: Optional[str] = None


class MaintenanceComplete(BaseModel):
    completion_date: datetime
    next_due_date: Optional[datetime] = None
    remarks: Optional[str] = None


class MaintenanceResponse(BaseModel):
    id: str
    equipment_name: str
    equipment_id: str
    description: str
    last_maintenance_date: datetime
    next_due_date: datetime
    status: str
    remarks: Optional[str] = ""
    completion_date: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_by: str
    updated_at: datetime


# Request models with admin_token
class MaintenanceCreateRequest(MaintenanceCreate):
    admin_token: str


class MaintenanceUpdateRequest(MaintenanceUpdate):
    admin_token: str


class MaintenanceCompleteRequest(MaintenanceComplete):
    admin_token: str


class MaintenanceDeleteRequest(BaseModel):
    admin_token: str


# =========================================
# Default System Settings
# =========================================

DEFAULT_SETTINGS = {
    "system_name": "VisionShield",

    "min_temperature": 1300,
    "max_temperature": 1600,

    "min_weight": 500,
    "max_weight": 650,

    "refresh_interval": 5,
    "alert_email": "",
    "alert_phone": "",
    "enable_email_alerts": False,
    "enable_sms_alerts": False,
    "monitoring_enabled": False,
    "process_alert_email": "",
}


# =========================================
# Settings Permission Verification
# =========================================

def verify_settings_token(token: str):

    user = db["users"].find_one({
        "session_token": token,
        "status": "Active"
    })

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session."
        )

    if user.get("role") not in [
        "Administrator",
        "Supervisor"
    ]:

        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission "
                "to modify settings."
            )
        )

    return user


# =========================================
# Maintenance Helper Functions
# =========================================

def calculate_status(next_due_date: datetime) -> str:
    """Calculate maintenance status based on next due date.

    Returns:
        - "Overdue" if next_due_date < today
        - "Due Soon" if next_due_date <= 7 days from today
        - "Scheduled" if next_due_date > 7 days from today
        - "Completed" is handled separately when completion_date is set
    """
    now = datetime.now(timezone.utc)

    # Ensure next_due_date is timezone-aware
    if next_due_date.tzinfo is None:
        next_due_date = next_due_date.replace(tzinfo=timezone.utc)

    # Calculate days difference
    days_diff = (next_due_date - now).days

    if days_diff < 0:
        return "Overdue"
    elif days_diff <= 7:
        return "Due Soon"
    else:
        return "Scheduled"


def verify_maintenance_permission(token: str):
    """Verify user has Administrator or Supervisor role for maintenance CRUD operations."""
    user = db["users"].find_one({
        "session_token": token,
        "status": "Active"
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session."
        )

    if user.get("role") not in ["Administrator", "Supervisor"]:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to manage maintenance records."
        )

    return user


def verify_admin_only(token: str):
    """Verify user has Administrator role for delete operations."""
    user = db["users"].find_one({
        "session_token": token,
        "role": "Administrator",
        "status": "Active"
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Administrator authentication required."
        )

    return user


# =========================================
# Get Current System Settings
# =========================================

def get_current_settings():

    settings = db["system_settings"].find_one({
        "_id": "default"
    })

    if not settings:

        settings = {
            "_id": "default",
            **DEFAULT_SETTINGS
        }

        db["system_settings"].insert_one(
            settings
        )

    merged = {**DEFAULT_SETTINGS, **settings}
    return merged


def public_runtime_settings(settings=None):
    settings = settings or get_current_settings()
    return {
        "min_temperature": settings["min_temperature"],
        "max_temperature": settings["max_temperature"],
        "min_weight": settings["min_weight"],
        "max_weight": settings["max_weight"],
        "refresh_interval": settings["refresh_interval"],
        "monitoring_enabled": bool(settings.get("monitoring_enabled")),
        "updated_at": settings.get("updated_at"),
        "monitoring_started_at": settings.get("monitoring_started_at"),
        "monitoring_stopped_at": settings.get("monitoring_stopped_at"),
    }


def ingest_sensor_reading(temperature: float, weight: float):
    settings = get_current_settings()

    temp_min = settings["min_temperature"]
    temp_max = settings["max_temperature"]
    weight_min = settings["min_weight"]
    weight_max = settings["max_weight"]
    now = datetime.now(timezone.utc)

    sensor_record = {
        "temperature": temperature,
        "weight": weight,
        "timestamp": now,
        "thresholds": {
            "min_temperature": temp_min,
            "max_temperature": temp_max,
            "min_weight": weight_min,
            "max_weight": weight_max,
        },
    }

    result = db["sensor_readings"].insert_one(sensor_record)

    problems = []
    if temperature < temp_min:
        problems.append(
            f"Temperature {temperature}°C is below minimum {temp_min}°C"
        )
    elif temperature > temp_max:
        problems.append(
            f"Temperature {temperature}°C exceeds maximum {temp_max}°C"
        )

    if weight < weight_min:
        problems.append(
            f"Weight {weight} kg is below minimum {weight_min} kg"
        )
    elif weight > weight_max:
        problems.append(
            f"Weight {weight} kg exceeds maximum {weight_max} kg"
        )

    alert_created = False
    if problems:
        alert_record = {
            "temperature": temperature,
            "weight": weight,
            "problems": problems,
            "status": "Active",
            "detected_at": now,
            "resolved_at": None,
            "resolved_by": None,
            "thresholds": {
                "min_temperature": temp_min,
                "max_temperature": temp_max,
                "min_weight": weight_min,
                "max_weight": weight_max,
            },
        }
        db["alerts"].insert_one(alert_record)
        alert_created = True

        try:
            dispatch_alerts_from_settings(
                settings,
                subject="VisionShield sensor threshold alert",
                message_body=(
                    "Abnormal sensor reading detected.\n\n"
                    + "\n".join(problems)
                    + f"\n\nTemperature: {temperature}°C\n"
                    + f"Weight: {weight} kg"
                ),
                severity="CRITICAL",
            )
        except Exception as error:
            print(f"[Alerts] Failed to dispatch notifications: {error}")

    return {
        "id": str(result.inserted_id),
        "alert_created": alert_created,
        "problems": problems,
        "timestamp": now,
    }


# =========================================
# Save Sensor Data
# =========================================

@app.post("/api/sensors")
def add_sensor_data(data: SensorData):
    result = ingest_sensor_reading(data.temperature, data.weight)
    return {
        "message": "Sensor data saved successfully",
        "id": result["id"],
        "alert_created": result["alert_created"],
        "problems": result["problems"],
    }


@app.get("/api/settings/runtime")
def get_runtime_settings():
    return public_runtime_settings()


# =========================================
# Get Alerts
# =========================================

@app.get("/api/alerts")
def get_alerts(page: int = 1, limit: int = 10, status_filter: str = None, date_filter: str = None, show_recent_resolved: bool = True):

    # Build query conditions
    query_conditions = []

    # Status filter
    if status_filter:
        query_conditions.append({"status": status_filter})

    # Date filter for resolved alerts (resolved_at falls on specific date)
    if date_filter:
        try:
            # Parse the date filter (YYYY-MM-DD format)
            filter_date = datetime.strptime(date_filter, "%Y-%m-%d").date()

            # Create datetime range for the entire day
            start_datetime = datetime.combine(filter_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_datetime = datetime.combine(filter_date, datetime.max.time()).replace(tzinfo=timezone.utc)

            query_conditions.append({
                "resolved_at": {
                    "$gte": start_datetime,
                    "$lte": end_datetime
                }
            })
        except ValueError:
            # Invalid date format, ignore this filter
            pass

    # Show only recently resolved alerts (last 24 hours) if requested and no specific date filter
    if show_recent_resolved and not date_filter and (not status_filter or status_filter == "Resolved"):
        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        query_conditions.append({
            "resolved_at": {
                "$gte": twenty_four_hours_ago
            }
        })

    # Build the final query
    if query_conditions:
        if len(query_conditions) == 1:
            final_query = query_conditions[0]
        else:
            final_query = {"$and": query_conditions}
    else:
        final_query = {}

    # Calculate skip value for pagination
    skip = (page - 1) * limit

    # Get total count for pagination metadata
    total_alerts = db["alerts"].count_documents(final_query)

    # Calculate total pages
    total_pages = (total_alerts + limit - 1) // limit  # Ceiling division

    # Get paginated alerts
    alerts = list(
        db["alerts"]
        .find(
            final_query,
            {
                "_id": 1,
                "temperature": 1,
                "weight": 1,
                "problems": 1,
                "status": 1,
                "detected_at": 1,
                "resolved_at": 1,
                "resolved_by": 1
            }
        )
        .sort("detected_at", -1)
        .skip(skip)
        .limit(limit)
    )

    for alert in alerts:

        alert["_id"] = str(
            alert["_id"]
        )

        # -----------------------------------------
        # Detected timestamp
        # -----------------------------------------

        if alert.get("detected_at"):

            detected_at = alert["detected_at"]

            if detected_at.tzinfo is None:
                detected_at = detected_at.replace(
                    tzinfo=timezone.utc
                )

            alert["detected_at"] = (
                detected_at.isoformat()
            )


        # -----------------------------------------
        # Resolved timestamp
        # -----------------------------------------

        if alert.get("resolved_at"):

            resolved_at = alert["resolved_at"]

            if resolved_at.tzinfo is None:
                resolved_at = resolved_at.replace(
                    tzinfo=timezone.utc
                )

            alert["resolved_at"] = (
                resolved_at.isoformat()
            )

    # Return alerts with pagination metadata
    return {
        "alerts": alerts,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_alerts": total_alerts,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


# =========================================
# Resolve Alert
# =========================================

class ResolveAlertRequest(BaseModel):

    alert_id: str

    admin_token: str


@app.put("/api/alerts/resolve")
def resolve_alert(
    data: ResolveAlertRequest
):

    # -----------------------------------------
    # Verify Administrator or Supervisor session
    # -----------------------------------------

    verify_maintenance_permission(
        data.admin_token
    )


    # -----------------------------------------
    # Convert alert ID
    # -----------------------------------------

    try:

        alert_object_id = ObjectId(
            data.alert_id
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid alert ID."
        )


    # -----------------------------------------
    # Find alert
    # -----------------------------------------

    alert = db["alerts"].find_one({
        "_id": alert_object_id
    })


    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found."
        )


    # -----------------------------------------
    # Check if already resolved
    # -----------------------------------------

    if alert.get("status") == "Resolved":

        raise HTTPException(
            status_code=400,
            detail="Alert is already resolved."
        )


    # -----------------------------------------
    # Find logged-in Administrator
    # -----------------------------------------

    user = db["users"].find_one({
        "session_token": data.admin_token,
        "status": "Active"
    })


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid session."
        )


    # -----------------------------------------
    # Resolve alert
    # -----------------------------------------

    db["alerts"].update_one(
    {"_id": alert_object_id},
    {
        "$set": {
            "status": "Resolved",
            "resolved_at": datetime.now(timezone.utc),
            "resolved_by": user["username"]
        }
    }
)

    return {

        "message": "Alert resolved successfully.",

        "alert_id": data.alert_id,

        "resolved_by": user["username"],

        "status": "Resolved"
    }


# =========================================
# Get Sensor Data
# =========================================

@app.get("/api/sensors")
def get_sensor_data(page: int = 1, limit: int = 10, search: str = None):

    # Build search query
    if search:
        # Build $or conditions for searching across different field types
        or_conditions = []

        # Always search _id and timestamp as strings (these are strings in DB)
        or_conditions.append({"_id": {"$regex": search, "$options": "i"}})
        or_conditions.append({"timestamp": {"$regex": search, "$options": "i"}})

        # For numeric fields (temperature, weight), try to parse search as number
        # If successful, add exact match conditions (with small tolerance for floating point)
        try:
            num_search = float(search)
            # Add small tolerance for floating point comparison
            tolerance = 0.001
            or_conditions.append({
                "temperature": {
                    "$gte": num_search - tolerance,
                    "$lte": num_search + tolerance
                }
            })
            or_conditions.append({
                "weight": {
                    "$gte": num_search - tolerance,
                    "$lte": num_search + tolerance
                }
            })
        except ValueError:
            # If search term is not a number, we can't do meaningful numeric search
            # Skip adding temperature and weight conditions (they won't match anyway with regex on numbers)
            pass

        # Create the $or query if we have conditions
        if or_conditions:
            query = {"$or": or_conditions}
        else:
            # Fallback: if no conditions (shouldn't happen with non-empty search), match nothing
            query = {"_id": {"$regex": "^$"}}  # Matches nothing

        # Calculate skip value for pagination
        skip = (page - 1) * limit

        # Get total count for pagination metadata
        total_records = db["sensor_readings"].count_documents(query)

        # Calculate total pages
        total_pages = (total_records + limit - 1) // limit  # Ceiling division

        # Get paginated records
        records = list(
            db["sensor_readings"]
            .find(query)
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
        )

    else:
        # No search - use original logic for better performance
        # Calculate skip value for pagination
        skip = (page - 1) * limit

        # Get total count for pagination metadata
        total_records = db["sensor_readings"].count_documents({})

        # Calculate total pages
        total_pages = (total_records + limit - 1) // limit  # Ceiling division

        # Get paginated records
        records = list(
            db["sensor_readings"]
            .find()
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
        )

    for record in records:

        record["_id"] = str(record["_id"])

        if record.get("timestamp"):

            timestamp = record["timestamp"]

            # MongoDB may return the UTC datetime without timezone info.
            # Explicitly mark it as UTC before sending to React.
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(
                    tzinfo=timezone.utc
                )

            record["timestamp"] = timestamp.isoformat()

    # Return records with pagination metadata
    return {
        "records": records,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_records": total_records,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


# =========================================
# Get Sensor History by Date
# =========================================

@app.get("/api/sensors/history")
def get_sensor_history(date: str, page: int = 1, limit: int = 1000):
    """
    Get sensor readings for a specific date.
    Date format: YYYY-MM-DD
    Returns readings sorted chronologically (oldest first).
    """
    # Validate and parse date
    try:
        filter_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD."
        )

    # Create datetime range for the entire day (UTC)
    start_datetime = datetime.combine(filter_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_datetime = datetime.combine(filter_date, datetime.max.time()).replace(tzinfo=timezone.utc)

    # Build query
    query = {
        "timestamp": {
            "$gte": start_datetime,
            "$lte": end_datetime
        }
    }

    # Calculate skip value for pagination
    skip = (page - 1) * limit

    # Get total count for pagination metadata
    total_records = db["sensor_readings"].count_documents(query)

    # Calculate total pages
    total_pages = (total_records + limit - 1) // limit  # Ceiling division

    # Get paginated records - sort by timestamp ASC (chronological)
    records = list(
        db["sensor_readings"]
        .find(query)
        .sort("timestamp", 1)  # 1 = ascending (oldest first)
        .skip(skip)
        .limit(limit)
    )

    for record in records:
        record["_id"] = str(record["_id"])

        if record.get("timestamp"):
            timestamp = record["timestamp"]
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            record["timestamp"] = timestamp.isoformat()

    # Return records with pagination metadata
    return {
        "records": records,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_records": total_records,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


# =========================================
# Daily Production Report - PDF Download
# =========================================

@app.get("/api/reports/daily")
def get_daily_production_report(date: str):
    """
    Generate and download a daily production report as PDF.
    Date format: YYYY-MM-DD
    """
    # Validate and parse date
    try:
        filter_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD."
        )

    # Create datetime range for the entire day (UTC)
    start_datetime = datetime.combine(filter_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_datetime = datetime.combine(filter_date, datetime.max.time()).replace(tzinfo=timezone.utc)

    # 1. Fetch sensor readings for the date
    sensor_query = {
        "timestamp": {
            "$gte": start_datetime,
            "$lte": end_datetime
        }
    }
    sensor_records = list(
        db["sensor_readings"]
        .find(sensor_query)
        .sort("timestamp", 1)  # chronological
    )

    # 2. Fetch alerts for the date (both sensor alerts and process_sop alerts)
    alerts_query = {
        "detected_at": {
            "$gte": start_datetime,
            "$lte": end_datetime
        }
    }
    alerts = list(
        db["alerts"]
        .find(alerts_query)
        .sort("detected_at", 1)
    )

    # 3. Separate process SOP alerts
    process_sop_alerts = [a for a in alerts if a.get("type") == "process_sop"]
    sensor_alerts = [a for a in alerts if a.get("type") != "process_sop"]

    # 4. Get system settings for report header
    settings = get_current_settings()
    system_name = settings.get("system_name", "VisionShield")

    # 5. Generate PDF report
    pdf_buffer = generate_daily_report_pdf(
        date=date,
        system_name=system_name,
        sensor_records=sensor_records,
        sensor_alerts=sensor_alerts,
        process_sop_alerts=process_sop_alerts,
        temp_min=settings.get("min_temperature", 1300),
        temp_max=settings.get("max_temperature", 1600),
        weight_min=settings.get("min_weight", 500),
        weight_max=settings.get("max_weight", 650),
    )

    # Return PDF as streaming response
    filename = f"VisionShield_Daily_Report_{date}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_buffer),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


def generate_daily_report_pdf(
    date: str,
    system_name: str,
    sensor_records: list,
    sensor_alerts: list,
    process_sop_alerts: list,
    temp_min: float,
    temp_max: float,
    weight_min: float,
    weight_max: float,
) -> bytes:
    """Generate daily production report PDF using ReportLab."""
    buffer = io.BytesIO()

    # Create document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch,
    )

    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=6,
        textColor=HexColor('#1e3a5f'),
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        spaceAfter=12,
        textColor=HexColor('#4a5568'),
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        spaceBefore=16,
        spaceAfter=8,
        textColor=HexColor('#1e3a5f'),
        borderWidth=0,
        borderPadding=0,
    )
    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=11,
        leading=14,
        spaceBefore=10,
        spaceAfter=6,
        textColor=HexColor('#2d3748'),
    )
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=12,
        spaceAfter=4,
        textColor=HexColor('#2d3748'),
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=white,
        fontName='Helvetica-Bold',
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=10,
        alignment=TA_CENTER,
        textColor=HexColor('#2d3748'),
    )
    table_cell_left_style = ParagraphStyle(
        'TableCellLeft',
        parent=table_cell_style,
        alignment=TA_LEFT,
    )
    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=HexColor('#718096'),
    )

    # Color definitions
    header_bg = HexColor('#1e3a5f')
    header_fg = white
    row_alt_bg = HexColor('#f7fafc')
    border_color = HexColor('#e2e8f0')
    temp_color = HexColor('#2563eb')
    weight_color = HexColor('#f59e0b')
    critical_color = HexColor('#ef4444')
    warning_color = HexColor('#f59e0b')
    success_color = HexColor('#16a34a')

    story = []

    # =========================================
    # SECTION 1: HEADER
    # =========================================
    story.append(Paragraph(system_name, title_style))
    story.append(Paragraph("Daily Production Report", subtitle_style))
    story.append(Paragraph(f"Date: {date} &nbsp;&nbsp;|&nbsp;&nbsp; Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC", small_style))
    story.append(HRFlowable(width="100%", thickness=2, color=header_bg, spaceAfter=12))

    # =========================================
    # SECTION 2: PRODUCTION SUMMARY
    # =========================================
    story.append(Paragraph("1. Production Summary", heading_style))

    if sensor_records:
        temps = [r["temperature"] for r in sensor_records if isinstance(r.get("temperature"), (int, float))]
        weights = [r["weight"] for r in sensor_records if isinstance(r.get("weight"), (int, float))]

        if temps and weights:
            temp_avg = sum(temps) / len(temps)
            temp_min_val = min(temps)
            temp_max_val = max(temps)
            weight_avg = sum(weights) / len(weights)
            weight_min_val = min(weights)
            weight_max_val = max(weights)

            summary_data = [
                [Paragraph("Metric", table_header_style),
                 Paragraph("Temperature (°C)", table_header_style),
                 Paragraph("Weight (kg)", table_header_style)],
                [Paragraph("Average", table_cell_left_style),
                 Paragraph(f"{temp_avg:.1f}", table_cell_style),
                 Paragraph(f"{weight_avg:.1f}", table_cell_style)],
                [Paragraph("Minimum", table_cell_left_style),
                 Paragraph(f"{temp_min_val:.1f}", table_cell_style),
                 Paragraph(f"{weight_min_val:.1f}", table_cell_style)],
                [Paragraph("Maximum", table_cell_left_style),
                 Paragraph(f"{temp_max_val:.1f}", table_cell_style),
                 Paragraph(f"{weight_max_val:.1f}", table_cell_style)],
                [Paragraph("Readings Count", table_cell_left_style),
                 Paragraph(str(len(temps)), table_cell_style),
                 Paragraph(str(len(weights)), table_cell_style)],
                [Paragraph("Threshold Min", table_cell_left_style),
                 Paragraph(f"{temp_min:.1f}", table_cell_style),
                 Paragraph(f"{weight_min:.1f}", table_cell_style)],
                [Paragraph("Threshold Max", table_cell_left_style),
                 Paragraph(f"{temp_max:.1f}", table_cell_style),
                 Paragraph(f"{weight_max:.1f}", table_cell_style)],
            ]

            summary_table = Table(summary_data, colWidths=[2*inch, 2*inch, 2*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), header_bg),
                ('TEXTCOLOR', (0, 0), (-1, 0), header_fg),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 0.5, border_color),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, row_alt_bg]),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 8))

            # Temperature status
            temp_status = "NORMAL"
            if temp_avg > temp_max or temp_avg < temp_min:
                temp_status = "CRITICAL"
            elif temp_avg > temp_max * 0.95 or temp_avg < temp_min * 1.05:
                temp_status = "WARNING"

            weight_status = "NORMAL"
            if weight_avg > weight_max or weight_avg < weight_min:
                weight_status = "CRITICAL"
            elif weight_avg > weight_max * 0.95 or weight_avg < weight_min * 1.05:
                weight_status = "WARNING"

            story.append(Paragraph(f"Temperature Status: <b>{temp_status}</b>", body_style))
            story.append(Paragraph(f"Weight Status: <b>{weight_status}</b>", body_style))
        else:
            story.append(Paragraph("Insufficient sensor data for summary statistics.", body_style))
    else:
        story.append(Paragraph("No sensor readings recorded for this date.", body_style))

    story.append(Spacer(1, 12))

    # =========================================
    # SECTION 3: PPE SAFETY
    # =========================================
    story.append(Paragraph("2. PPE Safety Compliance", heading_style))

    # Note: PPE detection data is not stored by date in the database
    # This section will indicate if PPE data is available or not
    story.append(Paragraph(
        "No automated PPE detection data available for this date. "
        "PPE compliance monitoring requires running image/video detection via the AI Detection module. "
        "Manual safety inspections should be referenced for this period.",
        body_style
    ))

    # If we had PPE data, we would show a table like:
    # PPE Item | Required | Detected | Compliance | Violations
    # Helmet   | Yes      | X/Total  | X%         | N
    # Vest     | Yes      | X/Total  | X%         | N
    # Gloves   | Yes      | X/Total  | X%         | N
    # Boots    | Yes      | X/Total  | X%         | N
    # Goggles  | Yes      | X/Total  | X%         | N
    # Cap      | No       | X/Total  | X%         | N

    story.append(Spacer(1, 12))

    # =========================================
    # SECTION 4: SENSOR SUMMARY (Detailed Readings)
    # =========================================
    story.append(Paragraph("3. Sensor Readings Summary", heading_style))

    if sensor_records:
        # Show first 20 readings in a table
        display_records = sensor_records[:20]

        sensor_table_data = [
            [Paragraph("Time (UTC)", table_header_style),
             Paragraph("Temperature (°C)", table_header_style),
             Paragraph("Weight (kg)", table_header_style),
             Paragraph("Temp Status", table_header_style),
             Paragraph("Weight Status", table_header_style)],
        ]

        for record in display_records:
            ts = record.get("timestamp")
            time_str = ""
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                    time_str = dt.strftime('%H:%M:%S')
                except:
                    time_str = "N/A"

            temp = record.get("temperature", "N/A")
            weight = record.get("weight", "N/A")

            # Determine status
            temp_status = "OK"
            if isinstance(temp, (int, float)):
                if temp > temp_max or temp < temp_min:
                    temp_status = "CRITICAL"
                elif temp > temp_max * 0.95 or temp < temp_min * 1.05:
                    temp_status = "WARNING"

            weight_status = "OK"
            if isinstance(weight, (int, float)):
                if weight > weight_max or weight < weight_min:
                    weight_status = "CRITICAL"
                elif weight > weight_max * 0.95 or weight < weight_min * 1.05:
                    weight_status = "WARNING"

            sensor_table_data.append([
                Paragraph(time_str, table_cell_style),
                Paragraph(f"{temp:.1f}" if isinstance(temp, (int, float)) else str(temp), table_cell_style),
                Paragraph(f"{weight:.1f}" if isinstance(weight, (int, float)) else str(weight), table_cell_style),
                Paragraph(temp_status, table_cell_style),
                Paragraph(weight_status, table_cell_style),
            ])

        sensor_table = Table(sensor_table_data, colWidths=[1.3*inch, 1.5*inch, 1.5*inch, 1.1*inch, 1.1*inch])
        sensor_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), header_fg),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, border_color),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, row_alt_bg]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(sensor_table)

        if len(sensor_records) > 20:
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"<i>Showing first 20 of {len(sensor_records)} readings. Full data available via API.</i>", small_style))
    else:
        story.append(Paragraph("No sensor readings recorded for this date.", body_style))

    story.append(Spacer(1, 12))

    # =========================================
    # SECTION 5: ALERT SUMMARY
    # =========================================
    story.append(Paragraph("4. Alert Summary", heading_style))

    # Sensor alerts
    story.append(Paragraph("4.1 Sensor Threshold Alerts", subheading_style))
    if sensor_alerts:
        alert_table_data = [
            [Paragraph("Time (UTC)", table_header_style),
             Paragraph("Type", table_header_style),
             Paragraph("Issues", table_header_style),
             Paragraph("Status", table_header_style),
             Paragraph("Resolved", table_header_style)],
        ]

        for alert in sensor_alerts[:30]:  # Limit to 30 alerts
            ts = alert.get("detected_at")
            time_str = ""
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace('Z', '+00:00')) if isinstance(ts, str) else ts
                    time_str = dt.strftime('%H:%M:%S')
                except:
                    time_str = "N/A"

            problems = alert.get("problems", [])
            issues_text = "; ".join(problems) if problems else "N/A"
            if len(issues_text) > 60:
                issues_text = issues_text[:57] + "..."

            status = alert.get("status", "Unknown")
            resolved_at = alert.get("resolved_at")
            resolved_str = ""
            if resolved_at:
                try:
                    dt = datetime.fromisoformat(resolved_at.replace('Z', '+00:00')) if isinstance(resolved_at, str) else resolved_at
                    resolved_str = dt.strftime('%H:%M:%S')
                except:
                    resolved_str = "N/A"

            alert_table_data.append([
                Paragraph(time_str, table_cell_style),
                Paragraph("Sensor", table_cell_style),
                Paragraph(issues_text, table_cell_left_style),
                Paragraph(status, table_cell_style),
                Paragraph(resolved_str if resolved_str else "—", table_cell_style),
            ])

        alert_table = Table(alert_table_data, colWidths=[1.1*inch, 0.9*inch, 2.5*inch, 0.9*inch, 1.1*inch])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), header_fg),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, border_color),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, row_alt_bg]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(alert_table)

        if len(sensor_alerts) > 30:
            story.append(Spacer(1, 4))
            story.append(Paragraph(f"<i>Showing first 30 of {len(sensor_alerts)} sensor alerts.</i>", small_style))
    else:
        story.append(Paragraph("No sensor threshold alerts for this date.", body_style))

    story.append(Spacer(1, 8))

    # Process SOP alerts
    story.append(Paragraph("4.2 Process SOP Validation Alerts", subheading_style))
    if process_sop_alerts:
        sop_table_data = [
            [Paragraph("Time (UTC)", table_header_style),
             Paragraph("Severity", table_header_style),
             Paragraph("Message", table_header_style)],
        ]

        for alert in process_sop_alerts:
            ts = alert.get("detected_at")
            time_str = ""
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace('Z', '+00:00')) if isinstance(ts, str) else ts
                    time_str = dt.strftime('%H:%M:%S')
                except:
                    time_str = "N/A"

            severity = alert.get("severity", "info").upper()
            message = alert.get("message", "N/A")
            if len(message) > 80:
                message = message[:77] + "..."

            sop_table_data.append([
                Paragraph(time_str, table_cell_style),
                Paragraph(severity, table_cell_style),
                Paragraph(message, table_cell_left_style),
            ])

        sop_table = Table(sop_table_data, colWidths=[1.2*inch, 1*inch, 4.3*inch])
        sop_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), header_fg),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, border_color),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, row_alt_bg]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(sop_table)
    else:
        story.append(Paragraph("No process SOP validation alerts for this date.", body_style))

    story.append(Spacer(1, 12))

    # =========================================
    # SECTION 6: CONCLUSION
    # =========================================
    story.append(Paragraph("5. Conclusion", heading_style))

    total_alerts = len(sensor_alerts) + len(process_sop_alerts)
    critical_count = len([a for a in sensor_alerts if a.get("status") == "Active"]) + \
                     len([a for a in process_sop_alerts if a.get("severity") == "error"])
    resolved_count = len([a for a in sensor_alerts if a.get("status") == "Resolved"])

    if sensor_records:
        conclusion_text = (
            f"Production monitoring for {date} recorded {len(sensor_records)} sensor readings. "
            f"A total of {total_alerts} alerts were generated, "
            f"with {critical_count} requiring attention and {resolved_count} resolved. "
        )
        if temps and weights:
            conclusion_text += (
                f"Average temperature was {temp_avg:.1f}°C (threshold: {temp_min}–{temp_max}°C). "
                f"Average weight was {weight_avg:.1f} kg (threshold: {weight_min}–{weight_max}kg). "
            )
        if process_sop_alerts:
            magnesium_skipped = any("MAGNESIUM" in a.get("message", "").upper() or "SKIPPED" in a.get("message", "").upper()
                                    for a in process_sop_alerts if a.get("severity") == "error")
            if magnesium_skipped:
                conclusion_text += "<b>CRITICAL: Magnesium process step was skipped during production.</b> "
            else:
                conclusion_text += "Process SOP validation detected violations. Review alerts above. "
        else:
            conclusion_text += "No process SOP violations detected. "

        conclusion_text += "Continue monitoring for threshold compliance and SOP adherence."
    else:
        conclusion_text = (
            f"No sensor data was recorded for {date}. "
            "This may indicate monitoring was disabled or equipment was offline. "
            "Verify system operation and ensure monitoring is enabled for future production days."
        )

    story.append(Paragraph(conclusion_text, body_style))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))
    story.append(Paragraph(
        f"Report generated by {system_name} Automated Reporting System &nbsp;|&nbsp; "
        f"For internal use only &nbsp;|&nbsp; Confidential",
        small_style
    ))

    # Build PDF
    doc.build(story)

    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


# =========================================
# Get System Settings
# =========================================

@app.get("/api/settings")
def get_settings(
    authorization: str = Header(None)
):

    # -----------------------------------------
    # Check Authorization header
    # -----------------------------------------

    if not authorization:

        raise HTTPException(
            status_code=401,
            detail="Authorization token required."
        )


    if not authorization.startswith(
        "Bearer "
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format."
        )


    token = authorization.replace(
        "Bearer ",
        "",
        1
    ).strip()


    # -----------------------------------------
    # Verify user
    # -----------------------------------------

    verify_settings_token(
        token
    )


    # -----------------------------------------
    # Get settings
    # -----------------------------------------

    settings = get_current_settings()


    # -----------------------------------------
    # Remove MongoDB internal ID
    # -----------------------------------------

    settings.pop(
        "_id",
        None
    )


    return settings


# =========================================
# Update System Settings
# =========================================

@app.put("/api/settings")
def update_settings(
    data: SystemSettings
):

    # -----------------------------------------
    # Verify Administrator / Supervisor
    # -----------------------------------------

    user = verify_settings_token(
        data.session_token
    )


    # -----------------------------------------
    # Validate system name
    # -----------------------------------------

    if not data.system_name.strip():

        raise HTTPException(
            status_code=400,
            detail="System name cannot be empty."
        )


    # -----------------------------------------
    # Validate temperature range
    # -----------------------------------------

    if (
        data.min_temperature
        >=
        data.max_temperature
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Minimum temperature must be "
                "less than maximum temperature."
            )
        )


    # -----------------------------------------
    # Validate weight range
    # -----------------------------------------

    if (
        data.min_weight
        >=
        data.max_weight
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Minimum weight must be "
                "less than maximum weight."
            )
        )


    # -----------------------------------------
    # Validate refresh interval
    # -----------------------------------------

    if data.refresh_interval <= 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Refresh interval must be "
                "greater than 0."
            )
        )


    # -----------------------------------------
    # Prepare updated settings
    # -----------------------------------------

    now = datetime.now(timezone.utc)

    updated_settings = {

        "system_name":
            data.system_name.strip(),

        "min_temperature":
            data.min_temperature,

        "max_temperature":
            data.max_temperature,

        "min_weight":
            data.min_weight,

        "max_weight":
            data.max_weight,

        "refresh_interval":
            data.refresh_interval,

        "alert_email":
            (data.alert_email or "").strip(),

        "alert_phone":
            (data.alert_phone or "").strip(),

        "enable_email_alerts":
            bool(data.enable_email_alerts),

        "enable_sms_alerts":
            bool(data.enable_sms_alerts),

        "monitoring_enabled":
            bool(data.monitoring_enabled),

        "updated_by":
            user["username"],

        "updated_at":
            now
    }

    if data.monitoring_enabled:
        updated_settings["monitoring_started_at"] = now
        updated_settings["monitoring_stopped_at"] = None
    else:
        updated_settings["monitoring_stopped_at"] = now

    db["threshold_history"].insert_one({
        "min_temperature": data.min_temperature,
        "max_temperature": data.max_temperature,
        "min_weight": data.min_weight,
        "max_weight": data.max_weight,
        "refresh_interval": data.refresh_interval,
        "monitoring_enabled": bool(data.monitoring_enabled),
        "updated_by": user["username"],
        "timestamp": now,
    })

    db["system_settings"].update_one(

        {
            "_id": "default"
        },

        {
            "$set": updated_settings
        },

        upsert=True
    )


    # -----------------------------------------
    # Return saved settings
    # -----------------------------------------

    return {

        "message":
            "Settings updated successfully.",

        "system_name":
            data.system_name.strip(),

        "min_temperature":
            data.min_temperature,

        "max_temperature":
            data.max_temperature,

        "min_weight":
            data.min_weight,

        "max_weight":
            data.max_weight,

        "refresh_interval":
            data.refresh_interval,

        "monitoring_enabled":
            bool(data.monitoring_enabled),

        "updated_at": now,
    }


# =========================================
# Process Alert Email (Admin Only)
# =========================================

class ProcessAlertEmailUpdate(BaseModel):
    session_token: str
    process_alert_email: Optional[str] = ""


@app.put("/api/settings/process-alert-email")
def update_process_alert_email(data: ProcessAlertEmailUpdate):
    """Update the default email for process detection alerts (magnesium skip, etc.).
    Only Administrator can update this."""
    user = db["users"].find_one({
        "session_token": data.session_token,
        "status": "Active",
        "role": "Administrator"
    })
    if not user:
        raise HTTPException(
            status_code=403,
            detail="Only Administrator can update process alert email."
        )

    now = datetime.now(timezone.utc)
    email = (data.process_alert_email or "").strip()

    if email and "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format.")

    db["system_settings"].update_one(
        {"_id": "default"},
        {"$set": {"process_alert_email": email, "updated_by": user["username"], "updated_at": now}},
        upsert=True,
    )

    return {
        "message": "Process alert email updated successfully.",
        "process_alert_email": email,
        "updated_at": now,
    }


@app.put("/api/settings/monitoring")
def update_monitoring(data: MonitoringControl):
    user = verify_settings_token(data.session_token)
    current = get_current_settings()
    now = datetime.now(timezone.utc)

    interval = (
        data.refresh_interval
        if data.refresh_interval is not None
        else current.get("refresh_interval", 5)
    )

    if interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Refresh interval must be greater than 0.",
        )

    update_fields = {
        "monitoring_enabled": data.monitoring_enabled,
        "refresh_interval": interval,
        "updated_by": user["username"],
        "updated_at": now,
    }

    if data.monitoring_enabled:
        update_fields["monitoring_started_at"] = now
        update_fields["monitoring_stopped_at"] = None
    else:
        update_fields["monitoring_stopped_at"] = now

    db["system_settings"].update_one(
        {"_id": "default"},
        {"$set": update_fields},
        upsert=True,
    )

    db["threshold_history"].insert_one({
        "min_temperature": current["min_temperature"],
        "max_temperature": current["max_temperature"],
        "min_weight": current["min_weight"],
        "max_weight": current["max_weight"],
        "refresh_interval": interval,
        "monitoring_enabled": data.monitoring_enabled,
        "updated_by": user["username"],
        "timestamp": now,
        "change_type": "monitoring",
    })

    return {
        "message": (
            "Sensor monitoring started."
            if data.monitoring_enabled
            else "Sensor monitoring stopped."
        ),
        "monitoring_enabled": data.monitoring_enabled,
        "refresh_interval": interval,
        "updated_at": now,
    }


# =========================================
# AI PPE Detection
# =========================================

@app.post("/api/ai/detect")
async def ai_detect(
    file: UploadFile = File(...)
):

    # -----------------------------------------
    # Folder for uploaded files
    # -----------------------------------------

    upload_dir = "ai/uploads"

    os.makedirs(
        upload_dir,
        exist_ok=True
    )


    # -----------------------------------------
    # Save uploaded file
    # -----------------------------------------

    file_path = os.path.join(
        upload_dir,
        file.filename
    )


    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )


    # -----------------------------------------
    # Run YOLO PPE detection
    # -----------------------------------------

    detections, result_path = detect_ppe(
        file_path
    )


    # -----------------------------------------
    # Get result filename
    # -----------------------------------------

    result_filename = os.path.basename(
        result_path
    )


    # -----------------------------------------
    # Return detection results
    # -----------------------------------------

    return {

        "filename":
            file.filename,

        "detections":
            detections,

        "count":
            len(detections),

        "result_image":
            f"/api/ai/result/{result_filename}"
    }

# =========================================
# AI PPE Video Detection
# =========================================

@app.post("/api/ai/video-detect")
async def ai_video_detect(file: UploadFile = File(...)):

    # -----------------------------------------
    # Allowed video formats
    # -----------------------------------------

    allowed_extensions = {
        ".mp4",
        ".avi",
        ".mov",
        ".mkv",
        ".webm"
    }

    file_extension = os.path.splitext(
        file.filename
    )[1].lower()

    if file_extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported video format. "
                "Please upload MP4, AVI, MOV, MKV or WEBM."
            )
        )


    # -----------------------------------------
    # Upload folder
    # -----------------------------------------

    upload_dir = "ai/video_uploads"

    os.makedirs(
        upload_dir,
        exist_ok=True
    )


    # -----------------------------------------
    # Save uploaded video
    # -----------------------------------------

    file_path = os.path.join(
        upload_dir,
        file.filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )


    # -----------------------------------------
    # Run YOLO + ByteTrack
    # -----------------------------------------

    try:

        result = detect_ppe_video(
            file_path
        )

    except Exception as error:

        print(
            "Video detection error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="Video processing failed."
        )


    # -----------------------------------------
    # Result video filename
    # -----------------------------------------

    result_filename = os.path.basename(
        result["result_path"]
    )


    # -----------------------------------------
    # Return video analysis
    # -----------------------------------------

    return {

        "filename":
            file.filename,

        "result_video":
            f"/api/ai/video-result/{result_filename}",

        "frames_processed":
            result["frames_processed"],

        "total_frames":
            result["total_frames"],

        "fps":
            result["fps"],

        "duration_seconds":
            result["duration_seconds"],

        "detections":
            result["detections"]
    }

# =========================================
# AI Result Video
# =========================================

@app.get(
    "/api/ai/video-result/{filename}"
)
def get_ai_video_result(
    filename: str
):

    file_path = os.path.join(
        "ai/video_results",
        filename
    )


    if not os.path.exists(
        file_path
    ):

        raise HTTPException(
            status_code=404,
            detail="Result video not found."
        )


    return FileResponse(
        file_path,
        media_type="video/mp4"
    )

# =========================================
# AI Result Image
# =========================================

@app.get(
    "/api/ai/result/{filename}"
)
def get_ai_result(
    filename: str
):

    file_path = os.path.join(
        "ai/results",
        filename
    )


    if not os.path.exists(
        file_path
    ):

        raise HTTPException(
            status_code=404,
            detail="Result image not found."
        )


    return FileResponse(
        file_path,
        media_type="image/jpeg"
    )

# =========================================
# Process Detection Video Endpoints (Async)
# =========================================

import uuid
from concurrent.futures import ThreadPoolExecutor

# In-memory job store (replace with Redis for production/multi-worker)
_process_jobs = {}
_job_executor = ThreadPoolExecutor(max_workers=2)


def _run_process_detection(job_id: str, file_path: str, filename: str):
    """Background task to run process detection."""
    try:
        _process_jobs[job_id]["status"] = "processing"
        _process_jobs[job_id]["progress"] = 5

        result = detect_process_video(file_path)

        _process_jobs[job_id]["progress"] = 90

        # Save SOP alerts to MongoDB
        sop_alerts = result["sop_summary"].get("alerts", [])
        for alert in sop_alerts:
            db["alerts"].insert_one({
                "type":         "process_sop",
                "severity":     alert["severity"],
                "message":      alert["message"],
                "status":       "Active",
                "detected_at":  __import__("datetime").datetime.utcnow(),
                "source_file":  filename,
            })

        # Dispatch email alerts for process SOP violations (e.g., magnesium skipped)
        if sop_alerts:
            try:
                settings = get_current_settings()
                process_email = settings.get("process_alert_email", "").strip()
                if process_email:
                    # Build message from all SOP alerts
                    alert_messages = "\n".join([f"• {a['message']}" for a in sop_alerts])
                    ok, detail = send_email_alert(
                        to_email=process_email,
                        subject="VisionShield SOP Violation: Process Step Skipped",
                        message_body=(
                            "Process detection found SOP violations in the uploaded video.\n\n"
                            f"Video: {filename}\n\n"
                            f"Violations:\n{alert_messages}\n\n"
                            "Please review the process detection report for details."
                        ),
                        severity="CRITICAL"
                    )
                    if ok:
                        print(f"[Process Detection] Email alert sent to {process_email}")
                    else:
                        print(f"[Process Detection] Failed to send email alert: {detail}")
            except Exception as email_err:
                print(f"[Process Detection] Failed to send email alert: {email_err}")

        result_filename = os.path.basename(result["result_path"])

        _process_jobs[job_id].update({
            "status":           "done",
            "progress":         100,
            "result": {
                "filename":          filename,
                "result_video":      f"/api/process/video-result/{result_filename}",
                "frames_processed":  result["frames_processed"],
                "total_frames":      result["total_frames"],
                "fps":               result["fps"],
                "duration_seconds":  result["duration_seconds"],
                "detection_counts":  result["detection_counts"],
                "sop_summary":       result["sop_summary"],
            }
        })

    except Exception as err:
        print(f"Process detection error for job {job_id}:", err)
        _process_jobs[job_id].update({
            "status":   "error",
            "error":    str(err),
            "progress": 100,
        })


@app.post("/api/process/video-detect")
async def process_video_detect(file: UploadFile = File(...)):

    allowed = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Use MP4, AVI, MOV, MKV or WEBM."
        )

    upload_dir = "ai/process_uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    # Create job
    job_id = str(uuid.uuid4())
    _process_jobs[job_id] = {
        "job_id":     job_id,
        "filename":   file.filename,
        "status":     "queued",
        "progress":   0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "result":     None,
        "error":      None,
    }

    # Start background processing
    _job_executor.submit(_run_process_detection, job_id, file_path, file.filename)

    return {
        "job_id":   job_id,
        "status":   "queued",
        "message":  "Video uploaded. Processing started in background."
    }


@app.get("/api/process/status/{job_id}")
def get_process_status(job_id: str):
    job = _process_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    # Return safe subset
    return {
        "job_id":     job["job_id"],
        "filename":   job["filename"],
        "status":     job["status"],
        "progress":   job["progress"],
        "created_at": job["created_at"],
        "error":      job.get("error"),
    }


@app.get("/api/process/result/{job_id}")
def get_process_result(job_id: str):
    job = _process_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail=f"Job not ready. Status: {job['status']}")
    return job["result"]


@app.get("/api/process/video-result/{filename}")
def get_process_video_result(filename: str):
    file_path = os.path.join("ai/video_results", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Result video not found.")
    return FileResponse(file_path, media_type="video/mp4")


@app.get("/api/process/jobs")
def list_process_jobs():
    """List all jobs (for debugging/recovery)."""
    return {
        "jobs": [
            {
                "job_id":     j["job_id"],
                "filename":   j["filename"],
                "status":     j["status"],
                "progress":   j["progress"],
                "created_at": j["created_at"],
            }
            for j in _process_jobs.values()
        ]
    }



@app.get("/api/process/download-report/{job_id}")
def download_process_report(job_id: str):
    """Download JSON report for a completed process detection job."""
    job = _process_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail=f"Job not ready. Status: {job['status']}")
    
    result = job["result"]
    if not result:
        raise HTTPException(status_code=404, detail="No result available for this job.")
    
    # Build comprehensive report
    report = {
        "job_id": job["job_id"],
        "filename": job["filename"],
        "processed_at": job["created_at"],
        "video_info": {
            "frames_processed": result.get("frames_processed", 0),
            "total_frames": result.get("total_frames", 0),
            "fps": result.get("fps", 0),
            "duration_seconds": result.get("duration_seconds", 0),
        },
        "detection_counts": result.get("detection_counts", {}),
        "sop_summary": result.get("sop_summary", {}),
        "result_video_url": result.get("result_video", ""),
    }
    
    import json
    from fastapi.responses import Response

    return Response(
        content=json.dumps(report, indent=2, default=str),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="process_report_{job["filename"]}_{job["job_id"][:8]}.json"'
        }
    )


@app.post("/api/process/cancel/{job_id}")
def cancel_process_job(job_id: str):
    """Cancel a running or queued process detection job."""
    job = _process_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] in ["done", "error", "cancelled"]:
        return {
            "message": f"Job already in final state: {job['status']}",
            "job_id": job_id,
            "status": job["status"]
        }

    # Mark as cancelled
    job["status"] = "cancelled"
    job["error"] = "Cancelled by user"
    job["progress"] = 100

    return {
        "message": "Job cancelled successfully",
        "job_id": job_id,
        "status": "cancelled"
    }


# =========================================
# Test Notification Endpoint
# =========================================

class TestNotificationRequest(BaseModel):
    session_token: str
    target_type: str # 'email' or 'sms'
    destination: str

@app.post("/api/test-notification")
def test_notification(req: TestNotificationRequest):
    verify_settings_token(req.session_token)

    if req.target_type == "email":
        ok, detail = send_email_alert(
            to_email=req.destination,
            subject="VisionShield Test Notification",
            message_body="This is a test notification from your VisionShield System. Your email alert configuration is functioning properly!",
            severity="INFO"
        )
        return {"success": ok, "detail": detail}
    elif req.target_type == "sms":
        ok, detail = send_sms_alert(
            to_phone=req.destination,
            message_body="Test alert from VisionShield. Mobile SMS notification is functioning properly!",
            severity="INFO"
        )
        return {"success": ok, "detail": detail}
    else:
        raise HTTPException(status_code=400, detail="Invalid target_type. Must be 'email' or 'sms'.")


# =========================================
# Maintenance Management Endpoints
# =========================================

@app.post("/api/maintenance")
def create_maintenance_record(data: MaintenanceCreateRequest):
    """Create a new maintenance record. Requires Administrator or Supervisor role."""
    user = verify_maintenance_permission(data.admin_token)

    # Validate dates
    if data.next_due_date <= data.last_maintenance_date:
        raise HTTPException(
            status_code=400,
            detail="Next due date must be after last maintenance date."
        )

    # Calculate initial status
    status = calculate_status(data.next_due_date)

    now = datetime.now(timezone.utc)

    maintenance_record = {
        "equipment_name": data.equipment_name.strip(),
        "equipment_id": data.equipment_id.strip(),
        "description": data.description.strip(),
        "last_maintenance_date": data.last_maintenance_date,
        "next_due_date": data.next_due_date,
        "status": status,
        "remarks": data.remarks.strip() if data.remarks else "",
        "completion_date": None,
        "created_by": user["username"],
        "created_at": now,
        "updated_by": user["username"],
        "updated_at": now,
    }

    result = db["maintenance_records"].insert_one(maintenance_record)

    # Prepare response with serialized datetime fields
    response_data = {
        "message": "Maintenance record created successfully.",
        "id": str(result.inserted_id),
        "equipment_name": maintenance_record["equipment_name"],
        "equipment_id": maintenance_record["equipment_id"],
        "description": maintenance_record["description"],
        "last_maintenance_date": maintenance_record["last_maintenance_date"].isoformat() if maintenance_record["last_maintenance_date"] else None,
        "next_due_date": maintenance_record["next_due_date"].isoformat() if maintenance_record["next_due_date"] else None,
        "status": maintenance_record["status"],
        "remarks": maintenance_record["remarks"],
        "completion_date": maintenance_record["completion_date"],
        "created_by": maintenance_record["created_by"],
        "created_at": maintenance_record["created_at"].isoformat() if maintenance_record["created_at"] else None,
        "updated_by": maintenance_record["updated_by"],
        "updated_at": maintenance_record["updated_at"].isoformat() if maintenance_record["updated_at"] else None,
    }

    return response_data


@app.get("/api/maintenance")
def get_maintenance_records(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    status_filter: str = None
):
    """List maintenance records with pagination, search, and status filter."""
    # Build query conditions
    query_conditions = []

    # Search filter
    if search:
        or_conditions = [
            {"equipment_name": {"$regex": search, "$options": "i"}},
            {"equipment_id": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"remarks": {"$regex": search, "$options": "i"}},
        ]
        query_conditions.append({"$or": or_conditions})

    # Status filter
    if status_filter and status_filter != "All":
        query_conditions.append({"status": status_filter})

    # Build final query
    if query_conditions:
        final_query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]
    else:
        final_query = {}

    # Pagination
    skip = (page - 1) * limit

    # Get total count
    total_records = db["maintenance_records"].count_documents(final_query)
    total_pages = (total_records + limit - 1) // limit

    # Get paginated records
    records = list(
        db["maintenance_records"]
        .find(final_query)
        .sort("next_due_date", 1)  # Sort by next due date ascending
        .skip(skip)
        .limit(limit)
    )

    # Format records
    for record in records:
        record["_id"] = str(record["_id"])
        # Convert datetime fields to ISO format
        for field in ["last_maintenance_date", "next_due_date", "completion_date", "created_at", "updated_at"]:
            if record.get(field):
                dt = record[field]
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                record[field] = dt.isoformat()

    return {
        "records": records,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_records": total_records,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@app.get("/api/maintenance/stats/summary")
def get_maintenance_stats():
    """Get maintenance summary statistics from all records."""
    # Get all records (no pagination) to calculate accurate stats
    records = list(db["maintenance_records"].find({}))

    total = len(records)
    upcoming = 0
    overdue = 0

    now = datetime.now(timezone.utc)

    for record in records:
        status = record.get("status", "")
        if status == "Overdue":
            overdue += 1
        elif status == "Due Soon":
            upcoming += 1
        elif status == "Scheduled":
            # Recalculate status based on next_due_date for accuracy
            next_due = record.get("next_due_date")
            if next_due:
                if next_due.tzinfo is None:
                    next_due = next_due.replace(tzinfo=timezone.utc)
                days_diff = (next_due - now).days
                if days_diff < 0:
                    overdue += 1
                elif days_diff <= 7:
                    upcoming += 1

    return {
        "total": total,
        "upcoming": upcoming,
        "overdue": overdue
    }


@app.get("/api/maintenance/{maintenance_id}")
def get_maintenance_record(maintenance_id: str):
    """Get a single maintenance record by ID."""
    try:
        obj_id = ObjectId(maintenance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid maintenance record ID.")

    record = db["maintenance_records"].find_one({"_id": obj_id})

    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    record["_id"] = str(record["_id"])
    for field in ["last_maintenance_date", "next_due_date", "completion_date", "created_at", "updated_at"]:
        if record.get(field):
            dt = record[field]
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            record[field] = dt.isoformat()

    return record


@app.put("/api/maintenance/{maintenance_id}")
def update_maintenance_record(maintenance_id: str, data: MaintenanceUpdateRequest):
    """Update a maintenance record. Requires Administrator or Supervisor role."""
    user = verify_maintenance_permission(data.admin_token)

    try:
        obj_id = ObjectId(maintenance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid maintenance record ID.")

    record = db["maintenance_records"].find_one({"_id": obj_id})
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    # Build update data
    update_data = {"updated_by": user["username"], "updated_at": datetime.now(timezone.utc)}

    if data.equipment_name is not None:
        update_data["equipment_name"] = data.equipment_name.strip()
    if data.equipment_id is not None:
        update_data["equipment_id"] = data.equipment_id.strip()
    if data.description is not None:
        update_data["description"] = data.description.strip()
    if data.last_maintenance_date is not None:
        update_data["last_maintenance_date"] = data.last_maintenance_date
    if data.next_due_date is not None:
        update_data["next_due_date"] = data.next_due_date
    if data.remarks is not None:
        update_data["remarks"] = data.remarks.strip()

    # Validate dates if both provided
    last_date = update_data.get("last_maintenance_date", record["last_maintenance_date"])
    next_date = update_data.get("next_due_date", record["next_due_date"])
    if next_date <= last_date:
        raise HTTPException(
            status_code=400,
            detail="Next due date must be after last maintenance date."
        )

    # Recalculate status if next_due_date changed and not completed
    if "next_due_date" in update_data and record.get("status") != "Completed":
        update_data["status"] = calculate_status(update_data["next_due_date"])

    db["maintenance_records"].update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )

    # Return updated record
    updated = db["maintenance_records"].find_one({"_id": obj_id})
    updated["_id"] = str(updated["_id"])
    for field in ["last_maintenance_date", "next_due_date", "completion_date", "created_at", "updated_at"]:
        if updated.get(field):
            dt = updated[field]
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            updated[field] = dt.isoformat()

    return {
        "message": "Maintenance record updated successfully.",
        **updated
    }


@app.put("/api/maintenance/{maintenance_id}/complete")
def complete_maintenance_record(maintenance_id: str, data: MaintenanceCompleteRequest):
    """Mark a maintenance record as completed and optionally schedule next maintenance. Requires Administrator or Supervisor role."""
    user = verify_maintenance_permission(data.admin_token)

    try:
        obj_id = ObjectId(maintenance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid maintenance record ID.")

    record = db["maintenance_records"].find_one({"_id": obj_id})
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    if record.get("status") == "Completed":
        raise HTTPException(status_code=400, detail="Maintenance record is already completed.")

    now = datetime.now(timezone.utc)
    completion_date = data.completion_date
    if completion_date.tzinfo is None:
        completion_date = completion_date.replace(tzinfo=timezone.utc)

    update_data = {
        "status": "Completed",
        "completion_date": completion_date,
        "updated_by": user["username"],
        "updated_at": now,
    }

    if data.remarks is not None:
        update_data["remarks"] = data.remarks.strip()

    # If next_due_date provided, update last_maintenance_date and next_due_date, and set status to Scheduled/Due Soon
    if data.next_due_date:
        next_due = data.next_due_date
        if next_due.tzinfo is None:
            next_due = next_due.replace(tzinfo=timezone.utc)

        if next_due <= completion_date:
            raise HTTPException(
                status_code=400,
                detail="Next due date must be after completion date."
            )

        update_data["last_maintenance_date"] = completion_date
        update_data["next_due_date"] = next_due
        update_data["status"] = calculate_status(next_due)

    db["maintenance_records"].update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )

    # Return updated record
    updated = db["maintenance_records"].find_one({"_id": obj_id})
    updated["_id"] = str(updated["_id"])
    for field in ["last_maintenance_date", "next_due_date", "completion_date", "created_at", "updated_at"]:
        if updated.get(field):
            dt = updated[field]
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            updated[field] = dt.isoformat()

    return {
        "message": "Maintenance marked as completed successfully.",
        **updated
    }


@app.delete("/api/maintenance/{maintenance_id}")
def delete_maintenance_record(maintenance_id: str, data: MaintenanceDeleteRequest):
    """Delete a maintenance record. Requires Administrator or Supervisor role."""
    user = verify_maintenance_permission(data.admin_token)

    try:
        obj_id = ObjectId(maintenance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid maintenance record ID.")

    result = db["maintenance_records"].delete_one({"_id": obj_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance record not found.")

    return {
        "message": "Maintenance record deleted successfully.",
        "deleted_by": user["username"]
    }
