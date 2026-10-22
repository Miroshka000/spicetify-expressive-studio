import { Hct, SchemeExpressive, SchemeTonalSpot, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import shapes from './shape-data.json';
import appearanceCss from 'studio:appearance';
import { panelRole } from './compatibility.js';
import { playerMetrics } from './config.js';
import { createNativeColors } from './native-colors.js';

const FONTS = {
  roboto: "'EM Roboto Flex','Segoe UI Variable','Segoe UI',sans-serif",
  spotify: "'SpotifyMixUI','Spotify Circular','Segoe UI',sans-serif",
  segoe: "'Segoe UI Variable','Segoe UI',sans-serif",
  system: 'system-ui,sans-serif',
};
const rgb = hex => { const n = Number.parseInt(hex.slice(1), 16); return `${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}`; };
function luminance(hex) {
  const c = rgb(hex).split(',').map(Number).map(n => { const s = n / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function foreground(hex) { return contrast('#17131c', hex) >= contrast('#faf5ff', hex) ? '#17131c' : '#faf5ff'; }
function mix(a, b, ratio) {
  const x = rgb(a).split(',').map(Number), y = rgb(b).split(',').map(Number);
  return '#' + x.map((v, i) => Math.round(v * (1 - ratio) + y[i] * ratio).toString(16).padStart(2, '0')).join('');
}

export function createAppearance({ assets, reportError }) {
  const root = document.documentElement, reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let settings, running = false, style, layer, observer, intersection, player, historyStop, controller;
  let scanTimer, readyTimer, colorTimer, attempts = 0, generation = 0, wallpaperGeneration = 0, palette, previous;
  const oldVariables = new Map(), observed = new Set(), paletteCache = new Map();
  const nativeColors = createNativeColors();
  let playerConnected = false;
  function variable(key, value) {
    if (!oldVariables.has(key)) oldVariables.set(key, [root.style.getPropertyValue(key), root.style.getPropertyPriority(key)]);
    root.style.setProperty(key, value);
  }
  function listen(target, event, handler, options = {}) { target.addEventListener(event, handler, { ...options, signal: controller.signal }); }
  function el(tag, className, parent) { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; }
  function makeShape(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 1 1');
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', shapes[id].start);
    path.setAttribute('class', `em-shape-${id}`); path.setAttribute('fill', 'currentColor'); svg.append(path); return svg;
  }
  function atmosphere() {
    layer = el('div', 'em-atmosphere', document.body); layer.id = 'es-atmosphere'; layer.setAttribute('aria-hidden', 'true');
    el('div', 'es-wallpaper', layer);
    for (let i = 0; i < 3; i++) el('div', `em-aura em-aura-${i}`, layer);
    for (let i = 0; i < 6; i++) {
      const id = ['cookie', 'sunny', 'clover'][i % 3], form = el('div', 'em-material-form', layer);
      form.dataset.shape = id;
      form.style.cssText = `--i:${i};--x:${[10,79,45,96,19,64][i]}%;--y:${[25,15,80,67,87,40][i]}%;--size:${[540,460,480,380,260,220][i]}px;--em-shape-time:${8 + i * 2}s`;
      form.append(makeShape(id));
    }
    const motes = el('div', 'em-motes', layer);
    for (let i = 0; i < 32; i++) {
      const id = ['cookie', 'sunny', 'clover'][i % 3], mote = el('div', 'em-mote', motes); mote.dataset.shape = id;
      mote.style.cssText = `--i:${i};--x:${(i * 37 + 11) % 100}%;--y:${(i * 23 + 9) % 100}%;--size:${4 + i % 4 * 4}px;--delay:${-i * 1.7}s`;
      mote.append(makeShape(id));
    }
  }
  function applyPalette(seed) {
    const Scheme = settings.dynamic ? SchemeExpressive : SchemeTonalSpot;
    const scheme = new Scheme(Hct.fromInt(argbFromHex(seed)), true, 0, '2025');
    const roles = {
      primary: scheme.primary, 'on-primary': scheme.onPrimary, 'primary-container': scheme.primaryContainer, 'on-primary-container': scheme.onPrimaryContainer,
      secondary: scheme.secondary, 'on-secondary': scheme.onSecondary, 'secondary-container': scheme.secondaryContainer, 'on-secondary-container': scheme.onSecondaryContainer,
      tertiary: scheme.tertiary, 'on-tertiary': scheme.onTertiary, 'tertiary-container': scheme.tertiaryContainer,
      surface: scheme.surface, 'surface-lowest': scheme.surfaceContainerLowest, 'surface-low': scheme.surfaceContainerLow,
      'surface-container': scheme.surfaceContainer, 'surface-high': scheme.surfaceContainerHigh, 'surface-highest': scheme.surfaceContainerHighest,
      'on-surface': scheme.onSurface, 'on-surface-variant': scheme.onSurfaceVariant, outline: scheme.outline, 'outline-variant': scheme.outlineVariant, error: scheme.error,
    };
    palette = {};
    for (const [key, argb] of Object.entries(roles)) {
      const hex = hexFromArgb(argb); palette[key] = hex; variable(`--em-${key}`, hex); variable(`--em-rgb-${key}`, rgb(hex));
    }
    const spice = { text:'on-surface',subtext:'on-surface-variant',main:'surface',sidebar:'surface-low',player:'surface-container',card:'surface-high','main-elevated':'surface-high',highlight:'surface-highest','highlight-elevated':'surface-highest','selected-row':'primary',button:'primary','button-active':'primary','button-disabled':'outline-variant','tab-active':'secondary-container',notification:'primary-container','notification-error':'error',misc:'outline' };
    for (const [key, role] of Object.entries(spice)) { variable(`--spice-${key}`, palette[role]); variable(`--spice-rgb-${key}`, rgb(palette[role])); }
    applySurfaces();
  }
  function applySurfaces() {
    if (!palette) return;
    const surface = settings.customSurfaces ? settings.surface : palette['surface-low'];
    const dock = settings.customSurfaces ? settings.dock : palette['surface-high'];
    const dockText = foreground(dock), dockMuted = mix(dock, dockText, .76);
    const play = contrast(palette.primary, dock) >= 3 ? palette.primary : contrast(palette['on-primary'], dock) >= 3 ? palette['on-primary'] : dockText;
    for (const [key, value] of Object.entries({
      canvas: settings.customSurfaces ? settings.background : palette['surface-lowest'], panel: surface, 'panel-rgb': rgb(surface), dock,
      'panel-text': settings.customSurfaces ? foreground(surface) : palette['on-surface'], 'dock-text': dockText, 'dock-text-rgb': rgb(dockText),
      'dock-muted': contrast(dockMuted, dock) >= 4.5 ? dockMuted : dockText, 'dock-accent': contrast(palette.primary, dock) >= 3 ? palette.primary : dockText,
      'dock-track': mix(dock, dockText, .4), 'play-surface': play, 'play-text': foreground(play),
      'panel-opacity': settings.opacity, 'background-strength': settings.strength,
    })) variable(`--em-${key}`, String(value));
  }
  function applySettings() {
    const metrics = playerMetrics(settings.playerHeight);
    const values = {
      emTheme:'expressive-studio',emMotion:settings.respectReduced && reduced.matches ? 'still' : settings.motion,
      emParticles:String(settings.particles),emArtwork:String(settings.artwork),emChromeTint:String(settings.chromeTint),
      emWindows:String(/Win/i.test(navigator.platform)),emSuspended:String(document.hidden),
      emShapes:settings.shapes,emMorph:String(settings.shapeMotion),emRotation:String(settings.shapeRotation),emWave:String(settings.wave),emWallpaper:settings.wallpaperMode,
    };
    Object.assign(root.dataset, values);
    const vars = {
      '--em-tempo':1 / settings.speed,'--panel-gap':`${settings.gap}px`,'--em-radius':`${settings.radius}px`,
      '--em-card-radius':`${settings.cardRadius}px`,'--em-card-padding':`${settings.cardPadding}px`,
      '--em-artwork-radius':`${settings.artworkRadius}px`,'--em-player-height':`${settings.playerHeight}px`,
      '--em-cover-size':`${settings.coverSize}px`,'--em-control-size':`${settings.controlSize}px`,'--em-play-width':`${Math.round(settings.controlSize * 72 / 52)}px`,
      '--em-player-padding':`${metrics.padding}px`,'--em-controls-gap':`${metrics.gap}px`,'--em-progress-height':`${metrics.progress}px`,'--em-wave-height':`${metrics.wave}px`,
      '--em-font':FONTS[settings.font],'--em-font-scale':settings.fontScale,'--em-font-weight':settings.fontWeight,'--em-heading-weight':settings.headingWeight,
      '--es-wallpaper-blur':`${settings.wallpaperBlur}px`,'--es-wallpaper-brightness':settings.wallpaperBrightness,
    };
    for (const [key, value] of Object.entries(vars)) variable(key, String(value));
    let index = 0; for (const mote of layer.querySelectorAll('.em-mote')) mote.hidden = index++ >= settings.particleCount;
    applySurfaces();
  }
  async function wallpaper() {
    const token = ++wallpaperGeneration, node = layer?.querySelector('.es-wallpaper');
    if (!node) return;
    node.style.backgroundImage = 'none';
    if (!settings.wallpaperId) return;
    try {
      const url = await assets.url(settings.wallpaperId);
      if (running && token === wallpaperGeneration) node.style.backgroundImage = `url("${url}")`;
    } catch (error) { if (running && token === wallpaperGeneration) reportError(error); }
  }
  function observe(node) {
    if (observed.has(node)) return;
    observed.add(node); node.classList.add('em-observed'); intersection?.observe(node);
    if (!intersection) node.classList.add('em-visible');
  }
  function decorate() {
    scanTimer = undefined; if (!running) return;
    nativeColors.scan();
    const shell = document.querySelector('.Root__top-container');
    if (shell) for (const node of shell.children) {
      const layout = getComputedStyle(node);
      const role = panelRole({ id:node.id,legacy:node.classList.contains('Root__nav-bar') ? 'left-sidebar' : node.classList.contains('Root__main-view') ? 'main-view' : '',gridArea:layout.gridArea,containerName:layout.containerName,hasPlayer:!!node.querySelector('.main-nowPlayingBar-container') });
      if (role) node.dataset.emPanel = role; else delete node.dataset.emPanel;
    }
    for (const node of observed) if (!node.isConnected) { intersection?.unobserve(node); observed.delete(node); }
    let index = 0;
    for (const card of document.querySelectorAll('.main-card-card, .main-card-cardContainer, [data-testid="card"], [data-encore-id="card"]')) {
      if (card.closest('.es-studio') || card.matches('[role="row"]') || card.querySelector('[role="grid"], [data-testid="tracklist"]')) { delete card.dataset.emCard; continue; }
      if (!card.hasAttribute('data-em-card')) { card.dataset.emCard = ''; card.style.setProperty('--em-index', String(index % 12)); }
      observe(card); index++;
    }
    for (const node of document.querySelectorAll('.main-entityHeader-imageContainer, .main-entityHeader-imageContainerNew, [data-testid="cover-art-container"], .main-nowPlayingView-coverArtContainer')) {
      node.classList.add('em-artwork'); observe(node);
    }
    index = 0;
    for (const row of document.querySelectorAll('.main-trackList-trackListRow, [data-testid="tracklist-row"], [role="grid"] [role="row"]')) {
      if (row.closest('.es-studio')) continue;
      if (!row.hasAttribute('data-em-row')) { row.dataset.emRow = ''; row.style.setProperty('--em-index', String(index % 12)); }
      for (const image of row.querySelectorAll('img')) image.classList.add('em-track-image'); observe(row); index++;
    }
  }
  function scheduleScan() { if (running && !scanTimer) scanTimer = setTimeout(decorate, 160); }
  function syncPlaying() { try { root.dataset.emPlaying = String(player.isPlaying()); } catch { root.dataset.emPlaying = 'false'; } }
  async function updateTrack() {
    syncPlaying(); const uri = player?.data?.item?.uri, token = ++generation;
    if (!settings.dynamic || !uri || !window.Spicetify?.colorExtractor) { applyPalette(settings.seed); return; }
    if (paletteCache.has(uri)) { applyPalette(paletteCache.get(uri)); return; }
    applyPalette(settings.seed); let timeout;
    try {
      const colors = await Promise.race([Spicetify.colorExtractor(uri),new Promise((_, reject) => { timeout = colorTimer = setTimeout(() => reject(new Error('timeout')), 6500); })]);
      if (!running || token !== generation || !settings.dynamic) return;
      let seed = colors?.VIBRANT_NON_ALARMING || colors?.VIBRANT || colors?.PROMINENT;
      if (typeof seed !== 'string') return;
      if (!seed.startsWith('#')) seed = '#' + seed;
      if (!/^#[a-f0-9]{6}$/i.test(seed)) return;
      if (paletteCache.size >= 32) paletteCache.delete(paletteCache.keys().next().value);
      paletteCache.set(uri, seed); applyPalette(seed);
    } catch { /* The manual palette is already visible. */ }
    finally { clearTimeout(timeout); }
  }
  function connectPlayer() {
    if (!running) return;
    const spice = window.Spicetify;
    if (!spice?.Player?.isPlaying || !spice.Player.addEventListener) { if (attempts++ < 120) readyTimer = setTimeout(connectPlayer, 500); return; }
    player = spice.Player; playerConnected = true;
    player.addEventListener('songchange', updateTrack); player.addEventListener('onplaypause', syncPlaying);
    historyStop = spice.Platform?.History?.listen?.(scheduleScan); updateTrack();
  }
  function start() {
    running = true; controller = new AbortController(); attempts = 0;
    style = el('style', '', document.head); style.id = 'es-appearance'; style.textContent = appearanceCss;
    atmosphere(); applyPalette(settings.seed); applySettings(); wallpaper();
    if ('IntersectionObserver' in window) intersection = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle('em-visible', entry.isIntersecting);
    }, { rootMargin:'80px' });
    decorate();
    observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && !node.closest?.('.em-atmosphere, .es-studio, .es-open-button')) { scheduleScan(); return; }
      }
    });
    observer.observe(document.body, { childList:true,subtree:true });
    listen(document, 'visibilitychange', () => { root.dataset.emSuspended = String(document.hidden); });
    listen(document, 'load', event => { if (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') scheduleScan(); }, { capture:true });
    listen(reduced, 'change', applySettings); connectPlayer();
  }
  function stop() {
    if (!running) return;
    running = false; generation++; wallpaperGeneration++; controller.abort();
    observer?.disconnect(); intersection?.disconnect();
    clearTimeout(scanTimer); clearTimeout(readyTimer); clearTimeout(colorTimer); scanTimer = undefined;
    if (typeof historyStop === 'function') historyStop(); historyStop = undefined;
    if (playerConnected) { player.removeEventListener('songchange', updateTrack); player.removeEventListener('onplaypause', syncPlaying); playerConnected = false; }
    for (const node of observed) node.classList.remove('em-observed', 'em-visible', 'em-artwork'); observed.clear();
    for (const node of document.querySelectorAll('[data-em-card], [data-em-row]')) { delete node.dataset.emCard; delete node.dataset.emRow; node.style.removeProperty('--em-index'); }
    document.querySelectorAll('[data-em-panel]').forEach(node => delete node.dataset.emPanel);
    document.querySelectorAll('.em-track-image').forEach(node => node.classList.remove('em-track-image'));
    for (const [key, [value, priority]] of oldVariables) { if (value) root.style.setProperty(key, value, priority); else root.style.removeProperty(key); }
    oldVariables.clear();
    nativeColors.restore();
    for (const key of ['emTheme','emMotion','emParticles','emArtwork','emChromeTint','emWindows','emSuspended','emShapes','emMorph','emRotation','emWave','emWallpaper','emPlaying']) delete root.dataset[key];
    style?.remove(); layer?.remove(); palette = undefined; previous = undefined;
  }
  return {
    update(next) {
      settings = next;
      if (!next.enabled) { stop(); return; }
      if (!running) start();
      else {
        applySettings();
        if (previous?.seed !== next.seed || previous?.dynamic !== next.dynamic) updateTrack();
        if (previous?.wallpaperId !== next.wallpaperId) wallpaper();
      }
      previous = next;
    },
    destroy: stop,
  };
}
