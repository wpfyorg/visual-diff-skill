<h1 align="center">visual-diff</h1>

<p align="center">
  <strong>Catch visual regressions with your AI agent — diff two renderings of a site, read one tiny report, open an image only when something breaks.</strong>
</p>

<p align="center">
  <em>A portable, agent-installable visual regression / screenshot-diff skill powered by <a href="https://github.com/dmtrKovalenko/odiff">odiff</a> + Playwright.</em>
</p>

<p align="center">
  <a href="#install-just-ask-your-agent">Install</a> •
  <a href="#why-we-built-it">Why</a> •
  <a href="#how-it-works">How it works</a> •
  <a href="#usage">Usage</a> •
  <a href="#commands--flags">Commands</a> •
  <a href="#configuration">Config</a> •
  <a href="#faq">FAQ</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/wpfyorg/visual-diff-skill?style=flat&color=blue" alt="MIT License"></a>
  <a href="https://github.com/wpfyorg/visual-diff-skill/stargazers"><img src="https://img.shields.io/github/stars/wpfyorg/visual-diff-skill?style=flat&color=yellow" alt="Stars"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat&logo=node.js&logoColor=white" alt="Node 18+">
  <img src="https://img.shields.io/badge/engine-odiff-ff00ff?style=flat" alt="odiff">
  <img src="https://img.shields.io/badge/Agent%20Skill-compatible-000000?style=flat" alt="Agent Skill compatible">
</p>

---

