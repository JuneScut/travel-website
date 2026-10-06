export function paintStyle(style) {
      const C = { land: '#EAF3C4', water: '#FFD3E6', waterLine: '#FFB8D6', green: '#D2E879', ice: '#FBFDF2', sand: '#F2F1C6', road: '#FFFFFF', casing: 'rgba(37,72,55,.12)', motorway: '#FFBEDB', rail: 'rgba(37,72,55,.3)', building: '#DCE9AC', text: '#254837', halo: '#F7FBE9', border: '#254837' };
      const hidden = /^(poi_|highway-shield|road_shield|road_one_way|airport|building-3d|aeroway|landuse_(pitch|track|cemetery|hospital|school))/;
      style.layers = style.layers.filter((l) => !hidden.test(l.id));
      for (const l of style.layers) {
        const p = (l.paint ||= {});
        const { id, type } = l;
        if (type === 'background') p['background-color'] = C.land;
        else if (type === 'raster') Object.assign(p, { 'raster-saturation': -1, 'raster-contrast': 0.15, 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.34, 6, 0.06] });
        else if (type === 'fill') {
          delete p['fill-outline-color'];
          if (id === 'water') p['fill-color'] = C.water;
          else if (/park|wood|grass|wetland/.test(id)) Object.assign(p, { 'fill-color': C.green, 'fill-opacity': 0.55 });
          else if (id === 'landcover_ice') p['fill-color'] = C.ice;
          else if (id === 'landcover_sand') p['fill-color'] = C.sand;
          else if (id === 'landuse_residential') Object.assign(p, { 'fill-color': '#E1ECB2', 'fill-opacity': 0.5 });
          else if (id === 'building') Object.assign(p, { 'fill-color': C.building, 'fill-outline-color': 'rgba(37,72,55,.18)' });
        } else if (type === 'line') {
          if (id.startsWith('waterway')) p['line-color'] = C.waterLine;
          else if (id.startsWith('boundary')) Object.assign(p, { 'line-color': C.border, 'line-opacity': 0.42 });
          else if (/casing/.test(id)) p['line-color'] = C.casing;
          else if (/rail/.test(id)) p['line-color'] = C.rail;
          else if (/motorway/.test(id)) p['line-color'] = C.motorway;
          else if (/^(road|bridge|tunnel)_/.test(id)) p['line-color'] = C.road;
          else if (id === 'park_outline') p['line-color'] = 'rgba(37,72,55,.12)';
        } else if (type === 'symbol') {
          Object.assign(p, { 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0 });
          if (l.layout?.['text-field']) l.layout['text-field'] = ['coalesce', ['get', 'name:zh-Hans'], ['get', 'name:zh'], ['get', 'name:nonlatin'], ['get', 'name_en'], ['get', 'name']];
          if (l.layout?.['icon-image']) delete l.layout['icon-image'];
        }
      }
      style.projection = { type: 'globe' };
      style.sky = { 'sky-color': '#F7FBE9', 'horizon-color': '#FFE4F0', 'fog-color': '#F7FBE9', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.6, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] };
      return style;
    }

    // Great-circle interpolation so flight lines follow the real curvature of the earth.
export function greatCircle(a, b, steps = 72) {
      const rad = Math.PI / 180;
      const toVec = ([lon, lat]) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
      const [A, B] = [toVec(a), toVec(b)];
      const omega = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
      if (omega < 1e-6) return [a, b];
      return Array.from({ length: steps + 1 }, (_, k) => {
        const t = k / steps;
        const f1 = Math.sin((1 - t) * omega) / Math.sin(omega);
        const f2 = Math.sin(t * omega) / Math.sin(omega);
        const [x, y, z] = [0, 1, 2].map((i) => f1 * A[i] + f2 * B[i]);
        return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad];
      });
    }
