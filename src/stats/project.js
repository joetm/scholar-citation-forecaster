import { selectBestModel } from './select.js';
import { fractionElapsed, currentYear } from './dates.js';

const Z_95 = 1.96;

function confidenceLabel(n) {
  if (n <= 2) return 'very low';
  if (n <= 4) return 'low';
  return 'normal';
}

function modelResidualSD(residuals) {
  const n = residuals.length;
  if (n <= 1) return 0;
  let ssr = 0;
  for (const r of residuals) ssr += r * r;
  return Math.sqrt(ssr / (n - 1));
}

export function projectYearEnd({ history, ytd, today }) {
  const sel = selectBestModel(history);
  if (sel === null) return null;

  const year = currentYear(today);
  const f = fractionElapsed(today);

  const yhatModel = sel.model.predict(year);
  const yhatYtd = f > 0 ? ytd / f : null;
  const yhat = yhatYtd !== null
    ? f * yhatYtd + (1 - f) * yhatModel
    : yhatModel;

  const seModel = modelResidualSD(sel.model.residuals);
  const seYtd = f > 0 ? Math.sqrt(Math.max(ytd, 0)) / f : 0;
  const se = Math.sqrt((1 - f) ** 2 * seModel ** 2 + f ** 2 * seYtd ** 2);

  let piLow = yhat - Z_95 * se;
  const piHigh = yhat + Z_95 * se;
  piLow = Math.max(piLow, ytd, 0);

  return {
    yhat,
    piLow,
    piHigh,
    model: sel.model.name,
    aicc: sel.aicc,
    nYears: sel.nYears,
    confidence: confidenceLabel(sel.nYears),
    fractionElapsed: f,
    year
  };
}
