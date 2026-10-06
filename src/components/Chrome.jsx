import { useEffect, useRef } from 'react';

export function Masthead() {
  const progress = useRef(null);
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = document.documentElement.scrollHeight - innerHeight;
        progress.current.style.transform = `scaleX(${height > 0 ? scrollY / height : 0})`;
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  return <header className="mast intro-mast"><div className="mast-inner">
    <a className="brand" href="#top">旅迹 <small>JOURNAL</small></a>
    <span className="issue">PHOTOGRAPHIC JOURNAL · No. 04</span>
    <nav aria-label="网站导航"><a href="#journeys">旅程</a><a href="#album">沿途光影</a><a href="#atlas">世界足迹 ↗</a></nav>
  </div><span ref={progress} className="progress" aria-hidden="true" /></header>;
}

export function Cover() {
  let index = 0;
  const word = (text) => [...text].map((character) => <span className="ch" key={index} style={{ '--k': index++ }}>{character}</span>);
  return <><section className="cover" id="top" aria-labelledby="cover-title">
    <h1 id="cover-title" aria-label="Out of office."><span className="word" aria-hidden="true">{word('Out')}</span>{' '}<span className="word" aria-hidden="true">{word('of')}</span>{' '}<em className="word" aria-hidden="true">{word('office.')}</em></h1>
    <p className="cover-note"><b>去远方，收集日常之外。</b>PHOTOGRAPHIC JOURNAL / 2025 — 2026</p>
  </section><div className="rule intro-rule" /></>;
}

export function Footer() {
  return <footer className="footer"><h2>Next stop, <em>unknown.</em></h2><div className="footer-row"><span>© 2026 旅迹 JOURNAL · 记录 · 探索 · 珍藏</span><a href="#top">回到顶部 ↑</a></div></footer>;
}
