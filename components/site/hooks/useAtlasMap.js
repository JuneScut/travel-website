import { useEffect, useRef, useState } from 'react';
import { useTrips } from '../TripContext.jsx';

import { coordinates } from '../lib/journal.js';
import { paintStyle, greatCircle } from '../lib/map-style.js';
import 'maplibre-gl/dist/maplibre-gl.css';
const workerUrl = '/map-worker.js';

const line = (coordinates, properties = {}) => ({ type: 'Feature', properties, geometry: coordinates.length >= 2 ? { type: 'LineString', coordinates } : null });
const worldView = (element) => ({ center: [52, 36], zoom: element.clientWidth < 700 ? 0.9 : 1.55, bearing: 0, pitch: 0 });


export default function useAtlasMap({ state, onSelect, reduced }) {
  const trips = useTrips();
  const chronologicalTrips = [...trips].filter(trip => trip.geo).sort((a, b) => a.date.localeCompare(b.date));
  const flightPath = chronologicalTrips.slice(1).flatMap((trip, i) => greatCircle(coordinates(chronologicalTrips[i].geo), coordinates(trip.geo)).slice(i ? 1 : 0));
  const container = useRef(null);
  const stage = useRef(null);
  const mapRef = useRef(null);
  const selectRef = useRef(onSelect);
  const stateRef = useRef(state);
  const visible = useRef(false);
  selectRef.current = onSelect;
  stateRef.current = state;
  const [pins, setPins] = useState([]);
  const [status, setStatus] = useState('loading');
  const [zoom, setZoom] = useState(1);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    let map;
    let frame;
    let timer;
    const controller = new AbortController();
    const hosts = [];
    setPins([]);
    setStatus('loading');
    const visibility = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; }, { threshold: 0.2 });
    visibility.observe(stage.current);
    async function init() {
      try {
        timer = setTimeout(() => { if (!disposed) setStatus('error'); }, 20000);
        const [module, response] = await Promise.all([
          import('maplibre-gl'),
          fetch('https://tiles.openfreemap.org/styles/liberty', { signal: controller.signal }),
        ]);
        if (!response.ok) throw new Error('Map style unavailable');
        const style = await response.json();
        if (disposed) return;
        const maplibre = module;
        maplibre.setWorkerUrl(workerUrl);
        map = new maplibre.Map({
          container: container.current, style: paintStyle(style), ...worldView(stage.current),
          minZoom: 0.6, maxZoom: 17, dragRotate: false, pitchWithRotate: false,
          touchPitch: false, cooperativeGestures: true, attributionControl: { compact: true },
          localIdeographFontFamily: "'Noto Sans SC', 'PingFang SC', sans-serif",
          locale: {
            'CooperativeGesturesHandler.WindowsHelpText': '按住 Ctrl 并滚动以缩放地图',
            'CooperativeGesturesHandler.MacHelpText': '按住 ⌘ 并滚动以缩放地图，或用触控板双指捏合',
            'CooperativeGesturesHandler.MobileHelpText': '用两根手指移动和缩放地图',
          },
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.on('zoom', () => setZoom(map.getZoom()));
        map.on('movestart', () => { stage.current.dataset.idle = 'false'; });
        map.on('idle', () => { stage.current.dataset.idle = 'true'; });
        map.on('error', () => { if (!disposed) setStatus('error'); });
        map.once('load', () => {
          if (disposed) return;
          clearTimeout(timer);
          setStatus('ready');
          map.getCanvas().setAttribute('aria-label', '世界地图，方向键平移，加减号缩放');
          map.addSource('flight', { type: 'geojson', data: line(reduced ? flightPath : flightPath.slice(0, 2)) });
          map.addLayer({ id: 'flight', type: 'line', source: 'flight', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#E73759', 'line-width': 2, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 0.25] } });
          map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: trips.map((trip) => line(trip.route.filter(([, , geo]) => geo).map(([, , geo]) => coordinates(geo)), { tripId: trip.id })) } });
          map.addLayer({ id: 'routes', type: 'line', source: 'routes', minzoom: 4.5, paint: { 'line-color': '#254837', 'line-width': 2, 'line-dasharray': [1, 2.2] } });
          for (const trip of trips) {
            const add = (kind, geo, stop) => {
              const host = document.createElement('button');
              host.type = 'button';
              host.className = `pin pin-${kind}`;
              host.setAttribute('aria-label', kind === 'trip' ? `${trip.city}，有相册，点击切换到这段旅程` : `${trip.route[stop][0]}，${trip.city}旅程第 ${stop + 1} 站`);
              host.addEventListener('click', () => selectRef.current(trip.id, { kind, tripId: trip.id, ...(kind === 'stop' ? { stop } : {}) }, 'map'));
              new maplibre.Marker({ element: host, anchor: 'center', opacityWhenCovered: '0' }).setLngLat(coordinates(geo)).addTo(map);
              hosts.push({ host, kind, trip, stop });
            };
            if (trip.geo) add('trip', trip.geo);
            trip.route.forEach(([, , geo], stop) => { if (geo) add('stop', geo, stop); });
          }
          setPins([...hosts]);
          if (!reduced && flightPath.length > 1) {
            const start = performance.now();
            const draw = (now) => {
              if (disposed) return;
              const progress = Math.min(1, (now - start) / 2800);
              const count = Math.max(2, Math.round(progress * flightPath.length));
              map.getSource('flight').setData(line(flightPath.slice(0, count)));
              if (progress < 1) frame = requestAnimationFrame(draw);
            };
            frame = requestAnimationFrame(draw);
          }
          // A timeline choice made before load still controls the camera on arrival.
          if (stateRef.current.cameraSource === 'map') moveToPlace(map, stateRef.current, stage.current, reduced, trips);
        });
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') {
          console.warn('Unable to load the world atlas:', error.message);
          setStatus('error');
        }
      }
    }
    const nearby = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      nearby.disconnect();
      init();
    }, { rootMargin: '600px 0px' });
    nearby.observe(stage.current);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      nearby.disconnect();
      visibility.disconnect();
      mapRef.current = null;
      map?.remove();
    };
  }, [reduced, retry]);

  useEffect(() => {
    pins.forEach(({ host, kind, trip, stop }) => {
      const selected = kind === 'trip'
          ? state.place.kind !== 'foot' && state.tripId === trip.id
          : state.place.kind === 'stop' && state.tripId === trip.id && state.place.stop === stop;
      host.setAttribute('aria-pressed', String(selected));
      host.classList.toggle('is-trip', state.tripId === trip?.id);
    });
    if (mapRef.current && pins.length && state.cameraSource !== 'initial' && (state.cameraSource === 'map' || visible.current)) {
      moveToPlace(mapRef.current, state, stage.current, reduced, trips);
    }
  }, [state, pins, reduced]);

  return { container, stage, pins, status, zoom, retry: () => setRetry((value) => value + 1),
    zoomBy: (direction) => mapRef.current?.[direction > 0 ? 'zoomIn' : 'zoomOut']({ duration: reduced ? 0 : 400 }),
    showWorld: () => {
      const map = mapRef.current;
      if (map) map[reduced ? 'jumpTo' : 'flyTo']({ ...worldView(stage.current), duration: 1800 });
    },
  };
}

function moveToPlace(map, state, stage, reduced, trips) {
  const trip = trips.find((trip) => trip.id === state.tripId);
  if (!trip) return;
  if (state.place.kind === 'stop' && trip.route[state.place.stop]?.[2]) {
    map[reduced ? 'jumpTo' : 'flyTo']({ center: coordinates(trip.route[state.place.stop][2]), zoom: 13.5, duration: 2200 });
    return;
  }
  const points = trip.route.filter(([, , geo]) => geo).map(([, , geo]) => coordinates(geo));
  if (!points.length) { if (trip.geo) map.jumpTo({ center: coordinates(trip.geo), zoom: 8 }); return; }
  const bounds = [[Math.min(...points.map(([x]) => x)), Math.min(...points.map(([, y]) => y))], [Math.max(...points.map(([x]) => x)), Math.max(...points.map(([, y]) => y))]];
  const padding = stage.clientWidth < 700 ? { top: 100, bottom: 210, left: 35, right: 65 } : { top: 90, bottom: 90, left: 420, right: 120 };
  map.fitBounds(bounds, { padding, maxZoom: 11.5, duration: reduced ? 0 : 2200 });
}
