import { createTooltipElement } from './tooltip.js';

const OPACITY_BY_CONFIDENCE = { 'very low': 0.4, 'low': 0.6, 'normal': 0.8 };
const DEFAULT_YEAR_TO_BAR_OFFSET_PX = 5;

function parsePxStyle(el, prop) {
  const m = (el.getAttribute('style') || '').match(new RegExp(`${prop}:\\s*(-?\\d+(?:\\.\\d+)?)\\s*px`));
  return m ? parseFloat(m[1]) : null;
}

function parseNumericText(el) {
  const t = (el.textContent || '').trim();
  const m = t.match(/-?\d[\d,]*/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function readYAxisLabels(wrapper) {
  const els = Array.from(wrapper.querySelectorAll('.gsc_g_xtl'));
  const out = [];
  for (const el of els) {
    const top = parsePxStyle(el, 'top');
    const value = parseNumericText(el);
    if (top == null || value == null) continue;
    out.push({ el, top, value });
  }
  return out;
}

// Given two (value, top_px) anchors, return a function pixel(value) under linear scale.
function linearPixelFn(v0, p0, v1, p1) {
  if (v1 === v0) return null;
  const slope = (p1 - p0) / (v1 - v0);
  return (v) => p0 + slope * (v - v0);
}

function pickAnchorPair(labels) {
  // Pick the pair of labels with the largest value spread (most stable linear fit).
  if (labels.length < 2) return null;
  let lo = labels[0], hi = labels[0];
  for (const l of labels) {
    if (l.value < lo.value) lo = l;
    if (l.value > hi.value) hi = l;
  }
  if (lo === hi) return null;
  return { lo, hi };
}

export function renderProjection({ container, projection, ytd, currentYear }) {
  // container is .gsc_md_hist_w; chart wrapper is its parent (.gsc_g_hist_wrp) holding y-axis labels.
  const wrapper = container.parentElement || container;
  const barsHost = container.querySelector('.gsc_md_hist_b') || container;

  const yearSpans = Array.from(barsHost.querySelectorAll('.gsc_g_t'));
  const bars = Array.from(barsHost.querySelectorAll('.gsc_g_a'));

  const yearStr = String(currentYear);
  const currentYearSpan = yearSpans.find(s => (s.textContent || '').trim() === yearStr);
  if (!currentYearSpan) return () => {};

  const labels = readYAxisLabels(wrapper);
  const anchorPair = pickAnchorPair(labels);
  if (!anchorPair) return () => {};
  const pixel = linearPixelFn(
    anchorPair.lo.value, anchorPair.lo.top,
    anchorPair.hi.value, anchorPair.hi.top
  );
  if (!pixel) return () => {};

  const currentMax = anchorPair.hi.value;
  const newMax = Math.max(currentMax, projection.piHigh);
  const rescaled = newMax > currentMax;

  // For rescale, keep label `top:` positions; recompute their values via inverse pixel function.
  // Build pixel'(v) so that pixel'(0) = pixel(0) and pixel'(newMax) = pixel(currentMax) = anchorPair.hi.top.
  const pZero = pixel(0);
  const pTop = anchorPair.hi.top; // pixel of currentMax
  const newPixel = linearPixelFn(0, pZero, newMax, pTop);

  const savedBarStyles = bars.map(b => ({ el: b, prev: b.getAttribute('style') || '' }));
  const savedLabelTexts = labels.map(l => ({ el: l.el, prev: l.el.textContent }));

  if (rescaled) {
    // Rescale existing bars
    for (const b of bars) {
      const v = parseNumericText(b);
      if (v == null) continue;
      const top = newPixel(v);
      const bottom = newPixel(0);
      const height = bottom - top;
      const right = parsePxStyle(b, 'right');
      const z = (b.getAttribute('style') || '').match(/z-index:\s*(\d+)/);
      const styleParts = [];
      if (right != null) styleParts.push(`right:${right}px`);
      styleParts.push(`top:${top}px`, `height:${height}px`);
      if (z) styleParts.push(`z-index:${z[1]}`);
      b.setAttribute('style', styleParts.join(';'));
    }
    // Rescale y-axis label values (keep their top positions)
    for (const l of labels) {
      // value at pixel l.top under new scale: solve newPixel(v) = l.top
      // newPixel(v) = pZero + ((pTop - pZero) / newMax) * v
      // v = (l.top - pZero) * newMax / (pTop - pZero)
      const denom = pTop - pZero;
      const v = denom === 0 ? l.value : Math.round((l.top - pZero) * newMax / denom);
      l.el.textContent = String(v);
    }
  }

  // Active pixel function for the projection (= newPixel when rescaled, else pixel)
  const activePixel = rescaled ? newPixel : pixel;

  // Find the current-year bar by right-position pairing with the year span,
  // and learn the year→bar right-offset (consistently 5px in real Scholar).
  const yearRight = parsePxStyle(currentYearSpan, 'right') ?? 0;
  let yearToBarOffset = DEFAULT_YEAR_TO_BAR_OFFSET_PX;
  let currentBar = null;
  if (bars.length) {
    let bestDiff = Infinity;
    for (const b of bars) {
      const br = parsePxStyle(b, 'right');
      if (br == null) continue;
      const d = Math.abs(br - yearRight);
      if (d < bestDiff && d <= 15) {
        bestDiff = d;
        currentBar = b;
      }
    }
    // Learn offset from any matched pair (works even if currentBar is null).
    for (const yEl of yearSpans) {
      const yr = parsePxStyle(yEl, 'right');
      if (yr == null) continue;
      let best = Infinity;
      for (const b of bars) {
        const br = parsePxStyle(b, 'right');
        if (br == null) continue;
        const d = br - yr;
        if (Math.abs(d) < Math.abs(best)) best = d;
      }
      if (Number.isFinite(best) && Math.abs(best) <= 15) {
        yearToBarOffset = best;
        break;
      }
    }
  }
  const barRight = currentBar
    ? (parsePxStyle(currentBar, 'right') ?? (yearRight + yearToBarOffset))
    : (yearRight + yearToBarOffset);

  const pTopProj = activePixel(projection.piHigh);
  const pYtd = activePixel(ytd);
  const pYhat = activePixel(projection.yhat);

  // Projection bar — give it Scholar's `.gsc_g_a` class so it inherits the
  // exact width Scholar uses for every other bar (including mobile media-query
  // variations under .gs_el_ph / .gs_el_ta). Inline style overrides only the
  // properties that differ: position, fill, border, opacity.
  const overlay = document.createElement('a');
  overlay.className = 'gsc_g_a';
  overlay.setAttribute('data-gsp', 'projection-bar');
  overlay.setAttribute('href', 'javascript:void(0)');
  const overlayHeight = Math.max(0, pYtd - pTopProj);
  overlay.setAttribute('style', [
    `right:${barRight}px`,
    `top:${pTopProj}px`,
    `height:${overlayHeight}px`,
    `background:rgba(120,120,120,0.55)`,
    `opacity:${OPACITY_BY_CONFIDENCE[projection.confidence] ?? 0.6}`,
    `border:1px solid rgba(120,120,120,0.7)`,
    `box-sizing:border-box`,
    `z-index:99`,
    `pointer-events:auto`,
    `cursor:default`
  ].join(';'));
  barsHost.appendChild(overlay);

  // Tick — same trick: inherit Scholar's bar width via class, override the rest.
  const tick = document.createElement('a');
  tick.className = 'gsc_g_a';
  tick.setAttribute('data-gsp', 'projection-tick');
  tick.setAttribute('href', 'javascript:void(0)');
  tick.setAttribute('style', [
    `right:${barRight}px`,
    `top:${pYhat}px`,
    `height:1px`,
    `background:rgba(40,40,40,0.9)`,
    `z-index:100`,
    `pointer-events:none`
  ].join(';'));
  barsHost.appendChild(tick);

  let tooltipEl = null;
  const enter = (ev) => {
    if (tooltipEl) return;
    tooltipEl = createTooltipElement(projection, ytd);
    document.body.appendChild(tooltipEl);
    moveTooltip(tooltipEl, ev);
  };
  const move = (ev) => { if (tooltipEl) moveTooltip(tooltipEl, ev); };
  const leave = () => {
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  };
  overlay.addEventListener('mouseenter', enter);
  overlay.addEventListener('mousemove', move);
  overlay.addEventListener('mouseleave', leave);

  let cleaned = false;
  return function cleanup() {
    if (cleaned) return;
    cleaned = true;
    overlay.removeEventListener('mouseenter', enter);
    overlay.removeEventListener('mousemove', move);
    overlay.removeEventListener('mouseleave', leave);
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
    overlay.remove();
    tick.remove();
    if (rescaled) {
      for (const { el, prev } of savedBarStyles) {
        if (prev) el.setAttribute('style', prev);
        else el.removeAttribute('style');
      }
      for (const { el, prev } of savedLabelTexts) {
        el.textContent = prev;
      }
    }
  };
}

function moveTooltip(el, ev) {
  el.style.left = `${ev.pageX + 12}px`;
  el.style.top  = `${ev.pageY + 12}px`;
}
