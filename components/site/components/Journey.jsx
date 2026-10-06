import { useRef } from 'react';
import { useTrips } from '../TripContext.jsx';
import { pad, titleOf } from '../lib/journal.js';
import Stamp from './Stamp.jsx';
import PhotoButton from './PhotoButton.jsx';

export default function Journey({ trip, place, onSelect, onCycle, onOpen, reduced }) {
  const trips = useTrips();
  const stamps = useRef(null);
  const index = trips.findIndex((item) => item.id === trip.id);
  function keyboard(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    onCycle(direction);
    const next = trips[(index + direction + trips.length) % trips.length];
    stamps.current.querySelector(`[data-trip="${next.id}"]`).focus({ preventScroll: true });
  }
  return <><section className="edition" id="journeys" aria-label="旅程">
    <div className="stamp-index" ref={stamps} role="group" aria-label="选择旅程邮票，左右方向键切换" onKeyDown={keyboard}>{trips.map((item, i) => <Stamp key={item.id} trip={item} selected={item.id === trip.id} index={i} onSelect={onSelect} reduced={reduced} />)}</div>
    <article className="story" aria-live="polite">
      <PhotoButton disabled={!trip.gallery.length} className="photo" label={`查看大图：${titleOf(trip)}`} onOpen={(trigger) => trip.gallery.length && onOpen(0, trigger)}><img key={trip.id} className="hero-image" src={trip.hero} alt={`${titleOf(trip)}的旅行照片`} width="1122" height="1402" /><span key={`a-${trip.id}`} className="curtain curtain-a" /><span key={`b-${trip.id}`} className="curtain curtain-b" /><span className="frame-no">FRAME {pad(index + 1)} · {trip.latin}</span></PhotoButton>
      <div className="story-meta" key={trip.id}><div><span className="micro kicker">{trip.latin} / {trip.dateRange}</span><h2>{titleOf(trip)}</h2></div><div><p className="desc">{trip.description}</p><a href={`/trips/${trip.slug}`}>阅读完整旅程 ↗</a><ol className="route">{trip.route.map(([name, date], i) => <li key={name} className={place.kind === 'stop' && place.stop === i ? 'is-anchor' : ''}>{name} <time>{date}</time></li>)}</ol><div className="controls"><button type="button" aria-label="上一段旅程" onClick={() => onCycle(-1)}>←</button><span>{pad(index + 1)} / {pad(trips.length)}</span><button type="button" aria-label="下一段旅程" onClick={() => onCycle(1)}>→</button></div></div></div>
    </article>
  </section><div className="rule" /></>;
}
