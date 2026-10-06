import { useId } from 'react';

export function StampArt({ id, className = '' }) {
  return <span data-art={id} className={`stamp-art ${className}`}><i /></span>;
}

export default function Stamp({ trip, selected, onSelect, reduced, index }) {
  const ringId = useId();
  function tilt(event) {
    if (reduced || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    Object.entries({ '--ry': `${x * 16}deg`, '--rx': `${y * -16}deg`, '--px': x, '--py': y }).forEach(([key, value]) => event.currentTarget.style.setProperty(key, value));
  }
  return <button className="stamp" type="button" data-trip={trip.id} data-art={trip.artKey} style={{ '--i': index }} aria-pressed={selected} aria-label={`选择${trip.city}旅程，${trip.dateRange}`} onClick={() => onSelect(trip.id)} onPointerMove={tilt} onPointerLeave={(event) => ['--rx', '--ry', '--px', '--py'].forEach((key) => event.currentTarget.style.removeProperty(key))}>
    <span className="stamp-lift"><span className="stamp-face" aria-hidden="true"><StampArt id={trip.artKey} /></span>
      <svg className="postmark" viewBox="0 0 120 80" aria-hidden="true"><defs><path id={ringId} d="M40 40 m-28 0 a28 28 0 1 1 56 0 a28 28 0 1 1 -56 0" /></defs><circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="40" cy="40" r="20" fill="none" stroke="currentColor" strokeWidth="1.2" /><text><textPath href={`#${ringId}`}>{trip.latin} · {trip.date.slice(0, 4)} ·</textPath></text><g fill="none" stroke="currentColor" strokeWidth="2"><path d="M78 26q6-6 12 0t12 0t12 0" /><path d="M78 40q6-6 12 0t12 0t12 0" /><path d="M78 54q6-6 12 0t12 0t12 0" /></g></svg>
    </span><span className="stamp-city">{trip.latin}</span><span className="stamp-zh">{trip.city}</span><span className="stamp-date">{trip.dateRange}</span>
  </button>;
}
