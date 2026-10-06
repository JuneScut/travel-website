import { createJourney, removeJourney, restoreJourney } from './journey-state.js';
import { trips } from '../src/trips.js';
import {
  appendPhotos,
  createAlbumDraft,
  movePhoto,
  removePhoto,
  renamePhoto,
  setCover,
} from './album-state.js';

const tripList = document.querySelector('#trip-list');
const albumGrid = document.querySelector('#album-grid');
const albumKicker = document.querySelector('#album-kicker');
const albumTitle = document.querySelector('#album-title');
const albumMeta = document.querySelector('#album-meta');
const photoInput = document.querySelector('#photo-input');
const uploadError = document.querySelector('#upload-error');
const statusMessage = document.querySelector('#status-message');
const saveState = document.querySelector('#save-state');
const saveButton = document.querySelector('#save-preview');
const backToSite = document.querySelector('#back-to-site');
const deleteDialog = document.querySelector('#delete-dialog');
const deleteCopy = document.querySelector('#delete-copy');
const discardDialog = document.querySelector('#discard-dialog');
const discardCopy = document.querySelector('#discard-copy');

const addJourneyButton = document.querySelector('#add-journey');
const deleteJourneyButton = document.querySelector('#delete-journey');
const addJourneyDialog = document.querySelector('#add-journey-dialog');
const addJourneyForm = document.querySelector('#add-journey-form');
const newJourneyPhotos = document.querySelector('#new-journey-photos');
const journeyFormError = document.querySelector('#journey-form-error');
const deleteJourneyDialog = document.querySelector('#delete-journey-dialog');
const undoNotice = document.querySelector('#undo-notice');
const savedDrafts = new Map();
const objectUrls = new Set();
let collectionDirty = false;
let albumDirty = false;
let deletedJourney = null;
let pendingJourneyId = null;

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const makeAdminTrip = (trip) => ({
  ...trip,
  gallery: trip.gallery.map((photo) => ({
    ...photo,
    src: photo.src.replace('./assets/', '../assets/'),
  })),
});
let adminTrips = trips.map(makeAdminTrip);
const freshDraft = (tripId) => savedDrafts.get(tripId) ?? createAlbumDraft(adminTrips.find((trip) => trip.id === tripId));

let activeTripId = 'kyoto';
let albumDraft = freshDraft(activeTripId);
let dirty = false;
let pendingDeleteId = null;
let pendingNavigation = null;
let returnFocusTo = null;

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

function activeTrip() {
  return adminTrips.find((trip) => trip.id === activeTripId);
}

function setDirty(nextDirty) {
  albumDirty = nextDirty;
  dirty = albumDirty || collectionDirty;
  saveState.classList.toggle('is-dirty', dirty);
  saveState.querySelector('span').textContent = dirty ? '存在未保存修改' : '无未保存修改';
  saveButton.disabled = !dirty;
}

function announce(message) {
  statusMessage.textContent = message;
}

function renderTripList() {
  document.querySelector('#archive-count').textContent = `ARCHIVE / ${String(adminTrips.length).padStart(2, '0')}`;
  tripList.innerHTML = adminTrips
    .map(
      (trip, index) => `
        <button class="trip-option" type="button" role="option" data-trip-id="${trip.id}"
          aria-selected="${trip.id === activeTripId}">
          <span class="trip-order">${String(index + 1).padStart(2, '0')}</span>
          <span class="trip-name">${escapeHtml(trip.city)}</span>
          <span class="trip-count">${trip.id === activeTripId ? albumDraft?.photos.length ?? 0 : savedDrafts.get(trip.id)?.photos.length ?? trip.gallery.length} PHOTOS</span>
        </button>`,
    )
    .join('') || '<p class="trip-list-empty">还没有旅程，点击上方添加。</p>';
}

