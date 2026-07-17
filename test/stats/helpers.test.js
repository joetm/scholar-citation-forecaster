import { describe, it, expect } from 'vitest';
import { sum, mean, median, variance, sd, sumSq } from '../../src/stats/helpers.js';

describe('stats/helpers', () => {
  it('sum adds numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
    expect(sum([])).toBe(0);
  });

  it('mean returns arithmetic mean', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(() => mean([])).toThrow(RangeError);
  });

  it('variance is sample variance (n-1 denominator)', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4.571, 2);
    expect(() => variance([5])).toThrow(RangeError);
  });

  it('sd is sqrt of variance', () => {
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(4.571), 2);
  });

  it('sumSq sums squared deviations from mean', () => {
    expect(sumSq([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(32, 4);
  });

  it('median returns the middle value (odd length) or average of the two middle values (even length)', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow(RangeError);
  });
});