**visual-diff** is an [Agent Skill](https://github.com/vercel-labs/agent-skills) for AI coding assistants. It captures every page in a list from two URLs — a **local** build and a **live**/staging build — diffs each pair with the native **odiff** engine, and writes a compact pass/fail table. Your agent reads the table and only opens a highlighted diff image for the pages that actually changed. No more burning context on full-page screenshots to prove two sites match.

Use it to **verify a migration or port, check visual parity after a refactor, QA a redesign before shipping, or run pixel-accurate visual regression testing** straight from your agent.

> Works in **Claude Code**, **Claude Desktop**, **OpenAI Codex**, **Google Antigravity**, **Cursor**, and **opencode** — plus any agent that can read a Markdown skill and run Node.

---

## Install (just ask your agent)

The fastest way to install visual-diff is to **let your AI agent do it.** Paste this one line into Claude Code, Codex, Cursor, opencode, Antigravity, or Claude Desktop:

```text
If you are an agent, read https://github.com/wpfyorg/visual-diff-skill/blob/master/LLM-INSTALL.md and install this stack.
```

The agent reads [`LLM-INSTALL.md`](LLM-INSTALL.md) — a step-by-step guide written for the agent — then places the skill in the right folder for your tool, installs the dependencies, and verifies it works. If it gets stuck, point it at [`skills/visual-diff/SKILL.md`](skills/visual-diff/SKILL.md), which is self-describing.

### Or install with one command (Agent Skills CLI)

If your tool supports the open [`npx skills add`](https://github.com/vercel-labs/agent-skills) standard (Claude Code, Codex, Cursor, opencode, and more):

```bash
npx skills add https://github.com/wpfyorg/visual-diff-skill --skill visual-diff
cd ~/.claude/skills/visual-diff && npm install && npx playwright install chromium   # install runtime deps
```

### Or install manually

```bash
git clone https://github.com/wpfyorg/visual-diff-skill
cp -R visual-diff-skill/skills/visual-diff ~/.claude/skills/visual-diff   # adjust path for your tool
cd ~/.claude/skills/visual-diff
npm install && npx playwright install chromium
```

Then copy `config.example.json` into your project as `visual-diff.config.json` and edit it.

---

## Compatibility

| Tool | Where the skill goes | Trigger |
|---|---|---|
| **Claude Code** | `~/.claude/skills/visual-diff/` (global) or `.claude/skills/visual-diff/` (project) | `/visual-diff` |
| **Claude Desktop** | Settings → Capabilities → **Skills** → add the folder | invoke "visual-diff" |
| **OpenAI Codex** | `.agents/skills/visual-diff/` (+ a `/visual-diff` prompt) | `/visual-diff` |
| **Google Antigravity** | `.agents/skills/visual-diff/` | `/visual-diff` |
| **Cursor** | `.cursor/commands/visual-diff.md` or `.cursor/rules/` | `/visual-diff` |
| **opencode** | `.opencode/command/visual-diff.md` or `~/.config/opencode/` | `/visual-diff` |
| **Any Markdown-skill agent** | wherever it reads skills; just run the Node script | run the script |

The skill is **just a folder of Markdown + Node** — no proprietary format. If your agent can read a `SKILL.md` and shell out to `node`, it can run visual-diff.

---

## Why we built it

We were porting a hand-authored static site into a WordPress/Bricks Builder build, page by page. Every time we changed a section we needed to answer one question: *does the live build still match the source?*

The naive way an AI agent does this is brutal on tokens — it screenshots both sites full-page and reads two giant PNGs **per page** into context, then eyeballs the difference. Fourteen pages × two renderings × desktop + mobile is a context bloodbath, and "looks about right" is not a real gate.

So we flipped it. Let a **deterministic image differ** do the matching and emit a number. The agent reads a one-line-per-page table, sees `✅ pass` / `❌ fail`, and opens an actual image **only** for the handful of pages that regressed. Same verification, a fraction of the tokens, and a hard numeric acceptance gate (default `< 0.1%` pixel difference) instead of vibes.

It turned out to be useful far beyond our migration — any time you have "the same pages rendered two ways" (refactor vs. main, staging vs. prod, framework A vs. framework B, before vs. after a dependency bump), this is the skill.

---

## Pick your consistency target

Tell your agent how close the two builds must match and let it loop. "Consistency" is just
`100% − diff%`, which maps directly to the skill's `--threshold` gate. Paste one of these:

| You want… | Threshold | Paste this to your agent |
|---|---:|---|
| **90% consistency** *(rough parity — early porting)* | `10` | `Run /visual-diff with --threshold 10. Fix every ❌ fail in my source, then re-run until all pages pass. Read only report.md; open a diff image only for failing rows.` |
| **95% consistency** *(close — pre-review)* | `5` | `Run /visual-diff with --threshold 5. Iterate: for each ❌ fail, open its diff*.png, fix the source, re-run that page, repeat until every page passes at 95%.` |
| **99% consistency** *(tight — pre-ship QA)* | `1` | `Get my live build to 99% visual parity with local. Run /visual-diff --threshold 1, fix each failing region (font, spacing, color, radius, icon size), and don't stop until all pages pass.` |
| **99.9% — default** *(pixel-perfect)* | `0.1` | `Run /visual-diff and don't declare done until every page is under the 0.1% gate.` |

**How the agent hits the target.** The skill turns "make it consistent" into a closed loop
the agent can run unattended:

1. **Set the gate** — your target becomes `--threshold (100 − target)`, so 95% → `--threshold 5`.
2. **Measure** — the runner diffs every page and writes `report.md` with a real number per page.
3. **Triage cheaply** — the agent reads only the table and opens a `diff*.png` **only** for `❌ fail` rows (changed pixels are magenta), so it sees exactly *where* a page drifts.
4. **Fix the source** — it edits your code/build for each failing region. The usual culprits are named for it: font fallback, letter-spacing, line-height, an off-by-a-hex brand color, border-radius, icon size, section padding.
5. **Re-run the failing page** — `--page <slug>` re-checks just that one, fast.
6. **Loop until green** — repeat 3–5 until every page is under the gate. Exit code `0` is the agent's stop signal; `2` means keep going.

The numeric gate is what makes this work without you in the loop: the agent has an objective
"am I done yet?" instead of guessing from screenshots.

---

## How it works

```
        local base                     live base
   http://127.0.0.1:8765        https://staging.example.com
            |                              |
            v                              v
   +-----------------------------------------------+
   |  Playwright (headless Chromium)               |
   |  - reduced-motion -> deterministic frames     |
   |  - waits document.fonts.ready -> stable text  |
   |  - optional full-page scroll to fire reveals  |
   +-----------------------------------------------+
            | local.png                    | live.png
            +--------------+----------------+
                           v
              +-------------------------+
              |  odiff (native, fast)   |
              |  - pads size mismatches |
              |  - highlights changes   |  -> diff.png  (magenta #ff00ff)
              |  - returns diff %       |
              +-------------------------+
                           v
              report.md  <-  the ONLY thing the agent reads
   +-------------------------------------------------------+
   | | Page     | Viewport | Diff % | Status | Diff image| |
   | | homepage | desktop  | 0.00%  | pass   | -         | |
   | | pricing  | desktop  | 2.41%  | fail   | diff.png  | |
   +-------------------------------------------------------+
```

1. **Capture** — For each page, Playwright loads the same `path` from both bases at a fixed viewport (desktop 1280×800; add mobile 390×844 with `--mobile`). It emulates `prefers-reduced-motion` to freeze animations, waits for web fonts so text metrics are identical, and (with `--full`) scrolls the page to trigger `IntersectionObserver` reveal animations before shooting.
2. **Diff** — [odiff](https://github.com/dmtrKovalenko/odiff) compares the two PNGs natively (much faster than pixelmatch on full pages). If the two images differ in size (e.g. the live page is taller), both are padded onto a shared canvas so a height difference correctly *raises* the diff % instead of erroring out. Changed pixels are painted magenta in `diff.png`.
3. **Gate & report** — Each page passes when its diff is below the threshold (default **0.1%**). The runner writes `report.md` (a small table), `report.json` (machine-readable), and the per-page PNGs. Exit code is `0` if everything passes, `2` if anything fails — so it drops straight into CI.
4. **The token-saving discipline** — Your agent reads **only `report.md`**, then opens a `diff*.png` **only for `❌ fail` rows**. Passing pages are never loaded into context.

---

## Usage

1. **Start your local server** at whatever `localBase` points to — e.g. `python3 -m http.server 8765 --directory web`, `npm run dev`, etc.
2. **Trigger the skill** in your agent (`/visual-diff`) or run the script directly:

```bash
node ~/.claude/skills/visual-diff/scripts/visual-diff.mjs            # all pages, desktop
node ~/.claude/skills/visual-diff/scripts/visual-diff.mjs --mobile   # + mobile viewport
node ~/.claude/skills/visual-diff/scripts/visual-diff.mjs --full     # full-page captures
node ~/.claude/skills/visual-diff/scripts/visual-diff.mjs --page pricing
```

3. **Read `tmp/visual-diff/<run>/report.md`.** Open a `diff*.png` only for failing rows.

Output lands in `<cwd>/tmp/visual-diff/<run-timestamp>/`:

```
tmp/visual-diff/2026-06-23T04-08-00Z/
├── report.md        <- read this
├── report.json      <- machine-readable (CI)
└── homepage/
    ├── local.png  live.png  diff.png
```

---

## Commands & flags

| Flag | Effect |
|---|---|
| *(none)* | All pages, desktop 1280×800 |
| `--page <slug>` | Diff a single page from the manifest |
| `--mobile` | Also capture mobile 390×844 |
| `--full` | Full-page captures (scrolls to trigger reveals; size diffs are padded) |
| `--local-base <url>` | Override the local base URL |
| `--live-base <url>` | Override the live base URL |
| `--threshold <n>` | Override the pass gate (percent, default `0.1`) |
| `--config <file>` | Use a specific config file |
| `--pages <file>` | Use a specific pages manifest |
| `--help` | Print usage |

**Exit codes:** `0` = every page within the gate · `2` = one or more fail/error.

---

## Configuration

Create `visual-diff.config.json` in your project root (copy `config.example.json`):

```json
{
  "localBase": "http://127.0.0.1:8765",
  "liveBase":  "https://staging.example.com",
  "thresholdPct": 0.1,
  "pages": [
    { "slug": "homepage", "path": "/" },
    { "slug": "pricing",  "path": "/pricing/" },
    { "slug": "about",    "path": "/about/" }
  ]
}
```

`path` is shared between both bases. You can keep pages in a separate `visual-diff.pages.json` (`{ "pages": [...] }`) instead — the runner auto-discovers it.

**Config resolution order** (highest priority first):

1. **CLI flag** — `--local-base`, `--live-base`, `--page`, `--pages`, `--threshold`, `--config`
2. **Env var** — `VDIFF_LOCAL_BASE`, `VDIFF_LIVE_BASE`, `VDIFF_PAGES`, `VDIFF_THRESHOLD`
3. **`visual-diff.config.json`** in the current working directory
4. **Built-in defaults** — `localhost:8765` vs `localhost:8766`, single `/` page, `0.1%` gate

---

## Dependencies

| Dependency | Why |
|---|---|
| **Node.js ≥ 18** | runtime |
| [`odiff-bin`](https://www.npmjs.com/package/odiff-bin) | native, fast image diffing |
| [`playwright`](https://www.npmjs.com/package/playwright) | headless Chromium capture (`npx playwright install chromium`) |
| [`pngjs`](https://www.npmjs.com/package/pngjs) | size-mismatch padding + diff re-encode so the image is vision-API readable |

Install all three inside the skill folder: `npm install && npx playwright install chromium`.

---

## FAQ

**Is this only for static sites?** No. Any two URLs that render the same `path` work — staging vs. prod, a refactor branch served on another port vs. main, framework A vs. framework B, before/after a redesign.

**A page fails but looks identical to me.** Live captures can be noisy — cookie banners, late-loading fonts, lazy content, A/B variants. Re-run first. If it persists, raise the per-pixel `threshold` or add `ignoreRegions` in [`scripts/lib/odiff-compare.mjs`](skills/visual-diff/scripts/lib/odiff-compare.mjs). Common real causes: font fallback, letter-spacing, line-height, an off-by-a-hex brand color, border-radius, icon size, or section padding.

**Why odiff instead of pixelmatch?** odiff is a native binary and dramatically faster on full-page screenshots, and it returns a clean diff percentage the runner can gate on without decoding the image.

**Does it work in CI?** Yes — it's a plain Node script with a meaningful exit code (`2` on any failure) and a `report.json`. Start your server, run it, fail the job on exit `2`.

**Can the agent install it itself?** That's the intended path — see [Install (just ask your agent)](#install-just-ask-your-agent).

---

## License

[MIT](LICENSE) © wpfyorg. No project-specific URLs or paths remain in this build — drop it into any repo.

<sub>Keywords: visual regression testing · screenshot diff · pixel diff · odiff · Playwright · AI agent skill · Claude Code skill · Codex skill · Cursor · opencode · Antigravity · visual QA · CI visual testing · migration parity check.</sub>