function renderAlbum({ focusPhotoId = null } = {}) {
  const trip = activeTrip();
  deleteJourneyButton.disabled = !trip;
  photoInput.disabled = !trip;
  document.querySelector('.journey-actions .add-photo-button').hidden = !trip;
  const summary = document.querySelector('#journey-summary');
  uploadError.hidden = true;
  if (!trip) {
    albumKicker.textContent = 'YOUR JOURNAL';
    albumTitle.textContent = '下一段旅程，从这里开始';
    albumMeta.textContent = '还没有旅程';
    summary.innerHTML = '';
    albumGrid.innerHTML = '<div class="album-empty"><p>添加目的地、日期和照片，开始记录新的旅程。</p><button class="save-button" type="button" data-add-journey>＋ 添加旅程</button></div>';
    return;
  }
  summary.innerHTML = `<p>${escapeHtml(trip.title)}</p><span>${escapeHtml(trip.dateRange)}${trip.country ? ` · ${escapeHtml(trip.country)}` : ''}</span>${trip.route.length ? `<ol>${trip.route.map(([name]) => `<li>${escapeHtml(name)}</li>`).join('')}</ol>` : ''}`;
  albumKicker.textContent = `CURRENT JOURNEY / ${trip.latin}`;
  albumTitle.textContent = `${trip.city}相册`;
  albumMeta.textContent = `${albumDraft.photos.length} 张照片${albumDraft.coverId ? ' · 1 张封面' : ''}`;
  document.documentElement.style.setProperty('--accent', trip.accent);

  albumGrid.innerHTML = albumDraft.photos
    .map((photo, index) => {
      const isCover = photo.id === albumDraft.coverId;
      const isOnlyPhoto = albumDraft.photos.length === 1;
      return `
        <article class="photo-card" data-photo-id="${photo.id}">
          <div class="photo-visual">
            <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}" style="object-position:${escapeHtml(photo.position)}" />
            <span class="photo-number">${String(index + 1).padStart(2, '0')}</span>
            ${isCover ? '<span class="cover-badge">COVER</span>' : ''}
          </div>
          <div class="photo-form">
            <label class="photo-title-label">
              照片标题
              <input class="photo-title-input" data-photo-title="${photo.id}" value="${escapeHtml(photo.title)}"
                aria-invalid="${photo.title.trim() === ''}" aria-describedby="error-${photo.id}" />
            </label>
            <p class="field-error" id="error-${photo.id}">${photo.title.trim() === '' ? '请填写照片标题' : ''}</p>
            <div class="photo-actions" aria-label="${escapeHtml(photo.title || '未命名照片')}的操作">
              <button class="photo-action" type="button" data-action="move-up" aria-label="上移${escapeHtml(photo.title || '照片')}" ${index === 0 ? 'disabled title="已经是第一张"' : ''}>↑ 上移</button>
              <button class="photo-action" type="button" data-action="move-down" aria-label="下移${escapeHtml(photo.title || '照片')}" ${index === albumDraft.photos.length - 1 ? 'disabled title="已经是最后一张"' : ''}>↓ 下移</button>
              <button class="photo-action set-cover ${isCover ? 'is-cover' : ''}" type="button" data-action="set-cover" ${isCover ? 'disabled' : ''}>${isCover ? '当前封面' : '设为封面'}</button>
              <button class="photo-action delete" type="button" data-action="delete" ${isOnlyPhoto ? 'disabled title="至少保留一张照片"' : ''}>删除</button>
            </div>
          </div>
        </article>`;
    })
    .join('') || '<div class="album-empty"><p>这段旅程还没有照片。</p><label class="add-photo-button" for="photo-input">＋ 添加第一张照片</label></div>';

  if (focusPhotoId) {
    albumGrid.querySelector(`[data-photo-id="${focusPhotoId}"] .photo-title-input`)?.focus({ preventScroll: true });
  }
}

function switchTrip(tripId) {
  activeTripId = tripId;
  albumDraft = tripId ? freshDraft(tripId) : null;
  setDirty(false);
  renderTripList();
  renderAlbum();
  if (tripId) {
    tripList.querySelector(`[data-trip-id="${tripId}"]`)?.focus({ preventScroll: true });
    announce(`已切换到${activeTrip().city}相册`);
  }
}

function requestNavigation(next) {
  if (next.type === 'leave' ? !dirty : !albumDirty) {
    if (next.type === 'add') openAddJourney();
    if (next.type === 'trip') switchTrip(next.tripId);
    if (next.type === 'leave') window.location.href = next.href;
    return;
  }

  pendingNavigation = next;
  returnFocusTo = next.trigger;
  discardCopy.textContent = next.type === 'trip'
    ? `切换到${adminTrips.find((trip) => trip.id === next.tripId).city}后，当前修改会恢复。`
    : next.type === 'add' ? '添加旅程前，当前相册的未保存修改会恢复。' : '返回公开网站后，本次预览中的修改不会保留。';
  discardDialog.returnValue = '';
  discardDialog.showModal();
  discardDialog.querySelector('[value="cancel"]').focus();
}

tripList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-trip-id]');
  if (!button || button.dataset.tripId === activeTripId) return;
  requestNavigation({ type: 'trip', tripId: button.dataset.tripId, trigger: button });
});

albumGrid.addEventListener('input', (event) => {
  const input = event.target.closest('[data-photo-title]');
  if (!input) return;
  albumDraft = renamePhoto(albumDraft, input.dataset.photoTitle, input.value);
  const invalid = input.value.trim() === '';
  input.setAttribute('aria-invalid', String(invalid));
  document.querySelector(`#error-${input.dataset.photoTitle}`).textContent = invalid ? '请填写照片标题' : '';
  setDirty(true);
  announce('照片标题已修改，尚未保存');
});

