# Update SEO Report Page

Update an existing SEO report HTML page with fresh GSC data and competitor analysis.

## Usage
```
/update-seo-report
```
After invoking, ask the user for:
1. **Keyword slug** — the folder name inside `sources/` and the HTML filename (e.g. `miami-otoplasty`)
2. **Full keyword** — the exact search query string (e.g. `miami otoplasty`)
3. **Page URL** — the full Avana page URL (e.g. `https://avanaplasticsurgery.com/miami-otoplasty`)
4. **Competitor URLs** — 3 competitor page URLs (one per line)

If the user provides all of this in the initial message (e.g. `/update-seo-report miami-otoplasty ...`), extract them from `$ARGUMENTS` and skip asking.

---

## Step 1 — Read GSC Source Data

The sources folder lives at: `sources/[keyword-slug]/`

It always contains two sub-folders:
- `[keyword-slug] keyword/[export-folder]/` → **keyword-filtered** data
- `[keyword-slug] url/[export-folder]/` → **URL-filtered** data

Use `find sources/[keyword-slug] -name "*.csv"` to discover the exact subfolder names.

### From the KEYWORD folder — read `Queries.csv`
Find the row matching the exact keyword. Extract:
- **Clicks** (KPI card)
- **Impressions** (KPI card)
- **CTR** (KPI card)
- **Position** (KPI card)

### From the KEYWORD folder — read `Devices.csv`
The device breakdown is **keyword-filtered** (it sits under the keyword KPI cards and is labeled with the keyword). Extract whatever device rows are present:
- Mobile: Clicks / Impressions / CTR / Position
- Desktop: Clicks / Impressions / CTR / Position
- Tablet: Clicks / Impressions / CTR / Position

**The keyword `Devices.csv` may have fewer than three rows, or only a header row.** Only render the device rows that actually exist in the CSV — do NOT pad with URL-filtered numbers or invent rows. If the file is header-only (the exact keyword had 0 impressions in the period), render an empty-state instead (see 2d).

### From the URL folder — read `Queries.csv`
- Row 1 (Pages.csv or Queries.csv totals): total Clicks / Impressions / CTR for the all-queries header
- All queries with 0 clicks and 100+ impressions → zero-click query rows (top 20, ordered by impressions desc)
- Count how many queries have 100+ impressions → use in footer text

---

## Step 2 — Update the HTML File

The target file is: `[keyword-slug].html`

### 2a. KPI Cards (keyword-filtered data)
Find the 4 `.kpi-card` divs near the top. Update:
- Clicks value
- Impressions value (formatted with comma, e.g. `2,263`)
- CTR value (e.g. `0.88%`)
- Position value (e.g. `16.59`)
- Each `.kpi-source` line should read: `[full keyword] — all devices` (first 3 cards) and `[full keyword] — primary query` (position card)

### 2b. Keyword Header & URL
- The `<h2>` keyword heading should show the full keyword
- The URL link and its copy button should show/use the page URL

### 2c. Device Breakdown Table Label
Find: `GSC — Device Breakdown for "..."` 
Update the quoted string to the **full keyword** (not the URL).

### 2d. Device Breakdown Table Rows
Update the rows with **keyword-filtered** `Devices.csv` values (from the KEYWORD folder), and label the section `(keyword-filtered)`.
- Render only the device rows that exist in the keyword `Devices.csv`. If the CSV has just Mobile + Desktop (no Tablet), render only those two — drop the Tablet row. Never pad with URL-filtered values.
- **If the keyword `Devices.csv` is header-only (no device rows)**, replace the table body with a single empty-state row instead:
  ```html
  <tr><td colspan="5" style="padding:18px 14px;text-align:center;color:#999;font-style:italic;">No device data &mdash; the keyword "[full keyword]" had 0 impressions in GSC for this period, so the keyword-filtered device export is empty.</td></tr>
  ```
  In that case, surface the URL-level reach (impressions / avg position from `Pages.csv`) in the all-queries section below — not in this table.

### 2e. All-Queries Collapsible Section Header
Find the blue collapsible `<details>` block. Update:
- Total clicks
- Total impressions  
- CTR percentage
These come from URL-filtered `Pages.csv` (the single row for this page).

### 2f. Zero-Click Queries Table
Replace the existing rows with the top 20 zero-click queries (0 clicks, 100+ impressions, sorted by impressions descending) from URL-filtered `Queries.csv`.

Each row format:
```html
<tr>
  <td style="...">[query]</td>
  <td style="...;text-align:right;">[impressions]</td>
  <td style="...;text-align:right;">[position]</td>
</tr>
```

