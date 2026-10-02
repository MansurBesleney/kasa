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
