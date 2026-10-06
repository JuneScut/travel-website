import { useEffect, useRef, useState } from 'react';
import { pad } from '../lib/journal.js';

export default function Lightbox({ album, onClose, reduced }) {
  const dialog = useRef(null);
  const image = useRef(null);
  const closing = useRef(false);
  const [index, setIndex] = useState(album.index);
  const photo = album.trip.gallery[index];

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const origin = album.trigger?.querySelector('img');
    let transition;
    if (!reduced && document.startViewTransition && origin) {
      origin.style.viewTransitionName = 'photo';
      transition = document.startViewTransition(() => {
        origin.style.viewTransitionName = '';
        element.showModal();
        image.current.style.viewTransitionName = 'photo';
      });
      transition.finished.finally(() => { if (image.current) image.current.style.viewTransitionName = ''; }).catch(() => {});
    } else element.showModal();
    return () => {
      transition?.skipTransition();
      if (origin) origin.style.viewTransitionName = '';
      element.close();
      document.body.style.overflow = previousOverflow;
      if (album.trigger?.isConnected) album.trigger.focus({ preventScroll: true });
    };
  }, [album, reduced]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    const target = album.trigger?.querySelector('img');
    if (!reduced && document.startViewTransition && target) {
      image.current.style.viewTransitionName = 'photo';
      const transition = document.startViewTransition(() => {
        image.current.style.viewTransitionName = '';
        dialog.current.close();
        target.style.viewTransitionName = 'photo';
      });
      transition.finished.finally(() => { target.style.viewTransitionName = ''; onClose(); }).catch(() => {});
    } else onClose();
  }

  function cycle(direction) {
    setIndex((value) => (value + direction + album.trip.gallery.length) % album.trip.gallery.length);
    if (!reduced) image.current.animate([{ opacity: 0.2, transform: `translateX(${direction * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 360 });
  }

  return <dialog className="lightbox" ref={dialog} aria-labelledby="lb-caption" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} onKeyDown={(event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cycle(event.key === 'ArrowRight' ? 1 : -1); }
  }}>
    <div className="lb-bar"><span className="micro">{pad(index + 1)} / {pad(album.trip.gallery.length)}</span><button type="button" className="lb-btn" aria-label="关闭大图" autoFocus onClick={close}>×</button></div>
    <div className="lb-media"><button type="button" className="lb-btn" aria-label="上一张照片" onClick={() => cycle(-1)}>←</button><img ref={image} src={photo.large ?? photo.src} alt={photo.alt} style={{ objectPosition: photo.position }} /><button type="button" className="lb-btn" aria-label="下一张照片" onClick={() => cycle(1)}>→</button></div>
    <p className="lb-cap" id="lb-caption">{album.trip.city} · {photo.caption}</p>
  </dialog>;
}
