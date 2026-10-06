import { trips } from '../src/trips.js';

// Stamp-only details the production data doesn't carry yet.
const extra = {
  lisbon: { postal: 'PORTUGAL', code: 'PT', value: '12', en: 'a tram up the windy hill', posted: '12 Mar 2026', roman: '12 III' },
  kyoto: { postal: 'NIPPON · 日本', code: 'JP', value: '26', en: 'after the rain, Kyoto', posted: '18 Apr 2026', roman: '18 IV' },
  iceland: { postal: 'ÍSLAND', code: 'IS', value: '25', en: 'black sand, low clouds', posted: '08 Feb 2025', roman: '08 II' },
  paris: { postal: 'FRANCE', code: 'FR', value: '10', en: 'before the bookshops close', posted: '03 Oct 2025', roman: '03 X' },
};

export const journeys = trips.map((trip) => ({
  ...trip,
  ...extra[trip.id],
  hero: trip.hero.replace('./', '../'),
  lat: trip.coords.split(' · ')[0],
}));

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const pad = (n) => String(n).padStart(2, '0');

// Wires click + ← → to a render(index) callback and returns a select() helper.
// An optional transition(update, originEl) wraps every change after the first render.
export function createSelector(render, { start = 1, transition } = {}) {
  const fromUrl = journeys.findIndex(({ id }) => id === new URLSearchParams(location.search).get('trip'));
  let index = fromUrl < 0 ? start : fromUrl;
  const select = (next) => {
    index = (next + journeys.length) % journeys.length;
    const update = () => render(journeys[index], index);
    if (transition) transition(update, document.querySelector(`[data-pick="${index}"]`));
    else update();
  };
  document.querySelectorAll('[data-pick]').forEach((el) => {
    el.addEventListener('click', () => select(Number(el.dataset.pick)));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') select(index + 1);
    if (event.key === 'ArrowLeft') select(index - 1);
  });
  render(journeys[index], index);
  return { select, current: () => index };
}

export function animate(el, keyframes, options) {
  if (!reduceMotion && el?.animate) el.animate(keyframes, { easing: 'cubic-bezier(.22,1,.36,1)', ...options });
}
