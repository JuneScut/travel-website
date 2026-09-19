import { getAdjacentTrip, getTripById, trips } from './trips.js?v=world-map-2';

const selector = document.querySelector('#trip-selector');
const routeList = document.querySelector('#route-list');
const routeCoords = document.querySelector('#route-coords');
const footerCoords = document.querySelector('#footer-coords');
const tripHero = document.querySelector('#trip-hero');
const tripPhotoCaption = document.querySelector('#trip-photo-caption');
const tripKicker = document.querySelector('#trip-kicker');
const tripTitle = document.querySelector('#trip-title');
const tripDate = document.querySelector('#trip-date');
const tripDescription = document.querySelector('#trip-description');
const tripPosition = document.querySelector('#trip-position');
const galleryMeta = document.querySelector('#gallery-meta');
const galleryGrid = document.querySelector('#gallery-grid');
const mapMarkers = document.querySelector('#map-markers');
const footprints = document.querySelector('#footprints');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const lightboxCount = document.querySelector('#lightbox-count');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let selectedId = 'kyoto';
let currentTrip = getTripById(selectedId);
let lightboxIndex = 0;
let returnFocusTo = null;

function projectGeoPoint({ latitude, longitude }) {
  return {
    x: ((longitude + 180) / 360) * 100,
    y: ((90 - latitude) / 180) * 100,
  };
}

function updateMapState(activeId) {
  mapMarkers.querySelectorAll('.map-marker').forEach((mapMarker) => {
    const isSelected = mapMarker.dataset.mapTripId === activeId;
    mapMarker.classList.toggle('is-selected', isSelected);
    mapMarker.setAttribute('aria-pressed', String(isSelected));
  });
}

function renderMapMarkers() {
  mapMarkers.innerHTML = trips
    .map((trip) => {
      const point = projectGeoPoint(trip.geo);
      const easternClass = point.x > 74 ? ' is-eastern' : '';
      return `
        <button class="map-marker${easternClass}" type="button" data-map-trip-id="${trip.id}"
          style="--map-x:${point.x.toFixed(3)}%; --map-y:${point.y.toFixed(3)}%; --marker-accent:${trip.accent}"
          aria-label="选择${trip.city}并查看旅程详情" aria-describedby="map-instruction"
          aria-pressed="${trip.id === selectedId}">
          <span class="map-marker-label">
            <strong>${trip.latin}</strong>
            <small>${trip.city} · ${trip.shortDate}</small>
          </span>
        </button>`;
    })
    .join('');

  mapMarkers.querySelectorAll('.map-marker').forEach((mapMarker) => {
    const tripId = mapMarker.dataset.mapTripId;
    mapMarker.addEventListener('click', () => {
      selectTrip(tripId);
      footprints.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

function renderSelector() {
  selector.innerHTML = trips
    .map(
      (trip) => `
        <button class="index-card" type="button" data-trip-id="${trip.id}"
          aria-label="查看${trip.city}旅程" aria-pressed="${trip.id === selectedId}">
          <span class="index-visual" aria-hidden="true">
            <span class="index-shader" style="--shader: ${trip.shader}"></span>
          </span>
          <span class="index-label"><span>${trip.latin}</span><span>${trip.shortDate}</span></span>
        </button>`,
    )
    .join('');

  selector.querySelectorAll('.index-card').forEach((card) => {
    const tripId = card.dataset.tripId;

    card.addEventListener('pointerenter', () => renderTrip(getTripById(tripId), { preview: true }));
    card.addEventListener('pointerleave', () => renderTrip(getTripById(selectedId)));
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 8;
      card.style.setProperty('--tx', `${x}px`);
      card.style.setProperty('--ty', `${y}px`);
      card.style.setProperty('--mx', `${50 + x * 2}%`);
      card.style.setProperty('--my', `${50 + y * 2}%`);
    });
    card.addEventListener('click', () => selectTrip(tripId, { focus: true }));
  });
}

function renderGallery(trip) {
  galleryMeta.textContent = `${trip.city} · ${trip.gallery.length} 张精选`;
  galleryGrid.innerHTML = trip.gallery
    .map(
      (photo, index) => `
        <button class="gallery-item" type="button" data-photo-index="${index}" aria-label="放大查看：${photo.caption}">
          <span class="image-wrap"><img src="${photo.src}" alt="${photo.alt}" loading="lazy" style="object-position:${photo.position}" /></span>
          <span>${photo.caption}</span>
        </button>`,
    )
    .join('');

  galleryGrid.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      returnFocusTo = item;
      openLightbox(Number(item.dataset.photoIndex));
    });
  });
}

