import requests
import json
import os
import time
from datetime import datetime

SERPER_KEY = os.environ.get("SERPER_API_KEY")

# Each keyword: its target URL and language ("en" or "es")
keywords = [
    {"keyword": "lipo 360 miami",
     "url": "https://avanaplasticsurgery.com/lipo-360-miami",
     "lang": "en"},
    {"keyword": "liposuccion 360 en miami",
     "url": "https://avanaplasticsurgery.com/espanol/lipo-360-en-miami",
     "lang": "es"},
    {"keyword": "breast implants miami",
     "url": "https://avanaplasticsurgery.com/breast-implants-miami",
     "lang": "en"},
    {"keyword": "implantes de senos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/implantes-de-senos-en-miami",
     "lang": "es"},
]

# Locations to check each keyword from
locations = [
    {"name": "United States", "location": None},                     # country-level (gl=us)
    {"name": "Miami", "location": "Miami, Florida, United States"},   # city-level
]

# Your domain — used to detect ANY of your pages ranking
MY_DOMAIN = "avanaplasticsurgery.com"


def check_ranking(keyword, target_url, lang, location):
    payload = {
        "q": keyword,
        "gl": "us",          # country = United States
        "hl": lang,          # result language (en or es)
        "num": 20,
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
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M"),
        })
        reports.append(result)
        print(f"  -> Target position: {result['position']}")
        if result.get("my_pages_ranking"):
            for p in result["my_pages_ranking"]:
                print(f"     (your page at #{p['position']}: {p['url']})")
        time.sleep(1)

# Save reports
os.makedirs("reports", exist_ok=True)
date = datetime.now().strftime("%Y-%m-%d")

with open(f"reports/{date}.json", "w", encoding="utf-8") as f:
    json.dump(reports, f, indent=2, ensure_ascii=False)

with open("reports/latest.json", "w", encoding="utf-8") as f:
    json.dump(reports, f, indent=2, ensure_ascii=False)

# Append to history CSV (now includes which of your pages ranked top + its position)
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