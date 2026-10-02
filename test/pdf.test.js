import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as L from '../logic.js';

const require = createRequire(import.meta.url);
const pdfMake = require('../vendor/pdfmake.min.js');
pdfMake.addVirtualFileSystem(require('../vendor/vfs_fonts.js'));

// Renders a month of `count` long-description expenses; returns planned vs. actual page counts.
async function pageCounts(count) {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `e${String(i).padStart(4, '0')}`, type: 'expense', date: '2026-10-01',
    desc: L.normalizeDesc('şantiye misafir ihtiyaçları ve gece bekçisi yemeği'), amount: 1234567 + i,
  }));
  const state = { version: 1, settings: { title: 'BAŞLIK', startMonth: '2026-10', openingBalance: 0 }, entries };
  const pages = L.layoutReport(state, '2026-10');
  const pdf = await pdfMake.createPdf(L.reportDoc(pages, 'BAŞLIK', '2026-10')).getBuffer();
  return { planned: pages.length, actual: pdf.toString('latin1').match(/\/Type \/Page\b/g).length };
}

test('rendered PDF has exactly the planned pages, so every column fits on A4', async () => {
  for (const count of [0, 28, 29, 51, 120]) {
    const { planned, actual } = await pageCounts(count);
    assert.equal(actual, planned, `${count} expenses`);
  }
});
