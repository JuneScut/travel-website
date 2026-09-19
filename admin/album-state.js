const photoId = (tripId, index) => `${tripId}-photo-${index + 1}`;

export function createAlbumDraft(trip) {
  const photos = trip.gallery.map((photo, index) => ({
    id: photoId(trip.id, index),
    src: photo.src,
    alt: photo.alt,
    title: photo.caption,
    position: photo.position ?? '50% 50%',
    temporary: false,
  }));

  return {
    tripId: trip.id,
    city: trip.city,
    photos,
    coverId: photos[0]?.id ?? null,
  };
}

export function renamePhoto(draft, id, title) {
  return {
    ...draft,
    photos: draft.photos.map((photo) => (photo.id === id ? { ...photo, title } : photo)),
  };
}

export function movePhoto(draft, id, direction) {
  const from = draft.photos.findIndex((photo) => photo.id === id);
  const to = from + (direction < 0 ? -1 : 1);
  if (from < 0 || to < 0 || to >= draft.photos.length) return draft;

  const photos = [...draft.photos];
  [photos[from], photos[to]] = [photos[to], photos[from]];
  return { ...draft, photos };
}

export function setCover(draft, id) {
  if (!draft.photos.some((photo) => photo.id === id)) return draft;
  return { ...draft, coverId: id };
}

export function removePhoto(draft, id) {
  if (!draft.photos.some((photo) => photo.id === id)) return draft;
  if (draft.photos.length === 1) throw new Error('相册至少保留一张照片');

  const photos = draft.photos.filter((photo) => photo.id !== id);
  return {
    ...draft,
    photos,
    coverId: draft.coverId === id ? photos[0].id : draft.coverId,
  };
}

export function appendPhotos(draft, files) {
  const existingIds = new Set(draft.photos.map(({ id }) => id));
  const additions = files.map((file, index) => {
    let serial = draft.photos.length + index + 1;
    let id = `${draft.tripId}-upload-${serial}`;
    while (existingIds.has(id)) id = `${draft.tripId}-upload-${++serial}`;
    existingIds.add(id);

    return {
      id,
      src: file.previewUrl,
      alt: `新添加的旅行照片：${file.name}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      position: '50% 50%',
      temporary: true,
    };
  });

  return { ...draft, photos: [...draft.photos, ...additions] };
}
