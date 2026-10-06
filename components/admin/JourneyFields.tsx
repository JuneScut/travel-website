'use client';
import type { Draft } from './types';

export default function JourneyFields({ value, onChange }: { value: Draft; onChange: (value: Draft) => void }) {
  const set = (key: keyof Draft, next: unknown) => onChange({ ...value, [key]: next });
  const fields = [['city', '目的地名称', true, 80], ['latin', '英文名称', false, 80], ['country', '国家 / 地区', false, 80], ['slug', '页面地址', true, 100], ['title', '旅程标题', true, 160]] as const;
  return <div className="admin-fields">{fields.map(([key, label, required, maxLength]) => <label key={key} className={key === 'title' ? 'admin-wide' : ''}>{label}{required && <small>必填</small>}<input name={key} required={required} maxLength={maxLength} value={value[key]} pattern={key === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined} onChange={event => set(key, event.target.value)} /></label>)}
    <label>开始日期<small>必填</small><input name="startDate" type="date" required value={value.startDate} onChange={event => set('startDate', event.target.value)} /></label>
    <label>结束日期<small>必填</small><input name="endDate" type="date" required min={value.startDate} value={value.endDate} onChange={event => set('endDate', event.target.value)} /></label>
    <label className="admin-wide">旅程简介<textarea name="description" rows={3} maxLength={4000} value={value.description} onChange={event => set('description', event.target.value)} /></label>
    <label>纬度<input type="number" min={-90} max={90} step="any" value={value.latitude ?? ''} onChange={event => set('latitude', event.target.value === '' ? null : Number(event.target.value))} /></label>
    <label>经度<input type="number" min={-180} max={180} step="any" value={value.longitude ?? ''} onChange={event => set('longitude', event.target.value === '' ? null : Number(event.target.value))} /></label>
    <p className="admin-note admin-wide">坐标可选；填写后才会显示在地图上。纬度与经度需要同时填写。</p>
    <div className="admin-wide"><div className="admin-section-title"><h3>沿途站点</h3><button type="button" onClick={() => set('stops', [...value.stops, { name: '', date: value.startDate, latitude: null, longitude: null }])}>＋ 添加站点</button></div>
      {value.stops.map((stop, index) => {
        const update = (key: string, next: unknown) => set('stops', value.stops.map((item, i) => i === index ? { ...item, [key]: next } : item));
        const move = (direction: number) => { const stops = [...value.stops]; [stops[index], stops[index + direction]] = [stops[index + direction], stops[index]]; set('stops', stops); };
        return <fieldset className="admin-stop" key={index}><legend>第 {index + 1} 站</legend><label>地点<input required maxLength={120} value={stop.name} onChange={event => update('name', event.target.value)} /></label><label>日期<input type="date" required min={value.startDate} max={value.endDate} value={stop.date} onChange={event => update('date', event.target.value)} /></label><label>纬度<input type="number" min={-90} max={90} step="any" value={stop.latitude ?? ''} onChange={event => update('latitude', event.target.value === '' ? null : Number(event.target.value))} /></label><label>经度<input type="number" min={-180} max={180} step="any" value={stop.longitude ?? ''} onChange={event => update('longitude', event.target.value === '' ? null : Number(event.target.value))} /></label><div className="admin-stop-actions"><button type="button" aria-label={`上移第 ${index + 1} 站`} disabled={!index} onClick={() => move(-1)}>↑</button><button type="button" aria-label={`下移第 ${index + 1} 站`} disabled={index === value.stops.length - 1} onClick={() => move(1)}>↓</button><button type="button" className="admin-danger" onClick={() => set('stops', value.stops.filter((_, i) => i !== index))}>删除站点</button></div></fieldset>;
      })}
    </div>
  </div>;
}
