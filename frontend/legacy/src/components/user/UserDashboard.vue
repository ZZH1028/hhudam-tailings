<template>
  <div class="dashboard-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <div class="ui-overlay pointer-none">
      <div class="hud-header">
        <div class="header-decoration"></div>
        <h1 class="header-title">尾矿库安全管理平台</h1>
        <div class="header-time">{{ currentTime }}</div>
      </div>

      <FunctionMenu
        :panels="panels"
        :open-menu-section="openMenuSection"
        :is-interactive="isInteractive"
        :measure-points="measurePoints"
        :measure-active="measureActive"
        :total-distance="totalDistance"
        :disaster-areas="disasterAreas"
        :disaster-area-active="disasterAreaActive"
        @update:panels="updatePanels"
        @update:open-menu-section="(val) => (openMenuSection = val)"
        @toggle-interaction="toggleInteraction"
        @toggle-measure="handleToggleMeasure"
        @clear-measure="handleClearMeasure"
        @toggle-disaster-area="handleToggleDisasterArea"
        @finish-disaster-area="handleFinishDisasterArea"
        @clear-disaster-areas="handleClearAllDisasterAreas"
        @delete-disaster-area="handleDeleteDisasterArea"
        @update-disaster-area-info="handleUpdateDisasterAreaInfo"
      />

      <div class="hud-panel left-panel pointer-auto">
        <!-- 左侧面板已清空（原 DamOverviewPanel 和 WaterLevelPanel 已移除） -->
      </div>

      <div class="hud-panel right-panel pointer-auto">
        <FileCenterPanel
          :is-show="panels.fileCenter"
          :dam-id="activeDamId"
          @close="panels.fileCenter = false"
          @requestFlyToDam="handleFlyToDam"
        />
      </div>

      <!-- 精准预报左侧面板 -->
      <div class="pf-side left pointer-auto" v-if="isForecastMode">
        <div class="pf-card">
          <div class="pf-head">
            <div class="pf-h-title">精准预报</div>
            <div class="pf-h-sub">
              <span v-if="pf.lastUpdated">更新时间：{{ pf.lastUpdated }}</span>
              <span v-else>—</span>
            </div>
          </div>

          <div class="pf-search">
            <input
              class="pf-input"
              v-model="pfCity"
              placeholder="输入城市，例如：郴州市 / 长沙市 / 广州市 / 北京市"
              @keyup.enter="loadPrecisionForecast(true)"
              :disabled="pfLoading"
            />
            <select class="pf-select" v-model="pfCountry" :disabled="pfLoading">
              <option value="CN">CN</option>
              <option value="">不限</option>
            </select>

            <button class="pf-btn" @click="loadPrecisionForecast(true)" :disabled="pfLoading || !pfCity.trim()">
              {{ pfLoading ? '加载中...' : '搜索' }}
            </button>

            <button class="pf-btn ghost" @click="useDemoCity" :disabled="pfLoading">
              示例：郴州市
            </button>
          </div>

          <div class="pf-msg" v-if="pfError">
            <span class="dot err"></span>
            <span>{{ pfError }}</span>
          </div>
          <div class="pf-msg ok" v-else-if="pfStatus">
            <span class="dot ok"></span>
            <span>{{ pfStatus }}</span>
          </div>

          <div class="pf-kv" v-if="pf.location">
            <div class="kv">
              <span class="k">定位</span>
              <span class="v">{{ pf.location.name }}（{{ pf.location.country }}）</span>
            </div>
            <div class="kv">
              <span class="k">坐标</span>
              <span class="v mono">{{ pf.location.latitude }}, {{ pf.location.longitude }}</span>
            </div>
            <div class="kv">
              <span class="k">单位</span>
              <span class="v">°C / km·h⁻¹ / mm</span>
            </div>
          </div>

          <div class="pf-now" v-if="pf.current">
            <div class="now-row">
              <div class="now-big">
                <div class="now-temp">{{ Math.round(pf.current.temperature_2m) }}°</div>
                <div class="now-desc">{{ weatherDesc(pf.current.weather_code) }}</div>
              </div>

              <div class="now-mini">
                <div class="mini">
                  <div class="k">湿度</div>
                  <div class="v">{{ valOrDash(pf.current.relative_humidity_2m, '%') }}</div>
                </div>
                <div class="mini">
                  <div class="k">风速</div>
                  <div class="v">{{ valOrDash(Math.round(pf.current.wind_speed_10m), ' km/h') }}</div>
                </div>
                <div class="mini">
                  <div class="k">气压</div>
                  <div class="v">{{ valOrDash(pf.current.surface_pressure, ' hPa') }}</div>
                </div>
                <div class="mini">
                  <div class="k">能见度</div>
                  <div class="v">{{ visibilityKm }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="pf-empty" v-else>
            请输入城市后点击“搜索”，即可加载天气数据。
          </div>
        </div>
      </div>

      <!-- 精准预报右侧面板 -->
      <div class="pf-side right pointer-auto" v-if="isForecastMode">
        <div class="pf-card">
          <div class="pf-head">
            <div class="pf-h-title">未来 7 天</div>
            <div class="pf-h-sub">文字摘要</div>
          </div>

          <div class="pf-empty" v-if="!pf.daily || pf.daily.length === 0">
            暂无数据
          </div>

          <div class="pf-list" v-else>
            <div class="pf-day" v-for="d in pf.daily" :key="d.date">
              <div class="d1">
                <span class="date">{{ d.weekday }} · {{ d.date }}</span>
                <span class="desc">{{ weatherDesc(d.weather_code) }}</span>
              </div>
              <div class="d2">
                <span class="t">{{ Math.round(d.temp_max) }}° / {{ Math.round(d.temp_min) }}°</span>
                <span class="m">降水 {{ d.precip_sum }} mm</span>
                <span class="m">风 {{ Math.round(d.wind_max) }} km/h</span>
              </div>
            </div>
          </div>

          <div class="pf-divider"></div>

          <div class="pf-head small">
            <div class="pf-h-title">未来 24 小时</div>
            <div class="pf-h-sub">前 24 条</div>
          </div>

          <div class="pf-empty" v-if="!pf.hourlyRows || pf.hourlyRows.length === 0">
            暂无数据
          </div>

          <div class="pf-hourly" v-else>
            <div class="hr" v-for="r in pf.hourlyRows.slice(0, 24)" :key="r.time">
              <span class="t mono">{{ r.time }}</span>
              <span class="w">{{ weatherDesc(r.weather_code) }}</span>
              <span class="v"><b>{{ Math.round(r.temp) }}°C</b></span>
              <span class="v">雨 {{ r.precip }} mm</span>
              <span class="v">风 {{ Math.round(r.wind) }} km/h</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 灾害预警面板 -->
      <DisasterWarningPanel
        :is-warning-mode="isWarningMode"
        v-model:activeType="currentWarningType"
      />
      <EmergencyPlanPanel v-if="isPlanMode" :is-plan-mode="isPlanMode" />

      <BottomNav
        :current-pre="currentPre"
        @update:current-pre="(val) => (currentPre = val)"
        @nav="handleNavChange"
        @openDisasterPanel="handleOpenDisasterPanel"
        @openEmergencyPlanPanel="handleOpenEmergencyPlanPanel"
      />

      <!-- 溃坝洪水演示入口 -->
      <div class="flood-entry pointer-auto" v-if="isDamBreakMode && !panels.floodSim">
        <button class="flood-btn" @click="openFloodSim">溃坝洪水演示</button>
      </div>

      <!-- 溃坝洪水演示面板 -->
      <div class="flood-panel pointer-auto" v-if="isDamBreakMode && panels.floodSim">
        <div class="flood-header">
          <div class="flood-title"><span class="flood-dot"></span>溃坝洪水过程演示</div>
          <button class="flood-close" @click="closeFloodSim">×</button>
        </div>

        <div class="flood-body">
          <div class="flood-row">
            <div class="flood-label">案例</div>
            <select class="flood-select" v-model="demoKey">
              <option value="preview_source_expand_20s">预览案例：水源扩散（高度+波浪，20秒）</option>
              <option value="none">无（等待真实洪水数据）</option>
            </select>
          </div>

          <div class="flood-hint">
            说明：该预览案例是“水源点→向外扩散→半径变大”，并且水面高度随时间起伏（波前+涟漪），同时叠加 Cesium Water 材质波纹。
          </div>

          <div class="flood-actions">
            <button class="flood-action-btn" @click="startFloodDemo" :disabled="floodBusy">
              {{ floodPlaying ? '重播' : '开始播放' }}
            </button>
            <button class="flood-action-btn" @click="toggleFloodDemo" :disabled="!floodReady">
              {{ floodPlaying ? '暂停' : '继续' }}
            </button>
            <button class="flood-action-btn danger" @click="stopFloodDemo" :disabled="!floodReady">
              停止并清理
            </button>
          </div>

          <div class="flood-row">
            <div class="flood-label">倍速</div>
            <input
              class="flood-range"
              type="range"
              min="1"
              max="40"
              step="1"
              v-model="floodSpeed"
              :disabled="!floodReady"
              @input="applyFloodSpeed"
            />
            <div class="flood-value">{{ floodSpeed }}x</div>
          </div>

          <div class="flood-status" v-if="floodStatus">{{ floodStatus }}</div>
        </div>
      </div>

      <AiWindow
        :is-show="panels.aiAssistant"
        :cesium-viewer="viewer"
        @close="panels.aiAssistant = false"
      />
    </div>
  </div>
</template>

<script>
import { fetchOriginal } from '../../originalApi.js';
import {
  defineComponent,
  ref,
  onMounted,
  onBeforeUnmount,
  nextTick,
  reactive,
  computed,
  watch
} from 'vue';

import * as CesiumLib from 'cesium';
import { initCesium, toggleMapInteraction, startMeasurement, stopMeasurement, clearMeasurement, startDrawingArea, stopDrawingArea, finishCurrentArea, clearAllAreas, removeDisasterAreaEntity, updateAreaInfo } from '../map/CesiumMap';
import { createFloodSimPlayer } from '../map/FloodSimPlayer';

import FunctionMenu from '../map/FunctionMenu.vue';
import BottomNav from '../nav/BottomNav.vue';
import AiWindow from '../ai/AiWindow.vue';
import FileCenterPanel from '../panels/FileCenterPanel.vue';
import DisasterWarningPanel from '../panels/DisasterWarning.vue';
import EmergencyPlanPanel from '../panels/EmergencyPlan.vue';

export default defineComponent({
  name: 'UserDashboard',
  components: {
    FunctionMenu,
    BottomNav,
    AiWindow,
    FileCenterPanel,
    DisasterWarningPanel,
    EmergencyPlanPanel
  },
  setup() {
    const currentTime = ref('');

    const panels = reactive({
      aiAssistant: true,
      fileCenter: false,
      floodSim: false,
      measure: false,
      disasterArea: false
    });

    const updatePanels = (val) => {
      if (val && typeof val === 'object') Object.assign(panels, val);
    };

    const activeDamId = ref(null);
    const openMenuSection = ref(null);
    const isInteractive = ref(true);
    const currentPre = ref('home');

    const isForecastMode = computed(() => String(currentPre.value || '') === 'forecast');
    const isWarningMode = computed(() => String(currentPre.value || '') === 'warning');
    const isPlanMode = computed(() => String(currentPre.value || '') === 'plan');

    const isDamBreakMode = computed(() => {
      const v = String(currentPre.value || '');
      const allow = new Set(['damBreak', 'break', 'breach', 'collapse', 'floodSim', 'breakSim', 'damBreakSim', 'kbpy']);
      return allow.has(v) || v.includes('break') || v.includes('breach') || v.includes('溃坝');
    });

    const viewer = ref(null);
    const measurePoints = ref([]);
    const measureActive = ref(false);
    const totalDistance = ref(0);
    const disasterAreas = ref([]);
    const disasterAreaActive = ref(false);

    const handleNavChange = (id) => {
      if (id !== 'damBreak') {
        panels.floodSim = false;
        stopFloodDemo();
      }
    };

    const handleOpenDisasterPanel = () => {
      currentPre.value = 'warning';
    };

    const handleOpenEmergencyPlanPanel = () => {
      currentPre.value = 'plan';
    };

    // 控制预警面板的模式（水质 / 坝体）
    const currentWarningType = ref('water');

    const demoKey = ref('preview_source_expand_20s');
    const floodStatus = ref('');
    const floodSpeed = ref(10);
    const floodPlaying = ref(false);
    const floodReady = ref(false);
    const floodBusy = ref(false);
    const floodPlayer = ref(null);

    const openFloodSim = () => {
      panels.floodSim = true;
      floodStatus.value = '';
    };

    const closeFloodSim = () => {
      panels.floodSim = false;
    };

    const stopFloodDemo = () => {
      if (floodPlayer.value) {
        floodPlayer.value.destroy();
        floodPlayer.value = null;
      }
      floodPlaying.value = false;
      floodReady.value = false;
      floodStatus.value = '已停止并清理洪水演示';
    };

    const applyFloodSpeed = () => {
      if (!floodPlayer.value) return;
      floodPlayer.value.setSpeed(Number(floodSpeed.value) || 1);
      floodStatus.value = `倍速已设置：${floodSpeed.value}x`;
    };

    const toggleFloodDemo = () => {
      if (!floodPlayer.value) return;
      if (floodPlaying.value) {
        floodPlayer.value.pause();
        floodPlaying.value = false;
        floodStatus.value = '已暂停';
      } else {
        floodPlayer.value.play();
        floodPlaying.value = true;
        floodStatus.value = '播放中...';
      }
    };

    const buildSourceExpandFrames20s = () => {
      const v = viewer.value;
      if (!v) return { frames: [], dt: 0.2 };

      const canvas = v.scene.canvas;
      const center = v.camera.pickEllipsoid(
        new CesiumLib.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
        v.scene.globe.ellipsoid
      );

      let lon0;
      let lat0;

      if (center) {
        const carto = CesiumLib.Cartographic.fromCartesian(center);
        lon0 = CesiumLib.Math.toDegrees(carto.longitude);
        lat0 = CesiumLib.Math.toDegrees(carto.latitude);
      } else {
        const carto = v.camera.positionCartographic;
        lon0 = CesiumLib.Math.toDegrees(carto.longitude);
        lat0 = CesiumLib.Math.toDegrees(carto.latitude);
      }

      const duration = 20.0;
      const dt = 0.2;
      const frames = [];
      const maxDepth = 6.0;
      const frontDepth = 3.0;
      const wavesAmp = 0.6;
      const wavesFreq = 2600.0;
      const wavesSpeed = 3.5;
      const R0 = 0.0025;
      const vR = 0.0012;
      const gridN = 90;

      for (let t = 0; t <= duration + 1e-6; t += dt) {
        const R = R0 + vR * t;
        const margin = 0.0018;
        const spanDeg = 2 * (R + margin);
        const step = spanDeg / (gridN - 1);
        const points = [];
        const sigma = Math.max(0.0007, R * 0.18);

        for (let r = 0; r < gridN; r++) {
          const lat = lat0 - spanDeg / 2 + r * step;
          for (let c = 0; c < gridN; c++) {
            const lon = lon0 - spanDeg / 2 + c * step;
            const dx = lon - lon0;
            const dy = lat - lat0;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const core = maxDepth * Math.exp(
              -(dist * dist) / Math.max(1e-10, (R * 0.55) * (R * 0.55))
            );

            const dFront = dist - R;
            const front = frontDepth * Math.exp(
              -(dFront * dFront) / Math.max(1e-10, 2 * sigma * sigma)
            );

            const phase = dist * wavesFreq - t * wavesSpeed * 60.0;
            const ripple = wavesAmp * Math.sin(phase);
            const mask = 1 / (1 + Math.exp((dist - (R + 0.0012)) / 0.00035));

            let depth = (core + front + ripple) * mask;
            if (depth < 0) depth = 0;
            points.push({ lon, lat, depth });
          }
        }

        frames.push({ t, points });
      }

      const firstR = R0 + vR * 2;
      const rect = CesiumLib.Rectangle.fromDegrees(
        lon0 - (firstR * 1.8),
        lat0 - (firstR * 1.8),
        lon0 + (firstR * 1.8),
        lat0 + (firstR * 1.8)
      );
      v.camera.flyTo({ destination: rect, duration: 1.0 });

      return { frames, dt };
    };

    const startFloodDemo = () => {
      if (floodBusy.value) return;
      floodBusy.value = true;

      try {
        if (!viewer.value) {
          floodStatus.value = '地图尚未初始化，请先登录并加载地图后再播放';
          return;
        }

        stopFloodDemo();

        if (demoKey.value === 'none') {
          floodStatus.value = '当前未选择演示案例';
          return;
        }

        viewer.value.clock.shouldAnimate = true;

        if (demoKey.value === 'preview_source_expand_20s') {
          const { frames, dt } = buildSourceExpandFrames20s();
          if (!frames.length) {
            floodStatus.value = '预览案例生成失败';
            return;
          }

          floodPlayer.value = createFloodSimPlayer(viewer.value, frames, {
            frameSeconds: dt,
            speed: Number(floodSpeed.value) || 10,
            baseHeight: 0,
            alpha: 0.8,
            water: {
              normalMap: CesiumLib.buildModuleUrl('Assets/Textures/waterNormals.jpg'),
              frequency: 1700.0,
              animationSpeed: 0.06,
              amplitude: 8.0,
              specularIntensity: 0.95,
              baseWaterColor: new CesiumLib.Color(0.02, 0.22, 0.35, 0.92),
              blendColor: new CesiumLib.Color(0.0, 0.78, 0.98, 0.38)
            },
            minVisibleDepth: 0
          });

          floodReady.value = true;
          floodPlayer.value.play();
          floodPlaying.value = true;
          floodStatus.value = '播放中：水源扩散（高度+波浪，20秒）';
        }
      } finally {
        floodBusy.value = false;
      }
    };

    watch(isDamBreakMode, (val) => {
      if (!val) {
        panels.floodSim = false;
        stopFloodDemo();
      }
    });

    let clockTimer = null;

    const toggleInteraction = () => {
      isInteractive.value = !isInteractive.value;
      toggleMapInteraction(viewer.value, isInteractive.value);
    };

    const handleCoordinateUpdate = (coords) => {
      coordinateData.value = coords;
    };

    const handleToggleCoordinatePicking = () => {
      if (coordinatePickingActive.value) {
        disableCoordinatePicking(viewer.value);
        coordinatePickingActive.value = false;
      } else {
        enableCoordinatePicking(viewer.value, handleCoordinateUpdate);
        coordinatePickingActive.value = true;
      }
    };

    const handleMeasureUpdate = (data) => {
      measurePoints.value = data.points;
      totalDistance.value = data.totalDistance;
    };

    const handleToggleMeasure = () => {
      if (measureActive.value) {
        stopMeasurement(viewer.value);
        measureActive.value = false;
      } else {
        startMeasurement(viewer.value, handleMeasureUpdate);
        measureActive.value = true;
      }
    };

    const handleClearMeasure = () => {
      clearMeasurement(viewer.value);
    };

    const handleDisasterAreaCallback = (data) => {
      if (data.type === 'add') {
        const exists = disasterAreas.value.find(a => a.id === data.area.id);
        if (!exists) {
          disasterAreas.value.push(data.area);
        }
      }
    };

    const handleToggleDisasterArea = () => {
      if (disasterAreaActive.value) {
        stopDrawingArea(viewer.value);
        disasterAreaActive.value = false;
      } else {
        startDrawingArea(viewer.value, handleDisasterAreaCallback);
        disasterAreaActive.value = true;
      }
    };

    const handleFinishDisasterArea = () => {
      if (!viewer.value || !disasterAreaActive.value) return;
      finishCurrentArea(viewer.value);
    };

    const handleClearAllDisasterAreas = () => {
      clearAllAreas(viewer.value);
      disasterAreas.value = [];
    };

    const handleDeleteDisasterArea = (areaId) => {
      removeDisasterAreaEntity(viewer.value, areaId);
      disasterAreas.value = disasterAreas.value.filter(a => a.id !== areaId);
    };

    const handleUpdateDisasterAreaInfo = ({ areaId, field, value }) => {
      const area = disasterAreas.value.find(a => a.id === areaId);
      if (area) {
        area.info[field] = value;
      }
      updateAreaInfo(viewer.value, areaId, field, value);
    };

    const startClock = () => {
      const updateTime = () => {
        const now = new Date();
        currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false });
      };
      updateTime();
      clockTimer = setInterval(updateTime, 1000);
    };

    const damConfig =
      (typeof window !== 'undefined' &&
        window.damConfig &&
        typeof window.damConfig === 'object')
        ? window.damConfig
        : {};

    const handleFlyToDam = (damId, options = {}) => {
      if (options.onlyClearFilter) {
        activeDamId.value = null;
        return;
      }
      if (!damId || !viewer.value) return;

      activeDamId.value = damId;
      const pos = damConfig[damId];
      if (!pos) return;

      const safeHeight = Math.max(Number(pos.height) || 2000, 6000);

      viewer.value.camera.flyTo({
        destination: CesiumLib.Cartesian3.fromDegrees(pos.lon, pos.lat, safeHeight),
        orientation: {
          heading: 0,
          pitch: CesiumLib.Math.toRadians(-45),
          roll: 0
        },
        duration: 1.6
      });
    };

    const pfCity = ref('郴州市');
    const pfCountry = ref('CN');

    const pf = reactive({
      lastUpdated: '',
      location: null,
      current: null,
      daily: [],
      hourlyRows: []
    });

    const pfLoading = ref(false);
    const pfStatus = ref('');
    const pfError = ref('');

    const valOrDash = (v, suffix = '') => {
      if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
      return `${v}${suffix}`;
    };

    const weatherDesc = (code) => {
      const c = Number(code);
      if (c === 0) return '晴';
      if (c === 1) return '大致晴';
      if (c === 2) return '多云';
      if (c === 3) return '阴';
      if (c === 45 || c === 48) return '雾';
      if (c >= 51 && c <= 57) return '毛毛雨';
      if (c >= 61 && c <= 67) return '雨';
      if (c >= 71 && c <= 77) return '雪';
      if (c >= 80 && c <= 82) return '阵雨';
      if (c >= 85 && c <= 86) return '阵雪';
      if (c >= 95) return '雷暴';
      return '未知';
    };

    const weekdayCN = (dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const ws = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return ws[d.getDay()];
    };

    const normalizeCityName = (name) => {
      return String(name || '')
        .trim()
        .replace(/\s+/g, '');
    };

    const buildCityCandidates = (name) => {
      const n = normalizeCityName(name);
      const set = new Set([n]);

      if (/[市区县盟州旗地区特别行政区]$/.test(n)) {
        set.add(n.replace(/(特别行政区|地区|自治州|盟|市|区|县|旗)$/g, ''));
      }

      return Array.from(set).filter(Boolean);
    };

    const formatDateTime = (input) => {
      const d = input ? new Date(input) : new Date();
      if (Number.isNaN(d.getTime())) return new Date().toLocaleString('zh-CN');
      return d.toLocaleString('zh-CN', { hour12: false });
    };

    const fetchJson = async (url) => {
      const resp = await fetchOriginal(url, { method: 'GET' });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `请求失败：${resp.status}`);
      }
      return resp.json();
    };

    const geocodeCity = async (name, countryCode) => {
      const candidates = buildCityCandidates(name);

      for (const keyword of candidates) {
        const params = new URLSearchParams({
          name: keyword,
          count: '10',
          language: 'zh',
          format: 'json'
        });

        if (countryCode) {
          params.set('countryCode', countryCode);
        }

        const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
        const results = Array.isArray(data?.results) ? data.results : [];

        if (!results.length) continue;

        const exact = results.find(
          (item) =>
            normalizeCityName(item?.name) === normalizeCityName(name) ||
            normalizeCityName(item?.name) === keyword
        );

        return exact || results[0];
      }

      throw new Error('未找到对应城市，请换一个更准确的城市名称再试');
    };

    const fetchWeatherByLocation = async (location) => {
      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        timezone: 'auto',
        forecast_days: '7',
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,visibility',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
        hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m'
      });

      return fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    };

    const buildDailyFromWeather = (w) => {
      const d = w?.daily || {};
      const dates = d.time || [];
      const tmax = d.temperature_2m_max || [];
      const tmin = d.temperature_2m_min || [];
      const p = d.precipitation_sum || [];
      const windMax = d.wind_speed_10m_max || [];
      const code = d.weather_code || [];

      const rows = [];
      for (let i = 0; i < dates.length; i++) {
        rows.push({
          date: dates[i],
          weekday: weekdayCN(dates[i]),
          temp_max: tmax[i],
          temp_min: tmin[i],
          precip_sum: p[i],
          wind_max: windMax[i],
          weather_code: code[i]
        });
      }
      return rows.slice(0, 7);
    };

    const buildHourlyFromWeather = (w) => {
      const h = w?.hourly || {};
      const times = h.time || [];
      const temps = h.temperature_2m || [];
      const prec = h.precipitation || [];
      const codes = h.weather_code || [];
      const wind = h.wind_speed_10m || [];

      const now = Date.now();
      const startIndex = times.findIndex((t) => new Date(t).getTime() >= now);
      const begin = startIndex >= 0 ? startIndex : 0;
      const end = begin + 24;

      const rows = [];
      for (let i = begin; i < Math.min(end, times.length); i++) {
        rows.push({
          time: String(times[i]).replace('T', ' '),
          temp: temps[i],
          precip: prec[i],
          weather_code: codes[i],
          wind: wind[i]
        });
      }
      return rows;
    };

    const loadPrecisionForecast = async (showStatus = false) => {
      const city = String(pfCity.value || '').trim();
      if (!city) return;

      pfLoading.value = true;
      pfError.value = '';
      if (showStatus) pfStatus.value = '正在加载天气数据...';

      try {
        const location = await geocodeCity(city, pfCountry.value || '');
        const w = await fetchWeatherByLocation(location);

        pf.lastUpdated = formatDateTime(w?.current?.time || new Date());
        pf.location = {
          name: location?.name || city,
          country: location?.country_code || pfCountry.value || '—',
          latitude: location?.latitude,
          longitude: location?.longitude
        };
        pf.current = w?.current || null;
        pf.daily = buildDailyFromWeather(w);
        pf.hourlyRows = buildHourlyFromWeather(w);
        pfStatus.value = '天气数据加载完成。';
      } catch (e) {
        pf.location = null;
        pf.current = null;
        pf.daily = [];
        pf.hourlyRows = [];
        pfError.value = e?.message || '天气加载失败';
        pfStatus.value = '';
      } finally {
        pfLoading.value = false;
      }
    };

    const useDemoCity = () => {
      pfCity.value = '郴州市';
      pfCountry.value = 'CN';
      loadPrecisionForecast(true);
    };

    const visibilityKm = computed(() => {
      if (!pf.current || pf.current.visibility == null) return '—';
      return `${(Number(pf.current.visibility) / 1000).toFixed(1)} km`;
    });

    watch(isForecastMode, (v) => {
      if (v && !pf.current) {
        loadPrecisionForecast(true);
      }
    });

    onMounted(async () => {
      await nextTick();
      try {
        viewer.value = await initCesium(
          'cesiumContainer',
          import.meta.env.VITE_CESIUM_ION_TOKEN,
          4617247
        );
        startClock();
      } catch (err) {
        console.error('[UserDashboard] Cesium 初始化失败：', err);
      }
    });

    onBeforeUnmount(() => {
      stopFloodDemo();

      if (viewer.value && viewer.value.__appResizeHandler) {
        window.removeEventListener('resize', viewer.value.__appResizeHandler);
      }

      if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.destroy();
      }

      if (clockTimer) clearInterval(clockTimer);
    });

    return {
      currentTime,
      panels,
      updatePanels,
      openMenuSection,
      isInteractive,
      toggleInteraction,
      measurePoints,
      measureActive,
      totalDistance,
      handleToggleMeasure,
      handleClearMeasure,
      disasterAreas,
      disasterAreaActive,
      handleToggleDisasterArea,
      handleFinishDisasterArea,
      handleClearAllDisasterAreas,
      handleDeleteDisasterArea,
      handleUpdateDisasterAreaInfo,
      currentPre,
      isForecastMode,
      isWarningMode,
      isPlanMode,
      viewer,
      activeDamId,
      handleFlyToDam,
      isDamBreakMode,
      demoKey,
      openFloodSim,
      closeFloodSim,
      startFloodDemo,
      toggleFloodDemo,
      stopFloodDemo,
      floodStatus,
      floodSpeed,
      floodPlaying,
      floodReady,
      floodBusy,
      applyFloodSpeed,
      pfCity,
      pfCountry,
      pf,
      pfLoading,
      pfStatus,
      pfError,
      loadPrecisionForecast,
      useDemoCity,
      weatherDesc,
      valOrDash,
      visibilityKm,
      handleNavChange,
      handleOpenDisasterPanel,
      handleOpenEmergencyPlanPanel,
      currentWarningType
    };
  }
});
</script>