### 2g. Zero-Click Queries Footer
Update the footer text to:
`Showing top 20 of [N] zero-click queries with 100+ impressions`
where N = count of queries with impressions ≥ 100 in the URL-filtered Queries.csv.

### 2h. Carousel Images
Find the 3 carousel `<img>` tags (authoritylabs, semrush, google screenshots).
Update their `src` attributes to:
- `img/[keyword-slug]_authoritylabs.png`
- `img/[keyword-slug]_semrush.png`
- `img/[keyword-slug]_google.png`

---

## Step 3 — Fetch Competitor Pages

Use WebFetch on each of the 4 pages (Avana + 3 competitors):
- `[page-url]` (Avana)
- Competitor 1 URL
- Competitor 2 URL
- Competitor 3 URL

For each page extract:
| Field | What to look for |
|---|---|
| Title tag | `<title>` content |
| H1 | First `<h1>` |
| Primary keyword | Most repeated target term in title/H1/H2s |
| Secondary keywords | H2 headings list |
| Word count | Approximate body text word count |
| Cost signal | Any price mention ($X,XXX or "starting at") |
| Meta description | `<meta name="description">` |
| FAQ coverage | Does the page have an FAQ section? List topics if yes |
| Trust signals | Reviews count, board certifications, before/after photos, awards |
| CTA | Primary call-to-action text/button |
| Schema | JSON-LD types present (`MedicalProcedure`, `FAQPage`, `LocalBusiness`, etc.) |

---

## Step 4 — Rebuild Competitor Comparison Table

Find the existing `<table>` inside the competitor section (look for `<thead>` with 4 `<th>` columns after the "Competitor Analysis" heading).

Replace the entire `<table>...</table>` block including `<tbody>` with a new 4-column table:

**Columns:**
1. **Avana** — red accent (`#dc2626`) — `avanaplasticsurgery.com/[slug]`
2. **[Competitor 1 short name]** — green accent (`#16a34a`) — domain only
3. **[Competitor 2 short name]** — orange accent (`#ea580c`) — domain only
4. **[Competitor 3 short name]** — purple accent (`#7c3aed`) — domain only

**Rows (11 total):**
1. Title tag
2. H1
3. Primary keyword
4. Secondary keywords (H2s)
5. Word count
6. Cost signal
7. Meta description
8. FAQ coverage
9. Trust signals
10. CTA
11. Schema markup

**Key Takeaway Box** (below the table):
- Left panel: "Why [top competitor] ranks / what they do better" — 5 bullet points
- Right panel: "What Avana must add to dominate '[full keyword]'" — 5 actionable items

Use `python3` via Bash for large replacements (300+ lines) to avoid Edit tool size limits.

---

## Step 5 — Update index.html Dashboard

Find the `kw-group mixed-group` table in `index.html`.

Check if a row for this keyword already exists:
- **If yes**: update the impressions, clicks, and CTR values
- **If no**: add a new `<tr>` at the appropriate position

Row format:
```html
<tr>
  <td><a class="query-link" href="[keyword-slug].html"><span class="seed">[full keyword]</span></a></td>
  <td class="note-cell" contenteditable="true"></td>
  <td><a class="kw-url-link" href="[page-url]" target="_blank">/[slug]</a></td>
  <td>[impressions formatted]</td>
  <td>[clicks]</td>
  <td><span class="ctr-badge [bad|warn|good]">[CTR]</span></td>
</tr>
```

CTR badge class:
- `bad` → CTR < 0.5%
- `warn` → CTR 0.5%–2%
- `good` → CTR > 2%

Use URL-filtered totals (from `Pages.csv`) for impressions, clicks, CTR.

---

---

## Step 6 — Update avana-procedure-positioning.html

Find the entry in the `const data = [...]` array in `avana-procedure-positioning.html` that matches `page:'/[keyword-slug]'`.

Update the following fields with fresh values:
- `pos` → URL-filtered average position (from `Pages.csv`)
- `clicks` → URL-filtered total clicks
- `impr` → URL-filtered total impressions
- `ctr` → URL-filtered CTR as a decimal number (e.g. `0.09` for 0.09%)
- `kpos` → keyword-filtered position (from keyword `Queries.csv`, row matching the exact keyword)
- `kimpr` → keyword-filtered impressions
- `kctr` → keyword-filtered CTR as decimal
- `kclicks` → keyword-filtered clicks
- **Add `link:'[keyword-slug].html'`** if not already present — this makes the keyword cell a clickable link in the rankings table

If no entry exists for the page, add one in sorted order by `pos` (descending — highest pos value first).

---

## Step 7 — Add Keyword Position Tracking

