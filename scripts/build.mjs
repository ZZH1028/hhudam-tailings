import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pages = process.argv.includes('--pages');
const windows = process.platform === 'win32';

if (pages) {
  const restricted = [
    'frontend/public/models/original_scene',
    'frontend/public/data/handbooks',
    'frontend/public/data/scene.json',
  ];
  for (const path of restricted) {
    if (existsSync(path)) throw new Error('Remove restricted project data before building GitHub Pages: ' + path);
  }
}

function run(command, args, shell = false) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(windows ? 'python' : 'python3', ['scripts/prepare_demo_assets.py']);
run('npm', ['--prefix', 'frontend', 'run', 'build', ...(pages ? ['--', '--mode', 'pages'] : [])], windows);

if (pages) {
  for (const name of ['index.html', 'shell.css', 'shell.js']) {
    copyFileSync('pages/' + name, 'dist/client/' + name);
  }
  writeFileSync('dist/client/.nojekyll', '');
} else {
  mkdirSync('dist/server', { recursive: true });
  copyFileSync('worker/index.js', 'dist/server/index.js');
  writeFileSync('dist/server/wrangler.json', JSON.stringify({
    main: 'index.js',
    compatibility_date: '2026-05-15',
    assets: { directory: '../client', binding: 'ASSETS' },
  }, null, 2) + '\n');
}
