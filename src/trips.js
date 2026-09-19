const makeGallery = (src, city, captions) =>
  captions.map((caption, index) => ({
    src,
    alt: `${city}旅行照片：${caption}`,
    caption,
    position: ['50% 50%', '30% 55%', '70% 45%', '45% 30%', '60% 70%', '20% 40%'][index],
  }));

export const trips = [
  {
    id: 'lisbon',
    city: '里斯本',
    latin: 'LISBON',
    country: '葡萄牙',
    shortDate: '03/12',
    date: '2026.03.12',
    dateRange: '03.12 — 03.17',
    coords: '38.7223° N · 9.1393° W',
    geo: { latitude: 38.7223, longitude: -9.1393 },
    title: '电车穿过有风的坡道',
    description: '海风把晾晒的衣物吹得很轻，黄色电车沿着石板路慢慢爬升。',
    accent: '#87956c',
    shader: 'radial-gradient(circle at 68% 30%, #e7e4c8 0 12%, transparent 30%), linear-gradient(138deg, #607255, #a8ad82 46%, #e3dfc9)',
    hero: './assets/lisbon.webp',
    route: [
      ['阿尔法玛', '03.12'],
      ['贝伦', '03.14'],
      ['辛特拉', '03.16'],
      ['卡斯凯什', '03.17'],
    ],
    gallery: makeGallery('./assets/lisbon.webp', '里斯本', ['清晨的二十八路电车', '阿尔法玛的蓝瓷墙', '塔霍河边的风', '旧城坡道', '午后的窗影', '海岸尽头']),
  },
  {
    id: 'kyoto',
    city: '京都',
    latin: 'KYOTO',
    country: '日本',
    shortDate: '04/26',
    date: '2026.04.18',
    dateRange: '04.18 — 04.26',
    coords: '35.0116° N · 135.7681° E',
    geo: { latitude: 35.0116, longitude: 135.7681 },
    title: '雨后的青石路',
    description: '雨停之后，街灯在潮湿的石板路上留下很长的倒影，城市的声音也慢了下来。',
    accent: '#b75937',
    shader: 'radial-gradient(circle at 64% 24%, #f2d6bb 0 14%, transparent 31%), linear-gradient(145deg, #7b2e23, #d36e40 48%, #eac8a3)',
    hero: './assets/kyoto.webp',
    route: [
      ['京都', '04.18'],
      ['奈良', '04.21'],
      ['大阪', '04.22'],
      ['东京', '04.26'],
    ],
    gallery: makeGallery('./assets/kyoto.webp', '京都', ['雨后的花见小路', '寺院屋檐', '清晨竹林', '町屋的窗', '鸭川暮色', '末班电车']),
  },
  {
    id: 'iceland',
    city: '冰岛',
    latin: 'ICELAND',
    country: '冰岛',
    shortDate: '02/25',
    date: '2025.02.08',
    dateRange: '02.08 — 02.16',
    coords: '64.9631° N · 19.0208° W',
    geo: { latitude: 64.9631, longitude: -19.0208 },
    title: '风把黑沙吹向海面',
    description: '浪在黑色海岸线上一次次退回去，远处的山藏在低低的云层里。',
    accent: '#6e8998',
    shader: 'radial-gradient(circle at 30% 28%, #dce8ea 0 13%, transparent 32%), linear-gradient(130deg, #536f7c, #8aa9b8 50%, #d2dde0)',
    hero: './assets/iceland.webp',
    route: [
      ['雷克雅未克', '02.08'],
      ['维克', '02.11'],
      ['杰古沙龙', '02.14'],
      ['斯奈山', '02.16'],
    ],
    gallery: makeGallery('./assets/iceland.webp', '冰岛', ['黑沙滩的浪', '环岛公路', '雾中的瀑布', '冰川蓝', '苔原微光', '海岸灯塔']),
  },
  {
    id: 'paris',
    city: '巴黎',
    latin: 'PARIS',
    country: '法国',
    shortDate: '10/25',
    date: '2025.10.03',
    dateRange: '10.03 — 10.09',
    coords: '48.8566° N · 2.3522° E',
    geo: { latitude: 48.8566, longitude: 2.3522 },
    title: '左岸书店关门以前',
    description: '傍晚的光落在旧书页上，塞纳河边的人们开始收起一天的脚步。',
    accent: '#44423d',
    shader: 'radial-gradient(circle at 67% 65%, #cfc8b6 0 12%, transparent 29%), linear-gradient(140deg, #20211e, #5e5e55 54%, #bbb6a7)',
    hero: './assets/paris.webp',
    route: [
      ['玛黑区', '10.03'],
      ['蒙马特', '10.05'],
      ['左岸', '10.07'],
      ['圣路易岛', '10.09'],
    ],
    gallery: makeGallery('./assets/paris.webp', '巴黎', ['清晨的街角', '旧书摊', '咖啡馆窗边', '雨中的塞纳河', '石阶与影子', '夜色亮起']),
  },
];

export function getTripById(id) {
  return trips.find((trip) => trip.id === id) ?? trips[1];
}

export function getAdjacentTrip(id, direction) {
  const currentIndex = trips.findIndex((trip) => trip.id === id);
  const safeIndex = currentIndex < 0 ? 1 : currentIndex;
  const normalizedDirection = direction < 0 ? -1 : 1;
  return trips[(safeIndex + normalizedDirection + trips.length) % trips.length];
}
