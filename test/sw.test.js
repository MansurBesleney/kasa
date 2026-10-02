import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('every file the service worker caches exists, and every app file is cached', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const files = JSON.parse(/const FILES = (\[[^\]]*\])/.exec(sw)[1].replaceAll("'", '"'));
  for (const f of files.filter(f => f !== './')) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `missing: ${f}`);
  }
  for (const f of ['index.html', 'style.css', 'app.js', 'logic.js', 'vendor/pdfmake.min.js', 'vendor/vfs_fonts.js']) {
    assert.ok(files.includes(f), `not cached: ${f}`);
  }
});
