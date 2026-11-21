export function fmtMoney(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}
