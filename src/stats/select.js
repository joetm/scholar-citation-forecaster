import { ConstantModel } from './models/constant.js';
import { LinearModel } from './models/linear.js';
import { LogLinearModel } from './models/log-linear.js';
import { QuadraticModel } from './models/quadratic.js';
import { gaussianLogLik, aicc } from './ic.js';

const NAMES = new Map([
  [ConstantModel,  'constant'],
  [LinearModel,    'linear'],
  [LogLinearModel, 'log-linear'],
  [QuadraticModel, 'quadratic']
]);

function allowedCandidates(n) {
  if (n <= 0) return [];
  if (n <= 2) return [ConstantModel];
  if (n <= 4) return [ConstantModel, LinearModel];
  if (n === 5) return [ConstantModel, LinearModel, LogLinearModel];
  return [ConstantModel, LinearModel, LogLinearModel, QuadraticModel];
}

export function selectBestModel(history) {
  const n = history.length;
  if (n === 0) return null;
  const candidates = allowedCandidates(n);
  const fits = [];
  for (const Model of candidates) {
    try {
      const m = Model.fit(history);
      const ll = gaussianLogLik(m.residuals);
      const score = aicc({ logLik: ll, k: m.k_params, n });
      fits.push({ model: m, aicc: score });
    } catch (_e) {
      // model rejected (insufficient n, singular matrix, LM divergence) — skip
    }
  }
  if (fits.length === 0) return null;
  fits.sort((a, b) => a.aicc - b.aicc);
  const best = fits[0];
  const tied = [best, ...fits.slice(1).filter(f =>
    Number.isFinite(f.aicc) && Number.isFinite(best.aicc) && f.aicc - best.aicc < 2
  )];
  tied.sort((a, b) => a.model.k_params - b.model.k_params || a.aicc - b.aicc);
  return {
    model: tied[0].model,
    aicc: tied[0].aicc,
    nYears: n,
    candidatesConsidered: candidates.map(C => NAMES.get(C))
  };
}
