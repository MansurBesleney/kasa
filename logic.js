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

export const ROWS_PER_COLUMN = 32; // measured: 33 rows overflow an A4 landscape page (test/pdf.test.js)

// Rows of the printed sheet, split into columns (left, right, next page left, ...).
// A "unit" is a group of rows that must stay in one column.
export function layoutReport(state, ym, rowsPerColumn = ROWS_PER_COLUMN) {
  const list = entriesOf(state, ym);
  const s = monthSummary(state, ym);
  const row = e => ({ kind: 'entry', date: e.date, desc: e.desc, amount: e.amount });
  const incomes = [
    { kind: 'entry', date: `${ym}-01`, desc: `${monthName(shiftMonth(ym, -1))} AYINDAN DEVİR`, amount: s.devir },
    ...list.filter(e => e.type === 'income').map(row),
  ];
  const expenses = list.filter(e => e.type === 'expense').map(row);

  const units = [[{ kind: 'header', text: 'TAHSİLATLAR' }, incomes[0]], ...incomes.slice(1).map(r => [r])];
  if (expenses.length) {
    units.push([{ kind: 'header', text: 'HARCAMA' }, expenses[0]], ...expenses.slice(1).map(r => [r]));
  }
  units.push([
    { kind: 'section', text: 'KASA DURUMU' },
    ...[['DEVİR', s.devir], ['TAHSİLAT', s.tahsilat], ['TOPLAM', s.toplam],
      ['HARCAMA', s.harcama], ['GENEL TOPLAM', s.kalan]]
      .map(([label, amount]) => ({ kind: 'total', label, amount })),
  ]);

  const columns = [[]];
  for (const unit of units) {
    let col = columns[columns.length - 1];
    if (col.length && col.length + unit.length > rowsPerColumn) columns.push(col = []);
    col.push(...unit);
  }
  const pages = [];
  for (let i = 0; i < columns.length; i += 2) pages.push({ left: columns[i], right: columns[i + 1] || [] });
  return pages;
}

// pdfmake document definition for the pages from layoutReport.
export function reportDoc(pages, title, ym) {
  const bold = { bold: true };
  const toRow = r => {
    if (r.kind === 'header') {
      return [{ text: 'TARİH', ...bold, alignment: 'center' }, { text: r.text, ...bold, alignment: 'center' },
        { text: 'TUTAR', ...bold, alignment: 'right' }];
    }
    if (r.kind === 'section') return ['', { text: r.text, ...bold, alignment: 'center' }, ''];
    if (r.kind === 'total') {
      return ['', { text: r.label, ...bold, alignment: 'right' },
        { text: formatAmount(r.amount), ...bold, alignment: 'right' }];
    }
    // noWrap keeps every row one line high, so ROWS_PER_COLUMN stays true
    return [{ text: formatDate(r.date), alignment: 'center' }, { text: r.desc, noWrap: true },
      { text: formatAmount(r.amount), alignment: 'right' }];
  };
  // pdfmake can't draw a table without rows
  const table = rows => (rows.length ? { table: { widths: [58, '*', 72], body: rows.map(toRow) } } : { text: '' });
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 9 },
    content: pages.flatMap((p, i) => [
      {
        columns: [
          { text: title, bold: true, fontSize: 13, alignment: 'center', width: '*' },
          { text: formatDate(lastDayOfMonth(ym)), width: 70, alignment: 'right' },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        columns: [table(p.left), table(p.right)],
        columnGap: 20,
        ...(i < pages.length - 1 ? { pageBreak: 'after' } : {}),
      },
    ]),
  };
}

const isStr = v => typeof v === 'string';
const isEntry = e => e && isStr(e.id) && (e.type === 'income' || e.type === 'expense')
  && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isStr(e.desc) && Number.isInteger(e.amount) && e.amount > 0;

// Returns the state if it has the expected shape, otherwise null.
export function validateBackup(obj) {
  const s = obj && obj.settings;
  const ok = obj && obj.version === 1 && s && isStr(s.title) && /^\d{4}-\d{2}$/.test(s.startMonth)
    && Number.isInteger(s.openingBalance) && (s.lastBackup === undefined || isStr(s.lastBackup))
    && Array.isArray(obj.entries) && obj.entries.every(isEntry);
  return ok ? obj : null;
}

function daysBetween(a, b) {
  const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function needsBackupReminder(state, today) {
  if (!state.entries.length) return false;
  const since = state.settings.lastBackup || state.entries.reduce((m, e) => (e.date < m ? e.date : m), today);
  return daysBetween(since, today) > 30;
}
