import requests
import json
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

SERPER_KEY = os.environ.get("SERPER_API_KEY")

# Miami timezone — auto-handles EDT/EST daylight saving switches
MIAMI = ZoneInfo("America/New_York")

# How deep to look. Serper serves 10 organic results per request, so depth costs
# API calls: one per 10 results, per keyword, per day.
#
# CURRENT SETTING IS 10 = one call per keyword (38/day), deliberately chosen to
# keep the API bill flat. The consequence, and it is a real one: a page sitting
# at #11-30 is reported as "not found", identical to a page that does not rank
# at all. Raising the number is the only way to tell those apart.
#
# Measured against the last 30 days (64% of keyword-days rank in the top 10),
# with STOP_WHEN_FOUND skipping deeper pages once the target is located:
#     SERP_DEPTH = 10 ....  38 calls/day  <-- current
#     SERP_DEPTH = 20 ....  52 calls/day  (sees page 2)
#     SERP_DEPTH = 30 ....  65 calls/day  (sees pages 2-3)
# Changing it is a one-line edit, but the wording in the email footer
# (send_email_report.py) and the "not in top N" chart legends in the report
# pages must be updated to match, or the report claims a depth it never scans.
SERP_DEPTH = 10
RESULTS_PER_PAGE = 10
PAGES_TO_FETCH = -(-SERP_DEPTH // RESULTS_PER_PAGE)   # ceil
STOP_WHEN_FOUND = True


def domain_of(url):
    """URL -> bare host, 'www.' stripped and lowercased."""
    try:
        host = (urlparse(url).netloc or "").lower()
    except Exception:
        return ""
    return host[4:] if host.startswith("www.") else host


def same_site(link, domain):
    """True when a search result belongs to `domain` (subdomains included).

    Host comparison, not a substring test: 'competitor.com/?ref=yourdomain.com'
    used to count as one of your pages.
    """
    if not domain:
        return False
    host = domain_of(link)
    return host == domain or host.endswith("." + domain)

# Each keyword: its target URL and language ("en" or "es")
keywords = [
    {"keyword": "botox injections miami",
     "url": "https://avanaplasticsurgery.com/botox-injections-miami",
     "lang": "en"},
    {"keyword": "inyecciones de botox en miami",
     "url": "https://avanaplasticsurgery.com/espanol/inyecciones-de-botox-en-miami",
     "lang": "es"},
    {"keyword": "implantes de glúteos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/implantes-de-gluteos-miami",
     "lang": "es"},
    {"keyword": "butt implants in miami",
     "url": "https://avanaplasticsurgery.com/butt-implants-in-miami",
     "lang": "en"},
    {"keyword": "buttock reduction in miami",
     "url": "https://avanaplasticsurgery.com/buttock-reduction-miami",
     "lang": "en"},
    {"keyword": "abdominoplastia con curvas en miami",
     "url": "https://avanaplasticsurgery.com/espanol/abdominoplastia-con-curvas-en-miami",
     "lang": "es"},
    {"keyword": "hourglass tummy tuck miami",
     "url": "https://avanaplasticsurgery.com/hourglass-tummy-tuck-in-miami",
     "lang": "en"},
    {"keyword": "aumento de senos transumbilical en miami",
     "url": "https://avanaplasticsurgery.com/espanol/aumento-de-senos-transumbilical-en-miami",
     "lang": "es"},
    {"keyword": "aumento de senos transabdominal en miami",
     "url": "https://avanaplasticsurgery.com/espanol/aumento-de-senos-transabdominal-en-miami",
     "lang": "es"},
    {"keyword": "transumbilical breast augmentation miami",
     "url": "https://avanaplasticsurgery.com/transumbilical-breast-augmentation-miami",
     "lang": "en"},
    {"keyword": "transabdominal breast augmentation miami",
     "url": "https://avanaplasticsurgery.com/transabdominal-breast-augmentation-miami",
     "lang": "en"},
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
    {"keyword": "reducción de glúteos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/reduccion-de-gluteos-en-miami",
     "lang": "es"},
    {"keyword": "brazilian butt lift miami",
     "url": "https://avanaplasticsurgery.com/brazilian-butt-lift-miami",
     "lang": "en"},
    {"keyword": "bbl revision miami",
     "url": "https://avanaplasticsurgery.com/bbl-revision-miami",
     "lang": "en"},
    {"keyword": "revisión de bbl en miami",
     "url": "https://avanaplasticsurgery.com/espanol/revision-de-bbl-en-miami",
     "lang": "es"},
    {"keyword": "breast augmentation miami",
     "url": "https://avanaplasticsurgery.com/breast-augmentation-miami",
     "lang": "en"},
    {"keyword": "breast implant revision miami",
     "url": "https://avanaplasticsurgery.com/breast-implant-revision-miami",
     "lang": "en"},
    {"keyword": "breast reduction miami",
     "url": "https://avanaplasticsurgery.com/breast-reduction-miami",
     "lang": "en"},
    {"keyword": "breast lift miami",
     "url": "https://avanaplasticsurgery.com/breast-lift-miami",
     "lang": "en"},
    {"keyword": "reducción de senos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/reduccion-de-senos-miami",
     "lang": "es"},
    {"keyword": "levantamiento de senos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/levantamiento-de-senos-en-miami",
     "lang": "es"},
    {"keyword": "revisión de implantes de senos en miami",
     "url": "https://avanaplasticsurgery.com/espanol/revision-de-implantes-de-senos-en-miami",
     "lang": "es"},
    {"keyword": "mommy makeover miami",
     "url": "https://avanaplasticsurgery.com/mommy-makeover-miami",
     "lang": "en"},
    {"keyword": "mommy makeover en miami",
     "url": "https://avanaplasticsurgery.com/espanol/mommy-makeover-en-miami",
     "lang": "es"},
    {"keyword": "liposuction miami",
     "url": "https://avanaplasticsurgery.com/liposuction-miami",
     "lang": "en"},
    {"keyword": "liposucción en miami",
     "url": "https://avanaplasticsurgery.com/espanol/liposuccion-en-miami-florida",
     "lang": "es"},
    {"keyword": "tummy tuck miami",
     "url": "https://avanaplasticsurgery.com/tummy-tuck-miami",
     "lang": "en"},
    {"keyword": "tummy tuck en miami",
     "url": "https://avanaplasticsurgery.com/espanol/tummy-tuck-en-miami",
     "lang": "es"},
    # gallardolawyers.com — separate client property. Handled exactly like the
    # Avana keywords: "my_pages_ranking" is scoped to whichever domain the
    # keyword's own target URL points at.
    {"keyword": "miami brain injury lawyer",
     "url": "https://gallardolawyers.com/injury-law/miami-brain-injury-lawyer",
     "lang": "en"},
    {"keyword": "product liability attorney miami",
     "url": "https://gallardolawyers.com/injury-law/product-liability-attorney-miami",
     "lang": "en"},
    {"keyword": "abogados de responsabilidad del producto en miami",
     "url": "https://gallardolawyers.com/es/lesionados/abogados-de-responsabilidad-del-producto-en-miami",
     "lang": "es"},
    {"keyword": "abogados de lesiones cerebrales en miami",
     "url": "https://gallardolawyers.com/es/lesionados/abogados-de-lesiones-cerebrales-en-miami",
     "lang": "es"},
]

# Locations to check each keyword from (Miami only)
locations = [
    {"name": "Miami", "location": "Miami, Florida, United States"},
]


def _fetch_page(keyword, lang, location, page, retries, retry_delay):
    """One Serper request. Returns (organic_list_or_None, last_error)."""
    payload = {
        "q": keyword,
        "gl": "us",                  # country = United States
        "hl": lang,                  # result language (en or es)
        "num": RESULTS_PER_PAGE,
    }
    if page > 1:
        payload["page"] = page
    if location:                     # add city-level targeting when provided
        payload["location"] = location

    results = None
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
                json=payload,
                timeout=30,
            )
            r.raise_for_status()
            results = r.json().get("organic", [])   # organic only — ignores ads
        except Exception as e:
            last_err = str(e)
            results = None

        if results:
            break
        if attempt < retries:
            print(f"    (empty/failed result for '{keyword}' p{page}, "
                  f"retry {attempt}/{retries - 1})")
            time.sleep(retry_delay)

    return results, last_err


