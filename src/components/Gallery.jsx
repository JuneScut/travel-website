import SectionHeading from './SectionHeading.jsx';
import PhotoButton from './PhotoButton.jsx';
import { pad } from '../lib/journal.js';
import { useReveal } from '../hooks/useMotion.js';

const ratios = ['4 / 5', '4 / 3', '3 / 4', '4 / 3', '4 / 5', '1 / 1'];
function GalleryPhoto({ photo, index, onOpen, reduced }) {
  const ref = useReveal(reduced);
  return <div ref={ref} className="gallery-photo"><PhotoButton className="shot" label={`放大查看：${photo.caption}`} style={{ '--ratio': ratios[index % ratios.length] }} onOpen={(trigger) => onOpen(index, trigger)}><span className="shot-img"><img src={photo.src} alt={photo.alt} loading="lazy" style={{ objectPosition: photo.position }} /></span><span className="shot-cap"><b>{pad(index + 1)}</b>{photo.caption}</span></PhotoButton></div>;
}
export default function Gallery({ trip, onOpen, reduced }) {
  return <section className="section" id="album" aria-labelledby="album-title"><SectionHeading id="album-title" kicker="相册 / Album" title="Along the way" translation="沿途光影" meta={`${trip.city} · ${trip.gallery.length} 张精选`} reduced={reduced} /><div className="gallery" key={trip.id}>{[0, 1, 2].map((column) => <div className="gallery-col" key={column}>{trip.gallery.map((photo, i) => i % 3 === column && <GalleryPhoto key={i} photo={photo} index={i} onOpen={onOpen} reduced={reduced} />)}</div>)}</div></section>;
}
