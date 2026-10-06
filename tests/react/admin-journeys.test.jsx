import { beforeEach, expect, it, vi } from 'vitest';
import adminMarkup from '../../admin/index.html?raw';
import { fireEvent, screen } from '@testing-library/react';

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = adminMarkup.split('<body>')[1].split('</body>')[0];
  window.HTMLDialogElement.prototype.close = function (value = '') {
    this.returnValue = value;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  await import('../../admin/admin.js');
});

function add(city = '成都') {
  fireEvent.click(screen.getByRole('button', { name: '＋ 添加旅程' }));
  const form = document.querySelector('#add-journey-form');
  for (const [name, value] of Object.entries({ city, title: '街巷里的散步', startDate: '2026-10-01', endDate: '2026-10-06' })) {
    fireEvent.change(form.elements[name], { target: { value } });
  }
  fireEvent.submit(form);
}
function confirmDeletion() {
  fireEvent.click(screen.getByRole('button', { name: '删除整段旅程' }));
  document.querySelector('#delete-journey-dialog').close('confirm');
}

it('adds a journey without photos, selects it and keeps it when switching', () => {
  add();
  expect(screen.getByRole('heading', { name: '成都相册' })).toBeTruthy();
  expect(screen.getByText('这段旅程还没有照片。')).toBeTruthy();
  expect(screen.getAllByRole('option')).toHaveLength(5);
  fireEvent.click(screen.getByRole('option', { name: /巴黎/ }));
  fireEvent.click(screen.getByRole('option', { name: /成都/ }));
  expect(screen.getByRole('heading', { name: '成都相册' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '保存本次预览' }).disabled).toBe(false);
});

it('canceling deletion preserves the journey; confirming deletes it and undo restores its photos', () => {
  const title = document.querySelector('[data-photo-title]');
  fireEvent.input(title, { target: { value: '修改后的标题' } });
  fireEvent.click(screen.getByRole('button', { name: '删除整段旅程' }));
  document.querySelector('#delete-journey-dialog').close('cancel');
  expect(screen.getAllByRole('option')).toHaveLength(4);
  confirmDeletion();
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.queryByRole('option', { name: /京都/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '撤销删除' }));
  expect(screen.getAllByRole('option')).toHaveLength(4);
  expect(document.querySelector('[data-photo-title]').value).toBe('修改后的标题');
  expect(screen.getByRole('heading', { name: '京都相册' })).toBeTruthy();
});

it('allows deleting every journey and adding again from the empty state', () => {
  for (let index = 0; index < 4; index++) confirmDeletion();
  expect(screen.queryAllByRole('option')).toHaveLength(0);
  expect(screen.getByRole('button', { name: '删除整段旅程' }).disabled).toBe(true);
  expect(screen.getByText('还没有旅程，点击上方添加。')).toBeTruthy();
  fireEvent.click(document.querySelector('[data-add-journey]'));
  expect(screen.getByRole('dialog', { name: '添加一段旅程' })).toBeTruthy();
});

it('validates dates and renders user text safely', () => {
  add('<b>成都</b>');
  expect(screen.getByRole('heading', { name: '<b>成都</b>相册' })).toBeTruthy();
  expect(document.querySelector('.trip-name b')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '＋ 添加旅程' }));
  const form = document.querySelector('#add-journey-form');
  for (const [name, value] of Object.entries({ city: '杭州', title: '湖边', startDate: '2026-10-06', endDate: '2026-10-01' })) form.elements[name].value = value;
  fireEvent.submit(form);
  expect(screen.getByRole('alert').textContent).toBe('结束日期不能早于开始日期');
  expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(5);
});

it('adds the first photo to an empty journey as its cover and retains saved edits across switches', () => {
  window.URL.createObjectURL = vi.fn(() => 'blob:new-photo');
  add();
  const input = document.querySelector('#photo-input');
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['image'], 'morning.webp', { type: 'image/webp' })] });
  fireEvent.change(input);
  expect(screen.getByText('1 张照片 · 1 张封面')).toBeTruthy();
  expect(screen.getByText('COVER')).toBeTruthy();
  fireEvent.input(document.querySelector('[data-photo-title]'), { target: { value: '清晨的街道' } });
  fireEvent.click(screen.getByRole('button', { name: '保存本次预览' }));
  fireEvent.click(screen.getByRole('option', { name: /巴黎/ }));
  fireEvent.click(screen.getByRole('option', { name: /成都/ }));
  expect(document.querySelector('[data-photo-title]').value).toBe('清晨的街道');
  expect(document.querySelector('#discard-dialog').hasAttribute('open')).toBe(false);
});
