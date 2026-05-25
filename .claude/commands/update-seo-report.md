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

### From the URL folder — read `Devices.csv`
Extract all three rows:
- Mobile: Clicks / Impressions / CTR / Position
- Desktop: Clicks / Impressions / CTR / Position
- Tablet: Clicks / Impressions / CTR / Position

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
Update the three rows (Mobile, Desktop, Tablet) with URL-filtered Devices.csv values.

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

## Notes

- **Always use keyword-filtered data for KPI cards** — not URL-filtered
- **Always use URL-filtered data for device breakdown and all-queries** — not keyword-filtered
- **Device breakdown label uses the keyword string** — not the URL
- **For large HTML replacements** (competitor table tbody > 200 lines), use Python string replacement via Bash instead of the Edit tool
- **Image files** `img/[keyword-slug]_*.png` may or may not exist — update the src regardless; note to user if images need to be uploaded
- **The HTML comment block** `<!-- <div style="margin-top:32px;">` near the competitor section is a harmless backup — leave it in place
