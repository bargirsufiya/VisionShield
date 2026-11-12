import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

# =========================================================
# 1. 100% FREE EMAIL ALERT (SMTP - Gmail / Outlook)
# =========================================================

def send_email_alert(to_email: str, subject: str, message_body: str, severity: str = "CRITICAL"):
    """
    Sends an HTML formatted email alert using Gmail/Outlook SMTP.
    Requires:
      ALERT_SENDER_EMAIL in .env
      ALERT_SENDER_PASSWORD (16-char Gmail App Password) in .env
    """
    if not to_email or not to_email.strip():
        return False, "Recipient email is empty."

    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    sender_email = os.getenv("SMTP_EMAIL") or os.getenv("ALERT_SENDER_EMAIL")
    sender_password = os.getenv("SMTP_PASSWORD") or os.getenv("ALERT_SENDER_PASSWORD")

    if not sender_email or not sender_password or "your_" in sender_email or "your_" in sender_password:
        msg = "Email alert credentials missing in backend/.env. Please add ALERT_SENDER_EMAIL and ALERT_SENDER_PASSWORD."
        print(f"[Notifier Email] {msg}")
        return False, msg

    try:
        msg = MIMEMultipart()
        msg["From"] = f"VisionShield Alert System <{sender_email}>"
        msg["To"] = to_email.strip()
        msg["Subject"] = f"[{severity.upper()}] VisionShield Alert: {subject}"

        color = "#ef4444" if severity.upper() == "CRITICAL" else "#f59e0b"
        time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        html = f"""
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 24px; background-color: #0b132b; font-family: Arial, sans-serif; color: #ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #1c2541; border-radius: 10px; overflow: hidden; border: 1px solid #3a506b;">
            <tr>
              <td style="background-color: {color}; padding: 16px 20px;">
                <h2 style="margin: 0; color: #ffffff; font-size: 18px;">VISIONSHIELD SAFETY ALERT</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px;">
                <div style="background-color: #0b132b; border-left: 4px solid {color}; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
                  <strong style="color: {color}; font-size: 13px; text-transform: uppercase;">{severity} INCIDENT</strong>
                  <div style="color: #ffffff; font-size: 16px; font-weight: bold; margin-top: 4px;">{subject}</div>
                </div>

                <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5;">{message_body}</p>

                <div style="font-size: 12px; color: #94a3b8; border-top: 1px solid #3a506b; padding-top: 10px; margin-top: 20px;">
                  Timestamp: {time_str} | VisionShield Automated Process Guard
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        clean_pwd = sender_password.strip()

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=12) as server:
                server.login(sender_email.strip(), clean_pwd)
                server.sendmail(sender_email.strip(), to_email.strip(), msg.as_string())
        else:
            with smtplib.SMTP(smtp_server, smtp_port, timeout=12) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(sender_email.strip(), clean_pwd)
                server.sendmail(sender_email.strip(), to_email.strip(), msg.as_string())

        print(f"[Notifier] Email successfully sent to {to_email}")
        return True, f"Email sent successfully to {to_email}"
    except Exception as e:
        error_msg = f"Failed to send email: {str(e)}"
        print(f"[Notifier] {error_msg}")
        return False, error_msg


# =========================================================
# 2. 100% FREE TELEGRAM BOT PUSH ALERT TO MOBILE
# =========================================================

def send_telegram_alert(message_body: str, severity: str = "CRITICAL", chat_id: str = None):
    """
    Sends an instant push notification directly to the supervisor's phone via Telegram.
    100% free with no trial limits or credit card needed.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    target_chat = chat_id or os.getenv("TELEGRAM_CHAT_ID")

    if not bot_token or not target_chat or "your_" in bot_token:
        return False, "Telegram Bot Token or Chat ID not configured in backend/.env"

    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        text = f"[{severity.upper()}] VisionShield Alert:\n\n{message_body}\n\nTime: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
        payload = {
            "chat_id": target_chat,
            "text": text,
        }
        res = requests.post(url, json=payload, timeout=8)
        data = res.json()
        if data.get("ok"):
            print(f"[Notifier Telegram] Push alert delivered to {target_chat}")
            return True, "Telegram alert sent to mobile."
        return False, f"Telegram API error: {data.get('description', 'Unknown error')}"
    except Exception as e:
        return False, f"Telegram connection error: {str(e)}"


# =========================================================
# 3. FREE INDIAN MOBILE SMS (FAST2SMS)
# =========================================================

