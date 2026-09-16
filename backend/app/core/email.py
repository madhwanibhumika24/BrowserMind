"""Sends plain-text emails via Gmail SMTP - used for the forgot-password
flow. Deliberately simple (no templating library, no background job queue):
this project only ever sends one kind of email, so a single function is
enough.

Setup (one-time, in the Google Account that will send the emails):
  1. Turn on 2-Step Verification (required for app passwords).
  2. Go to https://myaccount.google.com/apppasswords and generate an app
     password for "Mail".
  3. Put that account's address in SMTP_EMAIL and the 16-character app
     password (no spaces) in SMTP_APP_PASSWORD in backend/.env.
"""
import smtplib
from email.mime.text import MIMEText

from app.core.config import settings

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


class EmailNotConfiguredError(Exception):
    """Raised when SMTP_EMAIL/SMTP_APP_PASSWORD aren't set in .env yet."""


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.smtp_email or not settings.smtp_app_password:
        raise EmailNotConfiguredError(
            "Email isn't configured yet - set SMTP_EMAIL and SMTP_APP_PASSWORD "
            "in backend/.env (see app/core/email.py for setup steps)."
        )

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = settings.smtp_email
    message["To"] = to

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(settings.smtp_email, settings.smtp_app_password)
        server.sendmail(settings.smtp_email, [to], message.as_string())


def send_password_reset_code(to: str, code: str) -> None:
    send_email(
        to=to,
        subject="Your BrowserMind password reset code",
        body=(
            f"Your password reset code is: {code}\n\n"
            "This code expires in 10 minutes. If you didn't request a "
            "password reset, you can safely ignore this email."
        ),
    )
