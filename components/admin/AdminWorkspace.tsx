'use client';

import { useEffect, useRef, useState } from 'react';
import { saveJourney, changeJourneyStatus, saveAlbum, changePhotoStatus, reloadJourneys, logoutAction } from '../../server/actions';
import type { Result } from '../../server/errors';
import JourneyFields from './JourneyFields';
import { blankDraft, journeyDraft, type Draft, type Journey, type Photo } from './types';

const labels = { draft: '草稿', published: '已发布', archived: '已归档' };
export default function AdminWorkspace({ initialJourneys, username, diskPercent }: { initialJourneys: Journey[]; username: string; diskPercent: number }) {
  const [rows, setRows] = useState(initialJourneys);
  const [activeId, setActiveId] = useState(initialJourneys.find(row => !row.deletedAt)?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [trash, setTrash] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => initialJourneys.find(row => row.id === activeId) ? journeyDraft(initialJourneys.find(row => row.id === activeId)!) : blankDraft());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [albumDirty, setAlbumDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = rows.find(row => row.id === activeId);
  const visible = rows.filter(row => trash ? !!row.deletedAt : !row.deletedAt);

  useEffect(() => {
    if (!active || creating) return;
    if (!dirty) setDraft(journeyDraft(active));
    if (!albumDirty) { setPhotos(active.album?.photos.filter(photo => photo.status === 'ready') ?? []); setCover(active.album?.coverPhotoId ?? null); }
  }, [active, creating, dirty, albumDirty]);
  useEffect(() => {
    if (!dirty && !albumDirty && !busy) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty, albumDirty, busy]);
  function mayLeave() { return !dirty && !albumDirty || window.confirm('有未保存的修改，确定放弃并继续吗？'); }
  function select(id: string | null) {
    if (!mayLeave()) return;
    setCreating(false); setDirty(false); setAlbumDirty(false); setActiveId(id); setError(''); setNotice(''); setUploadStatus([]);
  }
  function create() {
    if (!mayLeave()) return;
    setCreating(true); setDraft(blankDraft()); setNewFiles([]); setDirty(false); setAlbumDirty(false); setError(''); setNotice('');
  }
  async function run<T>(operation: () => Promise<Result<T>>, success: (value: T) => void) {
    setBusy(true); setError(''); setExpired(false);
    try {
      const response = await operation();
      if (!response.ok) { setError(response.error); setExpired(response.code === 'UNAUTHORIZED'); return; }
      success(response.data);
    } catch { setError('网络连接中断，请重试；当前表单仍保留'); }
    finally { setBusy(false); }
  }
  async function uploadFiles(journeyId: string, files: File[]) {
    if (!files.length) return;
    if (files.length > 30 || files.some(file => file.size > 30 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))) {
      setError('一次最多选择 30 张 JPG、PNG、WebP、AVIF 图片，每张不超过 30 MB'); return;
    }
    setBusy(true); setError(''); setUploadStatus([]);
    const messages: string[] = [];
    try {
      for (let index = 0; index < files.length; index += 5) {
        setNotice(`正在上传第 ${index + 1}–${Math.min(files.length, index + 5)} 张，共 ${files.length} 张…`);
        const form = new FormData(); files.slice(index, index + 5).forEach(file => form.append('photos', file));
        const response = await fetch(`/api/uploads?journeyId=${journeyId}`, { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) { setExpired(response.status === 401); throw new Error(data.error ?? '上传失败'); }
        for (const item of data.results) messages.push(`${item.ok ? '✓' : '✕'} ${item.name}${item.ok ? ' · 已上传' : ` · ${item.error}`}`);
        setUploadStatus([...messages]);
      }
      setNotice('上传处理完成，照片已保存到服务器');
    } catch (error) { setError(error instanceof Error ? error.message : '上传失败，请重试'); }
    finally {
      const latest = await reloadJourneys().catch(() => null);
      if (latest?.ok) setRows(latest.data);
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const files = newFiles;
    let createdId: string | null = null;
    await run(() => saveJourney(creating ? null : active!.id, creating ? null : active!.revision, draft), value => {
      setDirty(false); setRows(value.journeys); setActiveId(value.id); setCreating(false); setTrash(false); setNotice(creating ? '旅程草稿已保存，发布后访客才能看到' : '旅程内容已保存到服务器');
      createdId = value.id;
    });
    if (createdId) { setNewFiles([]); if (files.length) await uploadFiles(createdId, files); }
  }
  function status(next: 'published' | 'draft' | 'archived' | 'delete' | 'restore', target = active) {
    if (!target || !mayLeave()) return;
    void run(() => changeJourneyStatus(target.id, target.revision, next), value => {
      setDirty(false); setAlbumDirty(false); setRows(value);
      if (next === 'delete') { setDeletedId(target.id); setActiveId(value.find((row: Journey) => !row.deletedAt)?.id ?? null); setNotice('整段旅程已移入回收区，公开页面已移除'); }
      else { setActiveId(target.id); setTrash(false); setNotice(next === 'restore' ? '旅程与相册已恢复' : `旅程${labels[next as keyof typeof labels]}`); }
    });
  }
  function movePhoto(index: number, direction: number) {
    const next = [...photos]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setPhotos(next); setAlbumDirty(true);
  }
  function editPhoto(id: string, fields: Partial<Photo>) { setPhotos(value => value.map(photo => photo.id === id ? { ...photo, ...fields } : photo)); setAlbumDirty(true); }
  function photoStatus(photo: Photo, action: 'delete' | 'restore') {
    if (!mayLeave()) return;
    if (action === 'delete' && !window.confirm(`将“${photo.title}”移入回收区？30 天内可恢复。`)) return;
    void run(() => changePhotoStatus(photo.id, action), value => { setAlbumDirty(false); setRows(value); setNotice(action === 'delete' ? '照片已移入回收区' : '照片已恢复'); });
  }

  return <div className="admin-shell"><a className="skip-link" href="#admin-main">跳到编辑区</a><header className="admin-header"><a href="/" className="admin-brand">旅迹 <small>JOURNAL / ARCHIVE</small></a><div><span>{username}</span><a href="/" target="_blank" rel="noreferrer">查看网站 ↗</a><form action={logoutAction}><button disabled={busy || dirty || albumDirty}>退出</button></form></div></header>
    <aside className="admin-sidebar"><p className="admin-eyebrow">{trash ? 'RECYCLE / 回收区' : `ARCHIVE / ${visible.length.toString().padStart(2, '0')}`}</p><button className="admin-primary" disabled={busy} onClick={create}>＋ 添加旅程</button><div className="admin-trip-list" aria-label="旅程列表">{visible.map((row, index) => <button key={row.id} aria-pressed={!creating && row.id === activeId} disabled={busy} onClick={() => select(row.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{row.city}<small>{row.title}</small></strong><i>{row.deletedAt ? '已删除' : labels[row.status]}</i></button>)}{!visible.length && <p className="admin-note">{trash ? '回收区为空。' : '还没有旅程，添加第一段记录。'}</p>}</div><button className="admin-trash-toggle" disabled={busy} onClick={() => { if (!mayLeave()) return; setDirty(false); setAlbumDirty(false); setCreating(false); setTrash(!trash); setActiveId(rows.find(row => trash ? !row.deletedAt : !!row.deletedAt)?.id ?? null); }}>{trash ? '← 返回旅程' : '回收区'} · {rows.filter(row => row.deletedAt).length}</button><p className="admin-backup-note">未配置异地备份<br /><small>请定期执行手动备份并下载归档。</small></p>{diskPercent >= 70 && <p className="admin-error">存储使用率 {diskPercent}%{diskPercent >= 95 ? '，已暂停上传' : ''}</p>}</aside>
    <main className="admin-main" id="admin-main"><div className="admin-messages" aria-live="polite">{notice && <p role="status">{notice}</p>}{error && <p className="admin-error" role="alert">{error}{expired && <> <a href="/admin/login" target="_blank" rel="noreferrer">在新窗口重新登录</a></>}</p>}{deletedId && rows.find(row => row.id === deletedId)?.deletedAt && <button disabled={busy} onClick={() => status('restore', rows.find(row => row.id === deletedId))}>撤销删除旅程</button>}</div>
      {creating || active && !active.deletedAt ? <><div className="admin-title-row"><div><p className="admin-eyebrow">{creating ? 'NEW JOURNEY' : `${active!.latin || 'JOURNEY'} / ${labels[active!.status]}`}</p><h1>{creating ? '添加一段旅程' : `${active!.city}的旅行档案`}</h1></div>{!creating && <button disabled={busy} className="admin-danger" onClick={() => dialog.current?.showModal()}>删除整段旅程</button>}</div>
        <fieldset disabled={busy} className="admin-editing"><form onSubmit={submit}><JourneyFields value={draft} onChange={value => { setDraft(value); setDirty(true); }} />{creating && <label className="admin-upload">旅程照片（可稍后添加）<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event => setNewFiles(Array.from(event.target.files ?? []))} /></label>}<div className="admin-save-row"><span>{dirty ? '存在未保存的修改' : '内容已同步'}</span><button className="admin-primary" type="submit">{creating ? '创建旅程草稿' : '保存旅程'}</button>{creating && <button type="button" onClick={() => select(activeId)}>取消</button>}</div></form></fieldset>
        {!creating && <><div className="admin-publish-row"><a href={`/admin/preview/${active!.id}`} target="_blank" rel="noreferrer">预览旅程 ↗</a>{active!.status !== 'published' && <button disabled={busy || dirty || albumDirty} className="admin-primary" onClick={() => status('published')}>发布旅程</button>}{active!.status === 'published' && <button disabled={busy || dirty || albumDirty} onClick={() => status('draft')}>撤回为草稿</button>}{active!.status !== 'archived' && <button disabled={busy || dirty || albumDirty} onClick={() => status('archived')}>归档旅程</button>}<span className="admin-note">草稿与归档不会出现在公开页面。</span></div>
          <section className="admin-album"><div className="admin-section-title"><div><p className="admin-eyebrow">ALONG THE WAY</p><h2>沿途光影 <small>{photos.length} 张照片</small></h2></div><label className="admin-upload-button">＋ 添加照片<input type="file" aria-label="添加照片" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy || dirty || albumDirty || diskPercent >= 95} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void uploadFiles(active!.id, files); }} /></label></div><p className="admin-note">每次最多 30 张，每张不超过 30 MB。上传后会立即保存；标题、排序和封面修改需要点击保存相册。</p>
            <ul className="admin-upload-status" aria-live="polite">{uploadStatus.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <fieldset disabled={busy} className="admin-editing"><div className="admin-photo-grid">{photos.map((photo, index) => <article className="admin-photo" key={photo.id}><div className="admin-photo-image"><img src={`/media/${photo.mediaKey}/v${photo.mediaVersion}/thumb.webp`} alt={photo.alt} loading="lazy" />{cover === photo.id && <span>封面</span>}</div><label>照片标题<input value={photo.title} maxLength={160} onChange={event => editPhoto(photo.id, { title: event.target.value })} /></label><label>替代文本<input value={photo.alt} maxLength={500} onChange={event => editPhoto(photo.id, { alt: event.target.value })} /></label><div className="admin-focal"><label>焦点横向<input type="number" min={0} max={100} value={photo.focalX} onChange={event => editPhoto(photo.id, { focalX: Number(event.target.value) })} /></label><label>焦点纵向<input type="number" min={0} max={100} value={photo.focalY} onChange={event => editPhoto(photo.id, { focalY: Number(event.target.value) })} /></label></div><div className="admin-photo-actions"><button aria-label={`上移照片 ${photo.title}`} disabled={!index} onClick={() => movePhoto(index, -1)}>↑</button><button aria-label={`下移照片 ${photo.title}`} disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)}>↓</button><button onClick={() => { setCover(photo.id); setAlbumDirty(true); }}>设为封面</button><button className="admin-danger" onClick={() => photoStatus(photo, 'delete')}>删除照片</button><a href={`/api/media/${photo.id}`}>原图 ↓</a></div></article>)}</div>{!photos.length && <p className="admin-empty">这段旅程还没有照片。添加第一张沿途光影。</p>}<div className="admin-save-row"><span>{albumDirty ? '相册存在未保存修改' : '相册已同步'}</span><button className="admin-primary" disabled={!albumDirty} onClick={() => void run(() => saveAlbum(active!.id, { revision: active!.revision, coverPhotoId: cover, photos: photos.map(({ id, title, alt, focalX, focalY }) => ({ id, title, alt, focalX, focalY })) }), value => { setAlbumDirty(false); setRows(value); setNotice('相册已保存，公开内容已更新'); })}>保存相册</button></div></fieldset>
            <details className="admin-photo-trash"><summary>照片回收区 · {active!.album?.photos.filter(photo => photo.status === 'trashed').length ?? 0}</summary>{active!.album?.photos.filter(photo => photo.status === 'trashed').map(photo => <div key={photo.id}><span>{photo.title}</span><button disabled={busy} onClick={() => photoStatus(photo, 'restore')}>恢复照片</button><button disabled={busy} onClick={() => photoStatus(photo, 'delete')}>重试移入回收区</button></div>)}</details>
          </section></>}
      </> : active?.deletedAt ? <section className="admin-empty"><p className="admin-eyebrow">RECYCLE BIN</p><h1>{active.city}</h1><p>整段旅程已删除，公开页面不可访问。删除后 30 天内可以恢复。</p><button disabled={busy} className="admin-primary" onClick={() => status('restore')}>恢复旅程与相册</button></section> : <section className="admin-empty"><h1>{trash ? '回收区为空。' : '旅途，从这里开始。'}</h1>{!trash && <button className="admin-primary" onClick={create}>＋ 添加第一段旅程</button>}</section>}
    </main><dialog className="admin-confirm" ref={dialog}><h2>删除整段旅程？</h2><p>“{active?.city}”及相册将从公开页面移除。30 天内可以恢复。</p><div><button onClick={() => dialog.current?.close()}>保留旅程</button><button className="admin-danger" onClick={() => { dialog.current?.close(); status('delete'); }}>确认删除旅程</button></div></dialog>
  </div>;
}
