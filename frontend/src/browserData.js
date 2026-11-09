const dbName = 'tailings-web-workspace';
const stores = ['models', 'floods', 'docs'];
const maxBytes = 256 * 1024 * 1024;
let dbPromise;

function openDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        for (const name of stores) request.result.createObjectStore(name, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function transact(store, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = operation(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('浏览器存储操作未完成。'));
    transaction.onerror = () => reject(transaction.error || request.error);
  });
}

export const readAll = store => transact(store, 'readonly', table => table.getAll());
export const saveLocal = (store, item) => transact(store, 'readwrite', table => table.put(item));
export const deleteLocal = (store, id) => transact(store, 'readwrite', table => table.delete(id));
export const assetUrl = path => new URL(path, document.baseURI).href;

export function importUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('请填写完整的 HTTPS 文件地址。');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('请填写无需在地址中携带账号密码的 HTTPS 文件地址。');
  }
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/');
    if (parts[3] === 'blob' && parts.length >= 6) {
      url = new URL('https://raw.githubusercontent.com/' + [...parts.slice(1, 3), ...parts.slice(4)].join('/'));
    }
  }
  return url;
}

export async function importFile(input, remote) {
  if (!remote) {
    if (!input) throw new Error('请先选择一个文件。');
    if (input.size > maxBytes) throw new Error('文件超过 256 MB，请拆分或使用完整版。');
    return input;
  }
  const url = importUrl(input);
  let response;
  try {
    response = await fetch(url, {
      credentials: url.origin === location.origin ? 'same-origin' : 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error('无法读取地址。请检查网络，并确认文件可直接访问且服务器允许跨域读取。');
  }
  if (!response.ok) throw new Error('文件地址返回 HTTP ' + response.status + '。');
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    throw new Error('此地址返回了网页。请粘贴 PDF、文本、JSON 或 CSV 文件的直链。');
  }
  if (Number(response.headers.get('Content-Length')) > maxBytes) {
    throw new Error('文件超过 256 MB，请拆分或使用完整版。');
  }
  const data = await response.blob();
  if (data.size > maxBytes) throw new Error('文件超过 256 MB，请拆分或使用完整版。');
  const name = decodeURIComponent(url.pathname.split('/').at(-1) || 'download');
  return new File([data], name, { type: data.type });
}
