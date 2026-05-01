export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function currentYear(today) {
  return today.getUTCFullYear();
}

export function fractionElapsed(today) {
  const year = today.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const ms = today.getTime() - start;
  const yearMs = daysInYear(year) * 24 * 60 * 60 * 1000;
  const f = ms / yearMs;
  if (f < 0) return 0;
  if (f > 1) return 1;
  return f;
}