def check_ranking(keyword, target_url, lang, location, retries=3, retry_delay=4):
    # Serper returns 10 organic results per request. A single num=100 call was
    # NOT honoured — 53 days of history contain no position above 10 — so
    # anything on page 2+ was recorded as "not found". Walk the pages instead.
    #
    # Page 1 is retried (an empty page 1 is a transient Serper failure, and
    # recording it as "no competitors" blanks every downstream table). Pages 2+
    # get a single attempt: an empty one legitimately means "no more results",
    # and retrying every one of those would add minutes to the daily run.
    merged = []
    seen = set()
    last_err = None

    for page in range(1, PAGES_TO_FETCH + 1):
        page_retries = retries if page == 1 else 1
        results, err = _fetch_page(keyword, lang, location, page,
                                   page_retries, retry_delay)
        if results is None:
            last_err = err
            if page == 1:
                return {"position": "error", "found_on_page_1": False,
                        "my_pages_ranking": [], "top_10_competitors": [],
                        "error": err}
            break                    # keep the pages we did get
        if not results:
            break                    # no more results

        # Dedupe by URL, preserving order. If `page` is ever ignored and the
        # same 10 results come back, this collapses them instead of inventing
        # fake positions 11-20 — the scan degrades to a top-10 check.
        new_on_this_page = 0
        for item in results:
            link = item.get("link", "")
            if link in seen:
                continue
            seen.add(link)
            merged.append(item)
            new_on_this_page += 1
        if not new_on_this_page:
            break                    # pagination isn't working — stop paying for it

        # Target located: deeper pages cannot change its position, so don't buy
        # them. This is what keeps the daily cost at ~65 calls instead of 114.
        if STOP_WHEN_FOUND and any(target_url in (it.get("link") or "")
                                   for it in merged):
            break

        if page < PAGES_TO_FETCH:
            time.sleep(0.5)          # be gentle between pages of one keyword

    results = merged[:SERP_DEPTH]

    position = "not found"
    competitors = []
    my_pages = []   # ALL pages from this keyword's own domain that appear

    # Which site "yours" means is taken from the keyword's target URL, so every
    # client property gets this — it used to be hard-coded to Avana, leaving
    # my_pages_ranking permanently empty for gallardolawyers.com keywords.
    my_domain = domain_of(target_url)

    for i, item in enumerate(results, 1):
        link = item.get("link", "")
        if i <= 10:
            competitors.append({
                "position": i,
                "url": link,
                "title": item.get("title", ""),
            })
        # record every page of yours, wherever it ranks
        if same_site(link, my_domain):
            my_pages.append({"position": i, "url": link})
        # is THIS result the target page?
        if target_url in link and position == "not found":
            position = i

    return {
        "position": position,                              # your target page's position
        "found_on_page_1": isinstance(position, int) and position <= 10,
        "my_pages_ranking": my_pages,                      # every page of yours that shows
        "top_10_competitors": competitors,
        "results_scanned": len(results),                   # how deep this scan really saw
    }


