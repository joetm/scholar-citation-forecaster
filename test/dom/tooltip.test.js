import { describe, it, expect } from 'vitest';
import { renderTooltipContent, buildTooltipNode } from '../../src/dom/tooltip.js';

describe('renderTooltipContent (string form)', () => {
  it('produces a string with all required fields', () => {
    const text = renderTooltipContent({
      yhat: 985,
      piLow: 720,
      piHigh: 1280,
      model: 'log-linear',
      aicc: -3.2,
      nYears: 7,
      confidence: 'normal',
      year: 2026
    }, 290);
    expect(text).toMatch(/Predicted 2026: 985/);
    expect(text).toMatch(/95% PI: \[720, 1280\]/);
    expect(text).toMatch(/Model: log-linear/);
    expect(text).toMatch(/Based on 7/);
    expect(text).toMatch(/YTD: 290/);
    expect(text).toMatch(/normal/i);
  });

  it('rounds non-integer values to integers in the displayed range', () => {
    const text = renderTooltipContent({
      yhat: 985.7, piLow: 720.3, piHigh: 1280.9,
      model: 'linear', aicc: 5.4, nYears: 4,
      confidence: 'low', year: 2026
    }, 290);
    expect(text).toMatch(/Predicted 2026: 986/);
    expect(text).toMatch(/\[720, 1281\]/);
  });
});

describe('buildTooltipNode (DOM form)', () => {
  it('builds a div with a strong header and text-only children — no innerHTML', () => {
    const node = buildTooltipNode({
      yhat: 985, piLow: 720, piHigh: 1280,
      model: 'log-linear', aicc: -3.2, nYears: 7,
      confidence: 'normal', year: 2026
    }, 290);
    expect(node.querySelector('strong').textContent).toBe('Predicted 2026: 985');
    expect(node.textContent).toMatch(/YTD: 290/);
    expect(node.textContent).toMatch(/normal/);
  });
});
