---
name: visual-diff
description: Compare two renderings of the same set of pages — a "local" base against a "live" base — using odiff, and report which pages match. Use to verify a port/migration, check parity after edits, or QA before shipping, instead of eyeballing full-page screenshots. Triggered by /visual-diff.
trigger: /visual-diff
user-invocable: true
argument-hint: "[page-slug] [--mobile] [--full]"
disable-model-invocation: true
---

# /visual-diff

Run an odiff-powered visual comparison of two sites (a **local** base vs a **live**
base) and report results **without burning tokens on full-page screenshots**. The
batch runner writes a compact `report.md`; you read that, and open a diff image
*only* for pages that fail.

This is a portable build — nothing is hard-coded to one project. Bases and the page
list come from config (see **Setup** below).

## Why this exists

Manually comparing two renderings by reading two full-page PNGs per page is slow and
token-expensive. `scripts/visual-diff.mjs` captures both sides, diffs them with odiff
(native, fast), and emits a machine-readable report. The diff numbers do the matching;
you only look at images when something is actually off.

## Setup (once per project)

1. Install the runtime deps in the host project (or globally):
   ```bash
   npm install --save-dev odiff-bin playwright pngjs
   npx playwright install chromium
   ```
2. Create a `visual-diff.config.json` in the project root. Copy `config.example.json`
   from this skill and edit the two bases + page list:
   ```json
   {
     "localBase": "http://127.0.0.1:8765",
     "liveBase":  "https://staging.example.com",
     "thresholdPct": 0.1,
     "pages": [
       { "slug": "homepage", "path": "/" },
       { "slug": "pricing",  "path": "/pricing/" }
     ]
   }
   ```
   Alternatively keep pages in a separate `visual-diff.pages.json` (`{ "pages": [...] }`)
   — the runner auto-discovers it.

## Steps

1. **Ensure the local server is running** at the `localBase` URL. If it isn't, start
   whatever serves the project (e.g. `python3 -m http.server 8765 --directory web`,
   `npm run dev`, etc.) in the background.

2. **Run the comparison.** Pass `$ARGUMENTS` through:
   - no arg → all pages, desktop viewport
   - a slug (e.g. `pricing`) → `--page <slug>`
   - `--mobile` → also capture 390×844
   - `--full` → full-page captures (padded diff; height differences raise the %)
   ```bash
   node path/to/skills/visual-diff/scripts/visual-diff.mjs [--page <slug>] [--mobile] [--full]
   ```
   Bases can also be overridden ad-hoc: `--local-base <url> --live-base <url>`.
   The command prints the run directory, e.g. `tmp/visual-diff/<run>/`.

3. **Read ONLY `tmp/visual-diff/<run>/report.md`.** It is a small table:
   `Page | Viewport | Diff % | Status | Diff image`.

4. **For rows marked `❌ fail` (and only those), open the listed `diff*.png`** with the
   Read tool to see the changed regions (highlighted in magenta `#ff00ff`). Do **not**
   read `local.png` / `live.png` unless the diff image alone is ambiguous. Skip
   `✅ pass` rows entirely — they are within the gate.

5. **Report** the pass/fail table back to the user. For each failure, name the likely
   cause from the usual mismatch sources: font loading / fallback, letter-spacing,
   line-height, exact brand-color hex, border-radius, SVG/icon size, section padding,
   or a missing/resized section (large diff % with a "size mismatch" note).

## Notes

- The acceptance gate defaults to `< 0.1%` diff. Override with `thresholdPct` in config,
  `--threshold <n>`, or `VDIFF_THRESHOLD`.
- Exit code 0 = all pass; 2 = one or more fail/error.
- Output lands in `<cwd>/tmp/visual-diff/<run>/`.
- Live captures can be flaky (cookie banners, late-loading fonts/content). If a failure
  looks like noise rather than a real mismatch, re-run; persistent false positives mean
  tuning the odiff `threshold` or adding `ignoreRegions` in `scripts/lib/odiff-compare.mjs`.
- Config resolution order (highest first): CLI flag → env var (`VDIFF_LOCAL_BASE`,
  `VDIFF_LIVE_BASE`, `VDIFF_PAGES`, `VDIFF_THRESHOLD`) → `visual-diff.config.json` →
  built-in defaults.
