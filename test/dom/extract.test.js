import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readHistogram } from '../../src/dom/extract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
function loadFixture(name) {
  return readFileSync(path.join(here, '..', 'fixtures', name), 'utf8');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('readHistogram (DOM extractor)', () => {
  it('reads the tall.html fixture into 7 historical years + ytd', () => {
    document.body.innerHTML = loadFixture('tall.html');
    const r = readHistogram(document, { today: new Date('2026-05-01T00:00:00Z') });
    expect(r).not.toBeNull();
    expect(r.history).toEqual([
      { year: 2019, count: 14 },
      { year: 2020, count: 40 },
      { year: 2021, count: 48 },
      { year: 2022, count: 67 },
      { year: 2023, count: 324 },
      { year: 2024, count: 593 },
      { year: 2025, count: 815 }
    ]);
    expect(r.ytd).toBe(291);
    expect(r.currentYear).toBe(2026);
  });

  it('reads the sparse.html fixture (1 historical year + ytd)', () => {
    document.body.innerHTML = loadFixture('sparse.html');
    const r = readHistogram(document, { today: new Date('2026-05-01T00:00:00Z') });
    expect(r.history).toEqual([{ year: 2025, count: 4 }]);
    expect(r.ytd).toBe(2);
  });

  it('returns null when no histogram element exists', () => {
    document.body.innerHTML = '<div>no chart here</div>';
    const r = readHistogram(document, { today: new Date('2026-05-01T00:00:00Z') });
    expect(r).toBe(null);
  });

  it('returns null when bars have no parseable counts', () => {
    document.body.innerHTML = `
      <div class="gsc_md_hist_w">
        <div class="gsc_md_hist_b">
          <span class="gsc_g_t" style="right:3px">2026</span>
          <a class="gsc_g_a" style="right:8px"><span class="gsc_g_al">???</span></a>
        </div>
      </div>`;
    const r = readHistogram(document, { today: new Date('2026-05-01T00:00:00Z') });
    expect(r).toBe(null);
  });
});

describe('readHistogram structural fallback', () => {
  it('finds bars/years even when classnames are missing', () => {
    document.body.innerHTML = `
      <main>
        <div id="histogram">
          <div class="bars">
            <a title="100" aria-label="100 citations in 2024">100</a>
            <a title="200" aria-label="200 citations in 2025">200</a>
            <a title="50"  aria-label="50 citations in 2026">50</a>
          </div>
          <div class="years"><span>2024</span><span>2025</span><span>2026</span></div>
        </div>
      </main>`;
    const r = readHistogram(document, { today: new Date('2026-05-01T00:00:00Z') });
    expect(r).not.toBeNull();
    expect(r.history).toEqual([
      { year: 2024, count: 100 },
      { year: 2025, count: 200 }
    ]);
    expect(r.ytd).toBe(50);
  });
});
