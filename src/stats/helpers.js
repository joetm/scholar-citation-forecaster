export function sum(xs) {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs) {
  if (xs.length === 0) throw new RangeError('mean of empty array');
  return sum(xs) / xs.length;
}

export function median(xs) {
  if (xs.length === 0) throw new RangeError('median of empty array');
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function sumSq(xs) {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s;
}

export function variance(xs) {
  if (xs.length < 2) throw new RangeError('variance requires n >= 2');
  return sumSq(xs) / (xs.length - 1);
}

export function sd(xs) {
  return Math.sqrt(variance(xs));
}
