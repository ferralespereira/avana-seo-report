---
name: project-automation
description: How seo_check.py runs automatically and how chart-data.js gets updated
metadata:
  type: project
---

`seo_check.py` runs automatically via GitHub Actions (`.github/workflows/seo-check.yml`) every day at 7am Miami time (11:00 UTC). It fetches rankings from Serper, saves a dated JSON to `reports/`, and regenerates `reports/chart-data.js` from scratch. The workflow then commits and pushes to `main`, which triggers GitHub Pages to redeploy — no manual steps needed.

**Why:** Fully automated pipeline. The Serper API key is stored as a GitHub Actions secret (`SERPER_API_KEY`).

**How to apply:** Do not suggest setting up cron jobs or manual runs — the pipeline is already in place.