This wires the page into the daily SERP/keyword-scan system so it gets a **Position Tracking chart** (Avana vs. top-10 competitors over time) and a **Daily Competitor Keyword History table**. There are **three** parts — all are required for tracking to work.

> **Skip if already wired.** First check whether the page is already tracked: grep `keyword_scan.py` for `"[page-url]"`. If a `PAGES` entry already exists, tracking is set up — only refresh data, don't duplicate.

### 7a. Add the tracking markup to `[keyword-slug].html`

Insert the tracking block **immediately after `<main class="main">`** (before the keyword header). The easiest reliable way is to copy the entire block from an already-tracked English page — **`breast-augmentation-miami.html`** is the reference (the block spans from `<!-- Position Tracking Chart -->` through the closing `</script>` of the chart IIFE, then the `<!-- Daily Competitor Keyword History -->` div + its two `<script>` tags).

After copying, replace **every** occurrence of the reference keyword/URL/slug with this page's values:
- Heading text: `Position Tracking &mdash; [full keyword]`
- Sub-label + legend URL: `avanaplasticsurgery.com/[slug]` (appears twice — header sub-label and the teal legend chip)
- `data-slug="[keyword-slug]"` on the `<div class="kw-history">`
- `const TARGET_URL = 'https://avanaplasticsurgery.com/[slug]';` in the chart `<script>`

The block depends on CSS vars `--navy`, `--midGray`, `--teal` (already present in every report page) and pulls data from `reports/chart-data.js` + `reports/keyword-history.js` via `kw-history-widget.js` and the Chart.js CDN. Until the next scan runs, the chart shows *"No tracking data found yet"* and the table shows its empty-state message — that is expected.

### 7b. Register the keyword in `seo_check.py` (drives the position chart)

Add an entry to the `keywords = [...]` list:
```python
    {"keyword": "[full keyword]",
     "url": "https://avanaplasticsurgery.com/[slug]",
     "lang": "en"},   # use "es" for Spanish pages
```
This makes the daily Serper SERP check record Avana's position + the day's top-10 competitors into `reports/<date>.json`, which `generate_chart_data()` rolls up into `reports/chart-data.js`.

### 7c. Register the page in `keyword_scan.py` (drives the history table)

1. **Create a curated keyword set** near the other `*_EN` / `*_ES` lists (15–20 rows). Each row is `("display label", ["match variant", "variant 2", ...])` — variants are lowercase, accent-free. Include the procedure terms, the `[full keyword]`, cost variants, related procedures, and the standard tail (`board certified plastic surgeon`, `plastic surgeon`, `plastic surgery`, `cosmetic surgery`). Example name: `MMO_EN` for mommy makeover.
2. **Add a `PAGES` entry:**
```python
    "https://avanaplasticsurgery.com/[slug]":
        {"slug": "[keyword-slug]", "lang": "en", "kw": MMO_EN},
```
The `slug` here must match the `data-slug` used in 7a.

### 7d. Validate

Confirm both scripts still parse:
```bash
python3 -c "import ast; ast.parse(open('keyword_scan.py',encoding='utf-8').read()); ast.parse(open('seo_check.py',encoding='utf-8').read()); print('OK')"
```
(On Windows, `python3`/`python` may not be on PATH — use the full interpreter path, e.g. `C:/Users/<user>/.local/bin/python3.14.exe`.)

---

## Notes

- **Always use keyword-filtered data for KPI cards** — not URL-filtered
- **Device breakdown uses KEYWORD-filtered data** (from the keyword folder's `Devices.csv`), labeled `(keyword-filtered)`. Render only the rows present; if header-only, use the empty-state (see 2d). Never substitute URL-filtered device numbers.
- **Always use URL-filtered data for the all-queries section** — not keyword-filtered
- **Device breakdown label uses the keyword string** — not the URL
- **For large HTML replacements** (competitor table tbody > 200 lines), use Python string replacement via Bash instead of the Edit tool
- **Image files** `img/[keyword-slug]_*.png` may or may not exist — update the src regardless; note to user if images need to be uploaded
- **The HTML comment block** `<!-- <div style="margin-top:32px;">` near the competitor section is a harmless backup — leave it in place
- **Tracking (Step 7)** is a one-time setup per page — once a page is in `keyword_scan.py`'s `PAGES` and `seo_check.py`'s `keywords`, re-running the skill should NOT add it again. Charts/tables populate on the next scan, not immediately.
- **`seo_check.py` needs the `SERPER_API_KEY` env var** to fetch rankings — same requirement as every other tracked keyword, so no new setup if the daily job already runs.
- **`data-slug` must equal the `keyword_scan.py` `slug`** (the `[keyword-slug]`), or the history table stays empty.
