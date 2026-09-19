import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendPhotos,
  createAlbumDraft,
  movePhoto,
  removePhoto,
  renamePhoto,
  setCover,
} from '../admin/album-state.js';

const sampleTrip = {
  id: 'kyoto',
  city: '京都',
  hero: '../assets/kyoto.webp',
  gallery: [
    { src: '../assets/kyoto.webp', alt: '照片一', caption: '照片一', position: '50% 50%' },
    { src: '../assets/kyoto.webp', alt: '照片二', caption: '照片二', position: '30% 50%' },
    { src: '../assets/kyoto.webp', alt: '照片三', caption: '照片三', position: '70% 50%' },
  ],
};

test('creates an independent album draft with one cover', () => {
  const draft = createAlbumDraft(sampleTrip);
  assert.equal(draft.tripId, 'kyoto');
  assert.equal(draft.photos.length, 3);
  assert.equal(draft.coverId, draft.photos[0].id);
  assert.notEqual(draft.photos, sampleTrip.gallery);
});

test('renames a photo without mutating the source draft', () => {
  const draft = createAlbumDraft(sampleTrip);
  const renamed = renamePhoto(draft, draft.photos[1].id, '雨后的屋檐');
  assert.equal(renamed.photos[1].title, '雨后的屋檐');
  assert.equal(draft.photos[1].title, '照片二');
});

test('moves a photo and preserves its cover identity', () => {
  const draft = createAlbumDraft(sampleTrip);
  const moved = movePhoto(draft, draft.photos[2].id, -1);
  assert.equal(moved.photos[1].id, draft.photos[2].id);
  assert.equal(moved.coverId, draft.coverId);
});

test('does not move a photo outside the album bounds', () => {
  const draft = createAlbumDraft(sampleTrip);
  assert.deepEqual(movePhoto(draft, draft.photos[0].id, -1), draft);
  assert.deepEqual(movePhoto(draft, draft.photos[2].id, 1), draft);
});

test('sets exactly one cover by id', () => {
  const draft = createAlbumDraft(sampleTrip);
  const next = setCover(draft, draft.photos[2].id);
  assert.equal(next.coverId, draft.photos[2].id);
});

test('removes a photo and replaces a removed cover', () => {
  const draft = createAlbumDraft(sampleTrip);
  const next = removePhoto(draft, draft.coverId);
  assert.equal(next.photos.length, 2);
  assert.equal(next.coverId, next.photos[0].id);
});

test('keeps at least one photo in an album', () => {
  const draft = createAlbumDraft({ ...sampleTrip, gallery: sampleTrip.gallery.slice(0, 1) });
  assert.throws(() => removePhoto(draft, draft.photos[0].id), /至少保留一张照片/);
});

test('appends temporary photo previews with file-name titles', () => {
  const draft = createAlbumDraft(sampleTrip);
  const next = appendPhotos(draft, [
    { name: 'sea-light.jpg', type: 'image/jpeg', previewUrl: 'blob:sea-light' },
  ]);
  assert.equal(next.photos.length, 4);
  assert.equal(next.photos[3].title, 'sea-light');
  assert.equal(next.photos[3].src, 'blob:sea-light');
  assert.equal(next.photos[3].temporary, true);
});
