import { ConstantModel } from './models/constant.js';
import { LinearModel } from './models/linear.js';
import { LogLinearModel } from './models/log-linear.js';
import { PowerLawModel } from './models/power-law.js';
import { QuadraticModel } from './models/quadratic.js';
import { LogisticModel } from './models/logistic.js';
import { GompertzModel } from './models/gompertz.js';
import { gaussianLogLik, aicc } from './ic.js';

const NAMES = new Map([
  [ConstantModel,  'constant'],
  [LinearModel,    'linear'],
  [LogLinearModel, 'log-linear'],
  [PowerLawModel,  'power-law'],
  [QuadraticModel, 'quadratic'],
  [LogisticModel,  'logistic'],
  [GompertzModel,  'gompertz']
]);

function allowedCandidates(n) {
  if (n <= 0) return [];
  if (n <= 2) return [ConstantModel];
  if (n <= 4) return [ConstantModel, LinearModel];
  if (n === 5) return [ConstantModel, LinearModel, LogLinearModel, PowerLawModel];
  return [ConstantModel, LinearModel, LogLinearModel, PowerLawModel, QuadraticModel, LogisticModel, GompertzModel];
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
  const tied = [best, ...fits.slice(1).filter(f => {
    const diff = f.aicc - best.aicc;
    return Number.isFinite(diff) ? diff < 2 : f.aicc === best.aicc;
  })];
  tied.sort((a, b) => a.model.k_params - b.model.k_params || a.aicc - b.aicc);
  return {
    model: tied[0].model,
    aicc: tied[0].aicc,
    nYears: n,
    candidatesConsidered: candidates.map(C => NAMES.get(C))
  };
}
