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
