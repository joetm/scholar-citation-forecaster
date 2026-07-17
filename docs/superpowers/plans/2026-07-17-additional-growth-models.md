# Additional Growth Models (logistic, gompertz, power-law) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the design spec and the implementation by adding the previously-missing `logistic` model, plus two new candidates (`gompertz`, `power-law`), so AICc model selection stops defaulting to `quadratic` for every rise-then-plateau citation history.

**Architecture:** Three new pure-JS model classes under `src/stats/models/`, one new shared Levenberg–Marquardt engine (`src/stats/lm.js`) used by the two nonlinear fits (logistic, gompertz), one new `median` helper, and an extension of `src/stats/select.js`'s candidate list and gating table. Power-law is closed-form OLS (no LM needed). All new modules follow the existing model interface: `fit(history) → instance`, `predict(year)`, `residuals`, `k_params`, `name`.

**Tech Stack:** Plain ESM, no new dependencies (matches project convention of zero runtime deps for `stats/`). Vitest for tests.

## Global Constraints

- Stats modules: pure functions/classes only. No globals, no `Date.now()`.
- Every model class exposes: `static fit(history) → instance`, `predict(year)`, `residuals` (getter, y-scale), `k_params` (getter), `name` (getter).
- Fit failures (insufficient n, singular matrix, LM divergence) throw `RangeError` and nothing else — `select.js` catches and skips.
- Gating per updated spec (`docs/superpowers/specs/2026-05-01-scholar-citation-projection-design.md` §3.3): n≥5 adds `log-linear` + `power-law`; n≥6 adds `quadratic`, `logistic`, `gompertz`.
- No comments except where a non-obvious constraint or sign convention would otherwise trip up a reader (e.g. LM sign conventions).

---

## Task 1: `median` helper

**Files:**
- Modify: `src/stats/helpers.js`
- Test: `test/stats/helpers.test.js`

