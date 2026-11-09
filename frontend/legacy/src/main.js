import { createApp } from 'vue';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style/index.css';

window.CESIUM_BASE_URL = new URL('../cesium/', document.baseURI).href;
const { default: App } = await import('./App.vue');
createApp(App).mount('#app');
