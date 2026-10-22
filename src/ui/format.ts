// Number formatting for the pages. No browser APIs, so it can be tested in Node.

/** Fixed decimals with a real minus sign ("−65.0" instead of "-65.0"); "–" for missing values. */
export function formatNumber(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const text = value.toFixed(decimals);
  // toFixed can give "-0.00" for tiny negative numbers; show that as plain 0.
  return /^-0\.?0*$/.test(text) ? text.slice(1) : text.replace('-', '−');
}

/** Number with a unit, separated by a non-breaking space so they stay on one line: "2.00 nA". */
export function formatQuantity(value: number | null | undefined, decimals: number, unit: string): string {
  return `${formatNumber(value, decimals)} ${unit}`;
}
