<template>
  <div class="ai-window-container pointer-auto"
       :class="{ 'minimized': isMinimized }"
       v-if="isShow">

    <div class="ai-window transparent-hud" v-show="!isMinimized">
      <div class="ai-header">
        <span class="ai-header-title">水利AI助手</span>
        <div class="ai-controls">
          <button class="win-btn min" @click="isMinimized = true" title="收起">─</button>
          <button class="win-btn close" @click="onClose" title="关闭">✕</button>
        </div>
      </div>

      <div class="ai-body-wrapper force-hologram">
        <AiChat />
      </div>
    </div>
    <div class="ai-minimized-pill" v-show="isMinimized" @click="isMinimized = false">
      <div class="pulse-ring"></div>
      <span class="robot-icon">🤖</span>
      <span class="pill-text">AI</span>
    </div>
  </div>
</template>

<script setup>
import { ref, provide, toRef } from 'vue';
import AiChat from './AiChat.vue';

const props = defineProps(['isShow', 'cesiumViewer']);
const emit = defineEmits(['close']);

// 向AiChat注入Cesium实例
provide('cesiumViewer', toRef(props, 'cesiumViewer'));

const isMinimized = ref(false);

const onClose = () => {
  emit('close');
};
</script>

<style scoped>
.ai-window-container {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 200;
  transition: all 0.3s;
  pointer-events: none;
}
.ai-window.transparent-hud {
  width: 360px;
  height: 500px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  pointer-events: auto;
  position: relative;
}
.ai-header {
  height: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent !important;
  border-bottom: none !important;
  box-shadow: none !important;
  padding: 0 15px;
  flex-shrink: 0;
}
.ai-header-title {
  font-size: 14px;
  color: #00f0ff;
  font-weight: bold;
  letter-spacing: 1px;
  text-shadow: 0 0 5px rgba(0, 240, 255, 0.5);
}
.ai-controls { display: flex; gap: 8px; }
.win-btn {
  color: #fff;
  background: rgba(0, 240, 255, 0.2);
  border: 1px solid rgba(0, 240, 255, 0.5);
  cursor: pointer;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
  font-weight: bold;
  transition: all 0.2s;
  text-shadow: 0 1px 2px #000;
}
.win-btn.min { font-size: 12px; }
.win-btn.close { font-size: 14px; }
.win-btn:hover {
  background: #00f0ff;
  color: #000;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
}
.ai-body-wrapper.force-hologram {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: linear-gradient(180deg, rgba(4, 28, 50, 0.3) 0%, rgba(4, 28, 50, 0) 100%);
}
.force-hologram :deep(.chatbot-header) { display: none !important; }
.force-hologram :deep(.chatbot-container) { background: transparent !important; box-shadow: none !important; }
.force-hologram :deep(.bubble) {
  background: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
  color: #fff !important;
}
.force-hologram :deep(.content) {
  text-shadow: 0 1px 4px rgba(0,0,0,1);
  font-weight: 500;
}
.force-hologram :deep(.role-label) { color: rgba(0, 240, 255, 0.8) !important; text-shadow: 1px 1px 1px #000; }
.force-hologram :deep(.message-item.user .content) { color: #fff !important; }
.force-hologram :deep(.message-item.assistant .content) { color: #00f0ff !important; }
.force-hologram :deep(.messages)::-webkit-scrollbar { display: none; }
.force-hologram :deep(.messages) { scrollbar-width: none; }
.force-hologram :deep(.input-area) {
  background: rgba(0, 0, 0, 0.4) !important;
  border-top: 1px solid rgba(0, 240, 255, 0.3) !important;
}
.force-hologram :deep(textarea) {
  background: transparent !important;
  border: none !important;
  color: #fff !important;
}
.force-hologram :deep(textarea)::placeholder { color: rgba(255,255,255,0.4); }
.ai-minimized-pill {
  position: fixed;
  bottom: 30px;
  right: 30px;
  display: flex; align-items: center; gap: 10px;
  background: rgba(4, 18, 30, 0.9); border: 1px solid #00f0ff;
  padding: 12px 25px; border-radius: 30px; cursor: pointer;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.3); pointer-events: auto;
  z-index: 201;
}
.ai-minimized-pill:hover { transform: scale(1.05); box-shadow: 0 0 25px rgba(0, 240, 255, 0.6); }
.pill-text { color: #00f0ff; font-weight: bold; }
</style>
