import { useState } from 'react';

export default function PhotoButton({ className, label, onOpen, children, style, disabled = false }) {
  const [cursor, setCursor] = useState(null);
  return <button type="button" disabled={disabled} className={className} style={style} aria-label={label} onClick={(event) => onOpen(event.currentTarget)} onPointerMove={(event) => {
    if (event.pointerType === 'mouse') setCursor({ x: event.clientX, y: event.clientY });
  }} onPointerLeave={() => setCursor(null)} onBlur={() => setCursor(null)}>
    {children}{cursor && <span className="cursor is-on" aria-hidden="true" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>{className === 'photo' ? '查看' : '放大'}</span>}
  </button>;
}
