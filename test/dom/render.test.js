import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderProjection } from '../../src/dom/render.js';
import { readHistogram } from '../../src/dom/extract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
function load(name) {
  return readFileSync(path.join(here, '..', 'fixtures', name), 'utf8');
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('renderProjection (basic injection)', () => {
  it('mounts a projection bar and tick with data-gsp markers', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ext = readHistogram(document, { today });
    const projection = {
      yhat: 700, piLow: 500, piHigh: 800,
      model: 'log-linear', aicc: -3.2, nYears: 7,
      confidence: 'normal', fractionElapsed: 0.33, year: 2026
    };
    const cleanup = renderProjection({
      container: ext.container,
      projection,
      ytd: ext.ytd,
      currentYear: ext.currentYear
    });

    expect(document.querySelector('[data-gsp="projection-bar"]')).not.toBeNull();
    expect(document.querySelector('[data-gsp="projection-tick"]')).not.toBeNull();

    cleanup();
    expect(document.querySelector('[data-gsp]')).toBe(null);
  });

  it('cleanup is idempotent', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ext = readHistogram(document, { today });
    const projection = {
      yhat: 400, piLow: 350, piHigh: 500,
      model: 'constant', aicc: 0, nYears: 7,
      confidence: 'normal', fractionElapsed: 0.33, year: 2026
    };
    const cleanup = renderProjection({
      container: ext.container, projection,
      ytd: ext.ytd, currentYear: ext.currentYear
    });
    cleanup();
    cleanup();
    expect(document.querySelectorAll('[data-gsp]').length).toBe(0);
  });

  it('places projection bar to the right of (alongside) the current-year bar', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ext = readHistogram(document, { today });
    const projection = {
      yhat: 700, piLow: 500, piHigh: 800,
      model: 'log-linear', aicc: 0, nYears: 7,
      confidence: 'normal', fractionElapsed: 0.33, year: 2026
    };
    renderProjection({
      container: ext.container, projection,
      ytd: ext.ytd, currentYear: ext.currentYear
    });
    const overlay = document.querySelector('[data-gsp="projection-bar"]');
    // 2026 year span has right:3px; bar offset learned ≈ 5; expect overlay right:8px
    expect(overlay.getAttribute('style')).toMatch(/right:\s*8px/);
  });
});

describe('renderProjection y-axis rescale', () => {
  it('rewrites y-axis labels when projection > original max', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ext = readHistogram(document, { today });
    const projection = {
      yhat: 1000, piLow: 800, piHigh: 1200,
      model: 'log-linear', aicc: 0, nYears: 7,
      confidence: 'normal', fractionElapsed: 0.33, year: 2026
    };
    const oldLabels = Array.from(
      document.querySelectorAll('.gsc_g_xtl')
    ).map(e => e.textContent);

    renderProjection({
      container: ext.container, projection,
      ytd: ext.ytd, currentYear: ext.currentYear
    });

    const newLabels = Array.from(
      document.querySelectorAll('.gsc_g_xtl')
    ).map(e => e.textContent);

    // The label that was 820 (max) should now be at least 1200
    const maxOld = Math.max(...oldLabels.map(t => parseInt(t, 10)));
    const maxNew = Math.max(...newLabels.map(t => parseInt(t, 10)));
    expect(maxNew).toBeGreaterThanOrEqual(1200);
    expect(maxNew).toBeGreaterThan(maxOld);
  });

  it('also rescales the existing bars top/height when projection > original max', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ext = readHistogram(document, { today });
    const projection = {
      yhat: 1000, piLow: 800, piHigh: 1200,
      model: 'log-linear', aicc: 0, nYears: 7,
      confidence: 'normal', fractionElapsed: 0.33, year: 2026
    };
    const before = Array.from(document.querySelectorAll('.gsc_g_a')).map(b => b.getAttribute('style'));
    renderProjection({
      container: ext.container, projection,
      ytd: ext.ytd, currentYear: ext.currentYear
    });
    const after = Array.from(document.querySelectorAll('.gsc_g_a')).map(b => b.getAttribute('style'));
    // At least one bar's style should differ
    expect(after.some((s, i) => s !== before[i])).toBe(true);
  });

  it('does not modify y-axis labels when projection fits within original max', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ext = readHistogram(document, { today });
    const projection = {
      yhat: 400, piLow: 350, piHigh: 500,
      model: 'constant', aicc: 0, nYears: 7,
      confidence: 'normal', fractionElapsed: 0.33, year: 2026
    };
    const before = Array.from(
      document.querySelectorAll('.gsc_g_xtl')
    ).map(e => e.textContent).join('|');

    renderProjection({
      container: ext.container, projection,
      ytd: ext.ytd, currentYear: ext.currentYear
    });

    const after = Array.from(
      document.querySelectorAll('.gsc_g_xtl')
    ).map(e => e.textContent).join('|');
    expect(after).toBe(before);
  });
});
