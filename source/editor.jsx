import icons from 'studio:icons';
import { MAX_IMPORT_BYTES, playerMetrics } from './config.js';
// The extension loads before Spotify finishes exposing React. Resolve hooks
// only when the editor is actually opened, after PopupModal is ready.
const useState = (...args) => Spicetify.React.useState(...args);
const useEffect = (...args) => Spicetify.React.useEffect(...args);
const useRef = (...args) => Spicetify.React.useRef(...args);

function Icon({ name }) { return <span className="es-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons[name] || icons.tune }} />; }
function Button({ icon, children, ...props }) { return <button type="button" {...props}>{icon && <Icon name={icon} />}{children && <span>{children}</span>}</button>; }
function Toggle({ label, help, value, onChange }) {
  return <label className="es-toggle"><span><strong>{label}</strong>{help && <small>{help}</small>}</span><input type="checkbox" role="switch" checked={value} onChange={e => onChange(e.target.checked)} /></label>;
}
function Range({ api, settings, field, label, min, max, step = 1, unit = '', format }) {
  const value = settings[field];
  return <label className="es-range"><span>{label}<output>{format ? format(value) : `${value}${unit}`}</output></span>
    <input type="range" min={min} max={max} step={step} value={value}
      onPointerDown={() => api.beginTransaction()} onPointerUp={() => api.endTransaction()} onPointerCancel={() => api.endTransaction()}
      onKeyDown={e => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) api.beginTransaction(); }}
      onKeyUp={() => api.endTransaction()} onBlur={() => api.endTransaction()} onChange={e => api.update({ [field]: Number(e.target.value) })} />
  </label>;
}
function Group({ title, children, help }) { return <section className="es-group"><h2>{title}</h2>{help && <p>{help}</p>}<div className="es-fields">{children}</div></section>; }
function Preset({ preset, active, apply }) {
  return <button type="button" className="es-preset" aria-pressed={active} onClick={apply}>
    <span className="es-preset-scene" style={{ '--p-bg':preset.background,'--p-panel':preset.surface,'--p-dock':preset.dock,'--p-accent':preset.seed }} aria-hidden="true"><i /><i /><i /></span>
    <span>{preset.name}</span>{active && <Icon name="check" />}
  </button>;
}
function Themes({ api, state }) {
  const s = state.settings;
  return <><Group title="Material 3 Expressive" help="Наше оформление с живыми формами, волнистым прогрессом и цветами обложки.">
    <Button className="es-primary" icon="restart_alt" onClick={() => api.applyPreset('material-expressive')}>Восстановить исходный стиль</Button>
  </Group><Group title="Готовые темы" help="Меняют цвета фона, панелей, плеера и акцента. Размеры и движение сохраняются.">
    <div className="es-preset-grid">{api.presets.map(p => <Preset key={p.id} preset={p} active={s.preset === p.id && !s.dynamic && s.customSurfaces} apply={() => api.applyPreset(p.id)} />)}</div>
  </Group></>;
}
function Colors({ api, state }) {
  const s = state.settings;
  return <><Group title="Цветовая палитра">
    <Toggle label="Цвета из обложки" help="Тональная палитра Material меняется вместе с треком." value={s.dynamic} onChange={dynamic => api.update({ dynamic })} />
    <div className="es-color-grid">{[['seed','Акцент'],['background','Фон'],['surface','Панели'],['dock','Плеер']].map(([field,label]) => <label key={field} className="es-color"><input type="color" aria-label={label} value={s[field]} onPointerDown={() => api.beginTransaction()} onBlur={() => api.endTransaction()} onChange={e => api.update({ [field]: e.target.value })} /><span>{label}</span><code>{s[field]}</code></label>)}</div>
    <Toggle label="Свои цвета поверхностей" help="Выключи, чтобы фон и панели снова подбирались автоматически." value={s.customSurfaces} onChange={customSurfaces => api.update({ customSurfaces })} />
  </Group><Group title="Поверхности">
    <Range api={api} settings={s} field="opacity" label="Плотность панелей" min={.2} max={.95} step={.05} format={n => `${Math.round(n * 100)}%`} />
    {/Win/i.test(navigator.platform) && <Toggle label="Тональный фон кнопок окна" help="Меняет фон области сворачивания, разворачивания и закрытия." value={s.chromeTint} onChange={chromeTint => api.update({ chromeTint })} />}
  </Group></>;
}
const DENSITIES = [
  ['Компактно',{ gap:8,radius:20,cardRadius:16,cardPadding:8,playerHeight:88,coverSize:48,controlSize:40 }],
  ['Expressive',{ gap:12,radius:28,cardRadius:24,cardPadding:12,playerHeight:112,coverSize:68,controlSize:52 }],
  ['Свободно',{ gap:20,radius:36,cardRadius:28,cardPadding:16,playerHeight:136,coverSize:80,controlSize:64 }],
];
function Geometry({ api, state }) {
  const s = state.settings;
  const range = (field,label,min,max,step=4) => <Range key={field} api={api} settings={s} field={field} label={label} min={min} max={max} step={step} unit=" px" />;
  return <><Group title="Плотность интерфейса"><div className="es-segments">{DENSITIES.map(([name,values]) => <button type="button" key={name} aria-pressed={Object.entries(values).every(([k,v]) => s[k] === v)} onClick={() => api.update(values)}>{name}</button>)}</div></Group>
    <Group title="Панели и карточки"><div className="es-two-columns">{range('gap','Между блоками',4,32)}{range('radius','Углы панелей',0,40)}{range('cardRadius','Углы карточек',0,36)}{range('cardPadding','Отступ внутри карточек',8,24)}{range('artworkRadius','Скругление обложек',0,32)}</div></Group>
    <Group title="Плеер"><div className="es-two-columns">{range('playerHeight','Высота плеера',80,160)}{range('coverSize','Размер обложки',40,Math.min(96,s.playerHeight-24))}{range('controlSize','Размер кнопки Play',40,Math.min(72,s.playerHeight-playerMetrics(s.playerHeight).reserved))}</div></Group>
  </>;
}
const FONTS = [['roboto','Roboto Flex'],['spotify','Spotify Mix'],['segoe','Segoe UI'],['system','Системный']];
function Typography({ api, state }) {
  const s = state.settings;
  return <><Group title="Шрифт"><div className="es-font-grid">{FONTS.map(([value,label]) => <button type="button" key={value} aria-pressed={s.font === value} onClick={() => api.update({ font:value })}><strong>{label}</strong><span style={{ fontFamily:value === 'roboto' ? "'EM Roboto Flex',sans-serif" : value === 'spotify' ? "'SpotifyMixUI',sans-serif" : value === 'segoe' ? "'Segoe UI',sans-serif" : 'system-ui' }}>Музыка остаётся с тобой</span></button>)}</div></Group>
    <Group title="Размер и насыщенность"><Range api={api} settings={s} field="fontScale" label="Масштаб текста" min={.85} max={1.25} step={.05} format={n => `${Math.round(n*100)}%`} /><Range api={api} settings={s} field="fontWeight" label="Насыщенность названий треков" min={400} max={800} step={10} /><Range api={api} settings={s} field="headingWeight" label="Насыщенность заголовков" min={600} max={950} step={10} /></Group>
  </>;
}
function Background({ api, state, run }) {
  const s = state.settings, fileRef = useRef();
  return <><Group title="Фон"><div className="es-segments es-wrap">{[['material','Material'],['image','Изображение'],['mixed','Вместе'],['solid','Однотонный']].map(([value,label]) => <button type="button" key={value} aria-pressed={s.wallpaperMode===value} onClick={() => api.update({ wallpaperMode:value })}>{label}</button>)}</div>
    <div className="es-upload"><Icon name="image" /><div><strong>{s.wallpaperId ? 'Изображение загружено' : 'Своё изображение'}</strong><p>PNG, JPEG или WebP до 4 МБ. Хранится только на этом устройстве.</p></div><Button onClick={() => fileRef.current.click()}>{s.wallpaperId ? 'Заменить' : 'Выбрать'}</Button>{s.wallpaperId && <Button aria-label="Убрать фоновое изображение" icon="delete" onClick={() => api.update({ wallpaperId:'',wallpaperMode:'material' })} />}</div>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const file=e.target.files[0]; if(file) run(() => api.setWallpaper(file)); e.target.value=''; }} />
    <div className="es-two-columns"><Range api={api} settings={s} field="wallpaperBlur" label="Размытие изображения" min={0} max={32} step={1} unit=" px" /><Range api={api} settings={s} field="wallpaperBrightness" label="Яркость изображения" min={.25} max={1.25} step={.05} format={n=>`${Math.round(n*100)}%`} /></div>
  </Group><Group title="Живые формы"><Range api={api} settings={s} field="strength" label="Выразительность фона" min={0} max={1} step={.05} format={n=>`${Math.round(n*100)}%`} /><label className="es-select">Формы<select value={s.shapes} onChange={e => api.update({ shapes:e.target.value })}><option value="all">Все формы Material</option><option value="cookie">Cookie</option><option value="sunny">Sunny</option><option value="clover">Clover</option></select></label><Toggle label="Морфинг форм" value={s.shapeMotion} onChange={shapeMotion => api.update({ shapeMotion })} /><Toggle label="Вращение крупных форм" value={s.shapeRotation} onChange={shapeRotation => api.update({ shapeRotation })} /></Group></>;
}
function Motion({ api, state }) {
  const s = state.settings;
  return <><Group title="Движение"><div className="es-segments">{[['max','Максимум'],['balanced','Мягкое'],['still','Без движения']].map(([value,label]) => <button type="button" key={value} aria-pressed={s.motion===value} onClick={() => api.update({ motion:value })}>{label}</button>)}</div><Range api={api} settings={s} field="speed" label="Темп анимаций" min={.6} max={1.8} step={.1} format={n=>`${n.toFixed(1)}×`} /><Toggle label="Учитывать настройки системы" help="Уменьшение движения в Windows имеет приоритет, пока этот переключатель включён." value={s.respectReduced} onChange={respectReduced=>api.update({ respectReduced })} /></Group>
    <Group title="Детали"><Toggle label="Малые формы на фоне" value={s.particles} onChange={particles=>api.update({ particles })} /><Range api={api} settings={s} field="particleCount" label="Количество малых форм" min={0} max={32} step={1} /><Toggle label="Панорамирование обложек" help="Только внутри карточек; миниатюры в списке треков остаются неподвижными." value={s.artwork} onChange={artwork=>api.update({ artwork })} /><Toggle label="Волнистый прогресс плеера" value={s.wave} onChange={wave=>api.update({ wave })} /></Group></>;
}
function download(text, filename) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function ProfileRow({ profile, active, api, run }) {
  const [editing,setEditing]=useState(false),[name,setName]=useState(profile.name);
  return <div className={`es-profile-row${active?' es-selected':''}`}><div>{editing ? <input aria-label="Новое название профиля" maxLength={60} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run(()=>{api.renameProfile(profile.id,name);setEditing(false);});if(e.key==='Escape')setEditing(false);}} autoFocus /> : <strong>{profile.name}</strong>}<small>{active?'Применён':'Сохранённый стиль'}</small></div><div className="es-row-actions">{editing ? <Button icon="check" aria-label="Сохранить название" onClick={()=>run(()=>{api.renameProfile(profile.id,name);setEditing(false);})} /> : <><Button onClick={()=>run(()=>api.applyProfile(profile.id))}>Применить</Button><Button icon="edit" aria-label={`Переименовать ${profile.name}`} onClick={()=>setEditing(true)} /></>}<Button icon="download" aria-label={`Экспортировать ${profile.name}`} onClick={()=>run(async()=>download(await api.exportProfile(profile.id),'expressive-studio-profile.json'))} /><Button icon="delete" aria-label={`Удалить ${profile.name}`} onClick={()=>api.deleteProfile(profile.id)} /></div></div>;
}
function Profiles({ api,state,run,busy,name,setName,nameRef }) {
  const fileRef=useRef();
  return <><Group title="Сохранить свой стиль"><form className="es-save-form" onSubmit={e=>{e.preventDefault();run(()=>{api.saveProfile(name);setName('');});}}><input ref={nameRef} aria-label="Название профиля" placeholder="Название профиля" maxLength={60} value={name} onChange={e=>setName(e.target.value)} /><button type="submit" className="es-primary"><Icon name="save" />Сохранить</button></form><div className="es-file-actions"><Button icon="download" onClick={()=>run(async()=>download(await api.exportCurrent(name.trim()||'Мой стиль'),'expressive-studio-style.json'))}>Экспорт текущего стиля</Button><Button icon="upload" disabled={busy} onClick={()=>fileRef.current.click()}>{busy?'Импортируем…':'Импорт JSON'}</Button><Button icon="download" disabled={!state.profiles.length||busy} onClick={()=>run(async()=>download(await api.exportAll(),'expressive-studio-profiles.json'))}>Экспорт всех профилей</Button></div><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e=>{const file=e.target.files[0];if(file)run(async()=>{if(file.size>MAX_IMPORT_BYTES)throw new Error('Файл слишком большой: максимум 12 МБ.');await api.importProfiles(await file.text());});e.target.value='';}} /></Group>
    <Group title={`Мои профили · ${state.profiles.length}/64`}>{state.profiles.length ? <div className="es-profile-list">{state.profiles.map(p=><ProfileRow key={p.id} profile={p} active={state.activeProfile===p.id} api={api} run={run} />)}</div> : <div className="es-empty"><Icon name="save" /><p>Сохрани текущий стиль, чтобы возвращаться к нему одним нажатием.</p></div>}</Group></>;
}
function Preview({ api,settings }) {
  const [track,setTrack]=useState({title:'Выбери трек',artist:'Музыка появится здесь',image:''}),[wallpaper,setWallpaper]=useState('');
  useEffect(()=>{
    const player=Spicetify.Player;
    const update=()=>{const meta=player?.data?.item?.metadata||{},src=document.querySelector('.main-nowPlayingWidget-nowPlaying img')?.currentSrc||'';setTrack({title:meta.title||'Выбери трек',artist:meta.artist_name||'Музыка появится здесь',image:src.startsWith('https://')?src:''});};
    update();player?.addEventListener?.('songchange',update);return()=>player?.removeEventListener?.('songchange',update);
  },[]);
  useEffect(()=>{let active=true;setWallpaper('');if(settings.wallpaperId)api.wallpaperUrl(settings.wallpaperId).then(url=>{if(active)setWallpaper(url);}).catch(()=>{});return()=>{active=false;};},[api,settings.wallpaperId]);
  const s=settings;
  return <aside className="es-preview"><div className="es-preview-label"><strong>Твой Spotify</strong><span>{s.enabled?'Изменения применены':'Оформление выключено'}</span></div><div className="es-preview-scene" data-motion={s.motion} style={{'--pv-bg':s.customSurfaces?s.background:'var(--em-canvas,#17121f)','--pv-panel':s.customSurfaces?s.surface:'var(--em-panel,#211a2d)','--pv-dock':s.customSurfaces?s.dock:'var(--em-dock,#30233f)','--pv-radius':`${Math.min(s.radius,28)}px`,'--pv-gap':`${Math.round(s.gap/2)}px`,'--pv-font-scale':s.fontScale}}>
    {wallpaper&&['image','mixed'].includes(s.wallpaperMode)&&<div className="es-preview-wallpaper" style={{backgroundImage:`url("${wallpaper}")`,filter:`blur(${s.wallpaperBlur/3}px) brightness(${s.wallpaperBrightness})`}} />}
    <div className="es-preview-top"><Icon name="palette" /><span>Поиск музыки</span></div><div className="es-preview-content"><div className="es-preview-library"><i/><i/><i/><i/></div><div className="es-preview-album">{track.image?<img alt="" src={track.image}/>:<Icon name="image"/>}<strong>{track.title}</strong><span>{track.artist}</span></div></div><div className="es-preview-player"><Icon name="skip_previous"/><span className="es-preview-play"><Icon name="play_arrow"/></span><Icon name="skip_next"/><i className={s.wave?'es-preview-wave':''}/></div>
  </div><p>Редактор меняет настоящее оформление Spotify. Здесь — компактный вид выбранного стиля.</p></aside>;
}
const TABS=[['themes','palette','Темы'],['colors','palette','Цвета'],['geometry','rounded_corner','Размеры'],['typography','text_fields','Шрифт'],['background','image','Фон'],['motion','animation','Движение'],['profiles','save','Профили']];
export function Editor({ api }) {
  const [state,setState]=useState(api.getSnapshot),[tab,setTab]=useState('themes'),[busy,setBusy]=useState(false),[name,setName]=useState('');
  const nameRef=useRef(),pending=useRef(0);
  useEffect(()=>{setState(api.getSnapshot());return api.subscribe(()=>setState(api.getSnapshot()));},[api]);
  async function run(action){pending.current++;try{setBusy(true);await action();}catch(error){api.reportError(error);}finally{pending.current--;if(!pending.current)setBusy(false);}}
  const props={api,state,run,busy,name,setName,nameRef};
  const panels={themes:Themes,colors:Colors,geometry:Geometry,typography:Typography,background:Background,motion:Motion,profiles:Profiles};
  const Panel=panels[tab];
  function keyboard(event){if(!(event.ctrlKey||event.metaKey))return;const editable=event.target.closest('input,textarea,[contenteditable="true"]');if(event.key.toLowerCase()==='s'){event.preventDefault();event.stopPropagation();setTab('profiles');setTimeout(()=>nameRef.current?.focus(),0);}else if(!editable&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();if(event.key.toLowerCase()==='y'||event.shiftKey)api.redo();else api.undo();}}
  return <div className="es-studio" onKeyDown={keyboard}><header className="es-header"><div><p>Expressive Studio</p></div><div className="es-header-actions"><Button icon="undo" aria-label="Отменить изменение" title="Отменить · Ctrl+Z" disabled={!state.canUndo} onClick={api.undo}/><Button icon="redo" aria-label="Повторить изменение" title="Повторить · Ctrl+Shift+Z" disabled={!state.canRedo} onClick={api.redo}/><Button icon="save" className="es-primary" onClick={()=>{setTab('profiles');setTimeout(()=>nameRef.current?.focus(),0);}}>Сохранить</Button></div></header>
    <div className="es-enable-row"><Toggle label="Оформление включено" help="Можно временно вернуться к обычному Spotify и продолжить редактирование здесь." value={state.settings.enabled} onChange={enabled=>api.update({enabled})}/></div>
    <nav className="es-tabs" role="tablist" aria-label="Разделы оформления">{TABS.map(([id,icon,label],index)=><button type="button" key={id} id={`es-tab-${id}`} role="tab" aria-selected={tab===id} aria-controls="es-editor-panel" tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?TABS.length-1:(index+(e.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length;setTab(TABS[next][0]);document.getElementById(`es-tab-${TABS[next][0]}`)?.focus();}}><Icon name={icon}/>{label}</button>)}</nav>
    {(state.error||state.message)&&<div className={`es-notice${state.error?' es-notice-error':''}`} role={state.error?'alert':'status'}><span>{state.error||state.message}</span><button type="button" onClick={api.clearMessage} aria-label="Закрыть сообщение">×</button></div>}
    <div className="es-workspace"><div id="es-editor-panel" role="tabpanel" aria-labelledby={`es-tab-${tab}`}><Panel {...props}/></div><Preview api={api} settings={state.settings}/></div>
    <footer className="es-footer"><span>Все изменения сохраняются автоматически.</span><Button icon="restart_alt" onClick={api.reset}>Сбросить оформление</Button></footer>
  </div>;
}
