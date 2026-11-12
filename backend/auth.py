from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import db
from pwdlib import PasswordHash
import secrets


router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hash = PasswordHash.recommended()


# -----------------------------
# Request models
# -----------------------------

class AdminSetup(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


# -----------------------------
# First-time Administrator Setup
# -----------------------------

@router.post("/setup")
def setup_admin(data: AdminSetup):

    existing_admin = db["users"].find_one({
        "role": "Administrator"
    })

    if existing_admin:
        raise HTTPException(
            status_code=403,
            detail="Administrator account already exists."
        )

    existing_username = db["users"].find_one({
        "username": data.username
    })

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already exists."
        )

    hashed_password = password_hash.hash(data.password)

    admin_user = {
        "username": data.username,
        "password_hash": hashed_password,
        "role": "Administrator",
        "status": "Active"
    }

    db["users"].insert_one(admin_user)

    return {
        "message": "Administrator account created successfully.",
        "username": data.username,
        "role": "Administrator"
    }


# -----------------------------
# Login
# -----------------------------

@router.post("/login")
def login(data: LoginRequest):

    user = db["users"].find_one({
        "username": data.username
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password."
        )

    if user.get("status") != "Active":
        raise HTTPException(
            status_code=403,
            detail="This account is inactive."
        )

    if not password_hash.verify(
        data.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password."
        )

    # Generate a secure session token
    session_token = secrets.token_urlsafe(32)

    # Store the token for this user
    db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"session_token": session_token}}
    )

    return {
        "message": "Login successful",
        "username": user["username"],
        "role": user["role"],
        "session_token": session_token
    }

# -----------------------------
# Administrator authentication
# -----------------------------

def verify_admin_token(token: str):

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
# -----------------------------
# Create Supervisor / Operator
# -----------------------------

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str


@router.post("/users")
def create_user(data: CreateUserRequest, admin_token: str):

    # Verify Administrator
    verify_admin_token(admin_token)

    # Only Supervisor and Operator accounts can be created here
    if data.role not in ["Supervisor", "Operator"]:
        raise HTTPException(
            status_code=400,
            detail="Role must be Supervisor or Operator."
        )

    # Check whether username already exists
    existing_user = db["users"].find_one({
        "username": data.username
    })

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists."
        )

    # Hash password
    hashed_password = password_hash.hash(data.password)

    new_user = {
        "username": data.username,
        "password_hash": hashed_password,
        "role": data.role,
        "status": "Active"
    }

    db["users"].insert_one(new_user)

    return {
        "message": f"{data.role} account created successfully.",
        "username": data.username,
        "role": data.role,
        "status": "Active"
    }


# -----------------------------
# Get all users
# -----------------------------

class GetUsersRequest(BaseModel):
    admin_token: str
    page: int = 1
    limit: int = 10


@router.get("/users")
def get_users(admin_token: str, page: int = 1, limit: int = 10):

    # Verify Administrator
    verify_admin_token(admin_token)

    # Calculate skip value for pagination
    skip = (page - 1) * limit

    # Get total count for pagination metadata
    total_users = db["users"].count_documents({})

    # Calculate total pages
    total_pages = (total_users + limit - 1) // limit  # Ceiling division

    # Get paginated users
    users = list(
        db["users"].find(
            {},
            {
                "_id": 0,
                "username": 1,
                "role": 1,
                "status": 1
            }
        )
        .skip(skip)
        .limit(limit)
    )

    # Return users with pagination metadata
    return {
        "users": users,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_users": total_users,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }
    # Hash password
    hashed_password = password_hash.hash(data.password)

    new_user = {
        "username": data.username,
        "password_hash": hashed_password,
        "role": data.role,
        "status": "Active"
    }

    db["users"].insert_one(new_user)

    return {
        "message": f"{data.role} account created successfully.",
        "username": data.username,
        "role": data.role,
        "status": "Active"
    }

# -----------------------------
# Manage User - Update Role
# -----------------------------

class UpdateUserRoleRequest(BaseModel):
    username: str
    role: str


@router.put("/users/role")
def update_user_role(
    data: UpdateUserRoleRequest,
    admin_token: str
):

    # Verify Administrator
    verify_admin_token(admin_token)

    # Only Supervisor and Operator roles can be assigned
    if data.role not in ["Supervisor", "Operator"]:
        raise HTTPException(
            status_code=400,
            detail="Role must be Supervisor or Operator."
        )

    # Find user
    user = db["users"].find_one({
        "username": data.username
    })

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Administrator cannot be changed through this endpoint
    if user.get("role") == "Administrator":
        raise HTTPException(
            status_code=403,
            detail="Administrator account cannot be modified here."
        )

    db["users"].update_one(
        {"username": data.username},
        {"$set": {"role": data.role}}
    )

    return {
        "message": "User role updated successfully.",
        "username": data.username,
        "role": data.role
    }


# -----------------------------
# Manage User - Activate / Deactivate
# -----------------------------

class UpdateUserStatusRequest(BaseModel):
    username: str
    status: str


@router.put("/users/status")
def update_user_status(
    data: UpdateUserStatusRequest,
    admin_token: str
):

    # Verify Administrator
    verify_admin_token(admin_token)

    if data.status not in ["Active", "Inactive"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be Active or Inactive."
        )

    # Find user
    user = db["users"].find_one({
        "username": data.username
    })

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Administrator cannot be deactivated
    if user.get("role") == "Administrator":
        raise HTTPException(
            status_code=403,
            detail="Administrator account cannot be deactivated."
        )

    db["users"].update_one(
        {"username": data.username},
        {"$set": {"status": data.status}}
    )

    return {
        "message": f"User {data.status.lower()} successfully.",
        "username": data.username,
        "status": data.status
    }


# -----------------------------
# Manage User - Reset Password
# -----------------------------

class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str


@router.put("/users/password")
def reset_user_password(
    data: ResetPasswordRequest,
    admin_token: str
):

    # Verify Administrator
    verify_admin_token(admin_token)

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters."
        )

    # Find user
    user = db["users"].find_one({
        "username": data.username
    })

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Administrator password cannot be reset here
    if user.get("role") == "Administrator":
        raise HTTPException(
            status_code=403,
            detail="Administrator password cannot be reset here."
        )

    hashed_password = password_hash.hash(data.new_password)

    db["users"].update_one(
        {"username": data.username},
        {
            "$set": {
                "password_hash": hashed_password,
                "session_token": None
            }
        }
    )

    return {
        "message": "Password reset successfully.",
        "username": data.username
    }