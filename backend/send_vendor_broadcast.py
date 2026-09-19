import os
import sys
import time
import json
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import httpx
import database
import models

SENDER_EMAIL = os.getenv("SMTP_EMAIL", "").strip()
SENDER_PASS = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()

SENT_LOG_FILE = "sent_vendors.json"

def load_sent_emails():
    if os.path.exists(SENT_LOG_FILE):
        try:
            with open(SENT_LOG_FILE, "r") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def record_sent_email(email):
    sent = load_sent_emails()
    sent.add(email.strip().lower())
    with open(SENT_LOG_FILE, "w") as f:
        json.dump(list(sent), f, indent=2)

def build_email_content(display_name: str):
    subject = "Action Required: Complete Your CampusLink Vendor Verification"

    text_body = f"""Hi {display_name},

This is Testimony from the Campus Link Team.

You registered as a vendor on Campus Link, but your account is still awaiting verification. Kindly complete the verification process to gain access to your personal store and start showcasing your products or services.

If you need help with the process or have any questions, kindly reach out to me on 07045230675. I’ll be happy to guide you through it.

Thank you!
Campus Link Team
https://campus-link.com.ng
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:30px 15px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
        
        <!-- Header with Brand Logo -->
        <tr>
          <td style="background:linear-gradient(135deg,#0284c7,#0369a1);padding:30px 24px;text-align:center;">
            <img src="https://campus-link.com.ng/pwa-512x512.png" alt="CampusLink" width="68" height="68" style="display:block;margin:0 auto 12px auto;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.18);background:#ffffff;padding:4px;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">CAMPUS<span style="color:#7dd3fc;">LINK</span></h1>
            <p style="color:#e0f2fe;margin:6px 0 0 0;font-size:13px;font-weight:500;">Campus Ecosystem &amp; Merchant Community</p>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding:32px 28px;color:#334155;font-size:15px;line-height:1.7;">
            <p style="margin-top:0;font-size:17px;color:#0f172a;font-weight:700;">Hi {display_name},</p>
            
            <p style="margin-bottom:16px;">
              This is Testimony from the <strong>Campus Link Team</strong>.
            </p>
            
            <p style="margin-bottom:16px;">
              You registered as a vendor on <strong>Campus Link</strong>, but your account is still awaiting verification. Kindly complete the verification process to gain access to your personal store and start showcasing your products or services.
            </p>
            
            <!-- Call to Action Button -->
            <div style="text-align:center;margin:28px 0;">
              <a href="https://campus-link.com.ng/login" style="background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;display:inline-block;box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                Complete Verification Now &rarr;
              </a>
            </div>

            <!-- Support / Contact Box -->
            <div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:16px 18px;border-radius:10px;margin:24px 0;">
              <p style="margin:0;color:#0369a1;font-size:14px;line-height:1.6;">
                <strong>Need help?</strong> If you need help with the process or have any questions, kindly reach out to me on <a href="tel:07045230675" style="color:#0284c7;font-weight:700;text-decoration:none;">07045230675</a>. I&rsquo;ll be happy to guide you through it.
              </p>
            </div>

            <!-- Campus Vendor Visual Image Banner -->
            <div style="margin:24px 0 20px 0;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
              <img src="https://campus-link.com.ng/campus_vendor.jpg" alt="CampusLink Marketplace" style="width:100%;height:auto;display:block;max-height:220px;object-fit:cover;">
            </div>

            <p style="margin-bottom:0;">
              Thank you!<br>
              <strong>Campus Link Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:22px 24px;text-align:center;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
            <p style="margin:0 0 6px 0;font-weight:600;color:#64748b;">CampusLink &bull; University Marketplace &amp; Student Ecosystem</p>
            <p style="margin:0;">Support Direct Line: 07045230675 &bull; <a href="https://campus-link.com.ng" style="color:#0284c7;text-decoration:none;">campus-link.com.ng</a></p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""
    return subject, text_body, html_body

def send_via_smtp(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    clean_to = to_email.strip().lower()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"CampusLink <{SENDER_EMAIL}>"
    msg["To"] = clean_to
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        ssl_ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, 465, context=ssl_ctx, timeout=12) as server:
            server.login(SENDER_EMAIL, SENDER_PASS)
            server.sendmail(SENDER_EMAIL, clean_to, msg.as_string())
            return True
    except Exception as e:
        print(f"  [SMTP Error: {e}]", end=" ")
        # Fallback to STARTTLS 587
        try:
            ssl_ctx = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, 587, timeout=12) as server:
                server.ehlo()
                server.starttls(context=ssl_ctx)
                server.ehlo()
                server.login(SENDER_EMAIL, SENDER_PASS)
                server.sendmail(SENDER_EMAIL, clean_to, msg.as_string())
                return True
        except Exception as e2:
            print(f"  [STARTTLS Error: {e2}]", end=" ")
            return False

def main():
    print("[DISPATCH] Starting personalized outreach via Gmail SMTP...")
    sent_already = load_sent_emails()
    print(f"[DISPATCH] Previously sent emails count: {len(sent_already)}")

    db = database.SessionLocal()
    try:
        vendors = (
            db.query(models.Vendor)
            .filter(models.Vendor.verification_status != "verified")
            .all()
        )

        valid_recipients = []
        for v in vendors:
            em = (v.email or "").strip().lower()
            if em and "@" in em:
                if not any(r["email"] == em for r in valid_recipients):
                    valid_recipients.append({
                        "email": em,
                        "business_name": (v.business_name or "").strip(),
                        "vendor_name": (getattr(v, "full_name", "") or "").strip()
                    })

        total = len(valid_recipients)
        print(f"[DISPATCH] Found {total} total unverified vendors.")
        print("-" * 60)

        success_count = 0
        skipped_count = 0
        fail_count = 0

        for i, recipient in enumerate(valid_recipients, 1):
            email = recipient["email"]
            name = recipient["business_name"] or recipient["vendor_name"] or "Vendor"

            if email in sent_already:
                print(f"[{i}/{total}] Skipping {name} <{email}> (Already sent)")
                skipped_count += 1
                continue

            print(f"[{i}/{total}] Sending 1-on-1 to {name} <{email}>...", end=" ", flush=True)

            subject, text_body, html_body = build_email_content(name)
            ok = send_via_smtp(email, subject, text_body, html_body)

            if ok:
                print("SUCCESS")
                record_sent_email(email)
                success_count += 1
            else:
                print("FAILED")
                fail_count += 1

            # Be courteous with rate limits
            time.sleep(0.8)

        print("-" * 60)
        print(f"[DONE] Newly Sent: {success_count}, Skipped (already sent): {skipped_count}, Failed: {fail_count}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
