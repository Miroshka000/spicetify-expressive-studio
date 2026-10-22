import { DEFAULTS, STORAGE_KEY, LEGACY_KEY, MAX_PROFILES, MAX_IMPORT_BYTES, normalizeSettings, profileName, presetSettings, decodeImport, encodeExport, isRecord } from './config.js';

export function createStore({ storage, assets, uid = () => crypto.randomUUID() }) {
  const listeners = new Set(), past = [], future = [];
  let timer, transactionStart = null, message = '', error = '', migrated = false;
  let state = { settings: normalizeSettings({}), profiles: [], activeProfile: '' };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== 1) throw new Error('Неподдерживаемая версия настроек.');
      state.settings = normalizeSettings(parsed.settings);
      if (Array.isArray(parsed.profiles)) for (const p of parsed.profiles.slice(0, MAX_PROFILES)) {
        if (!isRecord(p) || typeof p.id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(p.id) || state.profiles.some(item => item.id === p.id)) continue;
        try { state.profiles.push({ id: p.id, name: profileName(p.name), settings: normalizeSettings(p.settings) }); } catch { /* Invalid saved entries are omitted. */ }
      }
      if (state.profiles.some(p => p.id === parsed.activeProfile)) state.activeProfile = parsed.activeProfile;
    } else {
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy) { state.settings = normalizeSettings(JSON.parse(legacy)); migrated = true; message = 'Настройки Expressive Motion перенесены.'; }
    }
  } catch { error = 'Сохранённые настройки не удалось прочитать. Исходные данные сохранены; можно импортировать профиль или выбрать готовую тему.'; }
  let snapshot;
  const capture = () => ({ settings: state.settings, profiles: state.profiles, activeProfile: state.activeProfile });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function publish() {
    snapshot = { ...state, canUndo: past.length > 0, canRedo: future.length > 0, message, error, migrated };
    for (const listener of listeners) listener();
  }
  function persist() {
    clearTimeout(timer);
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state })); }
    catch { error = 'Стиль применён, но сохранить его не удалось. Экспортируй профиль, чтобы не потерять изменения.'; publish(); }
  }
  function changed(previous, note = '') {
    if (same(previous, capture())) return;
    if (!transactionStart) { past.push(previous); if (past.length > 60) past.shift(); }
    future.length = 0; error = ''; message = note;
    clearTimeout(timer); timer = setTimeout(persist, 200); publish();
  }
  function finishTransaction() {
    if (!transactionStart) return;
    if (!same(transactionStart, capture())) { past.push(transactionStart); if (past.length > 60) past.shift(); }
    transactionStart = null; persist(); publish();
  }
  function update(patch) {
    const previous = capture();
    const input = { ...patch };
    if (Object.hasOwn(patch, 'seed') && !Object.hasOwn(patch, 'dynamic')) input.dynamic = false;
    if (['background', 'surface', 'dock'].some(key => Object.hasOwn(patch, key)) && !Object.hasOwn(patch, 'customSurfaces')) input.customSurfaces = true;
    if (['seed', 'background', 'surface', 'dock', 'dynamic', 'customSurfaces'].some(key => Object.hasOwn(patch, key))) input.preset = '';
    state = { ...state, settings: normalizeSettings(input, state.settings), activeProfile: '' };
    changed(previous);
  }
  function apply(settings, activeProfile = '', note = '') {
    finishTransaction(); const previous = capture();
    state = { ...state, settings: normalizeSettings(settings), activeProfile }; changed(previous, note);
  }
  async function exportProfiles(profiles) {
    const images = {};
    for (const p of profiles) {
      const id = p.settings.wallpaperId;
      if (id && !images[id]) {
        const data = await assets.data(id);
        if (!data) throw new Error(`Не найден фон профиля «${p.name}». Выбери изображение заново.`);
        images[id] = data;
      }
    }
    const text = encodeExport(profiles.map(p => ({ name: p.name, settings: p.settings })), images);
    if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Слишком много изображений для одного файла. Экспортируй профили по отдельности.');
    return text;
  }
  publish();
  if (migrated) persist();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update,
    beginTransaction() { if (!transactionStart) transactionStart = capture(); },
    endTransaction: finishTransaction,
    applyPreset(id) { apply(presetSettings(id, state.settings), '', id === 'material-expressive' ? 'Material 3 Expressive восстановлен.' : 'Готовая тема применена.'); },
    reset() { apply(DEFAULTS, '', 'Исходное оформление восстановлено.'); },
    undo() {
      finishTransaction(); if (!past.length) return;
      future.push(capture()); state = past.pop(); message = 'Изменение отменено.'; error = ''; persist(); publish();
    },
    redo() {
      finishTransaction(); if (!future.length) return;
      past.push(capture()); state = future.pop(); message = 'Изменение повторено.'; error = ''; persist(); publish();
    },
    saveProfile(name) {
      finishTransaction(); name = profileName(name);
      if (state.profiles.length >= MAX_PROFILES) throw new Error('Можно сохранить до 64 профилей. Удали ненужный или экспортируй библиотеку.');
      const previous = capture(), id = uid();
      state = { ...state, profiles: [...state.profiles, { id, name, settings: state.settings }], activeProfile: id };
      changed(previous, `Профиль «${name}» сохранён.`); return id;
    },
    applyProfile(id) {
      const p = state.profiles.find(p => p.id === id); if (!p) throw new Error('Профиль не найден.');
      apply({ ...p.settings, enabled: state.settings.enabled }, p.id, `Профиль «${p.name}» применён.`);
    },
    renameProfile(id, name) {
      finishTransaction(); name = profileName(name);
      if (!state.profiles.some(p => p.id === id)) throw new Error('Профиль не найден.');
      const previous = capture();
      state = { ...state, profiles: state.profiles.map(p => p.id === id ? { ...p, name } : p) }; changed(previous, 'Профиль переименован.');
    },
    deleteProfile(id) {
      finishTransaction(); const previous = capture();
      state = { ...state, profiles: state.profiles.filter(p => p.id !== id), activeProfile: state.activeProfile === id ? '' : state.activeProfile };
      changed(previous, 'Профиль удалён. Его можно вернуть кнопкой отмены.');
    },
    async importProfiles(text) {
      const incoming = decodeImport(text);
      if (state.profiles.length + incoming.profiles.length > MAX_PROFILES) throw new Error('После импорта получится больше 64 профилей. Освободи место.');
      for (const [id, data] of Object.entries(incoming.assets)) await assets.put(data, id);
      finishTransaction();
      // Recheck after asynchronous image writes; another editor may have saved a profile.
      if (state.profiles.length + incoming.profiles.length > MAX_PROFILES) throw new Error('Недостаточно места в списке профилей.');
      const previous = capture();
      state = { ...state, profiles: [...state.profiles, ...incoming.profiles.map(p => ({ ...p, id: uid() }))] };
      changed(previous, `Добавлено профилей: ${incoming.profiles.length}.`);
    },
    exportCurrent(name = 'Мой стиль') { return exportProfiles([{ name: profileName(name), settings: state.settings }]); },
    exportProfile(id) { const p = state.profiles.find(p => p.id === id); if (!p) throw new Error('Профиль не найден.'); return exportProfiles([p]); },
    exportAll() { if (!state.profiles.length) throw new Error('Сначала сохрани хотя бы один профиль.'); return exportProfiles(state.profiles); },
    async setWallpaper(file) { const id = await assets.fromFile(file); update({ wallpaperId: id, wallpaperMode: 'mixed' }); },
    reportError(value) { error = String(value?.message || value); message = ''; publish(); },
    clearMessage() { error = ''; message = ''; publish(); },
    destroy() { finishTransaction(); clearTimeout(timer); listeners.clear(); },
  };
}
