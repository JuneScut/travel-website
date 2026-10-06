import { useReveal } from '../hooks/useMotion.js';

export default function SectionHeading({ id, kicker, title, translation, meta, reduced }) {
  const ref = useReveal(reduced);
  return <header className="section-head" ref={ref}><div><span className="micro">{kicker}</span><h2 id={id}>{title}<span>{translation}</span></h2></div><p>{meta}</p></header>;
}
