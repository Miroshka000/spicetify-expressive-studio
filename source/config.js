import presets from './presets.json' with { type: 'json' };

export const VERSION = '1.0.1';
export const STORAGE_KEY = 'expressive-studio:v1';
export const LEGACY_KEY = 'expressive-motion:v1';
export const MAX_PROFILES = 64;
export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
export const PRESETS = Object.freeze(presets);
export const DEFAULTS = Object.freeze({
  enabled: true, preset: '', dynamic: true, seed: '#b68aff',
  customSurfaces: false, background: '#17121f', surface: '#211a2d', dock: '#30233f',
  opacity: .52, strength: .85, motion: 'max', speed: 1, particles: true,
  particleCount: 12, artwork: true, respectReduced: true, chromeTint: true,
  gap: 12, radius: 28, cardRadius: 24, cardPadding: 12, artworkRadius: 20,
  playerHeight: 112, coverSize: 68, controlSize: 52,
  font: 'roboto', fontScale: 1, fontWeight: 590, headingWeight: 800,
  wallpaperMode: 'material', wallpaperId: '', wallpaperBlur: 0, wallpaperBrightness: .8,
  shapes: 'all', shapeMotion: true, shapeRotation: true, wave: true,
});

export const LIMITS = Object.freeze({
  opacity: [.2, .95], strength: [0, 1], speed: [.6, 1.8], particleCount: [0, 32],
  gap: [4, 32], radius: [0, 40], cardRadius: [0, 36], cardPadding: [8, 24],
  artworkRadius: [0, 32], playerHeight: [80, 160], coverSize: [40, 96], controlSize: [40, 72],
  fontScale: [.85, 1.25], fontWeight: [400, 800], headingWeight: [600, 950],
  wallpaperBlur: [0, 32], wallpaperBrightness: [.25, 1.25],
});
const ENUMS = {
  motion: ['max', 'balanced', 'still'], font: ['roboto', 'spotify', 'segoe', 'system'],
  wallpaperMode: ['material', 'image', 'mixed', 'solid'], shapes: ['all', 'cookie', 'sunny', 'clover'],
};
const COLORS = new Set(['seed', 'background', 'surface', 'dock']);
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const playerMetrics = height => height < 104
  ? { padding:8, gap:4, progress:12, wave:8, reserved:40 }
  : { padding:12, gap:8, progress:20, wave:16, reserved:60 };

// Enumerate known keys rather than merging untrusted objects or CSS strings.
export function normalizeSettings(value, base = DEFAULTS) {
  const input = isRecord(value) ? value : {};
  const result = {};
  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    const fallback = base[key] ?? defaultValue;
    const v = Object.hasOwn(input, key) ? input[key] : fallback;
    if (typeof defaultValue === 'boolean') result[key] = typeof v === 'boolean' ? v : fallback;
    else if (COLORS.has(key)) result[key] = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
    else if (LIMITS[key]) {
      const [min, max] = LIMITS[key];
      result[key] = typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
      if (key === 'particleCount') result[key] = Math.round(result[key]);
    } else if (ENUMS[key]) result[key] = ENUMS[key].includes(v) ? v : fallback;
    else if (key === 'preset') result[key] = typeof v === 'string' && PRESETS.some(p => p.id === v) ? v : '';
    else if (key === 'wallpaperId') result[key] = typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : '';
  }
  result.coverSize = Math.min(result.coverSize, result.playerHeight - 24);
  result.controlSize = Math.min(result.controlSize, result.playerHeight - playerMetrics(result.playerHeight).reserved);
  return result;
}

export function presetSettings(id, current = DEFAULTS) {
  if (id === 'material-expressive') return normalizeSettings({ ...DEFAULTS, enabled: current.enabled });
  const p = PRESETS.find(item => item.id === id);
  if (!p) throw new Error('Такой готовой темы нет.');
  return normalizeSettings({
    seed: p.seed, background: p.background, surface: p.surface, dock: p.dock,
    preset: p.id, dynamic: false, customSurfaces: true,
  }, current);
}

export function profileName(value) {
  if (typeof value !== 'string') throw new Error('Укажи название профиля.');
  const name = value.trim().replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ');
  if (!name || name.length > 60) throw new Error('Название должно содержать от 1 до 60 символов.');
  return name;
}

export function decodeImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Файл слишком большой: максимум 12 МБ.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('Не удалось прочитать JSON-файл.'); }
  if (!isRecord(input) || input.format !== 'expressive-studio' || input.version !== 1) throw new Error('Это не поддерживаемый файл профилей Expressive Studio.');
  if (!Array.isArray(input.profiles) || !input.profiles.length || input.profiles.length > MAX_PROFILES) throw new Error('В файле должно быть от 1 до 64 профилей.');
  const assets = {};
  if (input.assets !== undefined && !isRecord(input.assets)) throw new Error('Неверный список изображений в файле.');
  if (Object.keys(input.assets || {}).length > MAX_PROFILES) throw new Error('В файле слишком много изображений.');
  for (const [id, data] of Object.entries(input.assets || {})) {
    if (!/^[a-f0-9]{64}$/.test(id) || typeof data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(data)) throw new Error('Неверное изображение в файле профилей.');
    assets[id] = data;
  }
  const profiles = input.profiles.map(profile => {
    if (!isRecord(profile) || !isRecord(profile.settings)) throw new Error('В профиле отсутствуют настройки.');
    const settings = normalizeSettings(profile.settings);
    if (settings.wallpaperId && !Object.hasOwn(assets, settings.wallpaperId)) throw new Error('В файле отсутствует фоновое изображение профиля.');
    return { name: profileName(profile.name), settings };
  });
  return { profiles, assets };
}

export function encodeExport(profiles, assets = {}) {
  return JSON.stringify({ format: 'expressive-studio', version: 1, profiles, assets }, null, 2);
}
