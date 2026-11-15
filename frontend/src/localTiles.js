import { assetUrl } from './browserData.js';

const extensions = /\.(json|b3dm|i3dm|pnts|cmpt|glb|gltf|bin|png|jpe?g|webp|ktx2|subtree|avif)$/i;
const getDatabase = () => import(/* @vite-ignore */ assetUrl('local-tiles-db.js'));
let workerReady;

export function modelTileUrl(model) {
  const path = model.tileset.split('/').map(encodeURIComponent).join('/');
  return assetUrl('local-tiles/' + model.id + '/' + path);
}

export async function listTileModels() {
  const database = await getDatabase();
  return (await database.listTileModels()).map(model => ({ ...model, url: modelTileUrl(model) }));
}

export function connectTileWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('当前浏览器无法打开本地 3D Tiles。请使用 Chrome 或 Edge 访问 HTTPS 网页。');
  }
  if (!workerReady) workerReady = prepareWorker().catch(error => { workerReady = null; throw error; });
  return workerReady;
}

async function prepareWorker() {
  const script = assetUrl('local-tiles-worker.js');
  const workers = navigator.serviceWorker;
  await workers.register(script, { scope: assetUrl('./'), type: 'module' });
  if (workers.controller?.scriptURL === script) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      workers.removeEventListener('controllerchange', check);
      reject(new Error('浏览器尚未启用本地瓦片读取，请刷新后重试。'));
    }, 10000);
    function check() {
      if (workers.controller?.scriptURL !== script) return;
      clearTimeout(timer);
      workers.removeEventListener('controllerchange', check);
      resolve();
    }
    workers.addEventListener('controllerchange', check);
    check();
  });
}

export async function addTileDirectory(input, name) {
  const files = Array.from(input || []).filter(file => extensions.test(file.name)).map(file => ({
    path: file.webkitRelativePath.split('/').slice(1).join('/'),
    file,
  }));
  const root = files.filter(({ path }) => /(^|\/)tileset\.json$/i.test(path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
  if (!root) throw new Error('请选择包含 tileset.json 和瓦片文件的模型文件夹。');
  const tileset = JSON.parse(await root.file.text());
  if (!tileset.asset || !tileset.root) throw new Error('tileset.json 缺少 3D Tiles 资产或根节点。');
  if (files.reduce((size, entry) => size + entry.file.size, 0) > 512 * 1024 * 1024) {
    throw new Error('本地模型文件夹超过 512 MB，请使用 HTTPS 瓦片地址。');
  }
  const model = {
    id: crypto.randomUUID(), kind: 'tileset', name: name || root.file.webkitRelativePath.split('/')[0],
    description: '本机导入的 3D Tiles 实景模型', tileset: root.path,
  };
  const database = await getDatabase();
  await database.storeTileModel(model, files);
  return { ...model, url: modelTileUrl(model) };
}
