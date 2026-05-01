import { describe, it, expect } from 'vitest';
import { projectYearEnd } from '../../src/stats/project.js';

describe('projectYearEnd point estimate', () => {
  it('returns null when history is empty', () => {
    const r = projectYearEnd({
      history: [], ytd: 0, today: new Date('2026-05-01T00:00:00Z')
    });
    expect(r).toBe(null);
  });

  it('with f≈0.5 and ytd-extrapolation = model, point estimate ≈ both', () => {
    const history = [];
    for (let t = 2020; t <= 2025; t++) history.push({ year: t, count: 200 });
    const today = new Date('2026-07-02T00:00:00Z');
    const r = projectYearEnd({ history, ytd: 100, today });
    expect(r.yhat).toBeCloseTo(200, 0);
  });

  it('early in year (Jan) leans toward model prediction', () => {
    const history = [];
    for (let t = 2020; t <= 2025; t++) history.push({ year: t, count: 500 });
    const today = new Date('2026-01-08T00:00:00Z');
    const r = projectYearEnd({ history, ytd: 5, today });
    expect(r.yhat).toBeGreaterThan(480);
    expect(r.yhat).toBeLessThan(520);
  });

  it('late in year (Dec) leans toward ytd-extrapolation', () => {
    const history = [];
    for (let t = 2020; t <= 2025; t++) history.push({ year: t, count: 1000 });
    const today = new Date('2026-12-20T00:00:00Z');
    const r = projectYearEnd({ history, ytd: 200, today });
    // f ≈ 0.967; yhat = ytd + (1-f)*model ≈ 200 + 33 ≈ 233
    expect(r.yhat).toBeGreaterThan(225);
    expect(r.yhat).toBeLessThan(240);
  });

  it('ytd === 0 with very small f: yhat ≈ ŷ_model', () => {
    const history = [];
    for (let t = 2020; t <= 2025; t++) history.push({ year: t, count: 300 });
    const today = new Date('2026-01-02T00:00:00Z');
    const r = projectYearEnd({ history, ytd: 0, today });
    // f ≈ 0.003; yhat ≈ (1-f) * 300 ≈ 299.2
    expect(r.yhat).toBeGreaterThan(297);
    expect(r.yhat).toBeLessThan(301);
  });
});

describe('projectYearEnd prediction interval', () => {
  it('PI is symmetric around yhat (low <= yhat <= high) for normal cases', () => {
    const history = [
      { year: 2020, count: 50 }, { year: 2021, count: 100 },
      { year: 2022, count: 200 }, { year: 2023, count: 400 },
      { year: 2024, count: 800 }, { year: 2025, count: 1600 }
    ];
    const today = new Date('2026-05-01T00:00:00Z');
    const r = projectYearEnd({ history, ytd: 600, today });
    expect(r.piLow).toBeLessThan(r.yhat);
    expect(r.piHigh).toBeGreaterThan(r.yhat);
  });

  it('PI lower bound is clamped at YTD', () => {
    const history = [
      { year: 2020, count: 5 }, { year: 2021, count: 5 },
      { year: 2022, count: 5 }, { year: 2023, count: 5 },
      { year: 2024, count: 5 }, { year: 2025, count: 5 }
    ];
    const today = new Date('2026-12-15T00:00:00Z');
    const r = projectYearEnd({ history, ytd: 100, today });
    expect(r.piLow).toBeGreaterThanOrEqual(100);
  });

  it('PI width grows with model residual SD', () => {
    const noisy = [];
    for (let t = 2020; t <= 2025; t++) {
      noisy.push({ year: t, count: 100 + (t % 2 === 0 ? 50 : -50) });
    }
    const flat = [];
    for (let t = 2020; t <= 2025; t++) flat.push({ year: t, count: 100 });

    const today = new Date('2026-06-15T00:00:00Z');
    const rNoisy = projectYearEnd({ history: noisy, ytd: 50, today });
    const rFlat = projectYearEnd({ history: flat, ytd: 50, today });
    expect(rNoisy.piHigh - rNoisy.piLow).toBeGreaterThan(rFlat.piHigh - rFlat.piLow);
  });
});

describe('projectYearEnd confidence label', () => {
  it('labels n in {1,2} as "very low"', () => {
    const r1 = projectYearEnd({
      history: [{ year: 2025, count: 10 }],
      ytd: 5, today: new Date('2026-05-01T00:00:00Z')
    });
    expect(r1.confidence).toBe('very low');

    const r2 = projectYearEnd({
      history: [{ year: 2024, count: 10 }, { year: 2025, count: 12 }],
      ytd: 5, today: new Date('2026-05-01T00:00:00Z')
    });
    expect(r2.confidence).toBe('very low');
  });

  it('labels n in {3,4} as "low"', () => {
    const h = [
      { year: 2022, count: 10 }, { year: 2023, count: 12 },
      { year: 2024, count: 15 }, { year: 2025, count: 18 }
    ];
    const r = projectYearEnd({ history: h, ytd: 5, today: new Date('2026-05-01T00:00:00Z') });
    expect(r.confidence).toBe('low');
  });

  it('labels n >= 5 as "normal"', () => {
    const h = [];
    for (let t = 2021; t <= 2025; t++) h.push({ year: t, count: 100 });
    const r = projectYearEnd({ history: h, ytd: 30, today: new Date('2026-05-01T00:00:00Z') });
    expect(r.confidence).toBe('normal');
  });
});