<style scoped>
.dashboard-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.cesium-container {
  position: relative;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 50% 10%, rgba(0, 220, 255, 0.08), rgba(0, 0, 0, 0) 35%),
    linear-gradient(180deg, #02070d 0%, #07111c 42%, #0a2036 100%);
}

.cesium-container::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background:
    radial-gradient(circle at 50% 0%, rgba(0, 255, 255, 0.08), rgba(0, 0, 0, 0) 32%),
    linear-gradient(90deg, rgba(0, 180, 255, 0.03), rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 0) 80%, rgba(0, 180, 255, 0.03));
}

#cesiumContainer,
.cesium-viewer,
.cesium-viewer-cesiumWidgetContainer,
.cesium-widget,
.cesium-widget canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
}

.ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  padding: 0;
  display: flex;
  justify-content: space-between;
}

.pointer-none { pointer-events: none; }
.pointer-auto { pointer-events: auto; }

.hud-header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  background: linear-gradient(180deg, rgba(0, 10, 20, 0.9) 0%, rgba(0, 10, 20, 0) 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  z-index: 20;
}

.header-title {
  color: #fff;
  font-size: 28px;
  letter-spacing: 3px;
  font-weight: bold;
  text-shadow: 0 0 10px #00f0ff;
  position: relative;
  z-index: 2;
  margin-top: 10px;
}

