"""
keyword_scan.py — daily competitor keyword scan.

Runs after seo_check.py. For each tracked page it:
  1. reads that day's top-10 ranking competitors from reports/<date>.json,
  2. fetches each competitor page + Avana's target page,
  3. counts a fixed, curated list of SEO keywords on each page,
  4. accumulates the result into reports/keyword-history.json (keyed by day),
  5. regenerates reports/keyword-history.js (window.KEYWORD_HISTORY) for the
     *-improvements.html pages to render.

Because the top-10 changes day to day, each day's scan stores its own column
set (the sites that ranked that day). The keyword ROWS are fixed per page so
history stays comparable. Avana's target page is always added as a reference
column even when it is not ranking.
"""
import requests
import json
import os
import re
import glob
import time
import html as htmllib
import unicodedata
from datetime import datetime
from urllib.parse import urlparse, quote
from zoneinfo import ZoneInfo

MIAMI = ZoneInfo("America/New_York")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Polite pause between HTTP requests so we don't hammer a host (and trip its
# rate-limiting / bot blocking). Sequential fetches, so this paces the whole run.
REQUEST_DELAY = 1.5     # seconds between consecutive fetches

# Domains with no comparable on-page content (social / video) — skipped.
SKIP_DOMAINS = ("youtube.com", "instagram.com", "facebook.com", "tiktok.com",
                "twitter.com", "x.com", "pinterest.com")

