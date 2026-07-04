import json
import os
import glob
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

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


def short_path(u):
    """Full URL -> just the '/path' for compact display."""
    try:
        return urlparse(u).path or "/"
    except Exception:
        return u


def norm_pos(p):
    """Report position -> int, or None for 'not found'/'error'/missing."""
    return p if isinstance(p, int) else None


def _tier_colors(pos):
    # SERP tier -> (background, text, border). Matches the web report.
    if pos is None:
        return ("#eef1f4", "#8a94a0", "#dbe1e8")   # not ranked
    if pos <= 3:
        return ("#EAF4EC", "#1E7E34", "#c2e3c9")   # strong
    if pos <= 10:
        return ("#FEF7E3", "#b7791f", "#eedda4")   # page one
    return ("#FDECEA", "#C0392B", "#f2c9c3")       # page two+


def rank_badge(pos):
    bg, color, border = _tier_colors(pos)
    label = "NR" if pos is None else f"#{pos}"
    return (f'<span style="display:inline-block;min-width:24px;text-align:center;'
            f'padding:2px 7px;border-radius:6px;font-size:11px;font-weight:bold;'
            f'background:{bg};color:{color};border:1px solid {border};'
            f'font-family:Arial,sans-serif;">{label}</span>')


def ranking_pages_html(item, prev):
    """Target page first (badge + trend), then every other page of the domain
    ranking for this keyword, each with its position — mirrors the web table."""
    target_url = item.get("target_url", "")
    cur = item.get("position")
    trend = diff_label(prev, cur)

    def is_target(u):
        return u == target_url or (u or "").rstrip("/") == target_url.rstrip("/")

    pages = item.get("my_pages_ranking", []) or []
    others = [p for p in pages
              if not is_target(p.get("url", "")) and isinstance(p.get("position"), int)]
    others.sort(key=lambda p: p["position"])

    target_tag = ('<span style="font-size:9px;font-weight:bold;letter-spacing:.5px;'
                  'text-transform:uppercase;color:#0E7C7B;background:#e3f1f1;'
                  'border:1px solid #b6dcdb;padding:1px 5px;border-radius:4px;'
                  'margin-left:5px;">target</span>')

    link_base = ('text-decoration:none;font-family:monospace;font-size:12px;'
                 'word-break:break-word;overflow-wrap:anywhere;')

    lines = []
    lines.append(
        f'<div style="padding:3px 0;">{rank_badge(norm_pos(cur))}'
        f'{(" " + trend) if trend else ""} '
        f'<a href="{target_url}" class="em-url" style="color:#0E7C7B;font-weight:bold;{link_base}">'
        f'{short_path(target_url)}</a>{target_tag}</div>'
    )
    for p in others:
        lines.append(
            f'<div style="padding:3px 0;color:#8a94a0;">&#8627; {rank_badge(p["position"])} '
            f'<a href="{p["url"]}" class="em-url" style="color:#8a94a0;{link_base}">'
            f'{short_path(p["url"])}</a></div>'
        )
    return "".join(lines)


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
        prev = prev_data.get(url)

        pages_html = ranking_pages_html(item, prev)

        rows += f"""
        <tr>
          <td class="em-cell em-kw" style="padding:10px 14px;border-bottom:1px solid #eee;vertical-align:top;font-weight:600;font-size:13px;word-break:break-word;overflow-wrap:anywhere;">{kw}</td>
          <td class="em-cell" style="padding:10px 14px;border-bottom:1px solid #eee;vertical-align:top;">{pages_html}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* Phone tuning — clients that support it get tighter padding; the layout
       already fits without this thanks to width:100% + word-break. */
    @media only screen and (max-width:600px) {{
      .em-outer  {{ padding:8px !important; }}
      .em-head   {{ padding:16px 16px !important; }}
      .em-pad    {{ padding:14px 12px !important; }}
      .em-foot   {{ padding:14px 16px !important; }}
      .em-cell   {{ padding:9px 8px !important; }}
      .em-kw     {{ font-size:12px !important; }}
      .em-url    {{ font-size:11px !important; }}
    }}
  </style>
</head>
<body class="em-outer" style="margin:0;font-family:Arial,sans-serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:640px;width:100%;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div class="em-head" style="background:#1a1a2e;padding:20px 28px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">Avana SEO Rankings</h2>
      <p style="margin:4px 0 0;color:#aaa;font-size:13px;">{today}</p>
    </div>
    <div class="em-pad" style="padding:24px 28px;">
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th class="em-cell" style="width:34%;padding:10px 14px;text-align:left;font-size:13px;color:#333;">Keyword</th>
            <th class="em-cell" style="padding:10px 14px;text-align:left;font-size:13px;color:#333;">Ranking pages &amp; position</th>
          </tr>
        </thead>
        <tbody>{rows}
        </tbody>
      </table>
    </div>
    <div class="em-foot" style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#999;">
        &#9650; improved &nbsp;|&nbsp; &#9660; dropped &nbsp;|&nbsp; &#8212; no change &nbsp;|&nbsp;
        &#8627; other page of yours ranking for the same term &nbsp;|&nbsp; NR = not in top 100 &nbsp;|&nbsp;
        Positions based on Google Miami search (top 100)
      </p>
      <a href="https://ferralespereira.github.io/avana-seo-report/"
         style="display:inline-block;margin-top:12px;padding:8px 16px;background:#1a1a2e;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:5px;white-space:nowrap;">
        &#128202; View Full SEO Report
      </a>
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
