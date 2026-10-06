import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('boots React with language, viewport and journal metadata', () => {
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="description"/);
  assert.match(html, /id="root"/);
  assert.match(html, /type="module" src="\/src\/main.jsx"/);
});

test('the public entry contains no album editing controls', () => {
  assert.doesNotMatch(html, /open-add-trip|add-trip-dialog|添加旅程|href="\/admin\/"/);
});
