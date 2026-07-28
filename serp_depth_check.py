"""Diagnostic: how many organic results does Serper ACTUALLY return?

The daily scan asks for num=100 but 53 days of history contain no position
above 10, so something is capping results. This makes 3 cheap calls and
prints what comes back, so the fix is based on measurement, not a guess.

Usage (PowerShell):
    $env:SERPER_API_KEY = "your-key"
    python serp_depth_check.py
"""

import os
import json
import requests

KEY = os.environ.get("SERPER_API_KEY")
if not KEY:
    raise SystemExit("Set SERPER_API_KEY first.")

KEYWORD = "miami brain injury lawyer"
TARGET = "gallardolawyers.com"
LOCATION = "Miami, Florida, United States"


def call(label, payload):
    r = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": KEY, "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    organic = r.json().get("organic", [])
    positions = [o.get("position") for o in organic]
    hits = [(o.get("position"), o.get("link")) for o in organic
            if TARGET in (o.get("link") or "")]
    print(f"\n{label}")
    print(f"  payload         : {json.dumps(payload)}")
    print(f"  organic results : {len(organic)}")
    print(f"  position range  : {min(positions, default='-')} .. {max(positions, default='-')}")
    print(f"  {TARGET} found  : {hits if hits else 'no'}")
    return len(organic)


# 1. Exactly what the daily scan sends today.
n1 = call("[1] CURRENT daily-scan payload (num=100)",
          {"q": KEYWORD, "gl": "us", "hl": "en", "num": 100, "location": LOCATION})

# 2. Same, without `location` — rules out location suppressing depth.
n2 = call("[2] num=100, no location",
          {"q": KEYWORD, "gl": "us", "hl": "en", "num": 100})

# 3. Explicit page 2 — does pagination reach results 11-20?
n3 = call("[3] page=2 (results 11-20)",
          {"q": KEYWORD, "gl": "us", "hl": "en", "num": 10, "page": 2, "location": LOCATION})

print("\n" + "=" * 60)
if n1 >= 50:
    print("VERDICT: num=100 works. The cap is elsewhere — send me this output.")
elif n3:
    print("VERDICT: num is capped at ~10; `page` DOES work.")
    print("         Fix = paginate: one request per 10 results.")
    print(f"         Cost: 38 keywords x N pages per day (today: 38 calls/day).")
else:
    print("VERDICT: neither num nor page returns depth — plan limitation.")
    print("         Fix = relabel everything as a top-10 check.")
