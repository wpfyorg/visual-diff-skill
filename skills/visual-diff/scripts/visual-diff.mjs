#!/usr/bin/env node
/**
 * visual-diff.mjs - batch A↔B visual comparison via odiff.
 *
 * Captures each page from a "local" base and a "live" base, diffs the pair with
 * odiff, and writes a compact report. The report is the only artifact you need
 * to read: open a page's diff image ONLY when its row fails.
 *
 * Portable / exportable build: nothing here is project-specific. Bases and the
 * page list are resolved from (highest priority first):
 *   1. CLI flags        --local-base / --live-base / --page / --pages <file>
 *   2. Env vars         VDIFF_LOCAL_BASE / VDIFF_LIVE_BASE / VDIFF_PAGES /
 *                       VDIFF_THRESHOLD
 *   3. Config file      ./visual-diff.config.json in the current working dir
 *                       (or a path passed via --config <file>)
 *   4. Built-in defaults (localhost:8765 vs localhost:8766, single "/" page)
 *
 * Usage:
 *   node visual-diff.mjs                 # all pages, desktop (1280×800)
 *   node visual-diff.mjs --mobile        # desktop + mobile (390×844)
 *   node visual-diff.mjs --page <slug>   # a single page from the manifest
 *   node visual-diff.mjs --sections      # diff each <section> separately (localize a fail)
 *   node visual-diff.mjs --full          # full-page captures (padded diff)
 *   node visual-diff.mjs --local-base http://127.0.0.1:8765
 *   node visual-diff.mjs --live-base  https://staging.example.com
 *   node visual-diff.mjs --config path/to/visual-diff.config.json
 *
 * --sections auto-detects each page's <section> elements on the LOCAL page and
 * diffs each by its semantic class (hero, pricing, faq, …). A page in the manifest
 * may override detection with a `sections` array (selectors or {selector,label}).
 *
 * Exit codes: 0 = every row passes (< threshold), 2 = one or more fail/error.
 * Output: <cwd>/tmp/visual-diff/<run-timestamp>/ (report.md, report.json, PNGs).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser, captureScreenshot } from './lib/capture.mjs';
import { odiffCompare, THRESHOLD_PCT } from './lib/odiff-compare.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : fallback;
};

if (flag('--help') || flag('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 35).join('\n').replace(/^ \*\/?/gm, '').replace(/^ ?\* ?/gm, ''));
  process.exit(0);
}

// ── resolve config ────────────────────────────────────────────────────────────
// Config file: explicit --config, else ./visual-diff.config.json if present.
const configPath = opt('--config',
  existsSync(join(CWD, 'visual-diff.config.json')) ? join(CWD, 'visual-diff.config.json') : null);
const config = configPath ? JSON.parse(readFileSync(configPath, 'utf8')) : {};

const pick = (flagName, envName, cfgKey, fallback) =>
  opt(flagName, process.env[envName] ?? config[cfgKey] ?? fallback);

const LOCAL_BASE = String(pick('--local-base', 'VDIFF_LOCAL_BASE', 'localBase', 'http://127.0.0.1:8765')).replace(/\/$/, '');
const LIVE_BASE  = String(pick('--live-base',  'VDIFF_LIVE_BASE',  'liveBase',  'http://127.0.0.1:8766')).replace(/\/$/, '');
const gatePct    = Number(pick('--threshold',  'VDIFF_THRESHOLD',  'thresholdPct', THRESHOLD_PCT));
const fullPage   = flag('--full');
const onlyPage   = opt('--page', null);
const sectionsMode = flag('--sections');

const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 800 }];
if (flag('--mobile')) VIEWPORTS.push({ name: 'mobile', width: 390, height: 844 });

// ── load + filter page manifest ────────────────────────────────────────────────
// Pages come from (in order): --pages <file> / VDIFF_PAGES / config.pages /
// config.pagesFile / a visual-diff.pages.json next to the config or in cwd.
function resolvePagesFile(p) {
  if (!p) return null;
  const abs = isAbsolute(p) ? p : resolve(configPath ? dirname(configPath) : CWD, p);
  return existsSync(abs) ? abs : null;
}

let pages;
const pagesFileArg = opt('--pages', process.env.VDIFF_PAGES ?? config.pagesFile ?? null);
const pagesFile = resolvePagesFile(pagesFileArg)
  || resolvePagesFile(join(CWD, 'visual-diff.pages.json'));

if (Array.isArray(config.pages) && !pagesFileArg) {
  pages = config.pages;
} else if (pagesFile) {
  pages = JSON.parse(readFileSync(pagesFile, 'utf8')).pages;
} else {
  pages = [{ slug: 'homepage', path: '/' }];
}

if (!Array.isArray(pages) || !pages.length) {
  console.error('No pages to compare. Provide config.pages, a visual-diff.pages.json, or --pages <file>.');
  process.exit(1);
}

if (onlyPage) {
  const all = pages;
  pages = pages.filter((p) => p.slug === onlyPage);
  if (!pages.length) {
    console.error(`No page with slug "${onlyPage}". Known: ${all.map((p) => p.slug).join(', ')}`);
    process.exit(1);
  }
}

// ── run ────────────────────────────────────────────────────────────────────────
const ROOT = CWD;
const runDir = join(ROOT, 'tmp', 'visual-diff', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(runDir, { recursive: true });

console.log(`Visual diff - ${pages.length} page(s) × ${VIEWPORTS.length} viewport(s)`);
console.log(`  local: ${LOCAL_BASE}`);
console.log(`  live:  ${LIVE_BASE}`);
console.log(`  gate:  < ${gatePct}%`);
console.log(`  out:   ${runDir}\n`);

const browser = await launchBrowser();
const results = [];

for (const page of pages) {
  const pageDir = join(runDir, page.slug);
  mkdirSync(pageDir, { recursive: true });

  for (const vp of VIEWPORTS) {
    const suffix = vp.name === 'desktop' ? '' : `-${vp.name}`;

    if (!sectionsMode) {
      const row = await diffPair({ page, vp, suffix, pageDir, section: null });
      results.push(row);
      logRow(row);
      continue;
    }

    // ── section-by-section ──────────────────────────────────────────────────
    let sections;
    try {
      sections = await resolveSections(page, vp);
    } catch (err) {
      const row = { slug: page.slug, section: '(detect)', viewport: vp.name, path: page.path,
        status: 'error', message: `section detect failed: ${err.message}`, diffPercentage: null };
      results.push(row);
      logRow(row);
      continue;
    }
    if (!sections.length) {
      const row = { slug: page.slug, section: '(none)', viewport: vp.name, path: page.path,
        status: 'error', message: 'no <section> with a semantic class found on local', diffPercentage: null };
      results.push(row);
      logRow(row);
      continue;
    }
    for (const section of sections) {
      const row = await diffPair({ page, vp, suffix, pageDir, section });
      results.push(row);
      logRow(row);
    }
  }
}

await browser.close();

// ── write reports ──────────────────────────────────────────────────────────────
writeFileSync(join(runDir, 'report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  localBase: LOCAL_BASE, liveBase: LIVE_BASE,
  fullPage, thresholdPct: gatePct, results,
}, null, 2));

writeFileSync(join(runDir, 'report.md'), buildMarkdown(results, runDir));

const failed = results.filter((r) => r.status !== 'pass');
console.log(`\nReport: ${relize(join(runDir, 'report.md'), ROOT)}`);
console.log(`${results.length - failed.length}/${results.length} passed.`);
if (failed.length) {
  console.log(`Open the diff image for these rows only:`);
  for (const r of failed) console.log(`  - ${rowTag(r)} [${r.viewport}]${r.diffImage ? ` → ${r.diffImage}` : ''}`);
  process.exit(2);
}

// ── capture/diff one pair (whole page, or one section when `section` is set) ──
async function diffPair({ page, vp, suffix, pageDir, section }) {
  const stem = section ? `${slugify(section.label)}${suffix}` : null;
  const localPath = join(pageDir, section ? `${stem}-local.png` : `local${suffix}.png`);
  const livePath = join(pageDir, section ? `${stem}-live.png` : `live${suffix}.png`);
  const diffPath = join(pageDir, section ? `${stem}-diff.png` : `diff${suffix}.png`);
  const row = { slug: page.slug, viewport: vp.name, path: page.path };
  if (section) row.section = section.label;

  try {
    await captureScreenshot({
      url: LOCAL_BASE + page.path, outPath: localPath,
      full: fullPage, width: vp.width, height: vp.height, browser,
      selector: section ? section.selector : null,
    });
    await captureScreenshot({
      url: LIVE_BASE + page.path, outPath: livePath,
      full: fullPage, width: vp.width, height: vp.height, browser,
      timeout: 45_000, // remote/live side is usually slower than localhost
      selector: section ? section.selector : null,
    });

    const cmp = await odiffCompare(localPath, livePath, diffPath, { gatePct });
    row.diffPercentage = cmp.diffPercentage;
    row.diffCount = cmp.diffCount;
    row.status = cmp.pass ? 'pass' : 'fail';
    row.message = cmp.message;
    row.diffImage = cmp.pass ? null : relize(cmp.diffPath, ROOT);
  } catch (err) {
    row.status = 'error';
    row.message = err.message;
    row.diffPercentage = null;
  }
  return row;
}

/** Section list for a page: manifest `sections` override, else auto-detect on local. */
async function resolveSections(page, vp) {
  if (Array.isArray(page.sections) && page.sections.length) {
    return page.sections.map((s) =>
      typeof s === 'string' ? { selector: s, label: s.replace(/^[.#]/, '') } : s);
  }
  return detectSections(LOCAL_BASE + page.path, vp);
}

/** Open the local page and read each <section>'s first semantic class. */
async function detectSections(url, vp) {
  const p = await browser.newPage();
  try {
    await p.setViewportSize({ width: vp.width, height: vp.height });
    const resp = await p.goto(url, { waitUntil: 'load', timeout: 30_000 });
    if (resp && !resp.ok()) throw new Error(`HTTP ${resp.status()} for ${url}`);
    const found = await p.evaluate(() => {
      const GENERIC = new Set(['section']); // utility token, not a semantic name
      const list = [];
      document.querySelectorAll('section').forEach((el) => {
        const cls = [...el.classList].filter((c) => !GENERIC.has(c));
        if (cls.length) list.push({ selector: '.' + cls[0], label: cls[0] });
      });
      return list;
    });
    const seen = new Set(); // de-dup by selector, keep first occurrence
    return found.filter((s) => (seen.has(s.selector) ? false : (seen.add(s.selector), true)));
  } finally {
    await p.close();
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────────
function relize(p, root) {
  return p && p.startsWith(root) ? p.slice(root.length + 1) : p;
}

function slugify(s) {
  return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function rowTag(r) {
  return r.section ? `${r.slug} › ${r.section}` : r.slug;
}

function logRow(r) {
  const mark = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '!';
  console.log(`  ${mark} ${rowTag(r)} [${r.viewport}] - ${r.message}`);
}

function buildMarkdown(rows) {
  const passed = rows.filter((r) => r.status === 'pass').length;
  const hasSections = rows.some((r) => r.section);
  const lines = [
    `# Visual diff report`,
    ``,
    `- Generated: ${new Date().toISOString()}`,
    `- Local: ${LOCAL_BASE} · Live: ${LIVE_BASE}`,
    `- Capture: ${hasSections ? 'section-by-section' : fullPage ? 'full-page' : 'viewport'} · Gate: < ${gatePct}% diff`,
    `- Result: **${passed}/${rows.length} passed**`,
    ``,
    `> Read this table first. Open a diff image ONLY for rows marked \`fail\`.`,
    ``,
    hasSections
      ? `| Page | Section | Viewport | Diff % | Status | Diff image |`
      : `| Page | Viewport | Diff % | Status | Diff image |`,
    hasSections
      ? `| --- | --- | --- | ---: | --- | --- |`
      : `| --- | --- | ---: | --- | --- |`,
  ];
  for (const r of rows) {
    const pct = r.diffPercentage == null ? '-' : `${r.diffPercentage.toFixed(2)}%`;
    const badge = r.status === 'pass' ? '✅ pass' : r.status === 'fail' ? '❌ fail' : '⚠️ error';
    const img = r.status === 'pass' ? '-' : (r.diffImage ? `\`${r.diffImage}\`` : `(${r.message})`);
    lines.push(hasSections
      ? `| ${r.slug} | ${r.section || '-'} | ${r.viewport} | ${pct} | ${badge} | ${img} |`
      : `| ${r.slug} | ${r.viewport} | ${pct} | ${badge} | ${img} |`);
  }
  lines.push('');
  return lines.join('\n');
}
