import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../logic.js';

test('parseAmount accepts plain and decimal amounts', () => {
  assert.equal(L.parseAmount('1250'), 125000);
  assert.equal(L.parseAmount('12,5'), 1250);
  assert.equal(L.parseAmount('12.50'), 1250);
  assert.equal(L.parseAmount(' 840 '), 84000);
});

test('parseAmount rejects ambiguous, empty, zero and negative input', () => {
  for (const bad of ['1.250', '12,345', '', 'abc', '-5', '0', '0,00', '1 250', '12,']) {
    assert.equal(L.parseAmount(bad), null, bad);
  }
  assert.equal(L.parseAmount('0', true), 0);
});

test('formatAmount uses Turkish separators', () => {
  assert.equal(L.formatAmount(242900), '2.429,00');
  assert.equal(L.formatAmount(-196550), '-1.965,50');
});

test('todayISO uses the local date, not UTC', () => {
  assert.equal(L.todayISO(new Date(2026, 9, 2, 0, 30)), '2026-10-02');
  assert.equal(L.todayISO(new Date(2026, 9, 2, 23, 59)), '2026-10-02');
});

test('date helpers', () => {
  assert.equal(L.addDays('2026-10-01', -1), '2026-09-30');
  assert.equal(L.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(L.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(L.lastDayOfMonth('2026-09'), '2026-09-30');
  assert.equal(L.lastDayOfMonth('2028-02'), '2028-02-29');
  assert.equal(L.formatDate('2026-09-03'), '03.09.2026');
  assert.equal(L.monthLabel('2026-10'), 'EKİM 2026');
});

test('isAllowedDate rejects future dates and dates before the start month', () => {
  assert.equal(L.isAllowedDate('2026-10-02', '2026-09', '2026-10-02'), true);
  assert.equal(L.isAllowedDate('2026-09-01', '2026-09', '2026-10-02'), true);
  assert.equal(L.isAllowedDate('2026-10-03', '2026-09', '2026-10-02'), false);
  assert.equal(L.isAllowedDate('2029-09-25', '2026-09', '2026-10-02'), false);
  assert.equal(L.isAllowedDate('2026-08-31', '2026-09', '2026-10-02'), false);
  assert.equal(L.isAllowedDate('', '2026-09', '2026-10-02'), false);
});

test('normalizeDesc uppercases in Turkish, trims and caps length', () => {
  assert.equal(L.normalizeDesc('  içme   suyu '), 'İÇME SUYU');
  assert.equal(L.normalizeDesc('x'.repeat(60)).length, L.DESC_MAX);
});

let seq = 0;
const entry = (type, date, amount, desc = 'X') => ({ id: `e${String(seq++).padStart(4, '0')}`, type, date, desc, amount });
const makeState = (entries, openingBalance = 0, startMonth = '2026-09') =>
  ({ version: 1, settings: { title: 'T', startMonth, openingBalance }, entries });

// September 2026 sheet, expense amounts in TL (after the fixes made to the xlsx)
const SEP_EXPENSES = [2200, 510, 1400, 500, 1000, 155, 280, 1120, 401, 364, 72, 760, 245, 940, 399, 325,
  360, 380, 719, 883, 325, 1090, 108, 870, 840, 108, 325, 5129, 172, 450, 660, 1132, 200, 1600, 800, 700,
  1150, 2840, 320, 120, 120, 1490, 845, 120, 700, 815];
const september = () => makeState([
  entry('income', '2026-09-03', 3000000),
  entry('income', '2026-09-19', 2140000),
  ...SEP_EXPENSES.map(tl => entry('expense', '2026-09-15', tl * 100)),
], 242900);

test('September regression: totals match the corrected sheet', () => {
  const s = L.monthSummary(september(), '2026-09');
  assert.deepEqual(s, { devir: 242900, tahsilat: 5140000, toplam: 5382900, harcama: 3604200, kalan: 1778700 });
});

test('devir carries over and follows edits to past months', () => {
  const state = september();
  assert.equal(L.monthSummary(state, '2026-10').devir, 1778700);
  assert.equal(L.monthSummary(state, '2026-11').devir, 1778700);
  state.entries.push(entry('expense', '2026-09-30', 100000));
  assert.equal(L.monthSummary(state, '2026-10').devir, 1678700);
  state.entries.push(entry('expense', '2026-10-05', 1800000));
  assert.equal(L.monthSummary(state, '2026-10').kalan, -121300);
});

test('entriesOf returns only that month, sorted by date', () => {
  const state = makeState([entry('expense', '2026-10-05', 1), entry('expense', '2026-09-30', 1),
    entry('income', '2026-10-01', 1)]);
  assert.deepEqual(L.entriesOf(state, '2026-10').map(e => e.date), ['2026-10-01', '2026-10-05']);
});

test('suggestions: same type, matching text, most used first, no exact match', () => {
  const es = [
    entry('expense', '2026-09-01', 1, 'İÇME SUYU'), entry('expense', '2026-09-02', 1, 'İÇME SUYU'),
    entry('expense', '2026-09-03', 1, 'BENZİN'), entry('expense', '2026-09-04', 1, 'ŞANTİYE İÇME SUYU'),
    entry('income', '2026-09-05', 1, 'HURDA SATIŞ'),
  ];
  assert.deepEqual(L.suggestions(es, 'expense', ''), ['İÇME SUYU', 'BENZİN', 'ŞANTİYE İÇME SUYU']);
  assert.deepEqual(L.suggestions(es, 'expense', 'içme'), ['İÇME SUYU', 'ŞANTİYE İÇME SUYU']);
  assert.deepEqual(L.suggestions(es, 'expense', 'içme suyu'), ['ŞANTİYE İÇME SUYU']);
  assert.deepEqual(L.suggestions(es, 'income', ''), ['HURDA SATIŞ']);
  assert.equal(L.suggestions(Array.from({ length: 9 }, (_, i) => entry('expense', '2026-09-01', 1, `D${i}`)), 'expense', '').length, 5);
});

const kinds = col => col.map(r => r.kind).join(',');

test('layout: small month fits in one column with all sections', () => {
  const state = makeState([entry('income', '2026-10-02', 500), entry('expense', '2026-10-03', 100, 'A')], 1000, '2026-10');
  const pages = L.layoutReport(state, '2026-10');
  assert.equal(pages.length, 1);
  assert.equal(kinds(pages[0].left), 'header,entry,entry,header,entry,section,total,total,total,total,total');
  assert.deepEqual(pages[0].right, []);
  assert.equal(pages[0].left[1].desc, 'EYLÜL AYINDAN DEVİR');
  assert.equal(pages[0].left[1].amount, 1000);
  assert.equal(pages[0].left.at(-1).label, 'GENEL TOPLAM');
  assert.equal(pages[0].left.at(-1).amount, 1400);
});

test('layout: month without income or expenses still has devir row and summary', () => {
  const pages = L.layoutReport(makeState([], 5000, '2026-10'), '2026-10');
  assert.equal(kinds(pages[0].left), 'header,entry,section,total,total,total,total,total');
});

test('layout: January devir row names December', () => {
  const pages = L.layoutReport(makeState([], 0, '2027-01'), '2027-01');
  assert.equal(pages[0].left[1].desc, 'ARALIK AYINDAN DEVİR');
});

test('layout: September (46 expenses) fits on one page', () => {
  const [page, ...rest] = L.layoutReport(september(), '2026-09');
  assert.equal(rest.length, 0);
  assert.equal(page.left.length, L.ROWS_PER_COLUMN);
  assert.ok(page.right.length <= L.ROWS_PER_COLUMN);
  const all = [...page.left, ...page.right];
  assert.equal(all.filter(r => r.kind === 'entry').length, 1 + 2 + 46);
  assert.equal(all.at(-1).amount, 1778700);
});

test('layout: many entries overflow to more pages, nothing lost, columns never too long', () => {
  const state = makeState(Array.from({ length: 120 }, (_, i) => entry('expense', '2026-10-01', i + 1)), 0, '2026-10');
  const pages = L.layoutReport(state, '2026-10');
  assert.equal(pages.length, 3);
  const cols = pages.flatMap(p => [p.left, p.right]).filter(c => c.length);
  for (const c of cols) assert.ok(c.length <= L.ROWS_PER_COLUMN);
  assert.equal(cols.flat().filter(r => r.kind === 'entry').length, 121);
});

test('layout: summary block is never split across columns', () => {
  // header+devir, HARCAMA header + 22 expenses = 25 rows; the 6-row summary moves to the right column
  const state = makeState(Array.from({ length: 22 }, () => entry('expense', '2026-10-01', 1)), 0, '2026-10');
  const [page] = L.layoutReport(state, '2026-10', 28);
  assert.equal(page.left.length, 25);
  assert.equal(kinds(page.right), 'section,total,total,total,total,total');
});

test('layout: section header is never alone at the bottom of a column', () => {
  // header+devir + 25 incomes = 27 rows; HARCAMA header and first expense move together
  const state = makeState([
    ...Array.from({ length: 25 }, () => entry('income', '2026-10-01', 1)),
    entry('expense', '2026-10-02', 1),
  ], 0, '2026-10');
  const [page] = L.layoutReport(state, '2026-10', 28);
  assert.equal(page.left.at(-1).kind, 'entry');
  assert.equal(kinds(page.right.slice(0, 2)), 'header,entry');
});

test('reportDoc: one header per page and page breaks between pages', () => {
  const state = makeState(Array.from({ length: 120 }, (_, i) => entry('expense', '2026-10-01', i + 1)), 0, '2026-10');
  const doc = L.reportDoc(L.layoutReport(state, '2026-10'), 'BAŞLIK', '2026-10');
  assert.equal(doc.pageOrientation, 'landscape');
  assert.equal(doc.content.length, 6);
  assert.equal(doc.content[0].columns[1].text, '31.10.2026');
  assert.equal(doc.content.filter(c => c.pageBreak === 'after').length, 2);
  const descCell = doc.content[1].columns[0].table.body[3][1];
  assert.equal(descCell.noWrap, true);
});
