const PRIMARY_CONTAINER = '.gsc_md_hist_w';
const PRIMARY_BARS      = '.gsc_g_a';
const PRIMARY_YEARS     = '.gsc_g_t';

function parseCount(el) {
  const sources = [
    el.getAttribute('title'),
    el.getAttribute('aria-label'),
    el.textContent
  ];
  for (const s of sources) {
    if (s == null) continue;
    const m = s.match(/-?\d[\d,]*/);
    if (m) {
      const n = parseInt(m[0].replace(/,/g, ''), 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function parseYear(el) {
  const t = (el.textContent || '').trim();
  const m = t.match(/^\d{4}$/);
  return m ? parseInt(m[0], 10) : null;
}

function parseRight(el) {
  const m = (el.getAttribute('style') || '').match(/right:\s*(-?\d+(?:\.\d+)?)\s*px/);
  return m ? parseFloat(m[1]) : null;
}

function pairYearsAndBars(yearEls, barEls, tolerancePx = 15) {
  const bars = barEls.map(b => ({ el: b, right: parseRight(b), used: false }));
  const pairs = [];
  for (const yEl of yearEls) {
    const year = parseYear(yEl);
    if (year == null) continue;
    const yRight = parseRight(yEl);
    let count = 0;
    let bar = null;
    if (yRight != null) {
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].used || bars[i].right == null) continue;
        const diff = Math.abs(bars[i].right - yRight);
        if (diff < bestDiff && diff <= tolerancePx) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        bars[bestIdx].used = true;
        bar = bars[bestIdx].el;
        const c = parseCount(bar);
        if (c == null) continue;
        count = c;
      }
    }
    pairs.push({ year, count, yearEl: yEl, barEl: bar });
  }
  return pairs;
}

function structuralReadHistogram(doc) {
  const all = doc.querySelectorAll('a, span, div');
  const candidates = new Map();

  for (const el of all) {
    const text = (el.getAttribute('aria-label') || el.getAttribute('title') || '');
    if (!/\b\d{4}\b/.test(text)) continue;
    if (parseCount(el) == null) continue;
    const p = el.parentElement;
    if (!p) continue;
    candidates.set(p, (candidates.get(p) || 0) + 1);
  }

  let bestParent = null, bestCount = 0;
  for (const [p, c] of candidates) {
    if (c > bestCount) { bestParent = p; bestCount = c; }
  }
  if (!bestParent || bestCount < 2) return null;

  const children = Array.from(bestParent.children);
  const pairs = [];
  for (const c of children) {
    const text = (c.getAttribute('aria-label') || c.getAttribute('title') || '');
    const yMatch = text.match(/\b(\d{4})\b/);
    if (!yMatch) continue;
    const count = parseCount(c);
    if (count == null) continue;
    pairs.push({ year: parseInt(yMatch[1], 10), count });
  }
  if (pairs.length < 2) return null;
  return { container: bestParent, pairs };
}

export function readHistogram(doc, { today }) {
  const cy = today.getUTCFullYear();

  const container = doc.querySelector(PRIMARY_CONTAINER);
  if (container) {
    const bars = Array.from(container.querySelectorAll(PRIMARY_BARS));
    const yearEls = Array.from(container.querySelectorAll(PRIMARY_YEARS));
    if (yearEls.length > 0) {
      const pairs = pairYearsAndBars(yearEls, bars);
      if (pairs.length > 0) {
        pairs.sort((a, b) => a.year - b.year);
        const hist = pairs.filter(p => p.year < cy).map(p => ({ year: p.year, count: p.count }));
        const cur = pairs.find(p => p.year === cy);
        if (hist.length && cur) {
          return { history: hist, ytd: cur.count, currentYear: cy, container };
        }
      }
    }
  }

  const fb = structuralReadHistogram(doc);
  if (!fb) return null;
  fb.pairs.sort((a, b) => a.year - b.year);
  const hist = fb.pairs.filter(p => p.year < cy);
  const cur = fb.pairs.find(p => p.year === cy);
  if (!hist.length || !cur) return null;
  return { history: hist, ytd: cur.count, currentYear: cy, container: fb.container };
}
