import requests
import json
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

SERPER_KEY = os.environ.get("SERPER_API_KEY")

# Miami timezone — auto-handles EDT/EST daylight saving switches
MIAMI = ZoneInfo("America/New_York")

# Your domain — used to detect ANY of your pages ranking
MY_DOMAIN = "avanaplasticsurgery.com"

# Each keyword: its target URL and language ("en" or "es")
keywords = [
    {"keyword": "lipo 360 miami",
     "url": "https://avanaplasticsurgery.com/lipo-360-miami",
     "lang": "en"},
    {"keyword": "liposucción 360 en miami",
     "url": "https://avanaplasticsurgery.com/espanol/lipo-360-en-miami",
     "lang": "es"},
    {"keyword": "breast implants miami",
     "url": "https://avanaplasticsurgery.com/breast-implants-miami",
     "lang": "en"},
    {"keyword": "implantes de senos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/implantes-de-senos-en-miami",
     "lang": "es"},
    {"keyword": "aumento de senos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/aumento-de-senos-miami",
     "lang": "es"},
    {"keyword": "levantamiento de gluteos brasileño en miami",
     "url": "https://avanaplasticsurgery.com/espanol/levantamiento-de-gluteos-en-miami",
     "lang": "es"},
    {"keyword": "brazilian butt lift miami",
     "url": "https://avanaplasticsurgery.com/brazilian-butt-lift-miami",
     "lang": "en"},
    {"keyword": "breast augmentation miami",
     "url": "https://avanaplasticsurgery.com/breast-augmentation-miami",
     "lang": "en"},
    {"keyword": "mommy makeover miami",
     "url": "https://avanaplasticsurgery.com/mommy-makeover-miami",
     "lang": "en"},
]

# Locations to check each keyword from (Miami only)
locations = [
    {"name": "Miami", "location": "Miami, Florida, United States"},
]


def check_ranking(keyword, target_url, lang, location):
    payload = {
        "q": keyword,
        "gl": "us",          # country = United States
        "hl": lang,          # result language (en or es)
        "num": 100,          # top 100 results
    }
    if location:             # add city-level targeting when provided
        payload["location"] = location

    try:
        r = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        return {"position": "error", "found_on_page_1": False,
                "my_pages_ranking": [], "top_10_competitors": [], "error": str(e)}

    results = data.get("organic", [])   # organic only — ignores ads

    position = "not found"
    competitors = []
    my_pages = []   # ALL pages from your own domain that appear

    for i, item in enumerate(results, 1):
        link = item.get("link", "")
        if i <= 10:
            competitors.append({
                "position": i,
                "url": link,
                "title": item.get("title", ""),
            })
        # record every page of yours, wherever it ranks
        if MY_DOMAIN in link:
            my_pages.append({"position": i, "url": link})
        # is THIS result the target page?
        if target_url in link and position == "not found":
            position = i

    return {
        "position": position,                              # your target page's position
        "found_on_page_1": isinstance(position, int) and position <= 10,
        "my_pages_ranking": my_pages,                      # every page of yours that shows
        "top_10_competitors": competitors,
    }


print("Starting SEO checks via Serper...")
reports = []

for item in keywords:
    for loc in locations:
        print(f"Checking '{item['keyword']}' from {loc['name']}...")
        result = check_ranking(
            item["keyword"], item["url"], item["lang"], loc["location"]
        )
        result.update({
            "keyword": item["keyword"],
            "target_url": item["url"],
            "location": loc["name"],
            "date": datetime.now(MIAMI).strftime("%Y-%m-%d"),
            "time": datetime.now(MIAMI).strftime("%H:%M"),
        })
        reports.append(result)
        print(f"  -> Target position: {result['position']}")
        if result.get("my_pages_ranking"):
            for p in result["my_pages_ranking"]:
                print(f"     (your page at #{p['position']}: {p['url']})")
        time.sleep(1)

# Save reports
os.makedirs("reports", exist_ok=True)
date = datetime.now(MIAMI).strftime("%Y-%m-%d")

with open(f"reports/{date}.json", "w", encoding="utf-8") as f:
    json.dump(reports, f, indent=2, ensure_ascii=False)

with open("reports/latest.json", "w", encoding="utf-8") as f:
    json.dump(reports, f, indent=2, ensure_ascii=False)

# Append to history CSV
csv_file = "reports/history.csv"
if not os.path.exists(csv_file):
    with open(csv_file, "w", encoding="utf-8") as f:
        f.write("date,location,keyword,target_url,target_position,"
                "top_ranking_own_page,top_own_position\n")

with open(csv_file, "a", encoding="utf-8") as f:
    for r in reports:
        # find the best-ranking page of yours (lowest position number)
        if r.get("my_pages_ranking"):
            best = min(r["my_pages_ranking"], key=lambda x: x["position"])
            top_own_url = best["url"]
            top_own_pos = best["position"]
        else:
            top_own_url = "none"
            top_own_pos = "none"
        f.write(f"{r['date']},{r['location']},{r['keyword']},"
                f"{r['target_url']},{r['position']},"
                f"{top_own_url},{top_own_pos}\n")

print("Done! Reports saved.")


def generate_chart_data(reports_dir="reports"):
    """Scan all dated JSON files and write reports/chart-data.js."""
    import glob
    from urllib.parse import urlparse

    data = {}  # {target_url: {date: {position, keyword, competitors}}}

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
                if url not in data:
                    data[url] = {}
                data[url][d] = {
                    "position": None if pos == "not found" else (int(pos) if isinstance(pos, int) else None),
                    "keyword": kw,
                    "competitors": comps,
                }
        except Exception:
            pass

    output = {}
    for url, dates in data.items():
        sorted_dates = sorted(dates.items())

        series = [
            {"date": d, "position": v["position"], "keyword": v["keyword"]}
            for d, v in sorted_dates
        ]

        # Top 5 competitors from the most recent date
        latest_comps = sorted_dates[-1][1].get("competitors", [])[:10] if sorted_dates else []

        competitors = []
        for comp in latest_comps:
            comp_url   = comp.get("url", "")
            comp_title = comp.get("title", "")
            try:
                comp_domain = urlparse(comp_url).netloc.replace("www.", "")
            except Exception:
                comp_domain = comp_url

            # Find this competitor's position on each historical date
            comp_series = []
            for d, v in sorted_dates:
                found_pos = None
                for c in v.get("competitors", []):
                    if c.get("url") == comp_url:
                        found_pos = c.get("position")
                        break
                comp_series.append({"date": d, "position": found_pos})

            competitors.append({
                "url": comp_url,
                "title": comp_title,
                "domain": comp_domain,
                "series": comp_series,
            })

        output[url] = {"series": series, "competitors": competitors}

    js = "// Auto-generated by seo_check.py — do not edit manually\n"
    js += "window.SEO_POSITION_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";\n"

    out_path = os.path.join(reports_dir, "chart-data.js")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"chart-data.js written ({len(output)} URL(s))")


generate_chart_data()