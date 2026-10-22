// Number formatting for the pages. No browser APIs, so it can be tested in Node.

/** Fixed decimals with a real minus sign ("−65.0" instead of "-65.0"); "–" for missing values. */
export function formatNumber(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const text = value.toFixed(decimals);
  // toFixed can give "-0.00" for tiny negative numbers; show that as plain 0.
  return /^-0\.?0*$/.test(text) ? text.slice(1) : text.replace('-', '−');
}

/**
 * A fraction as a percentage with 2 significant digits, for small deviations:
 * 0.0000198 → "0.0020 %". Below 0.0001 % it just says so instead of showing an exponent.
 */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '∞ %';
  const percent = fraction * 100;
  if (percent === 0) return '0 %';
  if (percent < 1e-4) return '< 0.0001 %';
  return `${percent.toPrecision(2)} %`;
}

/** Number with a unit, separated by a non-breaking space so they stay on one line: "2.00 nA". */
export function formatQuantity(value: number | null | undefined, decimals: number, unit: string): string {
  return `${formatNumber(value, decimals)} ${unit}`;
}
