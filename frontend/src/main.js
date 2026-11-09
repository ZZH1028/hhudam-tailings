import { createApp } from 'vue';
import App from './App.vue';

// Cesium resolves worker and texture assets after a lazy import of the scene.
window.CESIUM_BASE_URL = new URL('cesium/', document.baseURI).href;
createApp(App).mount('#app');
