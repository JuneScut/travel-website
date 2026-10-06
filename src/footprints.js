// Sample places from the prototype, kept separate from journeys with albums.
export const footprints = [
  { id: 'capetown', name: '开普敦', latin: 'CAPE TOWN', date: '2023-12', geo: { latitude: -33.9249, longitude: 18.4241 }, sample: true },
  { id: 'chiangmai', name: '清迈', latin: 'CHIANG MAI', date: '2024-06', geo: { latitude: 18.7883, longitude: 98.9853 }, sample: true },
  { id: 'shanghai', name: '上海', latin: 'SHANGHAI', date: '2024-11', geo: { latitude: 31.2304, longitude: 121.4737 }, sample: true },
];

export const getFootprintById = (id) => footprints.find((foot) => foot.id === id);
