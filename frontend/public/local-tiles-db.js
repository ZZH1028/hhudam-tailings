const databaseName = 'hhudam-local-3d-tiles';
let database;

function open() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('models', { keyPath: 'id' });
        request.result.createObjectStore('files', { keyPath: ['id', 'path'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
  }
  return database;
}

async function read(store, key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const table = db.transaction(store, 'readonly').objectStore(store);
    const request = key ? table.get(key) : table.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const listTileModels = () => read('models');
export const getTile = (id, path) => read('files', [id, path]);

export async function storeTileModel(model, files) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['models', 'files'], 'readwrite');
    const table = transaction.objectStore('files');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('未能保存三维瓦片。'));
    transaction.objectStore('models').put(model);
    files.forEach(({ path, file }) => table.put({ id: model.id, path, file }));
  });
}
