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

export function entriesOf(state, ym) {
  return state.entries
    .filter(e => monthOf(e.date) === ym)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

const total = (list, type) => list.reduce((s, e) => s + (e.type === type ? e.amount : 0), 0);

// DEVİR is derived from everything before the month, so editing an old entry fixes every later month.
export function monthSummary(state, ym) {
  const before = state.entries.filter(e => e.date < `${ym}-01`);
  const list = entriesOf(state, ym);
  const devir = state.settings.openingBalance + total(before, 'income') - total(before, 'expense');
  const tahsilat = total(list, 'income');
  const harcama = total(list, 'expense');
  return { devir, tahsilat, toplam: devir + tahsilat, harcama, kalan: devir + tahsilat - harcama };
}

// Earlier descriptions of the same type containing `typed`, most used first.
export function suggestions(entries, type, typed, limit = 5) {
  const q = normalizeDesc(typed);
  const counts = new Map();
  for (const e of entries) if (e.type === type) counts.set(e.desc, (counts.get(e.desc) || 0) + 1);
  return [...counts]
    .filter(([d]) => d.includes(q) && d !== q)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .slice(0, limit)
    .map(([d]) => d);
}
