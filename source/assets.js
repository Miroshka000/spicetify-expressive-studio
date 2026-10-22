const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function imageBytes(data) {
  if (typeof data !== 'string' || data.length > MAX_IMAGE_BYTES * 1.4) throw new Error('Изображение слишком большое: максимум 4 МБ.');
  const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(data);
  if (!match) throw new Error('Поддерживаются изображения PNG, JPEG и WebP.');
  let bytes;
  try { bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)); }
  catch { throw new Error('Изображение повреждено.'); }
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Изображение слишком большое: максимум 4 МБ.');
  const type = match[1].toLowerCase();
  const valid = type === 'png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
    : type === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!valid) throw new Error('Содержимое файла не соответствует формату изображения.');
  return { bytes, mime: `image/${type}` };
}

export function createAssets() {
  let dbPromise;
  const urls = new Map();
  function database() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('expressive-studio-assets', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('images');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Хранилище изображений недоступно.'));
      request.onblocked = () => reject(new Error('Закрой другие окна Spotify и повтори загрузку изображения.'));
    }).catch(error => { dbPromise = undefined; throw error; });
    return dbPromise;
  }
  async function request(mode, callback) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('images', mode);
      const req = callback(transaction.objectStore('images'));
      let value;
      req.onsuccess = () => { value = req.result; };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = transaction.onabort = () => reject(new Error('Не удалось сохранить или прочитать изображение.'));
    });
  }
  async function put(data, expectedId) {
    const { bytes, mime } = imageBytes(data);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const id = [...digest].map(n => n.toString(16).padStart(2, '0')).join('');
    if (expectedId && expectedId !== id) throw new Error('Контрольная сумма изображения в профиле не совпадает.');
    await request('readwrite', store => store.put({ data, mime }, id));
    return id;
  }
  async function get(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    return await request('readonly', store => store.get(id));
  }
  return {
    put,
    async fromFile(file) {
      if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES) throw new Error('Выбери PNG, JPEG или WebP размером до 4 МБ.');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение.')); reader.readAsDataURL(file);
      });
      return put(data);
    },
    async data(id) { return (await get(id))?.data || ''; },
    async url(id) {
      if (!id) return '';
      if (urls.has(id)) return urls.get(id);
      const value = await get(id);
      if (!value) throw new Error('Фоновое изображение не найдено. Выбери его снова.');
      const { bytes, mime } = imageBytes(value.data);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      urls.set(id, url); return url;
    },
    destroy() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); dbPromise?.then(db => db.close()).catch(() => {}); },
  };
}
