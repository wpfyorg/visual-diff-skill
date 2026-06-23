# visual-diff (portable skill)

A self-contained, project-agnostic version of the `/visual-diff` skill. Captures the
same set of pages from two bases (a **local** rendering and a **live** rendering),
diffs each pair with [odiff](https://github.com/dmtrKovalenko/odiff), and writes a
compact `report.md` so an agent can verify parity **without reading full-page
screenshots** — it only opens a diff image for rows that fail.

Originally built for a static-site → WordPress/Bricks migration; this build strips all
project specifics so it drops into any repo.

## Contents

```
visual-diff/
├── SKILL.md                # the agent-facing skill (Claude Code / compatible)
├── config.example.json     # copy to <project>/visual-diff.config.json and edit
├── package.json            # declares odiff-bin, playwright, pngjs
├── README.md               # this file
└── scripts/
    ├── visual-diff.mjs     # batch runner (config/env/flag driven)
    └── lib/
        ├── capture.mjs       # headless-Chromium capture (reduced-motion, font-stable)
        └── odiff-compare.mjs # odiff wrapper + size-mismatch padding + pass gate
```

## Install

```bash
# from inside the skill folder, or add these deps to your host project
npm install
npx playwright install chromium
```

## Configure

Create `visual-diff.config.json` in the project you want to test (copy
`config.example.json`):

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

`path` is shared between both bases. Pages can instead live in a sibling
`visual-diff.pages.json` (`{ "pages": [...] }`), which the runner auto-discovers.

## Run

```bash
node scripts/visual-diff.mjs                 # all pages, desktop 1280×800
node scripts/visual-diff.mjs --mobile        # + mobile 390×844
node scripts/visual-diff.mjs --full          # full-page captures
node scripts/visual-diff.mjs --page pricing  # one page by slug
node scripts/visual-diff.mjs --local-base http://127.0.0.1:3000 --live-base https://prod.example.com
node scripts/visual-diff.mjs --config ./other.config.json
```

Output: `<cwd>/tmp/visual-diff/<run-timestamp>/` containing `report.md`, `report.json`,
and per-page `local.png` / `live.png` / `diff.png`.

**Exit codes:** `0` = every page within the gate, `2` = one or more fail/error.

## Config resolution

Highest priority first:

1. CLI flag — `--local-base`, `--live-base`, `--page`, `--pages <file>`, `--threshold`, `--config`
2. Env var — `VDIFF_LOCAL_BASE`, `VDIFF_LIVE_BASE`, `VDIFF_PAGES`, `VDIFF_THRESHOLD`
3. `visual-diff.config.json` in the current working directory
4. Built-in defaults (`localhost:8765` vs `localhost:8766`, single `/` page, 0.1% gate)

## How the token-saving works

`odiff` returns the diff **percentage** per page. The runner gates each at
`thresholdPct` and writes a one-line table row. An agent reads only `report.md`, then
opens `diff*.png` for `❌ fail` rows — never the passing pairs. Diff regions are
highlighted in magenta (`#ff00ff`); mismatched image sizes are padded onto a shared
canvas so a height difference correctly raises the diff % instead of erroring out.

## License / provenance

Diffing via `odiff-bin`. Capture via Playwright Chromium. No project-specific code or
URLs remain in this build — safe to commit into any repo.
