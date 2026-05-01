# Scholar Citation Projection

A Firefox WebExtension (Manifest V3) that adds a year-end citation projection to Google Scholar profile pages. It reads the existing per-year citation histogram, fits a growth model selected from a small candidate set by AICc, blends with year-to-date pace, and renders a light-shaded extension on top of the current-year bar with a 95% prediction-interval range and a hover tooltip. The chart's y-axis rescales when the upper PI exceeds the existing maximum so nothing clips. The extension is silent on failure — never breaks the page.

## Prerequisites

- **Node.js** 18+ and npm
- **Firefox** 115+ (for loading the unpacked extension)

## Install

```
npm install
```

## Build

```
npm run build
```

This bundles `src/content.js` (and its imports) into `dist/content.bundle.js` via esbuild and copies `src/manifest.json` into `dist/`. The `dist/` directory is the loadable extension.

## Run unpacked (recommended for development)

```
npm run dev
```

This rebuilds and launches a fresh Firefox profile with the extension auto-loaded via `web-ext run`. Visit any Scholar profile (e.g. `https://scholar.google.com/citations?user=ucO_QYQAAAAJ`) to see the projection bar.

## Load manually in Firefox

If you'd rather load the built extension yourself:

1. `npm run build`
2. Open Firefox → `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on…**
4. Select `dist/manifest.json`
5. Visit a Scholar profile

The extension stays loaded until Firefox is restarted.

## Package for distribution

```
npm run package
```

Produces a `.zip` in `web-ext-artifacts/` ready for upload to addons.mozilla.org or self-distribution. Final signing for AMO happens server-side after upload.

## Test

```
npm test           # one-shot: 77 tests across stats and DOM
npm run test:watch # watch mode
npm run lint       # eslint
```

The stats modules (model fitters, AICc selection, projection) are pure JS unit-tested in Node. The DOM modules (extractor, renderer, tooltip) are tested in jsdom against synthetic HTML fixtures in `test/fixtures/`. The orchestrator (`content.js`) has integration tests that run the full extract → project → render flow.

## Project structure

```
src/
  stats/              pure JS — testable without a browser
    helpers.js        sum/mean/variance/sd
    dates.js          fractionElapsed, currentYear
    models/           constant, linear, log-linear, quadratic, logistic
    ic.js             Gaussian logLik + AICc
    select.js         model selection with sample-size gating + tie-break
    project.js        projectYearEnd: blend + 95% PI + confidence label
  dom/
    extract.js        readHistogram(document) — primary + structural fallback
    render.js         projection bar + axis rescale + cleanup
    tooltip.js        DOM-construction tooltip
  content.js          orchestrator: isProfileUrl gate, runOnce, watchAndRun
  manifest.json
test/
  stats/              unit tests
  dom/                jsdom integration tests
  fixtures/           saved Scholar profile HTML snapshots
  content.test.js     full-flow orchestrator tests
build/
  esbuild.config.js   bundles content.js → dist/content.bundle.js
docs/superpowers/
  specs/              design spec (single source of truth for design decisions)
  plans/              implementation plan (TDD task breakdown)
```

## URL targeting

The extension only activates on Scholar profile URLs:

- `manifest.json` matches: `https://scholar.google.com/citations` (exact path; query string is independent of path matching)
- An `isProfileUrl()` runtime check in the bootstrap further requires the URL to be on `scholar.google.com`, path exactly `/citations`, and to carry a `?user=...` query parameter

So the script runs on URLs like `https://scholar.google.com/citations?user=ucO_QYQAAAAJ` (with or without other params), but does nothing on `/citations` welcome pages, `/citations?view_op=search_authors`, `scholar.google.de`, or any other Scholar path.

## Further reading

- **Design spec:** `docs/superpowers/specs/2026-05-01-scholar-citation-projection-design.md` — projection algorithm, model selection, edge cases, error handling
- **Project notes:** `CLAUDE.md` — architecture summary and conventions for future work
- **Dev notes:** `dev-notes.md` — local install, smoke tests, fixture-capture instructions