def send_fast2sms_alert(to_phone: str, message_body: str):
    """
    Sends direct SMS to Indian mobile numbers (+91) using Fast2SMS API.
    Fast2SMS provides free initial wallet credits on signup without credit card.
    """
    api_key = os.getenv("FAST2SMS_API_KEY")
    if not api_key or "your_" in api_key:
        return False, "FAST2SMS_API_KEY not configured in backend/.env"

    clean_number = "".join(filter(str.isdigit, to_phone))
    if clean_number.startswith("91") and len(clean_number) == 12:
        clean_number = clean_number[2:]

    if len(clean_number) != 10:
        return False, f"Invalid Indian phone number: {to_phone}. Must be 10 digits."

    try:
        res = requests.post(
            "https://www.fast2sms.com/dev/bulkV2",
            headers={
                "authorization": api_key.strip(),
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={
                "message": f"VisionShield Alert: {message_body}"[:140],
                "language": "english",
                "route": "q",
                "numbers": clean_number
            },
            timeout=10
        )
        data = res.json()
        if data.get("return"):
            print(f"[Fast2SMS] Delivered to {clean_number}")
            return True, f"SMS delivered via Fast2SMS to {clean_number}"
        return False, f"Fast2SMS error: {data.get('message', ['Unknown error'])[0] if isinstance(data.get('message'), list) else data.get('message')}"
    except Exception as e:
        return False, f"Fast2SMS request failed: {str(e)}"


# =========================================================
# 4. TWILIO SMS (FALLBACK)
# =========================================================

def send_twilio_sms(to_phone: str, message_body: str, severity: str = "CRITICAL"):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_PHONE_NUMBER")

    if not account_sid or not auth_token or not from_phone or "your_" in account_sid:
        return False, "Twilio credentials not configured in backend/.env."

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        sms_text = f"[{severity}] VisionShield Alert: {message_body}"[:160]
        message = client.messages.create(
            body=sms_text,
            from_=from_phone,
            to=to_phone.strip()
        )
        return True, f"Twilio SMS sent (SID: {message.sid})"
    except Exception as e:
        return False, f"Twilio error: {str(e)}"


# =========================================================
# ROUTER: DISPATCH SMS (Tries Fast2SMS -> Twilio)
# =========================================================

def send_sms_alert(to_phone: str, message_body: str, severity: str = "CRITICAL"):
    """
    Intelligently routes SMS:
    1. If FAST2SMS_API_KEY is present in .env -> uses Fast2SMS (Free for India)
    2. Else if TWILIO_ACCOUNT_SID is present in .env -> uses Twilio
    3. Else returns descriptive instructions on how to enable either for free.
    """
    if not to_phone or not to_phone.strip():
        return False, "Recipient phone number is empty."

    fast2sms_key = os.getenv("FAST2SMS_API_KEY")
    if fast2sms_key and "your_" not in fast2sms_key:
        return send_fast2sms_alert(to_phone, message_body)

    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    if twilio_sid and "your_" not in twilio_sid:
        return send_twilio_sms(to_phone, message_body, severity)

    return False, (
        "No SMS provider configured in backend/.env. "
        "Option A: Set FAST2SMS_API_KEY for free SMS to Indian numbers (fast2sms.com). "
        "Option B: Use free Email alerts (works out-of-the-box with Gmail App Password)."
    )


# =========================================================
# DISPATCHER
# =========================================================

def dispatch_alerts_from_settings(settings: dict, subject: str, message_body: str, severity: str = "CRITICAL"):
    results = {}

    if settings.get("enable_email_alerts") and settings.get("alert_email"):
        ok, res = send_email_alert(
            to_email=settings["alert_email"],
            subject=subject,
            message_body=message_body,
            severity=severity
        )
        results["email"] = {"success": ok, "detail": res}

    if settings.get("enable_sms_alerts") and settings.get("alert_phone"):
        ok, res = send_sms_alert(
            to_phone=settings["alert_phone"],
            message_body=f"{subject}: {message_body}",
            severity=severity
        )
        results["sms"] = {"success": ok, "detail": res}

    telegram_chat = os.getenv("TELEGRAM_CHAT_ID")
    if telegram_chat and "your_" not in telegram_chat:
        ok, res = send_telegram_alert(
            message_body=f"*{subject}*\n{message_body}",
            severity=severity
        )
        results["telegram"] = {"success": ok, "detail": res}

    return results