**Interfaces:**
- Produces: `median(xs: number[]) → number`, throws `RangeError` on empty input. Used by Task 4 (logistic's `x0` initial guess).

- [ ] **Step 1: Write the failing test**

Add to `test/stats/helpers.test.js` (import list becomes `import { sum, mean, median, variance, sd, sumSq } from '../../src/stats/helpers.js';`):

```js
  it('median returns the middle value (odd length) or average of the two middle values (even length)', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow(RangeError);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stats/helpers.test.js`
Expected: FAIL — `median is not a function` (or similar import error).

- [ ] **Step 3: Add the implementation**

In `src/stats/helpers.js`, add after `mean`:

```js
export function median(xs) {
  if (xs.length === 0) throw new RangeError('median of empty array');
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stats/helpers.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stats/helpers.js test/stats/helpers.test.js
git commit -m "$(cat <<'EOF'
Add median() helper for logistic model's initial-guess heuristic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared Levenberg–Marquardt engine (`stats/lm.js`)

**Files:**
- Create: `src/stats/lm.js`
- Test: `test/stats/lm.test.js`

**Interfaces:**
- Produces:
  - `solveLinearSystem(A: number[][], b: number[]) → number[]` — Gaussian elimination with partial pivoting, throws `RangeError('LM: singular normal equations')` on a singular matrix.
  - `levenbergMarquardt({ residual, jacobian, params0, maxIter = 100, tol = 1e-9 }) → { params: number[], residuals: number[] }` where `residual(params) → number[]` returns `y_i − f(x_i, params)` and `jacobian(params) → number[][]` returns `∂f(x_i,params)/∂params_j` (an n×p matrix, **not** the residual's Jacobian — sign convention matters, see Step 3). Throws `RangeError` on non-convergence or divergence.
- Consumes: nothing (pure numerical utility, no project-specific imports).

- [ ] **Step 1: Write the failing test**

Create `test/stats/lm.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { solveLinearSystem, levenbergMarquardt } from '../../src/stats/lm.js';

describe('solveLinearSystem', () => {
  it('solves a well-conditioned 2x2 system', () => {
    const x = solveLinearSystem([[2, 1], [1, 3]], [3, 5]);
    expect(x[0]).toBeCloseTo(0.8, 6);
    expect(x[1]).toBeCloseTo(1.4, 6);
  });

  it('throws RangeError on a singular matrix', () => {
    expect(() => solveLinearSystem([[1, 2], [2, 4]], [1, 2])).toThrow(RangeError);
  });
});

describe('levenbergMarquardt', () => {
  function toyProblem() {
    // f(x,p) = p0 * exp(p1 * x); recover p0=3, p1=0.5 from noiseless data
    const xs = [0, 1, 2, 3, 4, 5];
    const trueP = [3, 0.5];
    const ys = xs.map(x => trueP[0] * Math.exp(trueP[1] * x));
    const residual = (p) => xs.map((x, i) => ys[i] - p[0] * Math.exp(p[1] * x));
    const jacobian = (p) => xs.map(x => {
      const e = Math.exp(p[1] * x);
      return [e, p[0] * x * e];
    });
    return { residual, jacobian, trueP };
  }

  it('recovers known parameters of a nonlinear model from noiseless data', () => {
    const { residual, jacobian, trueP } = toyProblem();
    const { params, residuals } = levenbergMarquardt({ residual, jacobian, params0: [1, 0.1] });
    expect(params[0]).toBeCloseTo(trueP[0], 3);
    expect(params[1]).toBeCloseTo(trueP[1], 3);
    for (const r of residuals) expect(Math.abs(r)).toBeLessThan(1e-4);
  });

  it('throws RangeError when stuck at a high-residual stationary point (zero Jacobian)', () => {
    expect(() => levenbergMarquardt({
      residual: () => [1, 1, 1],
      jacobian: () => [[0, 0], [0, 0], [0, 0]],
      params0: [0, 0]
    })).toThrow(RangeError);
  });

  it('throws RangeError when maxIter is exceeded before convergence', () => {
    const { residual, jacobian } = toyProblem();
    expect(() => levenbergMarquardt({
      residual, jacobian, params0: [1, 0.1], maxIter: 1, tol: 1e-15
    })).toThrow(RangeError);
  });

  it('throws RangeError on non-finite initial residuals', () => {
    expect(() => levenbergMarquardt({
      residual: () => [NaN, 1, 1],
      jacobian: () => [[1, 0], [0, 1], [1, 1]],
      params0: [0, 0]
    })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stats/lm.test.js`
Expected: FAIL — cannot find module `../../src/stats/lm.js`.

- [ ] **Step 3: Create `src/stats/lm.js`**

```js
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
    }
    if (Math.abs(M[pivot][i]) < 1e-14) throw new RangeError('LM: singular normal equations');
    [M[i], M[pivot]] = [M[pivot], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// residual(p) must return y - f(x,p); jacobian(p) must return df(x,p)/dp
// (not the residual's Jacobian, which is its negative) — normal equations
// below assume this sign convention.
export function levenbergMarquardt({ residual, jacobian, params0, maxIter = 100, tol = 1e-9 }) {
  const p = params0.length;
  let params = params0.slice();
  let r = residual(params);
  let ssr = dot(r, r);
  if (!Number.isFinite(ssr)) throw new RangeError('LM: non-finite initial residuals');
  if (ssr < tol) return { params, residuals: r };

  let lambda = 1e-3;
  const LAMBDA_MAX = 1e12;
  let improvedAtLeastOnce = false;

  for (let iter = 0; iter < maxIter; iter++) {
    const J = jacobian(params);
    const JTJ = Array.from({ length: p }, (_, i) =>
      Array.from({ length: p }, (_, j) => {
        let s = 0;
        for (let row = 0; row < J.length; row++) s += J[row][i] * J[row][j];
        return s;
      })
    );
    const JTr = Array.from({ length: p }, (_, i) => {
      let s = 0;
      for (let row = 0; row < J.length; row++) s += J[row][i] * r[row];
      return s;
    });

    const gradNorm = Math.sqrt(dot(JTr, JTr));
    if (gradNorm < tol) {
      if (improvedAtLeastOnce || ssr < tol) return { params, residuals: r };
      throw new RangeError('LM: diverged (stationary point with high residual)');
    }

    let stepAccepted = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const A = JTJ.map((row, i) => row.map((v, j) => (i === j ? v + lambda : v)));
      let delta;
      try {
        delta = solveLinearSystem(A, JTr);
      } catch (_e) {
        lambda *= 10;
        if (lambda > LAMBDA_MAX) throw new RangeError('LM: diverged (singular normal equations)');
        continue;
      }
      const trialParams = params.map((v, i) => v + delta[i]);
      if (trialParams.some(v => !Number.isFinite(v))) {
        lambda *= 10;
        if (lambda > LAMBDA_MAX) throw new RangeError('LM: diverged (non-finite parameters)');
        continue;
      }
      const trialR = residual(trialParams);
      const trialSsr = dot(trialR, trialR);
      if (!Number.isFinite(trialSsr)) {
        lambda *= 10;
        if (lambda > LAMBDA_MAX) throw new RangeError('LM: diverged (non-finite residuals)');
        continue;
      }
      if (trialSsr < ssr) {
        const relImprove = (ssr - trialSsr) / (ssr + tol);
        params = trialParams;
        r = trialR;
        ssr = trialSsr;
        lambda = Math.max(lambda / 10, 1e-12);
        stepAccepted = true;
        improvedAtLeastOnce = true;
        if (relImprove < tol || ssr < tol) {
          return { params, residuals: r };
        }
        break;
      } else {
        lambda *= 10;
        if (lambda > LAMBDA_MAX) throw new RangeError('LM: diverged (no improving step found)');
      }
    }
    if (!stepAccepted) throw new RangeError('LM: diverged (no improving step found)');
  }
  throw new RangeError('LM: exceeded max iterations without convergence');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stats/lm.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stats/lm.js test/stats/lm.test.js
git commit -m "$(cat <<'EOF'
Add shared Levenberg-Marquardt engine for nonlinear model fits

Logistic and gompertz both need nonlinear least squares; this is the
first NLS need in stats/ (everything else is closed-form OLS), so it's
factored into a standalone, model-agnostic engine rather than duplicated.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `power-law` model

**Files:**
- Create: `src/stats/models/power-law.js`
- Test: `test/stats/models/power-law.test.js`

**Interfaces:**
- Consumes: `mean` from `../helpers.js` (existing).
- Produces: `PowerLawModel` class — `PowerLawModel.fit(history) → instance`; `k_params = 2`; `name = 'power-law'`. Used by Task 6 (`select.js`).

- [ ] **Step 1: Write the failing test**

Create `test/stats/models/power-law.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PowerLawModel } from '../../../src/stats/models/power-law.js';

describe('PowerLawModel', () => {
  it('recovers y = 5 * tau^1.5 (tau = years since first history year)', () => {
    const firstYear = 2018;
    const history = [];
    for (let y = 2018; y <= 2023; y++) {
      const tau = y - firstYear + 1;
      history.push({ year: y, count: 5 * Math.pow(tau, 1.5) });
    }
    const m = PowerLawModel.fit(history);
    const tau2024 = 2024 - firstYear + 1;
    expect(m.predict(2024)).toBeCloseTo(5 * Math.pow(tau2024, 1.5), 2);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-6);
  });

  it('clamps zeros via log(max(y, 0.5)), same convention as log-linear', () => {
    const history = [
      { year: 2020, count: 0 },
      { year: 2021, count: 1 },
      { year: 2022, count: 4 }
    ];
    const m = PowerLawModel.fit(history);
    expect(Number.isFinite(m.predict(2023))).toBe(true);
    expect(m.predict(2023)).toBeGreaterThan(0);
  });

  it('reports k_params = 2 and name = "power-law"', () => {
    const m = PowerLawModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }, { year: 2022, count: 4 }
    ]);
    expect(m.k_params).toBe(2);
    expect(m.name).toBe('power-law');
  });

  it('throws RangeError when n < 2', () => {
    expect(() => PowerLawModel.fit([{ year: 2020, count: 1 }])).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stats/models/power-law.test.js`
Expected: FAIL — cannot find module `../../../src/stats/models/power-law.js`.

- [ ] **Step 3: Create `src/stats/models/power-law.js`**

```js
import { mean } from '../helpers.js';

const ZERO_CLAMP = 0.5;

export class PowerLawModel {
  static fit(history) {
    if (history.length < 2) throw new RangeError('PowerLawModel needs n >= 2');
    const firstYear = Math.min(...history.map(h => h.year));
    const taus = history.map(h => h.year - firstYear + 1);
    const ys = history.map(h => h.count);
    const lts = taus.map(t => Math.log(t));
    const lys = ys.map(y => Math.log(Math.max(y, ZERO_CLAMP)));
    const ltBar = mean(lts);
    const lyBar = mean(lys);
    let num = 0, den = 0;
    for (let i = 0; i < lts.length; i++) {
      const dt = lts[i] - ltBar;
      num += dt * (lys[i] - lyBar);
      den += dt * dt;
    }
    if (den === 0) throw new RangeError('PowerLawModel: zero variance in log(years)');
    const b = num / den;
    const la = lyBar - b * ltBar;
    return new PowerLawModel(history, firstYear, Math.exp(la), b);
  }

  constructor(history, firstYear, a, b) {
    this._history = history;
    this._firstYear = firstYear;
    this._a = a; this._b = b;
  }

  predict(year) {
    const tau = year - this._firstYear + 1;
    return this._a * Math.pow(tau, this._b);
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 2; }
  get name() { return 'power-law'; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stats/models/power-law.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stats/models/power-law.js test/stats/models/power-law.test.js
git commit -m "$(cat <<'EOF'
Add power-law growth model (y = a*tau^b)

Sustained-but-decelerating growth without reversal — fills the gap
between linear and a quadratic that eventually turns down, for
prolific researchers whose yearly gains are still positive but shrinking.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `logistic` model

**Files:**
- Create: `src/stats/models/logistic.js`
- Test: `test/stats/models/logistic.test.js`

**Interfaces:**
- Consumes: `mean`, `median` from `../helpers.js` (Task 1); `levenbergMarquardt` from `../lm.js` (Task 2), signature `levenbergMarquardt({ residual, jacobian, params0 }) → { params, residuals }`.
- Produces: `LogisticModel` class — `LogisticModel.fit(history) → instance`; `k_params = 3`; `name = 'logistic'`. Used by Task 6.

- [ ] **Step 1: Write the failing test**

Create `test/stats/models/logistic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { LogisticModel } from '../../../src/stats/models/logistic.js';

describe('LogisticModel', () => {
  it('recovers a logistic curve: rises then saturates near L', () => {
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const tBar = years.reduce((a, b) => a + b, 0) / years.length;
    const trueL = 200, trueK = 0.8, trueX0 = 0;
    const history = years.map(y => {
      const x = y - tBar;
      return { year: y, count: trueL / (1 + Math.exp(-trueK * (x - trueX0))) };
    });
    const m = LogisticModel.fit(history);
    expect(m.predict(2035)).toBeCloseTo(trueL, 0);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-3);
  });

  it('reports k_params = 3 and name = "logistic"', () => {
    const history = [
      { year: 2020, count: 5 }, { year: 2021, count: 15 }, { year: 2022, count: 40 },
      { year: 2023, count: 70 }, { year: 2024, count: 85 }, { year: 2025, count: 92 }
    ];
    const m = LogisticModel.fit(history);
    expect(m.k_params).toBe(3);
    expect(m.name).toBe('logistic');
  });

  it('throws RangeError when n < 3', () => {
    expect(() => LogisticModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }
    ])).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stats/models/logistic.test.js`
Expected: FAIL — cannot find module `../../../src/stats/models/logistic.js`.

- [ ] **Step 3: Create `src/stats/models/logistic.js`**

```js
import { mean, median } from '../helpers.js';
import { levenbergMarquardt } from '../lm.js';

export class LogisticModel {
  static fit(history) {
    if (history.length < 3) throw new RangeError('LogisticModel needs n >= 3');
    const ts = history.map(h => h.year);
    const ys = history.map(h => h.count);
    const tBar = mean(ts);
    const xs = ts.map(t => t - tBar);
    const maxY = Math.max(...ys);
    const range = Math.max(...xs) - Math.min(...xs) || 1;

    const L0 = Math.max(maxY * 1.2, 1);
    const x0_0 = median(xs);
    const k0 = 4 / range;

    const residual = (p) => {
      const [L, k, x0] = p;
      return xs.map((x, i) => ys[i] - L / (1 + Math.exp(-k * (x - x0))));
    };
    const jacobian = (p) => {
      const [L, k, x0] = p;
      return xs.map(x => {
        const s = 1 / (1 + Math.exp(-k * (x - x0)));
        const dL = s;
        const dk = L * s * (1 - s) * (x - x0);
        const dx0 = -L * k * s * (1 - s);
        return [dL, dk, dx0];
      });
    };

    const { params } = levenbergMarquardt({
      residual, jacobian, params0: [L0, k0, x0_0]
    });
    return new LogisticModel(history, tBar, ...params);
  }

  constructor(history, tBar, L, k, x0) {
    this._history = history;
    this._tBar = tBar;
    this._L = L; this._k = k; this._x0 = x0;
  }

  predict(year) {
    const x = year - this._tBar;
    return this._L / (1 + Math.exp(-this._k * (x - this._x0)));
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 3; }
  get name() { return 'logistic'; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stats/models/logistic.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stats/models/logistic.js test/stats/models/logistic.test.js
git commit -m "$(cat <<'EOF'
Add logistic growth model (the model the design spec already called for)

This closes the gap the projection-selection bug traced back to: the
spec listed logistic as a n>=6 candidate from day one, but it was never
implemented, leaving quadratic as the only flexible candidate for
rise-then-plateau citation histories.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `gompertz` model

**Files:**
- Create: `src/stats/models/gompertz.js`
- Test: `test/stats/models/gompertz.test.js`

**Interfaces:**
- Consumes: `mean` from `../helpers.js` (existing); `levenbergMarquardt` from `../lm.js` (Task 2).
- Produces: `GompertzModel` class — `GompertzModel.fit(history) → instance`; `k_params = 3`; `name = 'gompertz'`. Used by Task 6.

- [ ] **Step 1: Write the failing test**

Create `test/stats/models/gompertz.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { GompertzModel } from '../../../src/stats/models/gompertz.js';

describe('GompertzModel', () => {
  it('recovers a gompertz curve: rises then saturates near L, asymmetrically', () => {
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const tBar = years.reduce((a, b) => a + b, 0) / years.length;
    const trueL = 300, trueB = 3, trueC = 0.5;
    const history = years.map(y => {
      const x = y - tBar;
      return { year: y, count: trueL * Math.exp(-trueB * Math.exp(-trueC * x)) };
    });
    const m = GompertzModel.fit(history);
    expect(m.predict(2045)).toBeCloseTo(trueL, 0);
    for (const r of m.residuals) expect(Math.abs(r)).toBeLessThan(1e-3);
  });

  it('reports k_params = 3 and name = "gompertz"', () => {
    const history = [
      { year: 2020, count: 5 }, { year: 2021, count: 15 }, { year: 2022, count: 40 },
      { year: 2023, count: 70 }, { year: 2024, count: 85 }, { year: 2025, count: 92 }
    ];
    const m = GompertzModel.fit(history);
    expect(m.k_params).toBe(3);
    expect(m.name).toBe('gompertz');
  });

  it('throws RangeError when n < 3', () => {
    expect(() => GompertzModel.fit([
      { year: 2020, count: 1 }, { year: 2021, count: 2 }
    ])).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stats/models/gompertz.test.js`
Expected: FAIL — cannot find module `../../../src/stats/models/gompertz.js`.

- [ ] **Step 3: Create `src/stats/models/gompertz.js`**

```js
import { mean } from '../helpers.js';
import { levenbergMarquardt } from '../lm.js';

export class GompertzModel {
  static fit(history) {
    if (history.length < 3) throw new RangeError('GompertzModel needs n >= 3');
    const ts = history.map(h => h.year);
    const ys = history.map(h => h.count);
    const tBar = mean(ts);
    const xs = ts.map(t => t - tBar);
    const maxY = Math.max(...ys);
    const range = Math.max(...xs) - Math.min(...xs) || 1;

    const L0 = Math.max(maxY * 1.2, 1);
    const b0 = 1;
    const c0 = 2 / range;

    const residual = (p) => {
      const [L, b, c] = p;
      return xs.map((x, i) => {
        const u = Math.exp(-c * x);
        const f = L * Math.exp(-b * u);
        return ys[i] - f;
      });
    };
    const jacobian = (p) => {
      const [L, b, c] = p;
      return xs.map(x => {
        const u = Math.exp(-c * x);
        const inner = Math.exp(-b * u);
        const f = L * inner;
        const dL = inner;
        const db = -u * f;
        const dc = f * b * x * u;
        return [dL, db, dc];
      });
    };

    const { params } = levenbergMarquardt({
      residual, jacobian, params0: [L0, b0, c0]
    });
    return new GompertzModel(history, tBar, ...params);
  }

  constructor(history, tBar, L, b, c) {
    this._history = history;
    this._tBar = tBar;
    this._L = L; this._b = b; this._c = c;
  }

  predict(year) {
    const x = year - this._tBar;
    return this._L * Math.exp(-this._b * Math.exp(-this._c * x));
  }
  get residuals() { return this._history.map(h => h.count - this.predict(h.year)); }
  get k_params() { return 3; }
  get name() { return 'gompertz'; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stats/models/gompertz.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stats/models/gompertz.js test/stats/models/gompertz.test.js
git commit -m "$(cat <<'EOF'
Add gompertz growth model (asymmetric saturation)

The standard alternative to logistic in bibliometric citation-curve
modeling: slow start, fast rise, long flat tail, vs. logistic's
symmetric inflection. Lets AICc arbitrate between the two shapes
instead of assuming symmetry.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire new models into `select.js`

**Files:**
- Modify: `src/stats/select.js`
- Modify: `test/stats/select.test.js`

**Interfaces:**
- Consumes: `PowerLawModel` (Task 3), `LogisticModel` (Task 4), `GompertzModel` (Task 5), plus existing `ConstantModel`, `LinearModel`, `LogLinearModel`, `QuadraticModel`.
- Produces: `selectBestModel(history) → { model, aicc, nYears, candidatesConsidered } | null` (unchanged signature).

**Context — a bug found while validating this task:** the existing tie-break logic gates on `Number.isFinite(best.aicc)`. When the best-fitting candidate achieves an exactly-zero-residual fit (which happens more often now that more flexible models are in the pool — e.g. a perfectly flat citation history fits `constant`, `linear`, and `quadratic` all with zero residual), `aicc` is `-Infinity`, `Number.isFinite(-Infinity)` is `false`, and the whole tie-break filter silently no-ops — the "wrong" (not-simplest) model among the tied group could win depending on incidental array/sort order alone, rather than the documented "fewer params wins" rule. Task 6 fixes this alongside the wiring, since it's the same code path being extended and the new models make the bug more likely to trigger, not a tangential refactor.

- [ ] **Step 1: Write the failing tests**

In `test/stats/select.test.js`, update the `n>=6` test (previously asserted 4 candidates) and add three new tests. Replace:

```js
  it('n>=6 → considers all four candidates', () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    const result = selectBestModel(genConstant(years, 50));
    expect(result.candidatesConsidered.sort()).toEqual(
      ['constant', 'linear', 'log-linear', 'quadratic'].sort()
    );
    expect(result.model.name).toBe('constant');
  });
```

with:

```js
  it('n>=6 → considers all seven candidates', () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    const result = selectBestModel(genConstant(years, 50));
    expect(result.candidatesConsidered.sort()).toEqual(
      ['constant', 'gompertz', 'linear', 'log-linear', 'logistic', 'power-law', 'quadratic'].sort()
    );
    expect(result.model.name).toBe('constant');
  });

  it('n=5 → adds power-law alongside log-linear', () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const result = selectBestModel(genLinear(years, 0, 100));
    expect(result.candidatesConsidered.sort()).toEqual(
      ['constant', 'linear', 'log-linear', 'power-law'].sort()
    );
  });

  it('n>=6 picks logistic over quadratic for a rise-then-plateau history', () => {
    const history = [
      { year: 2014, count: 5 }, { year: 2015, count: 12 }, { year: 2016, count: 28 },
      { year: 2017, count: 55 }, { year: 2018, count: 90 }, { year: 2019, count: 130 },
      { year: 2020, count: 165 }, { year: 2021, count: 190 }, { year: 2022, count: 200 },
      { year: 2023, count: 202 }, { year: 2024, count: 198 }, { year: 2025, count: 201 }
    ];
    const result = selectBestModel(history);
    expect(result.model.name).toBe('logistic');
  });

  it('tie-break applies correctly even when multiple candidates hit an exact zero-residual fit', () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    const result = selectBestModel(genConstant(years, 50));
    expect(result.model.k_params).toBe(1);
    expect(result.model.name).toBe('constant');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/stats/select.test.js`
Expected: FAIL — `candidatesConsidered` still only has 4 entries; `n=5` test can't find `power-law`; rise-then-plateau test gets `quadratic` not `logistic`.

- [ ] **Step 3: Update `src/stats/select.js`**

Replace the whole file:

```js
import { ConstantModel } from './models/constant.js';
import { LinearModel } from './models/linear.js';
import { LogLinearModel } from './models/log-linear.js';
import { PowerLawModel } from './models/power-law.js';
import { QuadraticModel } from './models/quadratic.js';
import { LogisticModel } from './models/logistic.js';
import { GompertzModel } from './models/gompertz.js';
import { gaussianLogLik, aicc } from './ic.js';

const NAMES = new Map([
  [ConstantModel,  'constant'],
  [LinearModel,    'linear'],
  [LogLinearModel, 'log-linear'],
  [PowerLawModel,  'power-law'],
  [QuadraticModel, 'quadratic'],
  [LogisticModel,  'logistic'],
  [GompertzModel,  'gompertz']
]);

function allowedCandidates(n) {
  if (n <= 0) return [];
  if (n <= 2) return [ConstantModel];
  if (n <= 4) return [ConstantModel, LinearModel];
  if (n === 5) return [ConstantModel, LinearModel, LogLinearModel, PowerLawModel];
  return [ConstantModel, LinearModel, LogLinearModel, PowerLawModel, QuadraticModel, LogisticModel, GompertzModel];
}

export function selectBestModel(history) {
  const n = history.length;
  if (n === 0) return null;
  const candidates = allowedCandidates(n);
  const fits = [];
  for (const Model of candidates) {
    try {
      const m = Model.fit(history);
      const ll = gaussianLogLik(m.residuals);
      const score = aicc({ logLik: ll, k: m.k_params, n });
      fits.push({ model: m, aicc: score });
    } catch (_e) {
      // model rejected (insufficient n, singular matrix, LM divergence) — skip
    }
  }
  if (fits.length === 0) return null;
  fits.sort((a, b) => a.aicc - b.aicc);
  const best = fits[0];
  const tied = [best, ...fits.slice(1).filter(f => {
    const diff = f.aicc - best.aicc;
    return Number.isFinite(diff) ? diff < 2 : f.aicc === best.aicc;
  })];
  tied.sort((a, b) => a.model.k_params - b.model.k_params || a.aicc - b.aicc);
  return {
    model: tied[0].model,
    aicc: tied[0].aicc,
    nYears: n,
    candidatesConsidered: candidates.map(C => NAMES.get(C))
  };
}
```

Note on the tie-break fix (Step 3 vs. the "Context" note above): `diff = f.aicc - best.aicc` is `NaN` only when both are `-Infinity` (perfect fit) — in every other case `diff` is finite or `+Infinity`, both handled correctly by the plain `< 2` check. The `Number.isFinite(diff) ? ... : f.aicc === best.aicc` branch treats that one `NaN` case as "tied" (correct — both are perfect fits) rather than silently disabling the whole filter.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/stats/select.test.js`
Expected: PASS (all tests, including the 4 new/updated ones)

Then run the full suite to check for regressions elsewhere (DOM/content tests render whatever `model.name` string comes back, so they shouldn't hardcode model names, but confirm):

Run: `npx vitest run`
Expected: PASS — all suites green, including `test/stats/pi-calibration.test.js` (coverage assertion `> 0.85`) and `test/content.test.js` / `test/dom/*.test.js` (structural assertions only, no hardcoded model names).

- [ ] **Step 5: Commit**

```bash
git add src/stats/select.js test/stats/select.test.js
git commit -m "$(cat <<'EOF'
Wire logistic, gompertz, power-law into AICc model selection

Also fixes select.js's tie-break filter, which silently no-op'd
whenever the best AICc was exactly -Infinity (a perfect-fit model) —
Number.isFinite(best.aicc) gated the whole "prefer fewer params" rule
instead of just the comparison. With more flexible models now in the
candidate pool, exact-zero-residual ties are more likely, so this was
worth fixing alongside the wiring rather than leaving it latent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full regression check

**Files:** none (verification only)

**Interfaces:** none — this task consumes the finished work of Tasks 1–6 and produces a pass/fail verification signal.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All test files pass, including `test/stats/pi-calibration.test.js`'s Monte Carlo coverage check and the three fixture-based integration suites (`test/content.test.js`, `test/dom/extract.test.js`, `test/dom/render.test.js`, `test/dom/tooltip.test.js`).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors. (`eslint:recommended` — watch for `no-unused-vars` on any destructured LM/model params; the plan's code above already prefixes intentionally-unused catch bindings with `_`.)

- [ ] **Step 3: Manual sanity check against the original bug report**

Run: `node -e "
import('./src/stats/select.js').then(({ selectBestModel }) => {
  const history = [
    { year: 2014, count: 5 }, { year: 2015, count: 12 }, { year: 2016, count: 28 },
    { year: 2017, count: 55 }, { year: 2018, count: 90 }, { year: 2019, count: 130 },
    { year: 2020, count: 165 }, { year: 2021, count: 190 }, { year: 2022, count: 200 },
    { year: 2023, count: 202 }, { year: 2024, count: 198 }, { year: 2025, count: 201 }
  ];
  console.log(selectBestModel(history).model.name);
});
"`

Expected output: `logistic` (not `quadratic`) — confirms the original complaint ("tooltip always shows quadratic, even when recent citations are stable") is resolved.

- [ ] **Step 4: Commit if any fixes were needed**

Only if Steps 1–2 required changes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
Fix regressions found in full-suite verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

If Steps 1–3 passed clean, no commit needed — Task 6 already committed the working state.
