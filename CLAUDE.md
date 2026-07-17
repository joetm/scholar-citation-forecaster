# Scholar Citation Projection — Project Notes

## What this is

A Firefox WebExtension (Manifest V3) that adds a year-end citation projection to Google Scholar profile pages. It reads the per-year histogram already on the page, fits a growth model, projects the current year's total, and renders a light-shaded extension on top of the current-year bar with a prediction-interval range and a hover tooltip. The chart is rescaled honestly when the projection exceeds the existing y-axis max. The extension is silent on failure — never breaks the page.

## Architecture

```
src/
  stats/      pure JS, no DOM — model fitters, AICc selection, projection
    models/       constant, linear, log-linear, power-law, quadratic, logistic, gompertz fitters (one file per model)
    lm.js         shared Levenberg–Marquardt engine (logistic, gompertz)
    select.js     AICc-based candidate selection + simpler-wins tie-break
    project.js    projectYearEnd(history, ytd, today)
  dom/        DOM-side, jsdom-testable
    extract.js    readHistogram(document) from Scholar's profile chart
    render.js     CSS-variable rescale + projection bar injection
  content.js  thin orchestrator (extract → project → render)
  manifest.json
test/
  stats/      unit tests (node, vitest)
  fixtures/   saved Scholar profile HTML snapshots (3 profiles)
  dom.test.js integration via jsdom
```

The stats and dom layers are kept strictly separate so the algorithm can be unit-tested without a browser, and the renderer can be exercised against saved fixtures.

## Projection algorithm (one-paragraph summary)

Fit up to seven candidate models (constant, linear, log-linear, power-law, quadratic, logistic, gompertz) to the historical year/count series, gated by sample size. Select the best by **AICc**, breaking ties toward fewer parameters. Compute the model's prediction for the current year, blend it with the YTD-extrapolated value using time-weighted weights (`w_ytd = fraction_of_year_elapsed`), and report a 95% prediction interval that combines the model's residual SD with a Poisson term for YTD count noise. With n_years < 3 the candidate set collapses to constant; n_years 3–4 is {constant, linear}; n_years = 5 adds log-linear and power-law; quadratic, logistic, and gompertz require n_years ≥ 6 (logistic and gompertz are fit via a shared Levenberg–Marquardt engine, `stats/lm.js`, since they're nonlinear — everything else is closed-form OLS). See the design spec for full detail.

## Build & dev commands

```bash
npm install              # one-time
npm run build            # esbuild → content.bundle.js
npm run dev              # web-ext run (loads unpacked into Firefox)
npm test                 # vitest run
npm run lint             # eslint
npm run package          # web-ext build → signed .xpi
```

### Loading the unpacked extension manually (`about:debugging`)

If Firefox is installed as a **snap** (`snap list firefox` succeeds), it's filesystem-confined to the home directory and cannot open a "Load Temporary Add-on…" file picker on `dist/manifest.json` under this repo — it fails with `Unable to load script: moz-extension://.../content.bundle.js`, which looks like a build/manifest bug but isn't. `npm run build` already copies `dist/*` to `~/scholar-citation-projection/` for exactly this reason — load `~/scholar-citation-projection/manifest.json` instead. `npm run dev` (`web-ext run`) is unaffected since it launches its own Firefox instance.

## Key references

- Design spec: `docs/superpowers/specs/2026-05-01-scholar-citation-projection-design.md` — single source of truth for design decisions
- Manifest: `src/manifest.json`
- Fixtures: `test/fixtures/{tall,medium,sparse}.html` — saved Scholar profile pages used by integration tests

## Conventions

- Stats modules: pure functions only. No globals, no Date.now() — `today` is always passed in.
- DOM modules: every injected node and modified attribute carries `data-gsp` so cleanup is a single querySelectorAll.
- Errors in `content.js` are caught and logged with the prefix `[scholar-projection]`; the page is never left broken.
- ESM source; bundled to a single file by esbuild for the content script (MV3 + Firefox content-script ergonomics).
