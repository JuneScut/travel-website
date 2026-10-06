import React, { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getTripById } from '../../src/trips.js';
import { initialJourney, journeyReducer } from '../../src/lib/journal.js';

vi.mock('../../src/hooks/useAtlasMap.js', () => ({ default: () => ({ container: { current: null }, stage: { current: null }, pins: [], zoom: 1, status: 'error', retry: vi.fn(), zoomBy: vi.fn(), showWorld: vi.fn() }) }));
import App from '../../src/App.jsx';
import Atlas from '../../src/components/Atlas.jsx';

it('updates the story, selected stamp, album and map card on a journey choice', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^选择巴黎旅程/ }));
  expect(screen.getByRole('heading', { name: '巴黎 · 左岸书店关门以前' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^选择巴黎旅程/ }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('巴黎 · 6 张精选')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('4 个站点 · 6 张照片')).toBeTruthy());
  expect(screen.getAllByAltText(/巴黎旅行照片/)).toHaveLength(6);
});

it('supports arrow-key trip selection and transfers focus to the selected stamp', () => {
  render(<App />);
  const stamp = screen.getByRole('button', { name: /^选择京都旅程/ });
  stamp.focus();
  fireEvent.keyDown(stamp, { key: 'ArrowRight' });
  expect(screen.getByRole('heading', { name: '冰岛 · 风把黑沙吹向海面' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /^选择冰岛旅程/ }));
});

it('opens, cycles and closes the lightbox and restores trigger focus', () => {
  render(<App />);
  const trigger = screen.getByRole('button', { name: '放大查看：末班电车' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  expect(screen.getByText('06 / 06')).toBeTruthy();
  fireEvent.keyDown(dialog, { key: 'ArrowRight' });
  expect(screen.getByText('01 / 06')).toBeTruthy();
  expect(screen.getByText('京都 · 雨后的花见小路')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '关闭大图' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe('');
});

it('rapid selections leave all displayed content on the final journey', () => {
  render(<App />);
  for (const city of ['巴黎', '里斯本', '冰岛', '京都']) fireEvent.click(screen.getByRole('button', { name: new RegExp(`^选择${city}旅程`) }));
  expect(screen.getByRole('heading', { name: '京都 · 雨后的青石路' })).toBeTruthy();
  expect(screen.getByRole('img', { name: '京都 · 雨后的青石路的旅行照片' }).getAttribute('src')).toContain('kyoto.webp');
  expect(screen.getByText('京都 · 6 张精选')).toBeTruthy();
});

it('keeps every station usable through the location list when the map service fails', () => {
  const select = vi.fn();
  render(<Atlas trip={getTripById('kyoto')} state={initialJourney()} onSelect={select} onOpen={vi.fn()} reduced />);
  expect(screen.getByRole('status').textContent).toContain('地图服务暂时无法访问');
  expect(screen.getByRole('button', { name: '放大地图' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /蒙马特/ }));
  expect(select).toHaveBeenCalledWith('paris', { kind: 'stop', tripId: 'paris', stop: 1 }, 'map');
});

it('selects a footprint without replacing the story or album, and returns to a journey', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /^选择巴黎旅程/ }));
  const shanghai = screen.getByRole('button', { name: /上海\s*2024\.11 · 无相册/ });
  fireEvent.click(shanghai);
  expect(shanghai.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: /巴黎\s*2025\.10/ }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('heading', { name: '巴黎 · 左岸书店关门以前' })).toBeTruthy();
  expect(screen.getByText('巴黎 · 6 张精选')).toBeTruthy();
  expect(screen.getAllByAltText(/巴黎旅行照片/)).toHaveLength(6);
  expect(screen.getByText('SHANGHAI · 2024.11 · 足迹')).toBeTruthy();
  expect(screen.getByText(/（示例数据）/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '打开相册', exact: true })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /京都\s*2026\.04/ }));
  expect(shanghai.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('heading', { name: '京都 · 雨后的青石路' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '打开相册', exact: true })).toBeTruthy();
});

it('footprints remain selectable through the timeline when map loading fails', () => {
  const select = vi.fn();
  render(<Atlas trip={getTripById('kyoto')} state={initialJourney()} onSelect={select} onOpen={vi.fn()} reduced />);
  fireEvent.click(screen.getByRole('button', { name: /清迈\s*2024\.06 · 无相册/ }));
  expect(select).toHaveBeenCalledWith(undefined, { kind: 'foot', footId: 'chiangmai' }, 'map');
});
