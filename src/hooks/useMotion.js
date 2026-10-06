import { useEffect, useRef, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function useReveal(reduced) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (reduced || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const animation = element.animate([
        { opacity: 0, transform: 'translateY(28px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
      observer.disconnect();
      animation.finished.catch(() => {});
    }, { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);
  return ref;
}
