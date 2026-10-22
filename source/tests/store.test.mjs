import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store.js';
import { LEGACY_KEY, STORAGE_KEY } from '../config.js';
import { imageBytes } from '../assets.js';
function fixture(entries = []) {
  const values = new Map(entries); let next = 0;
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  return { values, store: createStore({ storage, assets: {}, uid: () => `profile-${++next}` }) };
}
test('migration creates new state while preserving rollback data', () => {
  const legacy = JSON.stringify({ seed: '#bbccdd', motion: 'max', speed: 1.7 });
  const { store, values } = fixture([[LEGACY_KEY, legacy]]);
  assert.equal(store.getSnapshot().settings.seed, '#bbccdd'); assert.equal(store.getSnapshot().settings.speed, 1.7);
  assert.equal(values.get(LEGACY_KEY), legacy); assert.ok(values.has(STORAGE_KEY)); store.destroy();
});
test('a slider drag is one undo operation, and a new edit discards redo', () => {
  const { store } = fixture(); store.beginTransaction(); store.update({ gap: 16 }); store.update({ gap: 24 }); store.endTransaction();
  store.undo(); assert.equal(store.getSnapshot().settings.gap, 12); assert.equal(store.getSnapshot().canUndo, false);
  store.redo(); assert.equal(store.getSnapshot().settings.gap, 24); store.undo(); store.update({ gap: 8 });
  assert.equal(store.getSnapshot().canRedo, false); store.destroy();
});
test('profiles are immutable snapshots; deletion can be undone', () => {
  const { store } = fixture(); store.update({ gap: 20 }); const id = store.saveProfile('Мой стиль');
  store.update({ gap: 28 }); store.applyProfile(id); assert.equal(store.getSnapshot().settings.gap, 20);
  store.deleteProfile(id); assert.equal(store.getSnapshot().profiles.length, 0);
  store.undo(); assert.equal(store.getSnapshot().profiles[0].id, id); store.destroy();
});
test('an invalid import leaves existing state untouched', async () => {
  const { store } = fixture(); store.saveProfile('Сохранённый'); const before = store.getSnapshot();
  await assert.rejects(store.importProfiles('{bad'));
  assert.equal(store.getSnapshot(), before); store.destroy();
});
test('SVG and files with a fake PNG declaration are rejected', () => {
  assert.throws(() => imageBytes('data:image/svg+xml;base64,PHN2Zz4='));
  assert.throws(() => imageBytes('data:image/png;base64,PHNjcmlwdD4='));
});
