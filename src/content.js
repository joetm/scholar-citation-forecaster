import { readHistogram } from './dom/extract.js';
import { renderProjection } from './dom/render.js';
import { projectYearEnd } from './stats/project.js';

const LOG_PREFIX = '[scholar-projection]';
let activeCleanup = null;

function mark(state, info) {
  try {
    if (document && document.body) {
      document.body.setAttribute('data-gsp-state', state);
      if (info) document.body.setAttribute('data-gsp-info', JSON.stringify(info));
    }
  } catch (_e) { /* ignore */ }
  if (state === 'error') console.warn(LOG_PREFIX, state, info ?? '');
}

export function isProfileUrl(href) {
  try {
    const u = new URL(href);
    return u.hostname === 'scholar.google.com'
      && u.pathname === '/citations'
      && u.searchParams.has('user');
  } catch (_e) {
    return false;
  }
}

export function runOnce(doc, { today } = { today: new Date() }) {
  try {
    if (activeCleanup) {
      try { activeCleanup(); } catch (_e) { /* swallow */ }
      activeCleanup = null;
    }
    const ext = readHistogram(doc, { today });
    if (!ext) {
      mark('extract-null');
      return false;
    }
    mark('extracted');
    const projection = projectYearEnd({
      history: ext.history, ytd: ext.ytd, today
    });
    if (!projection) {
      mark('project-null');
      return false;
    }
    activeCleanup = renderProjection({
      container: ext.container,
      projection,
      ytd: ext.ytd,
      currentYear: ext.currentYear
    });
    mark('rendered');
    return true;
  } catch (e) {
    mark('error', { message: String(e && e.message || e) });
    return false;
  }
}

export function watchAndRun(doc, { today, timeoutMs = 1000 } = { today: new Date() }) {
  if (runOnce(doc, { today })) {
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (runOnce(doc, { today })) {
      observer.disconnect();
    }
  });
  const start = () => observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
  if (doc.body) start();
  else doc.addEventListener('DOMContentLoaded', start, { once: true });
  const timer = setTimeout(() => observer.disconnect(), timeoutMs);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}

const isExtensionEnv = typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && !globalThis.__SCHOLAR_PROJECTION_TEST__;

if (isExtensionEnv && isProfileUrl(window.location.href)) {
  watchAndRun(document, { today: new Date(), timeoutMs: 5000 });
  window.addEventListener('popstate', () => {
    if (isProfileUrl(window.location.href)) {
      watchAndRun(document, { today: new Date(), timeoutMs: 5000 });
    }
  });
}
