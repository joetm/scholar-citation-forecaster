# Scholar Citation Projection — Design Spec

**Status:** approved (brainstorming complete)
**Date:** 2026-05-01
**Target:** Firefox WebExtension (Manifest V3)

## 1. Goal

A passive enhancement to Google Scholar profile pages that adds a year-end projection to the citation histogram. The projection appears as a light-shaded extension on top of the current-year bar, scaled honestly against the rest of the chart, with a hover tooltip explaining how it was computed.

The extension is silent on failure: if the chart can't be parsed or there is no historical data, nothing is rendered and the page is left untouched.

## 2. User-visible behavior

On any Scholar profile page (`https://scholar.google.com/citations?user=*`):

1. The existing per-year citation bar chart renders as usual.
2. The extension reads the historical year/count pairs from the chart DOM.
3. It fits a small set of growth models, selects the best by AICc, blends with year-to-date pace (time-weighted), and computes a point estimate plus prediction interval for the current year's total.
4. The current-year bar gets a light-fill extension on top, capped at the upper prediction-interval bound, with a horizontal tick at the point estimate.
5. If the upper PI exceeds the chart's existing y-axis maximum, the chart is rescaled proportionally so all bars remain to-scale and nothing clips.
6. Hovering the projected portion shows a tooltip with: point estimate, PI bounds, model selected, AICc, n_years used, YTD value, confidence label.

## 3. Projection algorithm

### 3.1 Data inputs

- `history`: array of `{year, count}` for every fully-completed year shown on the chart, ordered ascending. Excludes the current year.
- `ytd`: integer count for the current (in-progress) year.
- `today`: a `Date` representing "now" (passed in for testability).

### 3.2 Candidate models

Each candidate is a class with `fit(history) → instance`, and each instance exposes `predict(year)`, `residuals`, `k_params` (number of free parameters), and `logLik` computed on the y-scale.

| Model       | Form                          | k | Notes                                                              |
| ----------- | ----------------------------- | - | ------------------------------------------------------------------ |
| constant    | y = ȳ                         | 1 | Sanity floor for noisy/flat profiles.                              |
| linear      | y = a + b·t                   | 2 | OLS.                                                               |
| log-linear  | log(y) = a + b·t              | 2 | OLS on log-counts; `log` clamped via `log(max(y, 0.5))` for zeros. |
| power-law   | y = a·τ^b, τ = years since first history year (≥1) | 2 | OLS on `log y` vs `log τ`; same zero clamp as log-linear. Sustained deceleration without reversal — fills the gap between linear and a quadratic that eventually turns down. |
| quadratic   | y = a + b·t + c·t²            | 3 | OLS. Allowed only at n_years ≥ 6.                                  |
| logistic    | y = L / (1 + exp(−k(t − t₀))) | 3 | Levenberg–Marquardt. Symmetric S-curve (rise, inflect, saturate). Allowed only at n_years ≥ 6.                  |
| gompertz    | y = L·exp(−b·exp(−c·t))       | 3 | Levenberg–Marquardt. Asymmetric S-curve (slow start, fast rise, long flat tail) — the standard alternative to logistic in bibliometric citation-curve modeling. Allowed only at n_years ≥ 6. |

For log-linear and power-law, predictions on the y-scale are `exp(a + b·t)` / `a·τ^b` respectively. Log-likelihoods for AICc are computed under a Gaussian residual model **on the y-scale** for every candidate, so model comparison is on a common metric.

