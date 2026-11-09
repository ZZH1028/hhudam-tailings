<template>
  <div class="function-area pointer-auto">
    <button class="menu-btn" :class="{ active: !isMenuOpen }" @click="isMenuOpen = !isMenuOpen">
      <span class="icon">⚙️</span> 功能菜单
    </button>

    <transition name="slide-down">
      <div class="menu-dropdown glass-panel" v-if="isMenuOpen">
        <div class="menu-scroll-content">
          <!-- 水利AI助手 -->
          <div class="menu-group">
            <div class="group-header no-arrow">
              <span>水利AI助手 / AI Assistant</span>
              <div class="switch-wrapper">
                <input type="checkbox" id="cb_ai" v-model="panels.aiAssistant">
                <label for="cb_ai" class="toggle-switch"></label>
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <!-- 文件资料中心 -->
          <div class="menu-group">
            <div class="group-header no-arrow">
              <span>文件资料中心 / Documents</span>
              <div class="switch-wrapper">
                <input type="checkbox" id="cb_fileCenter" v-model="panels.fileCenter">
                <label for="cb_fileCenter" class="toggle-switch"></label>
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <!-- 受灾区域添加 -->
          <div class="menu-group">
            <div class="group-header no-arrow">
              <span>受灾区域 / Disaster Areas</span>
              <div class="switch-wrapper">
                <input type="checkbox" id="cb_disasterArea" v-model="panels.disasterArea">
                <label for="cb_disasterArea" class="toggle-switch"></label>
              </div>
            </div>
            <div class="coord-display" v-if="panels.disasterArea">
              <button
                class="action-btn"
                :class="{ 'btn-success': disasterAreaActive }"
                @click="toggleDisasterArea"
              >
                {{ disasterAreaActive ? '📍 停止绘制' : '🎯 开始绘制区域' }}
              </button>
              <button
                v-if="disasterAreaActive"
                class="action-btn btn-warning"
                style="margin-top: 6px;"
                @click="finishCurrentArea"
              >
                ✅ 闭合当前区域
              </button>
              <button
                v-if="disasterAreas.length > 0"
                class="action-btn btn-danger"
                style="margin-top: 6px;"
                @click="clearAllDisasterAreas"
              >
                🗑️ 清除所有区域
              </button>
              <div class="coord-info" v-if="disasterAreas.length > 0">
                <div class="disaster-area-item" v-for="(area, idx) in disasterAreas" :key="area.id">
                  <div class="area-header">
                    <span class="area-num">区域 {{ area.id }}</span>
                    <button class="delete-area-btn" @click="deleteDisasterArea(area.id)">×</button>
                  </div>
                  <div class="area-info">
                    <div class="info-row">
                      <span class="info-label">面积:</span>
                      <span class="info-value">{{ area.area.toFixed(2) }} m²</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">编号:</span>
                      <input
                        type="text"
                        class="area-input"
                        :value="area.info.编号"
                        @input="updateAreaInfo(area.id, '编号', $event.target.value)"
                        placeholder="请输入编号"
                      >
                    </div>
                    <div class="info-row">
                      <span class="info-label">房屋数量:</span>
                      <input
                        type="text"
                        class="area-input"
                        :value="area.info.房屋数量"
                        @input="updateAreaInfo(area.id, '房屋数量', $event.target.value)"
                        placeholder="请输入数量"
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div class="coord-info coord-empty" v-else>
                <span>点击"开始绘制区域"后在地图上点击添加顶点</span>
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <!-- 测量工具 -->
          <div class="menu-group">
            <div class="group-header no-arrow">
              <span>测量 / Measurement</span>
              <div class="switch-wrapper">
                <input type="checkbox" id="cb_measure" v-model="panels.measure">
                <label for="cb_measure" class="toggle-switch"></label>
              </div>
            </div>
            <div class="coord-display" v-if="panels.measure">
              <button
                class="action-btn"
                :class="{ 'btn-success': measureActive }"
                @click="toggleMeasure"
              >
                {{ measureActive ? '📍 停止测量' : '🎯 开始测量' }}
              </button>
              <button
                v-if="measureActive && measurePoints.length > 0"
                class="action-btn btn-danger"
                style="margin-top: 6px;"
                @click="clearMeasure"
              >
                🗑️ 清除测量
              </button>
              <div class="coord-info" v-if="measurePoints.length > 0">
                <div class="measure-point" v-for="(pt, idx) in measurePoints" :key="idx">
                  <div class="point-header">
                    <span class="point-num">点 {{ idx + 1 }}</span>
                  </div>
                  <div class="point-coords">
                    <div class="coord-item">
                      <span class="coord-label">经度</span>
                      <span class="coord-value">{{ pt.longitude.toFixed(6) }}°</span>
                    </div>
                    <div class="coord-item">
                      <span class="coord-label">纬度</span>
                      <span class="coord-value">{{ pt.latitude.toFixed(6) }}°</span>
                    </div>
                    <div class="coord-item">
                      <span class="coord-label">高程</span>
                      <span class="coord-value">{{ (pt.height - 16.5).toFixed(2) }} m</span>
                    </div>
                  </div>
                </div>
                <div class="total-row" v-if="measurePoints.length >= 2">
                  <span class="total-label">总距离</span>
                  <span class="total-distance">{{ totalDistance.toFixed(2) }} m</span>
                </div>
              </div>
              <div class="coord-info coord-empty" v-else>
                <span>点击"开始测量"后在地图上点击添加点</span>
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <!-- 地图交互开关 -->
          <div class="menu-section">
            <button class="action-btn" :class="{ 'btn-danger': isInteractive }" @click="toggleInteraction">
              {{ isInteractive ? '🚫 禁用地图交互' : '✅ 启用地图交互' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps([
  'panels',
  'isInteractive',
  'measurePoints',
  'measureActive',
  'totalDistance',
  'disasterAreas',
  'disasterAreaActive'
]);

const emit = defineEmits([
  'update:panels',
  'toggleInteraction',
  'toggle-measure',
  'clear-measure',
  'toggle-disaster-area',
  'finish-disaster-area',
  'clear-disaster-areas',
  'delete-disaster-area',
  'update-disaster-area-info'
]);

const isMenuOpen = ref(false);

const toggleInteraction = () => {
  emit('toggleInteraction');
};

const toggleMeasure = () => {
  emit('toggle-measure');
};

const clearMeasure = () => {
  emit('clear-measure');
};

const toggleDisasterArea = () => {
  emit('toggle-disaster-area');
};

const finishCurrentArea = () => {
  emit('finish-disaster-area');
};

const clearAllDisasterAreas = () => {
  emit('clear-disaster-areas');
};

const deleteDisasterArea = (areaId) => {
  emit('delete-disaster-area', areaId);
};

const updateAreaInfo = (areaId, field, value) => {
  emit('update-disaster-area-info', { areaId, field, value });
};
</script>

<style scoped>
.function-area { position: absolute; top: 20px; left: 20px; z-index: 101; }
.menu-btn { background: rgba(0, 40, 80, 0.8); color: #00f0ff; border: 1px solid #00f0ff; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.3s; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2); }
.menu-btn:hover, .menu-btn.active { background: rgba(0, 240, 255, 0.2); box-shadow: 0 0 20px rgba(0, 240, 255, 0.4); }
.menu-dropdown { margin-top: 10px; width: 240px; background: rgba(4, 18, 30, 0.95); border: 1px solid #007af5; border-radius: 4px; backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.menu-scroll-content { padding: 10px 0; max-height: 500px; overflow-y: auto; }
.menu-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 5px 15px; }
.menu-group { margin-bottom: 2px; }
.group-header { padding: 10px 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #ccc; font-size: 14px; font-weight: bold; transition: 0.3s; }
.group-header:hover { color: #fff; background: rgba(0, 240, 255, 0.1); }
.group-header.no-arrow { cursor: default; }
.menu-section { padding: 10px 15px; }
.action-btn { width: 100%; padding: 8px; border: 1px solid #00f0ff; background: transparent; color: #00f0ff; border-radius: 4px; cursor: pointer; font-size: 12px; transition: 0.3s; }
.action-btn:hover { background: rgba(0,240,255,0.1); }
.action-btn.btn-danger { border-color: #ff4444; color: #ff4444; }
.action-btn.btn-danger:hover { background: rgba(255, 68, 68, 0.1); }
.switch-wrapper { display: flex; align-items: center; }
.switch-wrapper input { display: none; }
.toggle-switch { width: 36px; height: 18px; background: #333; border-radius: 9px; position: relative; cursor: pointer; transition: 0.3s; }
.toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: 0.3s; }
input:checked + .toggle-switch { background: #00f0ff; }
input:checked + .toggle-switch::after { left: 20px; }
.coord-display { padding: 10px 15px; }
.coord-info { margin-top: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px; font-family: 'Courier New', monospace; }
.measure-point { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.measure-point:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.point-header { margin-bottom: 6px; }
.point-num { color: #ffcc00; font-size: 13px; font-weight: bold; }
.point-coords { padding-left: 8px; }
.coord-item { display: flex; justify-content: space-between; margin-bottom: 3px; }
.coord-item:last-child { margin-bottom: 0; }
.coord-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
.coord-row:last-child { margin-bottom: 0; }
.coord-row.header-row { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px; }
.coord-row.total-row { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; margin-top: 6px; }
.total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); }
.total-label { color: #ffcc00; font-size: 13px; font-weight: bold; }
.total-distance { color: #ff8800; font-size: 16px; font-weight: bold; }
.coord-label { color: #888; font-size: 12px; }
.coord-value { color: #00f0ff; font-size: 12px; font-weight: bold; }
.coord-value.total-distance { color: #ff8800; font-size: 14px; }
.coord-empty { text-align: center; color: #666; font-size: 11px; font-family: normal; }
.btn-success { border-color: #00ff88 !important; color: #00ff88 !important; }
.btn-success:hover { background: rgba(0,255,136,0.1) !important; }
.btn-warning { border-color: #ffaa00 !important; color: #ffaa00 !important; }
.btn-warning:hover { background: rgba(255,170,0,0.1) !important; }
.disaster-area-item { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.disaster-area-item:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.area-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.area-num { color: #ff6600; font-size: 13px; font-weight: bold; }
.delete-area-btn { background: rgba(255,68,68,0.2); border: 1px solid #ff4444; color: #ff4444; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.delete-area-btn:hover { background: rgba(255,68,68,0.4); }
.area-info { padding-left: 4px; }
.info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.info-row:last-child { margin-bottom: 0; }
.info-label { color: #888; font-size: 11px; }
.info-value { color: #ff6600; font-size: 12px; font-weight: bold; }
.area-input { background: rgba(0,0,0,0.3); border: 1px solid #444; color: #00f0ff; padding: 2px 6px; border-radius: 3px; font-size: 11px; width: 80px; }
.area-input:focus { border-color: #00f0ff; outline: none; }
.area-input::placeholder { color: #555; }
</style>