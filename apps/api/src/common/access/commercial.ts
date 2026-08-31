/** Department or title that grants Clients / Newsletters access. */
export function matchesMarketingOrProduct(value?: string | null): boolean {
  if (!value) return false;
  const text = value.toLowerCase();
  return /\bmarketing\b/.test(text) || /\bproduct\b/.test(text);
}
