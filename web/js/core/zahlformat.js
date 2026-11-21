export const runde2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Deutsche Zahl mit höchstens 2 Nachkommastellen, optional mit Einheit: 1.200 € / 12,5 %. */
export function zahlText(n, einheit = '') {
  const r = runde2(n);
  const text = Number.isInteger(r)
    ? r.toLocaleString('de-DE', { maximumFractionDigits: 0 })
    : r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return einheit ? `${text} ${einheit}` : text;
}
