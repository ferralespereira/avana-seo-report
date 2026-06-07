import json
import os
import glob
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from zoneinfo import ZoneInfo

MIAMI = ZoneInfo("America/New_York")
REPORTS_DIR = "reports"
GMAIL_USER = os.environ["GMAIL_USER"]
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"]
TO_EMAIL = os.environ.get("TO_EMAIL", GMAIL_USER)


def load_report(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_sorted_report_files():
    files = sorted(glob.glob(f"{REPORTS_DIR}/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].json"))
    return files


def pos_label(pos):
    if pos is None or pos == "not found" or pos == "error":
        return "Not ranked"
    return f"#{pos}"


def diff_label(prev, cur):
    if prev is None or cur is None:
        return ""
    if prev == "not found" or cur == "not found":
        return ""
    try:
        d = int(prev) - int(cur)
    except (ValueError, TypeError):
        return ""
    if d > 0:
        return f'<span style="color:#1a7f37;font-weight:bold;">&#9650;{d}</span>'
    elif d < 0:
        return f'<span style="color:#c0392b;font-weight:bold;">&#9660;{abs(d)}</span>'
    return '<span style="color:#888;">&#8212;</span>'


def build_email():
    files = get_sorted_report_files()
    if not files:
        print("No report files found.")
        return None

    latest = load_report(files[-1])
    prev_data = {}
    if len(files) >= 2:
        for item in load_report(files[-2]):
            prev_data[item["target_url"]] = item.get("position")

    today = datetime.now(MIAMI).strftime("%B %d, %Y")

    rows = ""
    for item in latest:
        kw = item.get("keyword", "")
        url = item.get("target_url", "")
        cur = item.get("position")
        prev = prev_data.get(url)

        cur_label = pos_label(cur)
        diff = diff_label(prev, cur)

        short_url = url.replace("https://", "").replace("http://", "")

        # Row background alternating
        rows += f"""
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;">{kw}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#555;font-size:13px;">{short_url}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">{cur_label}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center;">{diff if diff else '<span style="color:#888;">—</span>'}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#1a1a2e;padding:20px 28px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">Avana SEO Rankings</h2>
      <p style="margin:4px 0 0;color:#aaa;font-size:13px;">{today}</p>
    </div>
    <div style="padding:24px 28px;">
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#333;">Keyword</th>
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#333;">URL</th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;color:#333;">Position</th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;color:#333;">vs Yesterday</th>
          </tr>
        </thead>
        <tbody>{rows}
        </tbody>
      </table>
    </div>
    <div style="padding:14px 28px;background:#fafafa;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#999;">
        &#9650; improved &nbsp;|&nbsp; &#9660; dropped &nbsp;|&nbsp; &#8212; no change &nbsp;|&nbsp;
        Positions based on Google Miami search (top 100)
      </p>
    </div>
  </div>
</body>
</html>"""

    return html


def send_email(html):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Avana SEO Rankings — {datetime.now(MIAMI).strftime('%Y-%m-%d')}"
    msg["From"] = GMAIL_USER
    msg["To"] = TO_EMAIL
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, TO_EMAIL, msg.as_string())
    print(f"Email sent to {TO_EMAIL}")


html = build_email()
if html:
    send_email(html)
