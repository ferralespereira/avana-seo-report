"""One-off: re-check a SINGLE keyword for today and patch its entry only.

Reuses the same logic as seo_check.py but:
  - queries only TARGET_KEYWORD
  - updates ONLY that keyword's entry inside reports/<today>.json
    (and reports/latest.json) -- the other keywords are left untouched
  - regenerates reports/chart-data.js

Usage (PowerShell):
    $env:SERPER_API_KEY = "your-key"
    python serp_one.py
"""

import requests
import json
import os
import glob
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

SERPER_KEY = os.environ.get("SERPER_API_KEY")
MIAMI = ZoneInfo("America/New_York")
MY_DOMAIN = "avanaplasticsurgery.com"

# ---- the single keyword to refresh -------------------------------------
TARGET_KEYWORD = "breast implants miami"
TARGET_URL     = "https://avanaplasticsurgery.com/breast-implants-miami"
TARGET_LANG    = "en"
LOCATION_NAME  = "Miami"
LOCATION       = "Miami, Florida, United States"
# ------------------------------------------------------------------------

REPORTS_DIR = "reports"


def check_ranking(keyword, target_url, lang, location):
    payload = {"q": keyword, "gl": "us", "hl": lang, "num": 100}
    if location:
        payload["location"] = location

    r = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()

    results = data.get("organic", [])
    position = "not found"
    competitors = []
    my_pages = []

    for i, item in enumerate(results, 1):
        link = item.get("link", "")
        if i <= 10:
            competitors.append({"position": i, "url": link, "title": item.get("title", "")})
        if MY_DOMAIN in link:
            my_pages.append({"position": i, "url": link})
        if target_url in link and position == "not found":
            position = i

    return {
        "position": position,
        "found_on_page_1": isinstance(position, int) and position <= 10,
        "my_pages_ranking": my_pages,
        "top_10_competitors": competitors,
    }


def patch_day_file(path, entry):
    """Replace the matching keyword/url entry in a report file, or append it."""
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            items = json.load(fh)
    else:
        items = []

    replaced = False
    for idx, it in enumerate(items):
        if it.get("keyword") == entry["keyword"] and it.get("target_url") == entry["target_url"]:
            items[idx] = entry
            replaced = True
            break
    if not replaced:
        items.append(entry)

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(items, fh, indent=2, ensure_ascii=False)
    return replaced


def generate_chart_data(reports_dir="reports"):
    """Same generator as seo_check.py, but competitors fall back to the most
    recent date that actually HAS competitors (so one empty API day won't
    blank the chart)."""
    data = {}
    for path in sorted(glob.glob(f"{reports_dir}/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].json")):
        try:
            with open(path, encoding="utf-8") as fh:
                items = json.load(fh)
            for item in items:
                url   = item.get("target_url", "")
                pos   = item.get("position")
                d     = item.get("date", "")
                kw    = item.get("keyword", "")
                comps = item.get("top_10_competitors", [])
                if not url or not d:
                    continue
                data.setdefault(url, {})[d] = {
                    "position": None if pos == "not found" else (int(pos) if isinstance(pos, int) else None),
                    "keyword": kw,
                    "competitors": comps,
                }
        except Exception:
            pass

    output = {}
    for url, dates in data.items():
        sorted_dates = sorted(dates.items())
        series = [{"date": d, "position": v["position"], "keyword": v["keyword"]}
                  for d, v in sorted_dates]

        # most recent date that actually has competitors
        latest_comps = []
        for _, v in reversed(sorted_dates):
            if v.get("competitors"):
                latest_comps = v["competitors"][:10]
                break

        competitors = []
        for comp in latest_comps:
            comp_url = comp.get("url", "")
            try:
                comp_domain = urlparse(comp_url).netloc.replace("www.", "")
            except Exception:
                comp_domain = comp_url
            comp_series = []
            for d, v in sorted_dates:
                found_pos = None
                for c in v.get("competitors", []):
                    if c.get("url") == comp_url:
                        found_pos = c.get("position")
                        break
                comp_series.append({"date": d, "position": found_pos})
            competitors.append({"url": comp_url, "title": comp.get("title", ""),
                                "domain": comp_domain, "series": comp_series})

        output[url] = {"series": series, "competitors": competitors}

    js = "// Auto-generated by seo_check.py — do not edit manually\n"
    js += "window.SEO_POSITION_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";\n"
    with open(os.path.join(reports_dir, "chart-data.js"), "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"chart-data.js written ({len(output)} URL(s))")


def main():
    if not SERPER_KEY:
        raise SystemExit("SERPER_API_KEY is not set. In PowerShell run:\n"
                         '  $env:SERPER_API_KEY = "your-key"')

    now = datetime.now(MIAMI)
    today = now.strftime("%Y-%m-%d")

    print(f"Checking '{TARGET_KEYWORD}' from {LOCATION_NAME} ...")
    result = check_ranking(TARGET_KEYWORD, TARGET_URL, TARGET_LANG, LOCATION)
    result.update({
        "keyword": TARGET_KEYWORD,
        "target_url": TARGET_URL,
        "location": LOCATION_NAME,
        "date": today,
        "time": now.strftime("%H:%M"),
    })
    print(f"  -> position: {result['position']}, "
          f"{len(result['top_10_competitors'])} competitors found")

    day_path = os.path.join(REPORTS_DIR, f"{today}.json")
    replaced = patch_day_file(day_path, result)
    print(f"  -> {'updated' if replaced else 'added'} entry in {day_path}")

    # keep latest.json in sync too (it mirrors the most recent run)
    patch_day_file(os.path.join(REPORTS_DIR, "latest.json"), result)

    generate_chart_data(REPORTS_DIR)
    print("Done.")


if __name__ == "__main__":
    main()