function renderLightbox() {
  const photo = currentTrip.gallery[lightboxIndex];
  lightboxImage.src = photo.src;
  lightboxImage.alt = photo.alt;
  lightboxImage.style.objectPosition = photo.position;
  lightboxCaption.textContent = `${currentTrip.city} · ${photo.caption}`;
  lightboxCount.textContent = `${String(lightboxIndex + 1).padStart(2, '0')} / ${String(currentTrip.gallery.length).padStart(2, '0')}`;
}

function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  lightbox.showModal();
  document.querySelector('#close-lightbox').focus();
}

function cyclePhoto(direction) {
  lightboxIndex = (lightboxIndex + direction + currentTrip.gallery.length) % currentTrip.gallery.length;
  renderLightbox();
  if (!reduceMotion && lightboxImage.animate) {
    lightboxImage.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  }
}

function updateSelectorState(activeId) {
  selector.querySelectorAll('.index-card').forEach((card) => {
    const isActive = card.dataset.tripId === activeId;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-pressed', String(card.dataset.tripId === selectedId));
  });
}

function renderTrip(trip, { preview = false } = {}) {
  currentTrip = trip;
  document.documentElement.style.setProperty('--accent', trip.accent);
  updateSelectorState(trip.id);

  routeList.innerHTML = trip.route
    .map(([place, date]) => `<li><strong>${place}</strong><span>${date}</span></li>`)
    .join('');
  routeCoords.textContent = trip.coords;
  footerCoords.textContent = trip.coords;

  tripHero.src = trip.hero;
  tripHero.alt = `${trip.city}${trip.title}的旅行照片`;
  tripPhotoCaption.textContent = `${trip.city} · ${trip.country}`;
  tripKicker.textContent = `${preview ? 'PREVIEW' : 'FEATURED JOURNEY'} · ${trip.latin}`;
  tripTitle.textContent = `${trip.city} · ${trip.title}`;
  tripDate.textContent = trip.date;
  tripDate.dateTime = trip.date.replaceAll('.', '-');
  tripDescription.textContent = trip.description;
  tripPosition.textContent = `${String(trips.findIndex(({ id }) => id === trip.id) + 1).padStart(2, '0')} / ${String(trips.length).padStart(2, '0')}`;

  renderGallery(trip);

  if (!reduceMotion && tripHero.animate) {
    tripHero.animate(
      [
        { opacity: 0.22, transform: 'scale(1.018)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
  }
}

function selectTrip(id, { focus = false } = {}) {
  selectedId = getTripById(id).id;
  renderTrip(getTripById(selectedId));
  updateMapState(selectedId);
  if (focus) selector.querySelector(`[data-trip-id="${selectedId}"]`)?.focus({ preventScroll: true });
}

function cycleTrip(direction) {
  selectTrip(getAdjacentTrip(selectedId, direction).id, { focus: true });
}

selector.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  cycleTrip(event.key === 'ArrowRight' ? 1 : -1);
});

document.querySelector('#previous-trip').addEventListener('click', () => cycleTrip(-1));
document.querySelector('#next-trip').addEventListener('click', () => cycleTrip(1));

document.querySelector('#close-lightbox').addEventListener('click', () => lightbox.close('dismiss'));
document.querySelector('#previous-photo').addEventListener('click', () => cyclePhoto(-1));
document.querySelector('#next-photo').addEventListener('click', () => cyclePhoto(1));

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) lightbox.close('dismiss');
});
lightbox.addEventListener('close', () => returnFocusTo?.focus({ preventScroll: true }));

document.addEventListener('keydown', (event) => {
  if (!lightbox.open) return;
  if (event.key === 'ArrowLeft') cyclePhoto(-1);
  if (event.key === 'ArrowRight') cyclePhoto(1);
  if (event.key === 'Escape') lightbox.close('dismiss');
});

renderSelector();
renderMapMarkers();
renderTrip(getTripById(selectedId));
updateMapState(selectedId);