Logistic and Gompertz are fit with a shared Levenberg–Marquardt engine (`stats/lm.js`) using analytic Jacobians and data-driven initial guesses (e.g. `L₀ = 1.2·max(y)`, `t₀ = median(years)`). Both operate on centered time `x = year − mean(years)` for numerical stability (same convention as quadratic's `tBar` centering); `predict(year)` re-centers internally so callers still pass raw years. A fit that fails to converge or produces non-finite parameters throws `RangeError`, which `select.js` already catches and skips — the same path used for singular-matrix rejections in the OLS models.

### 3.3 Candidate gating by sample size

| n_years | Allowed candidates                                                  |
| ------- | --------------------------------------------------------------------|
| 0       | none — no projection rendered                                       |
| 1       | constant only                                                       |
| 2       | constant only                                                       |
| 3       | {constant, linear}                                                  |
| 4       | {constant, linear}                                                  |
| 5       | {constant, linear, log-linear, power-law}                           |
| 6+      | {constant, linear, log-linear, power-law, quadratic, logistic, gompertz} |

### 3.4 Selection

For each allowed candidate, compute

```
AICc = 2k − 2·logLik + 2k(k+1) / (n − k − 1)
```

Pick the candidate with the lowest AICc. When two candidates have `ΔAICc < 2`, prefer the one with fewer parameters (Occam's razor).

### 3.5 Blend with YTD

Let `f = fractionElapsed(today)` be the fraction of the current year already past (calendar-day based, not weighted). Then:

```
ŷ_model = best.predict(currentYear)
ŷ_ytd   = ytd / f                            (if f > 0; else NaN)
ŷ       = f · ŷ_ytd + (1 − f) · ŷ_model      (if ŷ_ytd defined)
        = ŷ_model                            (if ytd == 0 and f very small)
```

Rationale: early in the year, YTD is too noisy to extrapolate; late in the year, YTD is essentially the answer. Time-weighting interpolates smoothly between the two regimes. Note that `f · ŷ_ytd = ytd` algebraically, so the formula is equivalent to `ŷ = ytd + (1 − f) · ŷ_model` — i.e. "treat YTD as observed and let the model predict the remainder under a uniform-rate assumption". Both forms are mathematically identical; the weighted-average framing makes the smooth interpolation explicit.

### 3.6 Prediction interval

```
SE_model = residual_SD_y_scale  (from fit residuals)
SE_ytd   = sqrt(ytd) / f        (Poisson approximation, if f > 0)
SE       = sqrt( (1 − f)² · SE_model² + f² · SE_ytd² )
PI_95    = ŷ ± 1.96 · SE
```

Lower bound is clamped to `max(ytd, 0)` — the projection cannot honestly fall below what's already observed.

### 3.7 Confidence label

| n_years | Label             |
| ------- | ----------------- |
| 1–2     | "very low"        |
| 3–4     | "low"             |
| ≥5      | "normal"          |

The label is shown in the tooltip and also drives bar opacity (very low → 0.4, low → 0.6, normal → 0.8).

## 4. Architecture

```
src/
  stats/
    models/       candidate model fitters (one file per model)
    lm.js         shared Levenberg–Marquardt engine (logistic, gompertz)
    select.js     AICc model selection + tie-break
    project.js   projectYearEnd(history, ytd, today) → { yhat, piLow, piHigh, model, aicc, nYears, confidence }
  dom/
    extract.js   readHistogram(document) → { history, ytd, currentYear, container } | null
    render.js   renderProjection(container, projection, history, ytd) → cleanup()
  content.js    orchestrator
  manifest.json
test/
  stats/*.test.js                pure unit tests
  fixtures/*.html                saved Scholar profile snapshots
  dom.test.js                    jsdom integration on fixtures
```

The `stats/` modules have **no DOM dependency** and are unit-tested in node. The `dom/` modules are tested against saved fixture HTML in jsdom. `content.js` is thin orchestration: extract → reject if null → project → render.

## 5. DOM strategy

### 5.1 Extraction

`dom/extract.js` locates the histogram with a cascade of selectors:

1. Primary: `.gsc_md_hist_w` (and descendants `.gsc_md_hist_b` for bars)
2. Fallback: structural — find the deepest container holding ≥3 sibling elements that each contain a 4-digit year label and a numeric count

Year/count pairs are read from accessible labels (`<a>` text content and `aria-label`/`title` attributes), not from inline `style.height` numbers (heights are pixel-based and lossy).

If the extractor cannot find a chart, or finds one with no historical bars, it returns `null` and the extension is silent.

### 5.2 Rendering — primary path (CSS-variable rescale)

1. Compute `newMax = max(currentMaxBar, upperPI)`.
2. Set `--gsp-max: ${newMax}` on the chart container.
3. Replace each bar's `style.height` with `calc(${value} / var(--gsp-max, ${oldMax}) * 100%)`.
4. Recompute and overwrite the y-axis tick labels (Scholar shows ~5 ticks; recompute as `[0, ¼·newMax, ½·newMax, ¾·newMax, newMax]` rounded to a "nice" interval).
5. Append a projection `<div data-gsp="projection-bar">` absolutely positioned over the current-year column with two children:
   - `<div data-gsp="projection-pi">` — light-fill rectangle from `ytd` up to `upperPI`.
   - `<div data-gsp="projection-tick">` — 1px horizontal line at `ŷ`.
6. Attach `mouseenter`/`mouseleave` to mount/unmount a tooltip near the cursor.

### 5.3 Rendering — fallback path (numeric height patching)

If after a `requestAnimationFrame` the bars' `getBoundingClientRect()` heights look unchanged (CSS-variable inheritance failed), revert and patch each bar's `style.height` to a numerical percentage directly (`${value/newMax*100}%`). Same projection-bar injection.

### 5.4 Cleanup

All injected nodes and modified attributes carry `data-gsp` markers. A single `cleanup()` function removes them and restores any saved-original inline styles. The orchestrator calls cleanup before re-rendering, making the extension idempotent.

## 6. Orchestration (`content.js`)

- Runs at `document_idle`.
- Calls `extract.readHistogram(document)`. If `null`, waits for one MutationObserver window (~1 second) in case Scholar lazy-renders the chart, then retries once. Still null → silent exit.
- Computes `project.projectYearEnd(history, ytd, today)`.
- Calls `render.renderProjection(container, projection, history, ytd)`.
- Listens for `popstate` defensively. On firing: re-extract, and if the chart node has changed identity, cleanup + re-render.

## 7. Edge cases

| Scenario                      | Behavior                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| Chart not present             | Silent no-op                                                    |
| n_years == 0                  | Silent no-op                                                    |
| n_years 1–2                   | Constant model, faded bar (opacity 0.4), tooltip "very low"    |
| n_years 3–4                   | Constant or linear, opacity 0.6, tooltip "low"                  |
| December, near year-end       | PI shrinks; bar nearly equals ytd                               |
| January, ytd == 0             | `ŷ ≈ ŷ_model`; no division by zero                            |
| All-zero history              | Constant model fits 0; projection at 0 + PI from Poisson YTD    |
| Profile chart hidden          | Silent no-op (extractor returns null)                           |
| Re-navigation in same tab     | popstate fires; re-render only if chart node identity changed   |

## 8. Error handling

- Every entry-point in `content.js` is wrapped in try/catch. Any thrown error logs to `console.warn` with the prefix `[scholar-projection]` and the extension exits silently. Real users never see a broken page.
- The stats modules throw `RangeError` on invalid input (negative counts, non-monotonic years); the orchestrator catches and silently skips.

## 9. Testing strategy

### 9.1 Unit tests (Vitest, node, no DOM)

`test/stats/`:

- **Synthetic recovery:** generate series from each candidate process + Gaussian noise, assert AICc picks the generating model in ≥95% of trials at n=8.
- **Selection edge cases:** ties prefer simpler model; quadratic, logistic, and gompertz are excluded at n<6; power-law is excluded at n<5.
- **LM robustness:** logistic/gompertz fits on divergent or degenerate init throw and are skipped rather than propagating bad params.
- **Projection:** known inputs map to known outputs (golden values).
- **Blend:** at f=0.05 result ≈ ŷ_model; at f=0.95 result ≈ ŷ_ytd; at f=0.5 it's between them.
- **PI calibration:** over a Monte Carlo of 1000 generated histories, ~95% of true year-end totals fall within the computed PI.
- **Edge inputs:** n_years 0, 1, 2; all-zero history; ytd = 0; ytd > current max.

### 9.2 Integration tests (Vitest + jsdom)

`test/fixtures/`: 3 saved Scholar profile HTML snapshots:
1. `tall.html` — researcher with steep recent growth (similar to the example screenshot)
2. `medium.html` — flat researcher with ~6 years of moderate counts
3. `sparse.html` — newer researcher with only 2 years of data

Tests assert: extractor returns the expected year/count pairs; orchestrator mutates the DOM (a `data-gsp` element appears); axis labels are updated when the projection exceeds the original max; cleanup() removes everything.

### 9.3 Manual verification

`web-ext run` against a live profile to confirm the visual result matches the design intent.

## 10. Build & packaging

- Plain ESM source.
- **esbuild** bundles `content.js` into a single file (MV3 + Firefox + content scripts requires bundling; importing across files at runtime is awkward).
- **web-ext** for development (`web-ext run`) and packaging (`web-ext build` → signed `.xpi`).
- `package.json` scripts: `build`, `dev`, `test`, `lint`, `package`.
- ESLint with the recommended config + `no-undef` for browser globals.

## 11. `manifest.json` shape

```jsonc
{
  "manifest_version": 3,
  "name": "Scholar Citation Projection",
  "version": "0.1.0",
  "description": "Adds a year-end citation projection to Google Scholar profile pages.",
  "content_scripts": [
    {
      "matches": ["https://scholar.google.com/citations*"],
      "js": ["content.bundle.js"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": ["https://scholar.google.com/*"],
  "browser_specific_settings": {
    "gecko": { "id": "scholar-projection@example", "strict_min_version": "115.0" }
  }
}
```

No background script, no popup, no options page — the extension is purely a content script.

## 12. Documentation

- `CLAUDE.md` at project root: project purpose (one paragraph), architecture summary, projection algorithm summary, key files, build/test/dev commands.
- This design spec stays at `docs/superpowers/specs/2026-05-01-scholar-citation-projection-design.md` and is updated only if the design itself changes.

## 13. Out of scope

- Other Scholar pages (search results, library, alerts).
- Multi-author / coauthor projections.
- Persistent storage of projections across visits.
- Configurable parameters (UI for changing PI %, model choice, etc.) — design favors a single sensible default.
- Cross-browser support beyond Firefox. (MV3 makes Chrome porting easy if asked later, but it's not the goal here.)
- i18n. UI strings are English-only.
