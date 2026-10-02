// Pure functions shared by the app and the tests. No DOM access in this file.

export const MONTHS_TR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
  'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
export const DESC_MAX = 40;

const pad = n => String(n).padStart(2, '0');
const money = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "12,5" -> 1250 kuruş. Ambiguous input ("1.250") or <= 0 -> null.
export function parseAmount(text, allowZero = false) {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(String(text).trim());
  if (!m) return null;
  const kurus = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  return kurus > 0 || (allowZero && kurus === 0) ? kurus : null;
}

export const formatAmount = kurus => money.format(kurus / 100);

// Local calendar date, never UTC: toISOString() would return yesterday before 03:00 in Turkey.
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + n));
}

export const monthOf = iso => iso.slice(0, 7);

export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

export const lastDayOfMonth = ym => addDays(`${shiftMonth(ym, 1)}-01`, -1);

export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export const monthName = ym => MONTHS_TR[Number(ym.slice(5)) - 1];
export const monthLabel = ym => `${monthName(ym)} ${ym.slice(0, 4)}`;

export function isAllowedDate(iso, startMonth, today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= `${startMonth}-01` && iso <= today;
}

export function normalizeDesc(text) {
  return String(text).trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR').slice(0, DESC_MAX);
}
