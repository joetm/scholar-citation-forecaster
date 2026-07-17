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
