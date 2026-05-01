import { describe, it, expect } from 'vitest';
import { projectYearEnd } from '../../src/stats/project.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function gauss(rand) {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateLinearTrial(rand, year) {
  const a = 100 + 50 * rand();
  const b = 30 + 20 * rand();
  const sigma = 5;
  const history = [];
  for (let t = year - 6; t < year; t++) {
    history.push({ year: t, count: Math.max(0, Math.round(a + b * t / 100 + gauss(rand) * sigma)) });
  }
  const trueTotal = Math.max(0, Math.round(a + b * year / 100 + gauss(rand) * sigma));
  return { history, trueTotal };
}

describe('PI calibration (linear-process trials)', () => {
  it('coverage of true totals is in a calibrated band over 500 trials', () => {
    const rand = rng(42);
    const today = new Date('2026-05-01T00:00:00Z');
    const N = 500;
    let inside = 0;
    for (let i = 0; i < N; i++) {
      const { history, trueTotal } = generateLinearTrial(rand, 2026);
      const f = 120 / 365;
      const ytd = Math.max(0, Math.round(trueTotal * f + gauss(rand) * 3));
      const r = projectYearEnd({ history, ytd, today });
      if (!r) continue;
      if (trueTotal >= r.piLow && trueTotal <= r.piHigh) inside++;
    }
    const coverage = inside / N;
    expect(coverage).toBeGreaterThan(0.85);
    expect(coverage).toBeLessThanOrEqual(1.0);
  }, 30000);
});
