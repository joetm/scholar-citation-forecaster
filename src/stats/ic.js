export function gaussianLogLik(residuals) {
  const n = residuals.length;
  if (n === 0) return -Infinity;
  let ssr = 0;
  for (const r of residuals) ssr += r * r;
  if (ssr === 0) return Infinity;
  const sigma2 = ssr / n;
  return -n / 2 * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1);
}

export function aicc({ logLik, k, n }) {
  const denom = n - k - 1;
  if (denom <= 0) return Infinity;
  const aic = 2 * k - 2 * logLik;
  const correction = (2 * k * (k + 1)) / denom;
  return aic + correction;
}