.header-decoration {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 60px;
  background: rgba(0, 40, 80, 0.6);
  clip-path: polygon(0 0, 100% 0, 95% 100%, 5% 100%);
  border-bottom: 2px solid #00f0ff;
  box-shadow: 0 5px 20px rgba(0, 240, 255, 0.2);
}

.header-time {
  position: absolute;
  right: 30px;
  top: 20px;
  color: #00f0ff;
  font-family: monospace;
  font-size: 20px;
  font-weight: bold;
}

.hud-panel {
  width: 380px;
  height: calc(100% - 100px);
  margin-top: 70px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px;
  pointer-events: none;
}
.left-panel { align-items: flex-start; }
.right-panel { align-items: flex-end; }
.hud-panel > * { pointer-events: auto; width: 100%; }

.pf-side {
  position: absolute;
  top: 90px;
  width: 420px;
  height: calc(100% - 150px);
  z-index: 60;
  pointer-events: auto;
}
.pf-side.left { left: 0; }
.pf-side.right { right: 20px; }

.pf-card {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 180, 255, 0.25);
  background: rgba(10, 18, 28, 0.40);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
  color: #e7f6ff;
}

.pf-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.pf-head.small {
  border-bottom: none;
  padding-bottom: 6px;
  margin-top: 10px;
}
.pf-h-title {
  font-weight: 900;
  color: #e7f6ff;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.25);
  letter-spacing: 1px;
}
.pf-h-sub {
  font-size: 12px;
  color: rgba(231, 246, 255, 0.65);
}

