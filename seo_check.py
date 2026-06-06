import anthropic
import json
import os
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
        "keyword": "breast augmentation miami",
        "url": "avanaplasticsurgery.com/breast-augmentation-miami"
    },
    {
        "keyword": "tummy tuck miami",
        "url": "avanaplasticsurgery.com/tummy-tuck-miami"
    },
]

def check_ranking(keyword, target_url):
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        tools=[
            {
                "type": "web_search_20250305",
                "name": "web_search"
            }
        ],
        messages=[
            {
                "role": "user",
                "content": f"""
                Search Google for: "{keyword}"
                Check if this URL appears in top 20 results: {target_url}
                
                Return ONLY this JSON format:
                {{
                    "keyword": "{keyword}",
                    "target_url": "{target_url}",
                    "position": <number or "not found">,
                    "found_on_page_1": <true or false>,
                    "top_10_competitors": [
                        {{"position": 1, "url": "example.com", "title": "Title"}}
                    ]
                }}
                """
            }
        ]
    )

    response_text = message.content[-1].text
    try:
        return json.loads(response_text)
    except:
        return {
            "keyword": keyword,
            "target_url": target_url,
            "position": "error",
            "found_on_page_1": False,
        }

# Run checks
print("Starting SEO checks...")
reports = []

for item in keywords:
    print(f"Checking: {item['keyword']}...")
    result = check_ranking(item["keyword"], item["url"])
    result["date"] = datetime.now().strftime("%Y-%m-%d")
    result["time"] = datetime.now().strftime("%H:%M")
    reports.append(result)
    print(f"Done: {item['keyword']} - Position: {result.get('position')}")

# Save reports
os.makedirs("reports", exist_ok=True)
date = datetime.now().strftime("%Y-%m-%d")

with open(f"reports/{date}.json", "w") as f:
    json.dump(reports, f, indent=2)

with open("reports/latest.json", "w") as f:
    json.dump(reports, f, indent=2)

# Update history CSV
csv_file = "reports/history.csv"
if not os.path.exists(csv_file):
    with open(csv_file, "w") as f:
        f.write("date,keyword,url,position,found_on_page_1\n")

with open(csv_file, "a") as f:
    for report in reports:
        f.write(f"{report['date']},{report['keyword']},{report['target_url']},{report.get('position','error')},{report.get('found_on_page_1',False)}\n")

print("All reports saved!")