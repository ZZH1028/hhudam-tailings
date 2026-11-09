<template>
  <div class="chat-float">
    <div class="chatbot-container">
      <div class="chatbot-body">
        <div class="messages">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="message-item"
            :class="msg.role"
          >
            <div class="bubble">
              <span class="role-label">{{
                msg.role === 'user' ? '我' : msg.role === 'assistant' ? 'AI' : '系统'
              }}</span>
              <p class="content">{{ msg.content }}</p>
            </div>
          </div>

          <div v-if="isLoading" class="message-item assistant">
            <div class="bubble">
              <span class="role-label">AI</span>
              <p class="content">思考中...</p>
            </div>
          </div>
        </div>

        <div class="input-area">
          <textarea
            v-model="inputMessage"
            class="message-input"
            placeholder="输入问题（可直接问资料：比如“某某应急预案里怎么写？”）..."
            rows="3"
            @keydown.enter.exact.prevent="sendMessage"
          ></textarea>

          <div class="input-toolbar">
            <div class="network-switch-wrap">
              <span class="network-label">联网</span>
              <button
                class="network-switch"
                :class="{ active: networkEnabled }"
                type="button"
                @click="networkEnabled = !networkEnabled"
                :disabled="isLoading"
                :title="networkEnabled ? '当前为联网模式' : '当前为不联网模式'"
              >
                <span class="switch-track">
                  <span class="switch-thumb"></span>
                </span>
                <span class="switch-text">{{ networkEnabled ? '已开启' : '已关闭' }}</span>
              </button>
            </div>

            <button
              class="send-btn"
              :disabled="isLoading || !inputMessage.trim()"
              @click="sendMessage"
            >
              {{ isLoading ? '...' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, unref } from 'vue';
import * as CesiumLib from 'cesium';
import { callDeepSeek } from '../../services/deepseek';

// 从父组件注入 Cesium Viewer（AiWindow 提供的是 toRef，所以这里可能是 ref）
const injectedViewer = inject('cesiumViewer', null);

const inputMessage = ref('');
const isLoading = ref(false);
const networkEnabled = ref(true);

const messages = ref([
  {
    role: 'system',
    content:
      '回答时优先使用“我的资料库”（文件中心已索引的资料），并在需要时结合通用知识。若资料库无相关信息，请明确说明。'
  }
]);

/**
 * 地球飞行
 * 保持单独封装，避免影响原有逻辑
 */
function flyToLocation(lng, lat, height = 3500) {
  const v = unref(injectedViewer);
  if (!v || lng == null || lat == null) return;

  const longitude = Number(lng);
  const latitude = Number(lat);
  const flyHeight = Number(height);

  if (
    Number.isNaN(longitude) ||
    Number.isNaN(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return;
  }

  v.camera.flyTo({
    destination: CesiumLib.Cartesian3.fromDegrees(
      longitude,
      latitude,
      Number.isNaN(flyHeight) ? 3500 : flyHeight
    ),
    duration: 2
  });
}

/**
 * 兼容原有固定地点定位（保留原功能）
 */
function tryHandleMapCommand(content) {
  const v = unref(injectedViewer);
  if (!v) return false;

  if (content.includes('定位扎子沟')) {
    flyToLocation(111.523933885389, 33.8675309497597, 3500);
    return true;
  } else if (content.includes('定位瑶岗仙尾矿库')) {
    flyToLocation(113.3048939516, 25.6277668963, 3500);
    return true;
  } else if (content.includes('定位河海大学西康路校区')) {
    flyToLocation(118.75, 32.06, 3500);
    return true;
  }

  return false;
}

/**
 * 判断是否是“前往某地 / 去某地 / 飞到某地 / 定位某地”类指令
 * 这里只做识别，不改变原有问答功能
 */
function isGoToPlaceCommand(content) {
  if (!content) return false;

  const text = content.trim();

  const patterns = [
    /^前往.+/,
    /^去.+/,
    /^飞到.+/,
    /^飞往.+/,
    /^定位.+/,
    /^跳转到.+/,
    /^移动到.+/
  ];

  return patterns.some((reg) => reg.test(text));
}

/**
 * 从用户输入中提取地点名
 * 例如：
 * - 前往北京
 * - 去三峡大坝
 * - 飞到河海大学西康路校区
 */
function extractPlaceName(content) {
  if (!content) return '';

  const text = content.trim();

  const match = text.match(/^(前往|去|飞到|飞往|定位|跳转到|移动到)\s*(.+)$/);
  if (!match) return '';

  return (match[2] || '').trim();
}

/**
 * 尝试从后端回复中提取经纬度
 * 为了不改你原有后端返回结构，这里做多格式兼容：
 *
 * 1. reply.location = { longitude, latitude, height }
 * 2. reply.data = { longitude, latitude, height }
 * 3. reply.coordinates = { lng, lat, height }
 * 4. reply.content 是 JSON 字符串
 * 5. reply.content 文本里包含：
 *    经度: 118.78 纬度: 32.04
 *    longitude: 118.78, latitude: 32.04
 */
function extractCoordinatesFromReply(reply) {
  if (!reply) return null;

  // 1) reply.location
  if (reply.location && typeof reply.location === 'object') {
    const lng =
      reply.location.longitude ??
      reply.location.lng ??
      reply.location.lon ??
      reply.location.x;
    const lat =
      reply.location.latitude ??
      reply.location.lat ??
      reply.location.y;
    const height = reply.location.height ?? reply.location.alt ?? 3500;

    if (lng != null && lat != null) {
      return { lng: Number(lng), lat: Number(lat), height: Number(height) };
    }
  }

  // 2) reply.data
  if (reply.data && typeof reply.data === 'object') {
    const lng =
      reply.data.longitude ??
      reply.data.lng ??
      reply.data.lon ??
      reply.data.x;
    const lat =
      reply.data.latitude ??
      reply.data.lat ??
      reply.data.y;
    const height = reply.data.height ?? reply.data.alt ?? 3500;

    if (lng != null && lat != null) {
      return { lng: Number(lng), lat: Number(lat), height: Number(height) };
    }
  }

  // 3) reply.coordinates
  if (reply.coordinates && typeof reply.coordinates === 'object') {
    const lng =
      reply.coordinates.longitude ??
      reply.coordinates.lng ??
      reply.coordinates.lon ??
      reply.coordinates.x;
    const lat =
      reply.coordinates.latitude ??
      reply.coordinates.lat ??
      reply.coordinates.y;
    const height = reply.coordinates.height ?? reply.coordinates.alt ?? 3500;

    if (lng != null && lat != null) {
      return { lng: Number(lng), lat: Number(lat), height: Number(height) };
    }
  }

  // 4) reply.content 如果是 JSON 字符串
  if (typeof reply.content === 'string') {
    const content = reply.content.trim();

    if (content.startsWith('{') && content.endsWith('}')) {
      try {
        const obj = JSON.parse(content);

        const lng =
          obj.longitude ??
          obj.lng ??
          obj.lon ??
          obj.x ??
          obj?.location?.longitude ??
          obj?.location?.lng;
        const lat =
          obj.latitude ??
          obj.lat ??
          obj.y ??
          obj?.location?.latitude ??
          obj?.location?.lat;
        const height =
          obj.height ??
          obj.alt ??
          obj?.location?.height ??
          3500;

        if (lng != null && lat != null) {
          return { lng: Number(lng), lat: Number(lat), height: Number(height) };
        }
      } catch (e) {
        // 忽略 JSON 解析失败，继续尝试正则提取
      }
    }

    // 5) 从普通文本中正则提取经纬度
    const lngMatch =
      content.match(/(?:经度|longitude|lng|lon)\s*[:：]\s*(-?\d+(?:\.\d+)?)/i) ||
      content.match(/"?(?:longitude|lng|lon)"?\s*[:：]\s*(-?\d+(?:\.\d+)?)/i);

    const latMatch =
      content.match(/(?:纬度|latitude|lat)\s*[:：]\s*(-?\d+(?:\.\d+)?)/i) ||
      content.match(/"?(?:latitude|lat)"?\s*[:：]\s*(-?\d+(?:\.\d+)?)/i);

    const heightMatch =
      content.match(/(?:高度|height|alt)\s*[:：]\s*(-?\d+(?:\.\d+)?)/i) ||
      content.match(/"?(?:height|alt)"?\s*[:：]\s*(-?\d+(?:\.\d+)?)/i);

    if (lngMatch && latMatch) {
      return {
        lng: Number(lngMatch[1]),
        lat: Number(latMatch[1]),
        height: heightMatch ? Number(heightMatch[1]) : 3500
      };
    }
  }

  return null;
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const content = inputMessage.value.trim();
  inputMessage.value = '';
  messages.value.push({ role: 'user', content });
  isLoading.value = true;

  try {
    // 1) 地图关键词定位（保留原逻辑）
    const handledByLocalMap = tryHandleMapCommand(content);

    // 2) 判断是否是“前往某地”类指令
    const isPlaceCommand = isGoToPlaceCommand(content);
    const placeName = extractPlaceName(content);

    // 3) 直接把消息发给后端（保留原逻辑）
    // 联网开启：后端走联网模式
    // 联网关闭：后端自动走本地知识库检索后回答
    const reply = await callDeepSeek(messages.value, {
      networkEnabled: networkEnabled.value,
      // 下面这些字段是新增的，但不会影响原功能
      action: isPlaceCommand ? 'goto_place' : 'chat',
      placeName: isPlaceCommand ? placeName : '',
      needCoordinates: isPlaceCommand
    });

    // 4) 保留原有显示回复逻辑
    messages.value.push({
      role: reply?.role || 'assistant',
      content: reply?.content || '暂无回复'
    });

    // 5) 如果本地没处理，尝试根据后端返回经纬度飞行
    //    这样“前往某地”就能由后端 DeepSeek 返回坐标后驱动地球飞行
    if (!handledByLocalMap) {
      const coords = extractCoordinatesFromReply(reply);
      if (coords) {
        flyToLocation(coords.lng, coords.lat, coords.height);
      }
    }
  } catch (e) {
    console.error(e);
    messages.value.push({ role: 'assistant', content: '服务连接失败' });
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.chat-float {
  width: 100%;
  height: 100%;
  position: relative;
}

.chatbot-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.chatbot-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.message-item {
  display: flex;
  margin-bottom: 15px;
}

.message-item.user {
  justify-content: flex-end;
}

.message-item.assistant,
.message-item.system {
  justify-content: flex-start;
}

.bubble {
  max-width: 90%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.role-label {
  font-size: 10px;
  color: #8fdfff;
  margin-bottom: 4px;
  display: block;
}

.content {
  font-size: 14px;
  margin: 0;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}

.input-area {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message-input {
  resize: none;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 240, 255, 0.18);
  background: rgba(255, 255, 255, 0.10);
  color: #fff;
  outline: none;
  transition: all 0.2s;
}

.message-input:focus {
  border-color: rgba(0, 240, 255, 0.45);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
}

.message-input::placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.network-switch-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.network-label {
  font-size: 12px;
  color: #9be9ff;
  letter-spacing: 1px;
  font-weight: 700;
  text-shadow: 0 0 6px rgba(0, 240, 255, 0.25);
}

.network-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 12px 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(0, 240, 255, 0.26);
  background: rgba(0, 25, 40, 0.58);
  color: #c9f6ff;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.05);
}

.network-switch:hover {
  border-color: rgba(0, 240, 255, 0.42);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.12);
}

.network-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.network-switch.active {
  background: rgba(0, 80, 120, 0.55);
  border-color: rgba(0, 240, 255, 0.55);
  box-shadow: 0 0 14px rgba(0, 240, 255, 0.18);
}

.switch-track {
  position: relative;
  width: 42px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(0, 240, 255, 0.16);
  transition: all 0.25s ease;
}

.network-switch.active .switch-track {
  background: rgba(0, 240, 255, 0.18);
  border-color: rgba(0, 240, 255, 0.35);
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #c8f7ff;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.28);
  transition: all 0.25s ease;
}

.network-switch.active .switch-thumb {
  transform: translateX(20px);
  background: #00f0ff;
}

.switch-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.send-btn {
  align-self: flex-end;
  min-width: 88px;
  height: 34px;
  padding: 0 16px;
  background: linear-gradient(180deg, rgba(0, 180, 255, 0.55), rgba(0, 100, 180, 0.45));
  color: white;
  border: 1px solid rgba(0, 240, 255, 0.28);
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow: 0 0 10px rgba(0, 180, 255, 0.15);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