albumGrid.addEventListener('click', (event) => {
  if (event.target.closest('[data-add-journey]')) { requestNavigation({ type: 'add', trigger: event.target }); return; }
  const action = event.target.closest('[data-action]');
  const card = event.target.closest('[data-photo-id]');
  if (!action || !card) return;
  const id = card.dataset.photoId;

  if (action.dataset.action === 'move-up' || action.dataset.action === 'move-down') {
    albumDraft = movePhoto(albumDraft, id, action.dataset.action === 'move-up' ? -1 : 1);
    setDirty(true);
    renderAlbum({ focusPhotoId: id });
    announce('照片顺序已调整');
  }

  if (action.dataset.action === 'set-cover') {
    albumDraft = setCover(albumDraft, id);
    setDirty(true);
    renderAlbum({ focusPhotoId: id });
    announce('封面已更新');
  }

  if (action.dataset.action === 'delete') {
    pendingDeleteId = id;
    returnFocusTo = action;
    const photo = albumDraft.photos.find((item) => item.id === id);
    deleteCopy.textContent = `“${photo.title || '未命名照片'}”将从本次预览中移除。`;
    deleteDialog.returnValue = '';
    deleteDialog.showModal();
    deleteDialog.querySelector('[value="cancel"]').focus();
  }
});

photoInput.addEventListener('change', () => {
  uploadError.hidden = true;
  uploadError.textContent = '';
  const files = [...photoInput.files];
  const valid = files.filter((file) => acceptedTypes.has(file.type) && file.type.startsWith('image/'));
  const invalid = files.filter((file) => !acceptedTypes.has(file.type));

  if (invalid.length) {
    uploadError.textContent = `未添加：${invalid.map((file) => file.name).join('、')}。请选择 JPG、PNG、WebP 或 AVIF。`;
    uploadError.hidden = false;
  }

  if (valid.length) {
    const previews = valid.map((file) => ({
      name: file.name,
      type: file.type,
      previewUrl: rememberObjectUrl(file),
    }));
    albumDraft = appendPhotos(albumDraft, previews);
    setDirty(true);
    if (!albumDraft.coverId) albumDraft = setCover(albumDraft, albumDraft.photos[0].id);
    renderTripList();
    renderAlbum({ focusPhotoId: albumDraft.photos.at(-1).id });
    announce(`已添加 ${valid.length} 张本地预览照片`);
  }
  photoInput.value = '';
});

deleteDialog.addEventListener('close', () => {
  if (deleteDialog.returnValue === 'confirm' && pendingDeleteId) {
    const removedIndex = albumDraft.photos.findIndex((photo) => photo.id === pendingDeleteId);
    albumDraft = removePhoto(albumDraft, pendingDeleteId);
    const focusAfterDelete = albumDraft.photos[Math.min(removedIndex, albumDraft.photos.length - 1)].id;
    setDirty(true);
    renderTripList();
    renderAlbum({ focusPhotoId: focusAfterDelete });
    announce('照片已从本次预览中删除');
  } else {
    returnFocusTo?.focus({ preventScroll: true });
  }
  pendingDeleteId = null;
});

discardDialog.addEventListener('close', () => {
  if (discardDialog.returnValue === 'discard' && pendingNavigation) {
    const navigation = pendingNavigation;
    pendingNavigation = null;
    if (navigation.type === 'add') { setDirty(false); albumDraft = activeTripId ? freshDraft(activeTripId) : null; renderAlbum(); openAddJourney(); }
    if (navigation.type === 'trip') switchTrip(navigation.tripId);
    if (navigation.type === 'leave') {
      setDirty(false);
      window.location.href = navigation.href;
    }
    return;
  }
  pendingNavigation = null;
  returnFocusTo?.focus({ preventScroll: true });
});

saveButton.addEventListener('click', () => {
  const invalidInput = [...albumGrid.querySelectorAll('.photo-title-input')].find((input) => input.value.trim() === '');
  if (invalidInput) {
    invalidInput.setAttribute('aria-invalid', 'true');
    invalidInput.focus();
    announce('请先补全照片标题');
    return;
  }

  if (albumDraft) savedDrafts.set(activeTripId, albumDraft);
  saveButton.textContent = '保存本次预览';
  collectionDirty = false;
  setDirty(false);
  renderTripList();
  announce('预览已保存，刷新后仍会恢复为演示数据');
});

function rememberObjectUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  return url;
}

function openAddJourney() {
  addJourneyForm.reset();
  journeyFormError.hidden = true;
  addJourneyDialog.returnValue = '';
  document.querySelector('#new-journey-photo-note').textContent = '可选多张；第一张作为封面。支持 JPG、PNG、WebP、AVIF。';
  addJourneyDialog.showModal();
  document.querySelector('#new-journey-city').focus();
}

