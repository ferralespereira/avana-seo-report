import anthropic
import json
import os
import re
from datetime import datetime

client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)

keywords = [
    {
        "keyword": "lipo 360 miami",
        "url": "avanaplasticsurgery.com/lipo-360-miami"
    },
    {
        "keyword": "liposucción 360 en miami",
        "url": "https://avanaplasticsurgery.com/espanol/lipo-360-en-miami"
    },
    {
        "keyword": "breast implants miami",
        "url": "https://avanaplasticsurgery.com/breast-implants-miami"
    },
    {
        "keyword": "implantes de senos en miami",
        "url": "https://avanaplasticsurgery.com/espanol/implantes-de-senos-en-miami"
    },
]

def extract_json(text):
    # Try direct parse first
    try:
        return json.loads(text)
    except:
        pass

    # Try to find JSON block in text
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except:
        pass

    return None

def check_ranking(keyword, target_url):
    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            tools=[
                {
                    "type": "web_search_20250305",
                    "name": "web_search"
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": f"""Search Google for: "{keyword}"

Look through the top 20 results and check if this domain appears: {target_url}

You MUST respond with ONLY this JSON, no other text before or after:
{{
    "keyword": "{keyword}",
    "target_url": "{target_url}",
    "position": <put the position number here, or the string "not found" if not in top 20>,
    "found_on_page_1": <true if position is 1-10, false otherwise>,
    "top_10_competitors": [
        {{"position": 1, "url": "full url here", "title": "page title here"}},
        {{"position": 2, "url": "full url here", "title": "page title here"}},
        {{"position": 3, "url": "full url here", "title": "page title here"}}
    ]
}}"""
                }
            ]
        )

        # Get all text blocks from response
        full_text = ""
        for block in message.content:
            if hasattr(block, 'text'):
                full_text += block.text

        print(f"Raw response: {full_text[:200]}")

        result = extract_json(full_text)
        if result:
            return result
        else:
            return {
                "keyword": keyword,
                "target_url": target_url,
                "position": "parse_error",
                "found_on_page_1": False,
                "raw_response": full_text[:500]
            }

    except Exception as e:
        return {
            "keyword": keyword,
            "target_url": target_url,
            "position": "exception",
            "found_on_page_1": False,
            "error": str(e)
        }

# Run checks
print("Starting SEO checks...")
reports = []

for item in keywords:
    print(f"\nChecking: {item['keyword']}...")
    result = check_ranking(item["keyword"], item["url"])
    result["date"] = datetime.now().strftime("%Y-%m-%d")
    result["time"] = datetime.now().strftime("%H:%M")
    reports.append(result)
    print(f"Result: Position {result.get('position')}")

# Save reports
os.makedirs("reports", exist_ok=True)
date = datetime.now().strftime("%Y-%m-%d")

with open(f"reports/{date}.json", "w") as f:
    json.dump(reports, f, indent=2, ensure_ascii=False)

with open("reports/latest.json", "w") as f:
    json.dump(reports, f, indent=2, ensure_ascii=False)

# Update history CSV
csv_file = "reports/history.csv"
if not os.path.exists(csv_file):
    with open(csv_file, "w") as f:
        f.write("date,keyword,url,position,found_on_page_1\n")

with open(csv_file, "a") as f:
    for report in reports:
        f.write(f"{report['date']},{report['keyword']},{report['target_url']},{report.get('position','error')},{report.get('found_on_page_1',False)}\n")

print("\nAll reports saved!")