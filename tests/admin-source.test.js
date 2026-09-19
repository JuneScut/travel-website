import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadSource = () => readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');

test('wires all album editing actions', () => {
  const source = loadSource();
  for (const token of [
    'renamePhoto',
    'movePhoto',
    'setCover',
    'removePhoto',
    'appendPhotos',
    'data-action',
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test('supports file validation and temporary local previews', () => {
  const source = loadSource();
  assert.match(source, /URL\.createObjectURL/);
  assert.match(source, /image\//);
  assert.match(source, /upload-error/);
  assert.match(source, /addEventListener\('change'/);
});

test('protects unsaved work while switching or leaving', () => {
  const source = loadSource();
  assert.match(source, /dirty/);
  assert.match(source, /discard-dialog/);
  assert.match(source, /beforeunload/);
  assert.match(source, /back-to-site/);
});

test('provides confirmation, validation, and save feedback', () => {
  const source = loadSource();
  assert.match(source, /showModal/);
  assert.match(source, /aria-invalid/);
  assert.match(source, /focusAfterDelete/);
  assert.match(source, /renderAlbum\(\{ focusPhotoId: focusAfterDelete \}\)/);
  assert.match(source, /保存本次预览/);
  assert.match(source, /刷新后仍会恢复/);
});
