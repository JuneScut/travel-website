import { createPortal } from 'react-dom';
import { trips } from '../trips.js';
import { footprints, getFootprintById } from '../footprints.js';
import { atlasTimeline, chronologicalTrips, pad, titleOf } from '../lib/journal.js';
import useAtlasMap from '../hooks/useAtlasMap.js';
import SectionHeading from './SectionHeading.jsx';
import { StampArt } from './Stamp.jsx';

function PinFace({ pin }) {
  const { kind, trip, stop, foot } = pin;
  const label = kind === 'foot' ? foot.name : kind === 'trip' ? trip.latin : trip.route[stop][0];
  const sub = kind === 'foot' ? foot.date.replace('-', '.') : kind === 'trip' ? trip.city : trip.route[stop][1];
  return <>{kind === 'trip' ? <span className="pin-stamp" aria-hidden="true"><span className="pin-clip" data-art={trip.id}><StampArt id={trip.id} className="pin-art" /></span></span> : <span className="pin-dot" aria-hidden="true" />}<span className="pin-label">{label}<small>{sub}</small></span></>;
}

export default function Atlas({ trip, state, onSelect, onOpen, reduced }) {
  const map = useAtlasMap({ state, onSelect, reduced });
  const stop = state.place.kind === 'stop' ? trip.route[state.place.stop] : null;
  const foot = state.place.kind === 'foot' ? getFootprintById(state.place.footId) : null;
  return <section className="section" id="atlas" aria-labelledby="atlas-title">
    <SectionHeading id="atlas-title" kicker="足迹 / World atlas" title="Footprints" translation="世界足迹" meta={`${pad(trips.length)} 段旅程 · ${trips.reduce((sum, trip) => sum + trip.route.length, 0)} 个站点 · ${pad(footprints.length)} 处足迹`} reduced={reduced} />
    <div ref={map.stage} className={`atlas-stage ${map.zoom < 6 ? 'is-far' : 'is-near'} ${map.zoom < 2.6 ? 'is-globe' : ''}`} data-status={map.status}>
      <div ref={map.container} className="atlas-map" role="region" aria-label="可缩放的世界地图。方向键平移，加减号缩放；下方时间线提供同样的地点列表" />
      {map.status !== 'ready' && <div className="atlas-status" role="status"><div>{map.status === 'loading' ? '地图载入中…' : <>地图服务暂时无法访问，可以使用下方地点列表浏览旅程。<br /><button className="retry-map" type="button" onClick={map.retry}>重新载入地图</button></>}</div></div>}
      <div className="atlas-legend" aria-hidden="true"><span><i className="lg-stamp" />有相册的旅程</span><span><i className="lg-stop" />旅途站点（放大可见）</span><span><i className="lg-foot" />足迹（暂无相册）</span></div>
      <div className="atlas-tools"><button type="button" aria-label="放大地图" disabled={!map.pins.length} onClick={() => map.zoomBy(1)}>+</button><button type="button" aria-label="缩小地图" disabled={!map.pins.length} onClick={() => map.zoomBy(-1)}>−</button><button type="button" className="text" aria-label="回到全球视角" disabled={!map.pins.length} onClick={map.showWorld}>全球</button></div>
      <div className={`atlas-card${foot ? ' no-thumb' : ''}`} aria-live="polite">{foot ? <div>
        <p className="card-kicker">{foot.latin} · {foot.date.replace('-', '.')} · 足迹</p>
        <p className="card-title">{foot.name}</p>
        <p className="card-sub">这里还没有录入相册，上方旅程保持不变。{foot.sample && <><br />（示例数据）</>}</p>
        <div className="card-actions"><button type="button" onClick={map.showWorld}>全球视角</button></div>
      </div> : <><span className="card-thumb"><img src={trip.hero} alt="" loading="lazy" /></span><div><p className="card-kicker">{stop ? `第 ${state.place.stop + 1} 站 · ${stop[1]}` : `${trip.latin} · ${trip.dateRange}`}</p><p className="card-title">{stop ? stop[0] : titleOf(trip)}</p><p className="card-sub">{stop ? `属于「${titleOf(trip)}」` : `${trip.route.length} 个站点 · ${trip.gallery.length} 张照片`}</p><div className="card-actions"><button type="button" className="primary" onClick={() => document.getElementById('journeys').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })}>回到旅程 ↑</button><button type="button" onClick={(event) => onOpen(stop ? Math.min(state.place.stop, trip.gallery.length - 1) : 0, event.currentTarget)}>打开相册</button></div></div></>}</div>
      {map.pins.map((pin) => createPortal(<PinFace pin={pin} />, pin.host, `${pin.kind}-${pin.foot?.id ?? pin.trip.id}-${pin.stop ?? ''}`))}
    </div>
    <div className="atlas-timeline" role="group" aria-label="按时间排列的足迹"><span className="micro">按时间</span>{atlasTimeline.map((item) => <button type="button" key={`${item.kind}-${item.id}`} className={item.kind === 'foot' ? 'is-foot' : undefined} aria-pressed={item.kind === 'foot' ? state.place.kind === 'foot' && state.place.footId === item.id : state.place.kind !== 'foot' && trip.id === item.id} onClick={() => onSelect(item.kind === 'foot' ? undefined : item.id, item.kind === 'foot' ? { kind: 'foot', footId: item.id } : { kind: 'trip', tripId: item.id }, 'map')}>{item.label}<small>{item.date.slice(0, 7).replace('-', '.')}{item.kind === 'foot' && ' · 无相册'}</small></button>)}</div>
    <details className="atlas-places"><summary>浏览全部 {trips.reduce((sum, trip) => sum + trip.route.length, 0)} 个旅途站点</summary><div className="place-groups">{chronologicalTrips.map((item) => <div key={item.id}><h3>{item.city}</h3><ol>{item.route.map(([name, date], index) => <li key={name}><button type="button" aria-pressed={state.place.kind === 'stop' && trip.id === item.id && state.place.stop === index} onClick={() => onSelect(item.id, { kind: 'stop', tripId: item.id, stop: index }, 'map')}>{name}<small>{date}</small></button></li>)}</ol></div>)}</div></details>
  </section>;
}
