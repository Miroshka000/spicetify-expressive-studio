import { createStore } from './store.js';
import { createAssets } from './assets.js';
import { createAppearance } from './appearance.js';
import { VERSION, PRESETS } from './config.js';
import paletteIcon from './assets/expressive-motion/icons/palette.svg';
import systemCss from 'studio:system';
import { Editor } from './editor.jsx';

function boot() {
  window.ExpressiveStudio?.destroy?.();
  window.ExpressiveMotion?.destroy?.();
  let storage;
  try { storage = window.localStorage; }
  catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
  const assets = createAssets(), store = createStore({ storage, assets });
  const renderer = createAppearance({ assets, reportError: store.reportError });
  const controller = new AbortController();
  const style = document.createElement('style'); style.id = 'es-system'; style.textContent = systemCss; document.head.append(style);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'es-open-button'; button.id = 'es-open-button';
  button.title = 'Открыть редактор оформления'; button.setAttribute('aria-label', 'Оформление: открыть Expressive Studio');
  button.innerHTML = paletteIcon + '<span>Оформление</span>';
  let menu, readyTimer, attempts = 0, destroyed = false, appliedSettings, modalOpen = false, modalMain, mainWasInert = false, previousFocus;
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
  button.disabled = true;
  function finishClose() {
    modalOpen = false; button.setAttribute('aria-expanded', 'false');
    if (modalMain) { modalMain.inert = mainWasInert; modalMain = null; }
    if (!document.querySelector('generic-modal [role="dialog"]') && previousFocus?.isConnected) previousFocus.focus({ preventScroll:true });
  }
  function close() {
    if (!modalOpen) return;
    if (document.querySelector('generic-modal .es-studio')) Spicetify.PopupModal.hide();
    finishClose();
  }
  function open() {
    if (!window.Spicetify?.React?.createElement || !window.Spicetify?.ReactDOM?.render || !window.Spicetify?.PopupModal?.display) return;
    if (modalOpen && document.querySelector('generic-modal .es-studio')) return;
    previousFocus = document.activeElement;
    Spicetify.PopupModal.display({ title:'Оформление',content:Spicetify.React.createElement(Editor,{api:window.ExpressiveStudio}),isLarge:true });
    modalOpen = true; button.setAttribute('aria-expanded', 'true');
    modalMain = document.getElementById('main');
    if (modalMain) { mainWasInert = modalMain.inert; modalMain.inert = true; }
    const host = document.querySelector('generic-modal:has(.es-studio)');
    const closeButton = host?.querySelector('.spicetify-popup-closeBtn');
    closeButton?.setAttribute('aria-label', 'Закрыть оформление');
    host?.querySelector('.es-header-actions button:not(:disabled)')?.focus();
  }
  button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); open(); }, { signal: controller.signal });
  function attachButton() {
    const toolbar = document.querySelector('.main-globalNav-contentRight');
    const parent = toolbar || document.body;
    if (button.parentElement !== parent) parent.prepend(button);
    button.classList.toggle('es-open-floating', !toolbar);
  }
  function synchronize() {
    const { settings } = store.getSnapshot();
    if (settings !== appliedSettings) {
      appliedSettings = settings;
      try { renderer.update(settings); }
      catch (error) { renderer.destroy(); store.reportError(new Error(`Оформление отключено из-за ошибки: ${error.message}`)); }
    }
    button.dataset.enabled = String(settings.enabled);
  }
  const unsubscribe = store.subscribe(synchronize);
  synchronize(); attachButton();
  const observer = new MutationObserver(() => {
    if (modalOpen && !document.querySelector('generic-modal .es-studio')) finishClose();
    if (!button.isConnected || !button.closest('.main-globalNav-contentRight') && document.querySelector('.main-globalNav-contentRight')) attachButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  function connect() {
    if (destroyed) return;
    if (!window.Spicetify?.Menu?.Item || !window.Spicetify?.React?.createElement || !window.Spicetify?.ReactDOM?.render || !window.Spicetify?.PopupModal?.display) {
      if (attempts++ < 120) readyTimer = setTimeout(connect, 500);
      return;
    }
    button.disabled = false;
    menu = new Spicetify.Menu.Item('Expressive Studio', false, open); menu.register();
  }
  connect();
  document.addEventListener('keydown', event => {
    if (!modalOpen) return;
    const host = document.querySelector('generic-modal:has(.es-studio) [role="dialog"]');
    if (!host) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...host.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')].filter(node => node.tabIndex >= 0 && !node.closest('[hidden]') && node.getClientRects().length);
    const first = nodes[0], last = nodes[nodes.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !host.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }, { capture:true,signal:controller.signal });
  window.ExpressiveStudio = Object.freeze({
    version: VERSION, presets: PRESETS, ...store, open,
    wallpaperUrl: id => assets.url(id),
    destroy() {
      if (destroyed) return;
      destroyed = true; close(); controller.abort(); clearTimeout(readyTimer); observer.disconnect(); unsubscribe();
      menu?.deregister(); renderer.destroy(); store.destroy(); assets.destroy(); button.remove(); style.remove();
      delete window.ExpressiveStudio;
    },
  });
  window.dispatchEvent(new CustomEvent('expressive-studio:ready'));
}
if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot, { once: true });