def run_daily_check():
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

    # Completeness check — surface any keyword that did NOT come back with a full
    # top-10 competitor set, so an incomplete run is visible in the log (and the
    # CI output) instead of silently blanking that page's tables.
    incomplete = [r for r in reports if len(r.get("top_10_competitors", [])) < 10]
    if incomplete:
        print(f"\nWARNING: {len(incomplete)} keyword(s) returned fewer than 10 competitors:")
        for r in incomplete:
            print(f"    - {r['keyword']}: {len(r['top_10_competitors'])} "
                  f"competitor(s), position={r['position']}")
    else:
        print("\nAll keywords returned a full top-10 competitor set.")

    # Depth check. This is what went unnoticed for 53 days: the scan asked for
    # 100 results, got 10, and silently reported everything on page 2+ as "not
    # found". If pagination stops working again, say so in the CI log.
    depths = [r.get("results_scanned", 0) for r in reports]
    deepest = max(depths, default=0)
    if deepest <= RESULTS_PER_PAGE and SERP_DEPTH > RESULTS_PER_PAGE:
        print(f"\nWARNING: no keyword saw more than {deepest} results, but "
              f"SERP_DEPTH is {SERP_DEPTH}. Pagination is NOT working — every "
              f"'not found' below means 'not in top {deepest}'. Check the "
              f"Serper `page` parameter before trusting today's report.")
    else:
        print(f"Scan depth: deepest {deepest} results, "
              f"median {sorted(depths)[len(depths) // 2] if depths else 0} "
              f"(SERP_DEPTH={SERP_DEPTH}).")


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
                pages = item.get("my_pages_ranking", [])
                if not url or not d:
                    continue
                if url not in data:
                    data[url] = {}
                data[url][d] = {
                    "position": None if pos == "not found" else (int(pos) if isinstance(pos, int) else None),
                    "keyword": kw,
                    "competitors": comps,
                    "pages": pages,
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

        # Competitors from the most recent date that actually HAS them, so a
        # single empty-SERP day doesn't blank the chart's competitor lines.
        # The domain's own ranking pages ("pages") are taken from that same
        # valid-SERP date, so a Serper hiccup doesn't wrongly blank them either.
        latest_comps = []
        latest_pages = []
        for _, v in reversed(sorted_dates):
            if v.get("competitors"):
                latest_comps = v["competitors"][:10]
                latest_pages = v.get("pages", [])
                break

        # Every page of the domain ranking for this keyword, target URL first,
        # then the rest by ascending SERP position.
        pages = []
        for p in latest_pages:
            p_url = p.get("url", "")
            pages.append({
                "position": p.get("position"),
                "url": p_url,
                "is_target": p_url == url or p_url.rstrip("/") == url.rstrip("/"),
            })
        pages.sort(key=lambda p: (not p["is_target"],
                                  p["position"] if p["position"] is not None else 999))

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

        output[url] = {"series": series, "competitors": competitors, "pages": pages}

    js = "// Auto-generated by seo_check.py — do not edit manually\n"
    js += "window.SEO_POSITION_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";\n"

    out_path = os.path.join(reports_dir, "chart-data.js")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"chart-data.js written ({len(output)} URL(s))")


if __name__ == "__main__":
    run_daily_check()
    generate_chart_data()