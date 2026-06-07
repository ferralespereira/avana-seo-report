---
name: project-overview
description: What this project is, what it tracks, and how it's structured
metadata:
  type: project
---

This is an SEO rank tracking tool for **Avana Plastic Surgery** (`avanaplasticsurgery.com`), a plastic surgery clinic in Miami, Florida.

## What it does
- Checks Google search rankings daily for 4 keywords (2 English, 2 Spanish) using the Serper API
- Tracks where Avana's target pages rank vs. the top 10 competitors for each keyword
- Displays results as an interactive Chart.js line chart on a GitHub Pages site
- Stores historical data in `reports/YYYY-MM-DD.json` files

## Keywords tracked
| Keyword | Target URL |
|---|---|
| lipo 360 miami | avanaplasticsurgery.com/lipo-360-miami |
| liposucción 360 en miami | avanaplasticsurgery.com/espanol/lipo-360-en-miami |
| breast implants miami | avanaplasticsurgery.com/breast-implants-miami |
| implantes de senos en miami | avanaplasticsurgery.com/espanol/implantes-de-senos-en-miami |

## Key files
- `seo_check.py` — fetches rankings from Serper, saves JSON reports, regenerates `chart-data.js`
- `reports/chart-data.js` — auto-generated JS file consumed by the chart on the HTML pages
- `lipo-360-miami.html` — chart page for the English lipo 360 keyword
- `.github/workflows/seo-check.yml` — GitHub Actions workflow that runs everything daily at 7am Miami time
- `reports/YYYY-MM-DD.json` — daily ranking snapshots

## Automation
Fully automated via GitHub Actions — see [[project-automation]] for details.

## Location targeting
Serper is configured to return results for Miami, Florida, United States (`gl: us`, `location: Miami, Florida, United States`). Results are non-personalized Google organic results (no ads).
