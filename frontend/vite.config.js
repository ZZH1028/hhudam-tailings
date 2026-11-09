import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [vue(), {
    name: 'copy-cesium-runtime',
    closeBundle() {
      const destination = resolve('../dist/client/engineering/cesium');
      mkdirSync(destination, { recursive: true });
      for (const directory of ['Assets', 'Widgets', 'Workers', 'ThirdParty']) {
        cpSync(resolve('node_modules/cesium/Build/Cesium', directory), resolve(destination, directory), { recursive: true });
      }
      cpSync('node_modules/cesium/LICENSE.md', resolve(destination, 'LICENSE.md'));
      const pdfSource = resolve('node_modules/pdfjs-dist');
      const pdfDestination = resolve('../dist/client/engineering/vendor/pdfjs');
      mkdirSync(pdfDestination, { recursive: true });
      for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
        cpSync(resolve(pdfSource, directory), resolve(pdfDestination, directory), { recursive: true });
      }
      for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
        cpSync(resolve(pdfSource, 'legacy/build', file), resolve(pdfDestination, file));
      }
      cpSync(resolve(pdfSource, 'LICENSE'), resolve(pdfDestination, 'LICENSE'));
    },
  }],
  build: {
    outDir: '../dist/client/engineering',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4500,
    rollupOptions: mode === 'pages' ? {
      input: [resolve('index.html'), resolve('legacy/index.html')],
    } : undefined,
  },
}));
