'use client';

import { useState } from 'react';
import { TripContext } from './TripContext.jsx';
import { useReducedMotion } from './hooks/useMotion.js';
import { Masthead, Cover, Footer } from './components/Chrome.jsx';
import Journey from './components/Journey.jsx';
import Gallery from './components/Gallery.jsx';
import Lightbox from './components/Lightbox.jsx';
import Atlas from './components/Atlas.jsx';

export default function Journal({ trips, initialId }) {
  const first = trips.find(trip => trip.id === initialId) ?? trips.find(trip => trip.artKey === 'kyoto') ?? trips[0];
  const [state, setState] = useState({ tripId: first?.id, place: { kind: 'trip', tripId: first?.id }, cameraRevision: 0, cameraSource: 'initial' });
  const [album, setAlbum] = useState(null);
  const reduced = useReducedMotion();
  const trip = trips.find(trip => trip.id === state.tripId) ?? first;
  const select = (tripId, place, source = 'journey') => setState(value => ({ tripId, place: place ?? { kind: 'trip', tripId }, cameraRevision: value.cameraRevision + 1, cameraSource: source }));
  const cycle = direction => select(trips[(trips.findIndex(item => item.id === trip.id) + direction + trips.length) % trips.length].id);
  const open = (index, trigger) => { if (trip.gallery.length) setAlbum({ trip, index: Math.max(0, index), trigger }); };
  return <TripContext.Provider value={trips}><a className="skip-link" href="#main">跳到主要内容</a><Masthead /><main id="main"><Cover />{trip ? <><Journey trip={trip} place={state.place} onSelect={select} onCycle={cycle} onOpen={open} reduced={reduced} /><Gallery trip={trip} onOpen={open} reduced={reduced} /><Atlas trip={trip} state={state} onSelect={select} onOpen={open} reduced={reduced} /></> : <section className="section"><h2>旅途即将开始。</h2><p>新的旅行记录正在整理中。</p></section>}</main><Footer />{album && <Lightbox album={album} onClose={() => setAlbum(null)} reduced={reduced} />}</TripContext.Provider>;
}
