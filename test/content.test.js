// must be set before importing src/content.js
globalThis.__SCHOLAR_PROJECTION_TEST__ = true;

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runOnce, watchAndRun, isProfileUrl } from '../src/content.js';

const here = path.dirname(fileURLToPath(import.meta.url));
function load(name) {
  return readFileSync(path.join(here, 'fixtures', name), 'utf8');
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('content.runOnce orchestrator', () => {
  it('reads, projects, and renders for a tall fixture', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    const ok = runOnce(document, { today });
    expect(ok).toBe(true);
    expect(document.querySelector('[data-gsp="projection-bar"]')).not.toBeNull();
  });

  it('returns false silently when no chart is present', () => {
    document.body.innerHTML = '<div>no chart</div>';
    const today = new Date('2026-05-01T00:00:00Z');
    const ok = runOnce(document, { today });
    expect(ok).toBe(false);
    expect(document.querySelector('[data-gsp]')).toBe(null);
  });

  it('is idempotent: a second run cleans up the first', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    runOnce(document, { today });
    runOnce(document, { today });
    expect(document.querySelectorAll('[data-gsp="projection-bar"]').length).toBe(1);
  });

  it('does not throw on malformed input; returns false', () => {
    document.body.innerHTML = `
      <div class="gsc_md_hist_w">
        <div class="gsc_md_hist_b"><a class="gsc_g_a">???</a></div>
        <div class="gsc_md_hist_x"><span>2026</span></div>
      </div>`;
    const today = new Date('2026-05-01T00:00:00Z');
    expect(() => runOnce(document, { today })).not.toThrow();
  });
});

describe('watchAndRun (MutationObserver retry)', () => {
  it('re-runs once a chart appears later', async () => {
    document.body.innerHTML = '<div id="root">no chart</div>';
    const today = new Date('2026-05-01T00:00:00Z');
    const stop = watchAndRun(document, { today, timeoutMs: 800 });

    setTimeout(() => {
      document.getElementById('root').innerHTML = `
        <div class="gsc_g_hist_wrp" dir="rtl">
          <div class="gsc_g_hist_xl">
            <div class="gsc_g_xtl" style="top:153px;">0</div>
            <div class="gsc_g_xtl" style="top:73px;">100</div>
            <div class="gsc_g_xtl" style="top:-7px;">200</div>
          </div>
          <div class="gsc_md_hist_w">
            <div class="gsc_md_hist_b">
              <span class="gsc_g_t" style="right:67px">2024</span>
              <span class="gsc_g_t" style="right:35px">2025</span>
              <span class="gsc_g_t" style="right:3px">2026</span>
              <a class="gsc_g_a" style="right:72px;top:73px;height:80px"><span class="gsc_g_al">100</span></a>
              <a class="gsc_g_a" style="right:40px;top:-7px;height:160px"><span class="gsc_g_al">200</span></a>
              <a class="gsc_g_a" style="right:8px;top:113px;height:40px"><span class="gsc_g_al">50</span></a>
            </div>
          </div>
        </div>`;
    }, 50);

    await new Promise(res => setTimeout(res, 200));
    stop();
    expect(document.querySelector('[data-gsp="projection-bar"]')).not.toBeNull();
  });
});

describe('popstate-style re-renders', () => {
  it('a second runOnce on the same DOM does not duplicate work', () => {
    document.body.innerHTML = load('tall.html');
    const today = new Date('2026-05-01T00:00:00Z');
    runOnce(document, { today });
    runOnce(document, { today });
    const second = document.querySelectorAll('[data-gsp="projection-bar"]');
    expect(second.length).toBe(1);
    expect(second[0]).not.toBeNull();
  });
});

describe('isProfileUrl', () => {
  it('matches a Scholar profile URL with ?user=', () => {
    expect(isProfileUrl('https://scholar.google.com/citations?user=ucO_QYQAAAAJ')).toBe(true);
  });

  it('matches even when other params come before user', () => {
    expect(isProfileUrl('https://scholar.google.com/citations?hl=en&user=ucO_QYQAAAAJ')).toBe(true);
  });

  it('rejects /citations without ?user=', () => {
    expect(isProfileUrl('https://scholar.google.com/citations')).toBe(false);
    expect(isProfileUrl('https://scholar.google.com/citations?view_op=search_authors')).toBe(false);
  });

  it('rejects other Scholar paths', () => {
    expect(isProfileUrl('https://scholar.google.com/scholar?q=foo')).toBe(false);
    expect(isProfileUrl('https://scholar.google.com/citations_help')).toBe(false);
    expect(isProfileUrl('https://scholar.google.com/citations/foo')).toBe(false);
  });

  it('rejects non-Scholar hosts even on the same path', () => {
    expect(isProfileUrl('https://example.com/citations?user=ucO_QYQAAAAJ')).toBe(false);
    expect(isProfileUrl('https://scholar.google.de/citations?user=ucO_QYQAAAAJ')).toBe(false);
  });

  it('rejects malformed URLs without throwing', () => {
    expect(isProfileUrl('not a url')).toBe(false);
    expect(isProfileUrl('')).toBe(false);
  });
});
