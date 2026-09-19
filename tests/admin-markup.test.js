import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadAdmin = () => readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const loadStyles = () => readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');

test('exposes the independent album-management workspace', () => {
  const html = loadAdmin();
  for (const id of ['trip-list', 'album-grid', 'photo-input', 'save-preview', 'delete-dialog']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /ADMIN \/ ALBUM STUDIO/);
  assert.match(html, /所有改动仅用于本次预览/);
  assert.match(html, /href="\.\.\/"/);
});

test('loads dedicated admin styles and module script', () => {
  const html = loadAdmin();
  assert.match(html, /href="\.\/admin\.css"/);
  assert.match(html, /<script type="module" src="\.\/admin\.js"><\/script>/);
});

test('keeps the mobile admin workspace within the viewport', () => {
  const css = loadStyles();
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /\.admin-layout\s*{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(css, /\.trip-list\s*{[^}]*overflow-x:\s*auto;/s);
});

test('provides accessible confirmation and feedback regions', () => {
  const html = loadAdmin();
  assert.match(html, /<dialog[^>]+id="delete-dialog"[^>]+aria-labelledby="delete-title"/);
  assert.match(html, /id="status-message"[^>]+role="status"/);
  assert.match(html, /id="upload-error"[^>]+role="alert"/);
});
