import { describe, expect, it } from 'vitest';
import { formatNumber, formatQuantity } from './format.ts';

describe('formatNumber', () => {
  it('uses a real minus sign and fixed decimals', () => {
    expect(formatNumber(-65, 1)).toBe('−65.0');
    expect(formatNumber(2, 2)).toBe('2.00');
  });

  it('shows tiny negative numbers as 0, not "−0.00"', () => {
    expect(formatNumber(-0.0001, 2)).toBe('0.00');
    expect(formatNumber(-0, 0)).toBe('0');
  });

  it('shows missing values as a dash', () => {
    expect(formatNumber(null, 1)).toBe('–');
    expect(formatNumber(Number.NaN, 1)).toBe('–');
  });
});

describe('formatQuantity', () => {
  it('joins number and unit with a non-breaking space', () => {
    expect(formatQuantity(1.5, 2, 'nA')).toBe('1.50 nA');
  });
});
