# LLM-INSTALL - visual-diff

**If you are an AI agent, read this file and install this stack.** This document is
written for you (the coding agent), not the human. Follow every step, then report back.

You are installing the **visual-diff** agent skill from
<https://github.com/wpfyorg/visual-diff-skill> for **whatever coding tool you are**
(Claude Code, Claude Desktop, OpenAI Codex, Google Antigravity, Cursor, opencode, or any
agent that can read a Markdown skill and run Node).

---

## Steps

### 1. Fetch the repo

Either:

```bash
git clone https://github.com/wpfyorg/visual-diff-skill /tmp/visual-diff-skill
```

…or download just the `skills/visual-diff/` folder. The complete skill lives in
`skills/visual-diff/` and contains:

```
skills/visual-diff/
├── SKILL.md              # the skill instructions (self-describing)
├── package.json          # deps: odiff-bin, playwright, pngjs
├── config.example.json   # template the human will copy
└── scripts/
    ├── visual-diff.mjs    # the runner
    └── lib/{capture,odiff-compare}.mjs
```

### 2. Copy the ENTIRE `skills/visual-diff/` folder into your skills directory

Keep the folder intact. Use the correct location **for whatever tool you are**:

| If you are… | Put the folder here |
|---|---|
| **Claude Code** | `~/.claude/skills/visual-diff/` (global) or `.claude/skills/visual-diff/` (project) |
| **Claude Desktop** | Add it as a Skill under Settings → Capabilities → Skills (zip the folder if upload is required) |
| **OpenAI Codex** | `.agents/skills/visual-diff/` (project) or the `~/.codex/` equivalent; also expose it as a `/visual-diff` prompt |
| **Google Antigravity** | `.agents/skills/visual-diff/` |
| **Cursor** | `.cursor/commands/visual-diff.md` (or `.cursor/rules/`) pointing at the SKILL.md instructions |
| **opencode** | `.opencode/command/visual-diff.md` (or `~/.config/opencode/`) referencing the SKILL.md |
| **Any other** | Wherever you read skills from; at minimum keep `scripts/` so you can run the Node runner |

If you support the [`npx skills add`](https://github.com/vercel-labs/agent-skills)
standard, you may instead run:

```bash
npx skills add https://github.com/wpfyorg/visual-diff-skill --skill visual-diff
```

### 3. Install the Node dependencies INSIDE the copied skill folder

The runner resolves its dependencies (`odiff-bin`, `playwright`, `pngjs`) from the skill
folder at runtime, so install them there - **not** in the user's project:

```bash
cd <skills-dir>/visual-diff
npm install
npx playwright install chromium
```

Requires **Node ≥ 18**.

### 4. Tell the human to create a config

Instruct them to copy `config.example.json` into their project root as
`visual-diff.config.json`, then set `localBase`, `liveBase`, and the `pages` list:

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

### 5. Verify the install

```bash
node <skills-dir>/visual-diff/scripts/visual-diff.mjs --help
```

Confirm it prints usage with no error.

---

## Then report back to the human

1. Confirm the skill is registered and where you placed it.
2. Tell them how to trigger it in this tool (e.g. `/visual-diff`).
3. Remind them to start their local server (at `localBase`) before the first run, and to
   create `visual-diff.config.json` if they haven't yet.

## How to actually use it once installed

- Read [`skills/visual-diff/SKILL.md`](skills/visual-diff/SKILL.md) - it is self-describing.
- The discipline: run the runner → read **only** `tmp/visual-diff/<run>/report.md` → open a
  `diff*.png` **only** for `❌ fail` rows → fix the source → re-run until the gate passes.
- Exit code `0` = all pages within the gate, `2` = one or more fail/error.
