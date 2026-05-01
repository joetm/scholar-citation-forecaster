import { describe, it, expect } from 'vitest';
import { fractionElapsed, daysInYear, currentYear } from '../../src/stats/dates.js';

describe('stats/dates', () => {
  it('daysInYear distinguishes leap years', () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
    expect(daysInYear(2026)).toBe(365);
  });

  it('fractionElapsed is ~0 on Jan 1, ~1 on Dec 31', () => {
    expect(fractionElapsed(new Date('2026-01-01T00:00:00Z'))).toBeCloseTo(0, 3);
    expect(fractionElapsed(new Date('2026-12-31T23:59:59Z'))).toBeCloseTo(1, 2);
  });

  it('fractionElapsed on 2026-05-01 is roughly 120/365', () => {
    expect(fractionElapsed(new Date('2026-05-01T00:00:00Z')))
      .toBeCloseTo(120 / 365, 3);
  });

  it('fractionElapsed on a leap-year date scales by 366', () => {
    expect(fractionElapsed(new Date('2024-07-01T00:00:00Z')))
      .toBeCloseTo(182 / 366, 3);
  });

  it('currentYear returns the year of the given date', () => {
    expect(currentYear(new Date('2026-05-01T00:00:00Z'))).toBe(2026);
  });
});
