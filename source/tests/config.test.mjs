import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, decodeImport, presetSettings, DEFAULTS, encodeExport } from '../config.js';
import { panelRole } from '../compatibility.js';

test('legacy theme settings migrate without losing chosen colors and motion', () => {
  const migrated = normalizeSettings({ seed: '#AABBCC', motion: 'max', opacity: .35, customSurfaces: true, dock: '#18231c' });
  assert.equal(migrated.seed, '#aabbcc'); assert.equal(migrated.motion, 'max');
  assert.equal(migrated.opacity, .35); assert.equal(migrated.dock, '#18231c');
  assert.equal(migrated.enabled, true); assert.equal(migrated.gap, 12);
});
test('malformed and hostile settings cannot introduce CSS, URLs or prototype keys', () => {
  const s = normalizeSettings(JSON.parse('{"seed":"red;opacity:0","font":"url(https://x)","wallpaperId":"javascript:alert(1)","__proto__":{"polluted":true},"playerHeight":1,"coverSize":96,"speed":null}'));
  assert.equal(s.seed, DEFAULTS.seed); assert.equal(s.font, 'roboto'); assert.equal(s.wallpaperId, '');
  assert.equal(s.playerHeight, 80); assert.equal(s.coverSize, 56); assert.equal(s.controlSize, 40); assert.equal(s.speed, 1);
  assert.equal(Object.hasOwn(s, '__proto__'), false); assert.equal({}.polluted, undefined);
});
test('profile import validates the version, count and names', () => {
  assert.throws(() => decodeImport('{broken'));
  assert.throws(() => decodeImport('{"format":"other","version":1,"profiles":[]}'));
  assert.throws(() => decodeImport(encodeExport([{ name: ' ', settings: {} }])));
  assert.throws(() => decodeImport(encodeExport(Array.from({ length: 65 }, () => ({ name: 'a', settings: {} })))));
  const { profiles: [p] } = decodeImport(encodeExport([{ name: '  Мой   стиль ', settings: { motion: 'still', gap: 20 } }]));
  assert.equal(p.name, 'Мой стиль'); assert.equal(p.settings.gap, 20); assert.equal(p.settings.motion, 'still');
});
test('color presets preserve geometry and enable manual surfaces', () => {
  const s = presetSettings('mint', normalizeSettings({ gap: 24, speed: 1.6 }));
  assert.equal(s.gap, 24); assert.equal(s.speed, 1.6); assert.equal(s.dynamic, false);
  assert.equal(s.customSurfaces, true); assert.equal(s.preset, 'mint');
  assert.throws(() => presetSettings('missing'));
});
test('cinema spans and placeholder nodes must never become painted panels', () => {
  assert.equal(panelRole({ gridArea: 'left-sidebar / left-sidebar / main-view / main-view' }), '');
  assert.equal(panelRole({ gridArea: 'left-sidebar / left-sidebar / right-sidebar / right-sidebar' }), '');
  assert.equal(panelRole({ gridArea: 'left-sidebar' }), '');
  assert.equal(panelRole({ id: 'Desktop_LeftSidebar_Id', gridArea: 'left-sidebar / left-sidebar / main-view / main-view' }), 'left-sidebar');
  assert.equal(panelRole({ id: 'main-view' }), 'main-view');
  assert.equal(panelRole({ gridArea: 'right-sidebar / right-sidebar / right-sidebar / right-sidebar' }), 'right-sidebar');
  assert.equal(panelRole({ gridArea: 'now-playing-bar', hasPlayer: true }), 'now-playing-bar');
});