.pf-search {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.pf-input,
.pf-select {
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e7f6ff;
  outline: none;
  padding: 0 10px;
  font-size: 12px;
}
.pf-select {
  background: rgba(255, 255, 255, 0.2);
  color: #e7f6ff;
}
.pf-input {
  flex: 1;
  min-width: 180px;
}
.pf-input::placeholder {
  color: rgba(231, 246, 255, 0.35);
}

.pf-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 240, 255, 0.25);
  background: rgba(0, 170, 255, 0.18);
  color: #e7f6ff;
  cursor: pointer;
  font-weight: 900;
}
.pf-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pf-btn.ghost {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.pf-msg {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}
.pf-msg.ok {
  border-color: rgba(34, 197, 94, 0.25);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #94a3b8;
}
.dot.ok { background: #22c55e; }
.dot.err { background: #ef4444; }

.pf-kv {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}
.kv {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
}
.kv .k { color: rgba(231, 246, 255, 0.6); }
.kv .v { color: #e7f6ff; font-weight: 900; }

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.pf-now {
  margin-top: 10px;
}
.now-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.now-big {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
}
.now-temp {
  font-size: 46px;
  font-weight: 900;
  line-height: 1;
}
.now-desc {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(231, 246, 255, 0.85);
  font-weight: 900;
}
.now-mini {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mini {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}
.mini .k { color: rgba(231, 246, 255, 0.6); }
.mini .v { margin-top: 6px; font-weight: 900; }

.pf-empty {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(231, 246, 255, 0.60);
}
.pf-list {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}
.pf-day {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}
.pf-day .d1 {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-weight: 900;
}
.pf-day .date { color: rgba(231, 246, 255, 0.85); }
.pf-day .desc { color: rgba(0, 240, 255, 0.85); }
.pf-day .d2 {
  margin-top: 6px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: rgba(231, 246, 255, 0.75);
}
.pf-day .t {
  font-weight: 900;
  color: #e7f6ff;
}
.pf-day .m {
  color: rgba(231, 246, 255, 0.70);
}

.pf-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 12px 0;
}

.pf-hourly {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}
.hr {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.7fr 0.9fr 0.9fr;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}
.hr .t { color: rgba(231, 246, 255, 0.70); }
.hr .w { color: rgba(0, 240, 255, 0.85); font-weight: 900; }
.hr .v { color: rgba(231, 246, 255, 0.75); }

@media (max-width: 1100px) {
  .pf-side.right { display: none; }
}

.flood-entry {
  position: absolute;
  left: 20px;
  bottom: 66px;
  z-index: 61;
}
.flood-btn {
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 170, 0, 0.55);
  background: rgba(46, 22, 6, 0.55);
  color: #ffe9c7;
  cursor: pointer;
  box-shadow: 0 0 14px rgba(255, 170, 0, 0.25);
  backdrop-filter: blur(10px);
}
.flood-btn:hover {
  box-shadow: 0 0 20px rgba(255, 170, 0, 0.45);
}

.flood-panel {
  position: absolute;
  left: 20px;
  bottom: 66px;
  width: 320px;
  border-radius: 14px;
  border: 1px solid rgba(255, 170, 0, 0.35);
  background: linear-gradient(135deg, rgba(46, 22, 6, 0.92), rgba(25, 10, 3, 0.96));
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.75), 0 0 22px rgba(255, 170, 0, 0.18);
  backdrop-filter: blur(14px);
  color: #ffe9c7;
  z-index: 61;
}
.flood-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 10px 6px 10px;
}
.flood-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.flood-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffaa00;
  box-shadow: 0 0 10px rgba(255, 170, 0, 0.9);
}
.flood-close {
  border: none;
  background: transparent;
  color: rgba(255, 233, 199, 0.7);
  font-size: 20px;
  cursor: pointer;
}
.flood-close:hover {
  color: #fff;
}
.flood-body {
  padding: 8px 10px 10px 10px;
}
.flood-hint {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 233, 199, 0.85);
  line-height: 1.4;
}
.flood-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}
.flood-action-btn {
  flex: 1;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 233, 199, 0.45);
  background: rgba(25, 10, 3, 0.55);
  color: #ffe9c7;
  cursor: pointer;
}
.flood-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.flood-action-btn.danger {
  border-color: rgba(255, 80, 80, 0.55);
  color: #ffd0d0;
}
.flood-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.flood-label {
  width: 40px;
  font-size: 12px;
  color: rgba(255, 233, 199, 0.85);
}
.flood-range {
  flex: 1;
}
.flood-value {
  width: 48px;
  text-align: right;
  font-size: 12px;
  color: rgba(255, 233, 199, 0.9);
}
.flood-status {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 233, 199, 0.85);
}
.flood-select {
  flex: 1;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 233, 199, 0.35);
  background: rgba(25, 10, 3, 0.45);
  color: #ffe9c7;
  outline: none;
}
</style>