# ── Curated keyword sets (display label -> accent-free match variants) ────────
BREAST_EN = [
    ("breast augmentation", ["breast augmentation"]),
    ("breast implants", ["breast implants", "breast implant"]),
    ("breast augmentation miami", ["breast augmentation miami", "miami breast augmentation"]),
    ("breast implants miami", ["breast implants miami", "breast implant miami"]),
    ("breast lift", ["breast lift"]),
    ("breast enhancement", ["breast enhancement"]),
    ("gummy bear implants", ["gummy bear implants", "gummy bear breast implants"]),
    ("silicone implants", ["silicone implants", "silicone breast implants", "silicone gel implants"]),
    ("saline implants", ["saline implants", "saline breast implants"]),
    ("capsular contracture", ["capsular contracture"]),
    ("implant placement", ["implant placement"]),
    ("implant size", ["implant size", "breast size"]),
    ("breast augmentation cost", ["breast augmentation cost", "augmentation cost", "cost of breast augmentation"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
]
BREAST_ES = [
    ("aumento de senos", ["aumento de senos"]),
    ("aumento de senos en miami", ["aumento de senos en miami", "aumento de senos miami"]),
    ("implantes de senos", ["implantes de senos", "implante de senos"]),
    ("implantes mamarios", ["implantes mamarios", "implante mamario"]),
    ("implantes de silicona", ["implantes de silicona", "implante de silicona", "gel de silicona"]),
    ("implantes salinos", ["implantes salinos", "solucion salina", "implantes de solucion salina"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("reduccion de senos", ["reduccion de senos"]),
    ("contractura capsular", ["contractura capsular"]),
    ("tejido mamario", ["tejido mamario"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("colocacion de implantes", ["colocacion de implantes", "colocacion de los implantes"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
]
BBL_EN = [
    ("brazilian butt lift", ["brazilian butt lift"]),
    ("brazilian butt lift miami", ["brazilian butt lift miami"]),
    ("bbl", ["bbl"]),
    ("butt lift", ["butt lift"]),
    ("butt augmentation", ["butt augmentation", "buttock augmentation"]),
    ("butt implants", ["butt implants", "buttock implants"]),
    ("fat transfer", ["fat transfer"]),
    ("fat grafting", ["fat grafting", "fat graft"]),
    ("skinny bbl", ["skinny bbl"]),
    ("bbl surgery", ["bbl surgery"]),
    ("liposuction", ["liposuction"]),
    ("tummy tuck", ["tummy tuck"]),
    ("breast augmentation", ["breast augmentation"]),
    ("body contouring", ["body contouring"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
]
BBL_ES = [
    ("levantamiento de gluteos brasileno", ["levantamiento de gluteos brasileno"]),
    ("aumento de gluteos", ["aumento de gluteos"]),
    ("bbl", ["bbl"]),
    ("cirugia bbl", ["cirugia bbl", "procedimiento bbl"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("injerto de grasa", ["injerto de grasa", "injerto graso"]),
    ("implantes de gluteos", ["implantes de gluteos", "implante de gluteos"]),
    ("liposuccion", ["liposuccion"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("aumento de senos", ["aumento de senos"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("contorno corporal", ["contorno corporal"]),
    ("lifting facial", ["lifting facial"]),
    ("prenda de compresion", ["prenda de compresion", "prendas de compresion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
]
LIPO_EN = [
    ("lipo 360", ["lipo 360"]),
    ("lipo 360 miami", ["lipo 360 miami"]),
    ("liposuction 360", ["liposuction 360", "360 liposuction"]),
    ("liposuction", ["liposuction"]),
    ("body contouring", ["body contouring"]),
    ("tummy tuck", ["tummy tuck"]),
    ("brazilian butt lift", ["brazilian butt lift", "bbl"]),
    ("abdominal etching", ["abdominal etching", "ab etching"]),
    ("love handles", ["love handles"]),
    ("flanks", ["flanks", "flank"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("excess fat", ["excess fat"]),
    ("fat removal", ["fat removal", "remove fat", "removes fat", "removing fat"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
]
LIPO_ES = [
    ("lipo 360", ["lipo 360"]),
    ("lipo 360 miami", ["lipo 360 miami"]),
    ("liposuccion 360", ["liposuccion 360", "360 liposuccion"]),
    ("liposuccion", ["liposuccion"]),
    ("contorno corporal", ["contorno corporal"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("levantamiento de gluteos", ["levantamiento de gluteos", "bbl"]),
    ("prenda de compresion", ["prenda de compresion", "prendas de compresion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
]
MMO_EN = [
    ("mommy makeover", ["mommy makeover"]),
    ("mommy makeover miami", ["mommy makeover miami", "miami mommy makeover"]),
    ("mommy makeover cost", ["mommy makeover cost", "cost of mommy makeover", "cost of a mommy makeover"]),
    ("tummy tuck", ["tummy tuck"]),
    ("abdominoplasty", ["abdominoplasty"]),
    ("breast augmentation", ["breast augmentation"]),
    ("breast lift", ["breast lift"]),
    ("breast implants", ["breast implants", "breast implant"]),
    ("liposuction", ["liposuction"]),
    ("brazilian butt lift", ["brazilian butt lift", "bbl"]),
    ("fat transfer", ["fat transfer"]),
    ("body contouring", ["body contouring"]),
    ("diastasis recti", ["diastasis recti", "abdominal separation", "muscle separation"]),
    ("post pregnancy", ["post pregnancy", "after pregnancy", "post-pregnancy"]),
    ("c section", ["c section", "c-section", "cesarean"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
]
MMO_ES = [
    ("mommy makeover", ["mommy makeover"]),
    ("mommy makeover en miami", ["mommy makeover en miami", "mommy makeover miami"]),
    ("cambio de imagen para mamas", ["cambio de imagen para mamas", "cambio de imagen de mama", "cambio de imagen para mama"]),
    ("mommy makeover precio", ["mommy makeover precio", "precio de mommy makeover", "precio del mommy makeover"]),
    ("cuanto cuesta un mommy makeover", ["cuanto cuesta un mommy makeover", "cuanto cuesta el mommy makeover", "cuanto cuesta una mommy makeover"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("aumento de senos", ["aumento de senos"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("liposuccion", ["liposuccion"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("contorno corporal", ["contorno corporal"]),
    ("diastasis", ["diastasis", "separacion abdominal", "separacion de los musculos"]),
    ("despues del parto", ["despues del parto", "posparto", "post parto"]),
    ("financiamiento", ["financiamiento", "financiacion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia estetica", ["cirugia estetica"]),
]

LIPOSUCTION_EN = [
    ("liposuction", ["liposuction"]),
    ("liposuction miami", ["liposuction miami", "miami liposuction"]),
    ("liposuction cost", ["liposuction cost", "liposuction miami cost", "cost of liposuction", "how much is liposuction"]),
    ("lipo", ["lipo"]),
    ("lipo miami", ["lipo miami", "miami lipo"]),
    ("lipo 360", ["lipo 360", "360 liposuction", "liposuction 360"]),
    ("laser liposuction", ["laser liposuction", "laser lipo"]),
    ("vaser liposuction", ["vaser liposuction", "vaser lipo"]),
    ("high definition liposuction", ["high definition liposuction", "hd liposuction", "hd lipo", "hi def lipo"]),
    ("chin liposuction", ["chin liposuction", "submental liposuction", "neck liposuction"]),
    ("liposculpture", ["liposculpture", "lipo sculpting"]),
    ("tummy tuck", ["tummy tuck"]),
    ("body contouring", ["body contouring"]),
    ("fat removal", ["fat removal", "remove fat", "fat reduction"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
]

LIPOSUCCION_ES = [
    ("liposuccion", ["liposuccion"]),
    ("liposuccion en miami", ["liposuccion en miami", "liposuccion miami", "liposuccion en miami florida"]),
    ("lipoescultura", ["lipoescultura", "lipo escultura"]),
    ("liposuccion precio", ["liposuccion precio", "precio de liposuccion", "precio liposuccion"]),
    ("cuanto cuesta una lipo", ["cuanto cuesta una lipo", "cuanto cuesta una liposuccion", "cuanto cuesta la lipo"]),
    ("lipo 360", ["lipo 360", "liposuccion 360"]),
    ("lipotransferencia", ["lipotransferencia", "transferencia de grasa"]),
    ("liposuccion laser", ["liposuccion laser", "lipolaser", "lipo laser"]),
    ("alta definicion", ["liposuccion de alta definicion", "alta definicion", "lipo hd"]),
    ("liposuccion de brazos", ["liposuccion de brazos", "lipo de brazos"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("contorno corporal", ["contorno corporal"]),
    ("lipopapada", ["lipopapada", "liposuccion de papada"]),
    ("financiamiento", ["financiamiento", "financiacion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia estetica", ["cirugia estetica"]),
]

# target_url -> {slug (improvements page), lang, keyword set}
PAGES = {
    "https://avanaplasticsurgery.com/brazilian-butt-lift-miami":
        {"slug": "brazilian-butt-lift-miami", "lang": "en", "kw": BBL_EN},
    "https://avanaplasticsurgery.com/espanol/levantamiento-de-gluteos-en-miami":
        {"slug": "levantamiento-de-gluteos-en-miami", "lang": "es", "kw": BBL_ES},
    "https://avanaplasticsurgery.com/lipo-360-miami":
        {"slug": "lipo-360-miami", "lang": "en", "kw": LIPO_EN},
    "https://avanaplasticsurgery.com/espanol/lipo-360-en-miami":
        {"slug": "liposuccion-360-en-miami", "lang": "es", "kw": LIPO_ES},
    "https://avanaplasticsurgery.com/breast-implants-miami":
        {"slug": "breast-implants-miami", "lang": "en", "kw": BREAST_EN},
    "https://avanaplasticsurgery.com/breast-augmentation-miami":
        {"slug": "breast-augmentation-miami", "lang": "en", "kw": BREAST_EN},
    "https://avanaplasticsurgery.com/espanol/implantes-de-senos-en-miami":
        {"slug": "implantes-de-senos-en-miami", "lang": "es", "kw": BREAST_ES},
    "https://avanaplasticsurgery.com/espanol/aumento-de-senos-miami":
        {"slug": "aumento-de-senos-miami", "lang": "es", "kw": BREAST_ES},
    "https://avanaplasticsurgery.com/mommy-makeover-miami":
        {"slug": "mommy-makeover-miami", "lang": "en", "kw": MMO_EN},
    "https://avanaplasticsurgery.com/espanol/mommy-makeover-en-miami":
        {"slug": "mommy-makeover-en-miami", "lang": "es", "kw": MMO_ES},
    "https://avanaplasticsurgery.com/liposuction-miami":
        {"slug": "liposuction-miami", "lang": "en", "kw": LIPOSUCTION_EN},
    "https://avanaplasticsurgery.com/espanol/liposuccion-en-miami-florida":
        {"slug": "liposuccion-en-miami-florida", "lang": "es", "kw": LIPOSUCCION_ES},
}


def strip_accents(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("ñ", "n")


def normalize(raw):
    for tag in ("script", "style", "noscript"):
        raw = re.sub(r"(?is)<%s.*?</%s>" % (tag, tag), " ", raw)
    raw = re.sub(r"(?is)<!--.*?-->", " ", raw)
    raw = re.sub(r"(?is)<(nav|footer|header|form|svg)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    raw = strip_accents(htmllib.unescape(raw).lower())
    raw = re.sub(r"[^a-z0-9\s]", " ", raw)
    return re.sub(r"\s+", " ", raw)


def decoded(r):
    """Return the response body as text, decoded with the right charset.

    Many pages send `Content-Type: text/html` with NO charset; requests then
    defaults to ISO-8859-1 (latin-1), which mangles UTF-8 accents
    (e.g. "glúteos" -> "gla"). When the header omits a charset we fall back to
    chardet's detection so Spanish/accented keywords count correctly."""
    if "charset=" not in r.headers.get("Content-Type", "").lower():
        r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def fetch_text(url):
    """Return normalized page text, or None if unreachable/blocked."""
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=30, allow_redirects=True)
        if r.status_code != 200:
            return None
        text = decoded(r)
        if len(text) < 2000:
            return None
        return normalize(text)
    except Exception:
        return None


def wayback_fetch(url):
    """Fallback for blocked/unreachable pages: fetch the most recent Wayback
    Machine snapshot. Returns (normalized_text, 'YYYY-MM-DD' crawl date) or
    (None, None) if the archive has no usable capture."""
    try:
        cdx = ("http://web.archive.org/cdx/search/cdx?url=" + quote(url, safe="") +
               "&output=json&fl=timestamp,original&filter=statuscode:200"
               "&collapse=digest&limit=-5")
        r = requests.get(cdx, headers={"User-Agent": UA}, timeout=30)
        rows = r.json()
        if not rows or len(rows) < 2:        # rows[0] is the header
            return None, None
        ts, original = rows[-1][0], rows[-1][1]    # most recent capture
        time.sleep(REQUEST_DELAY)                   # pace the two archive.org calls
        # "id_" returns the raw archived page without Wayback's injected toolbar
        snap = "https://web.archive.org/web/{}id_/{}".format(ts, original)
        r2 = requests.get(snap, headers={"User-Agent": UA}, timeout=40, allow_redirects=True)
        if r2.status_code != 200:
            return None, None
        text = decoded(r2)
        if len(text) < 2000:
            return None, None
        crawl_date = "{}-{}-{}".format(ts[0:4], ts[4:6], ts[6:8])
        return normalize(text), crawl_date
    except Exception:
        return None, None


def count(text, phrase):
    return len(re.findall(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text))


def prior_live_counts(entry, domain, nkw, before_date):
    """Most recent prior scan (before `before_date`) where `domain` was measured
    live or manually — never from Wayback. Returns (column_values, origin_date)
    or (None, None). Lets a blocked page reuse its last real counts instead of
    reaching for a years-old archive."""
    scans = (entry or {}).get("scans", {})
    for d in sorted(scans.keys(), reverse=True):
        if d >= before_date:
            continue
        scan = scans[d]
        sites = scan.get("sites", [])
        idx = next((i for i, s in enumerate(sites) if s.get("domain") == domain), None)
        if idx is None:
            continue
        s = sites[idx]
        if not s.get("ok") or s.get("archived") or s.get("source") in ("wayback", "none"):
            continue
        cnts = scan.get("counts", [])
        if len(cnts) != nkw:
            continue
        col = [cnts[r][idx] for r in range(nkw)]
        origin = s.get("carried_from") or d        # propagate the real measurement date
        return col, origin
    return None, None


def short_label(domain):
    name = domain.replace("www.", "").split(".")[0]
    return name[:14]


def scan_page(target_url, cfg, report_item, date, entry):
    """Build one day's scan for a single target page."""
    kw = cfg["kw"]
    competitors = report_item.get("top_10_competitors", [])

    sites = []        # column metadata
    urls = []         # source URL per column (for fetching)
    target_netloc = urlparse(target_url).netloc.replace("www.", "")

    for c in competitors:
        url = c.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        if url.rstrip("/") == target_url.rstrip("/"):
            continue  # the target itself — added separately as the Avana column
        if any(sd in domain for sd in SKIP_DOMAINS):
            continue
        label = short_label(domain)
        if domain == target_netloc:
            # another of our own pages ranking — disambiguate from the target
            seg = [p for p in urlparse(url).path.split("/") if p]
            tail = seg[-1] if seg else "page"
            domain = domain + "/" + tail
            label = "Avana·" + tail[:10]
        sites.append({"label": label, "domain": domain,
                      "pos": c.get("position"), "avana": False})
        urls.append(url)

    # Avana target column (always present, even if not ranking)
    pos = report_item.get("position")
    sites.append({"label": "Avana", "domain": urlparse(target_url).netloc.replace("www.", ""),
                  "pos": pos if isinstance(pos, int) else None, "avana": True})
    urls.append(target_url)

    # Fetch each column. Source preference (recorded in site["source"]):
    #   "live"    — fetched live just now
    #   blocked   -> fetch the Wayback snapshot AND look up the last live/manual
    #                count in history, then keep whichever is more RECENT:
    #     "carried" — last live/manual count is newer (site["carried_from"])
    #     "wayback" — the Wayback crawl is newer (site["archived"] = crawl date)
    #   "none"    — unreachable everywhere
    texts = []            # per-column normalized text (None when not text-sourced)
    override = {}         # column index -> precomputed counts column (carried)
    for i, (site, url) in enumerate(zip(sites, urls)):
        if i > 0:
            time.sleep(REQUEST_DELAY)     # pace requests across columns
        t = fetch_text(url)
        if t is not None:
            site["ok"], site["source"] = True, "live"
            texts.append(t)
            continue
        # live blocked — gather both fallbacks, then pick the freshest by date
        col, origin = prior_live_counts(entry, site["domain"], len(kw), date)
        wb_text, crawl_date = wayback_fetch(url)
        use_carry = col is not None and (wb_text is None or origin >= crawl_date)
        if use_carry:
            site["ok"], site["source"] = True, "carried"
            site["carried_from"] = origin
            override[i] = col
            texts.append(None)
            print(f"    (carried forward: {site['domain']} from {origin})")
        elif wb_text is not None:
            site["ok"], site["source"] = True, "wayback"
            site["archived"] = crawl_date         # served from archive, not live
            texts.append(wb_text)
            print(f"    (archived fallback: {site['domain']} @ {crawl_date})")
        else:
            site["ok"], site["source"] = False, "none"
            texts.append(None)

    # counts[keyword_index][site_index]
    counts = []
    for r, (_, variants) in enumerate(kw):
        row = []
        for i, t in enumerate(texts):
            if i in override:
                row.append(override[i][r])
            else:
                row.append(sum(count(t, v) for v in variants) if t else 0)
        counts.append(row)

    return {
        "sites": sites,
        "counts": counts,
    }


def main():
    import sys
    # Optional CLI arg: a specific report date (YYYY-MM-DD) to scan/backfill.
    # NOTE: keyword counts always come from the LIVE pages at run time, so
    # backfilling a past date reflects today's page content (only that day's
    # competitor SET and SERP positions are historical).
    date = sys.argv[1] if len(sys.argv) > 1 else datetime.now(MIAMI).strftime("%Y-%m-%d")
    report_path = f"reports/{date}.json"
    if not os.path.exists(report_path):
        # fall back to the newest dated report
        dated = sorted(glob.glob("reports/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].json"))
        if not dated:
            print("keyword_scan: no report file found; skipping.")
            return
        report_path = dated[-1]
        date = os.path.basename(report_path)[:10]
    with open(report_path, encoding="utf-8") as fh:
        report = json.load(fh)

    by_url = {r.get("target_url"): r for r in report}

    hist_path = "reports/keyword-history.json"
    history = {}
    if os.path.exists(hist_path):
        try:
            with open(hist_path, encoding="utf-8") as fh:
                history = json.load(fh)
        except Exception:
            history = {}

    for target_url, cfg in PAGES.items():
        item = by_url.get(target_url)
        if not item:
            print(f"keyword_scan: no report row for {target_url}; skipping.")
            continue
        slug = cfg["slug"]
        entry = history.get(slug, {})
        print(f"Scanning keywords for {slug} ({date})...")
        scan = scan_page(target_url, cfg, item, date, entry)

        entry["keyword"] = item.get("keyword", "")
        entry["target_url"] = target_url
        entry["lang"] = cfg["lang"]
        entry["keywords"] = [label for label, _ in cfg["kw"]]
        scans = entry.get("scans", {})
        scans[date] = scan
        entry["scans"] = scans
        history[slug] = entry

    with open(hist_path, "w", encoding="utf-8") as fh:
        json.dump(history, fh, ensure_ascii=False)

    js = "// Auto-generated by keyword_scan.py — do not edit manually\n"
    js += "window.KEYWORD_HISTORY = " + json.dumps(history, ensure_ascii=False) + ";\n"
    with open("reports/keyword-history.js", "w", encoding="utf-8") as fh:
        fh.write(js)

    print(f"keyword_scan: wrote {len(history)} page(s) to keyword-history.json/.js")


if __name__ == "__main__":
    main()
