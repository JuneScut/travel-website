import { useReducer, useState } from 'react';
import { getTripById } from './trips.js';
import { initialJourney, journeyReducer } from './lib/journal.js';
import { useReducedMotion } from './hooks/useMotion.js';
import { Masthead, Cover, Footer } from './components/Chrome.jsx';
import Journey from './components/Journey.jsx';
import Gallery from './components/Gallery.jsx';
import Lightbox from './components/Lightbox.jsx';
import Atlas from './components/Atlas.jsx';

export default function App() {
  const [state, dispatch] = useReducer(journeyReducer, undefined, initialJourney);
  const [album, setAlbum] = useState(null);
  const reduced = useReducedMotion();
  const trip = getTripById(state.tripId);
  const select = (tripId, place, source = 'journey') => dispatch({ type: 'select', tripId, place, source });
  const cycle = (direction) => dispatch({ type: 'cycle', direction });
  const open = (index, trigger) => setAlbum({ trip, index, trigger });

  return <><a className="skip-link" href="#main">跳到主要内容</a><Masthead /><main id="main"><Cover /><Journey trip={trip} place={state.place} onSelect={select} onCycle={cycle} onOpen={open} reduced={reduced} /><Gallery trip={trip} onOpen={open} reduced={reduced} /><Atlas trip={trip} state={state} onSelect={select} onOpen={open} reduced={reduced} /></main><Footer />{album && <Lightbox album={album} onClose={() => setAlbum(null)} reduced={reduced} />}</>;
}