addJourneyButton.addEventListener('click', () => requestNavigation({ type: 'add', trigger: addJourneyButton }));
for (const id of ['close-add-journey', 'cancel-add-journey']) {
  document.getElementById(id).addEventListener('click', () => addJourneyDialog.close());
}
addJourneyDialog.addEventListener('close', () => {
  const target = addJourneyDialog.returnValue === 'created'
    ? tripList.querySelector(`[data-trip-id="${activeTripId}"]`)
    : addJourneyButton;
  target?.focus({ preventScroll: true });
});
newJourneyPhotos.addEventListener('change', () => {
  document.querySelector('#new-journey-photo-note').textContent = newJourneyPhotos.files.length
    ? `已选择 ${newJourneyPhotos.files.length} 张照片；第一张作为封面。`
    : '照片可以稍后添加。';
});
addJourneyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  journeyFormError.hidden = true;
  const values = Object.fromEntries(new FormData(addJourneyForm));
  const files = [...newJourneyPhotos.files];
  try {
    if (files.some((file) => !acceptedTypes.has(file.type))) throw new Error('请选择 JPG、PNG、WebP 或 AVIF 图片');
    const id = `journey-${crypto.randomUUID()}`;
    // Validate fields before allocating any image URLs.
    createJourney(values, { id });
    const photos = files.map((file) => ({ name: file.name, previewUrl: rememberObjectUrl(file) }));
    const trip = createJourney(values, { id, photos });
    adminTrips = [...adminTrips, trip];
    const draft = createAlbumDraft(trip);
    draft.photos = draft.photos.map((photo) => ({ ...photo, temporary: true }));
    savedDrafts.set(trip.id, draft);
    collectionDirty = true;
    addJourneyDialog.close('created');
    switchTrip(trip.id);
    tripList.querySelector(`[data-trip-id="${trip.id}"]`).focus({ preventScroll: true });
    announce(`已添加${trip.city}旅程${photos.length ? `和 ${photos.length} 张照片` : '，可以继续添加照片'}`);
  } catch (error) {
    journeyFormError.textContent = error.message;
    journeyFormError.hidden = false;
  }
});

deleteJourneyButton.addEventListener('click', () => {
  const trip = activeTrip();
  if (!trip) return;
  pendingJourneyId = trip.id;
  document.querySelector('#delete-journey-copy').textContent = `“${trip.city} · ${trip.title}”及其 ${albumDraft.photos.length} 张照片、${trip.route.length} 个路线站点将从本次预览中移除。删除后可以撤销。`;
  deleteJourneyDialog.returnValue = '';
  deleteJourneyDialog.showModal();
  deleteJourneyDialog.querySelector('[value="cancel"]').focus();
});

deleteJourneyDialog.addEventListener('close', () => {
  if (deleteJourneyDialog.returnValue !== 'confirm' || !pendingJourneyId) {
    pendingJourneyId = null;
    deleteJourneyButton.focus({ preventScroll: true });
    return;
  }
  const result = removeJourney(adminTrips, pendingJourneyId);
  deletedJourney = { trip: result.removed, index: result.index, draft: albumDraft, baseline: freshDraft(pendingJourneyId), albumDirty };
  adminTrips = result.journeys;
  savedDrafts.delete(pendingJourneyId);
  pendingJourneyId = null;
  collectionDirty = true;
  switchTrip(result.nextId);
  document.querySelector('#undo-copy').textContent = `已删除${result.removed.city}旅程。`;
  undoNotice.hidden = false;
  (result.nextId ? tripList.querySelector(`[data-trip-id="${result.nextId}"]`) : addJourneyButton).focus({ preventScroll: true });
  announce(`已删除${result.removed.city}旅程，可以撤销`);
});

document.querySelector('#undo-journey').addEventListener('click', () => {
  if (!deletedJourney) return;
  // Keep edits in the currently selected album before restoring another trip.
  if (albumDraft) savedDrafts.set(activeTripId, albumDraft);
  const restored = deletedJourney;
  adminTrips = restoreJourney(adminTrips, restored.trip, restored.index);
  savedDrafts.set(restored.trip.id, restored.baseline);
  activeTripId = restored.trip.id;
  albumDraft = restored.draft;
  collectionDirty = true;
  setDirty(restored.albumDirty);
  deletedJourney = null;
  undoNotice.hidden = true;
  renderTripList();
  renderAlbum();
  tripList.querySelector(`[data-trip-id="${activeTripId}"]`).focus({ preventScroll: true });
  announce(`已恢复${restored.trip.city}旅程及其照片`);
});

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) objectUrls.forEach((url) => URL.revokeObjectURL(url));
});

backToSite.addEventListener('click', (event) => {
  if (!dirty) return;
  event.preventDefault();
  requestNavigation({ type: 'leave', href: backToSite.href, trigger: backToSite });
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

renderTripList();
renderAlbum();
setDirty(false);
