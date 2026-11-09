<template>
  <template v-if="isWarningMode">
    <!-- 左侧：预警面板（贴左边缘） -->
    <div class="pf-side left pointer-auto">
      <div class="pf-card">
        <div class="pf-head">
          <div class="pf-h-title">
            {{ activeType === "water" ? "灾害预警" : "坝体安全预警" }}
          </div>
          <div class="pf-h-sub">
            <span v-if="lastUpdated">更新于 {{ lastUpdated }}</span>
            <span v-else>—</span>
          </div>
        </div>

        <!-- 模式切换 -->
        <div class="mode-switch-inline">
          <button
            class="mode-btn-inline"
            :class="{ active: activeType === 'water' }"
            @click.stop="switchMode('water')"
          >
            💧 水质
          </button>
          <button
            class="mode-btn-inline"
            :class="{ active: activeType === 'dam' }"
            @click.stop="switchMode('dam')"
          >
            🏗️ 坝体
          </button>
        </div>

        <!-- 统计卡片 -->
        <div class="stats-compact">
          <div class="stat-item">
            <span class="stat-label">已发布</span>
            <span class="stat-value">{{ publishedCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">处置中</span>
            <span class="stat-value warning">{{ processingCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已关闭</span>
            <span class="stat-value">{{ closedCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总数</span>
            <span class="stat-value strong">{{ currentWarnings.length }}</span>
          </div>
        </div>

        <!-- 异常类型分布 -->
        <div class="type-toggle-row">
          <button class="type-toggle-btn" @click.stop="showTypeStats = !showTypeStats">
            <span>📊 异常类型分布 ({{ totalTypeCount }})</span>
            <span class="toggle-arrow" :class="{ open: showTypeStats }">▼</span>
          </button>
          <div v-if="showTypeStats" class="type-stats-popup" @click.stop>
            <div class="type-stats-header">按异常指标分类</div>
            <div class="type-stats-list">
              <div v-for="item in typeStats" :key="item.name" class="type-stats-row">
                <span>{{ item.name }}</span>
                <span>{{ item.count }}</span>
              </div>
              <div v-if="!typeStats.length" class="type-stats-empty">暂无数据</div>
            </div>
          </div>
        </div>

        <!-- 过滤标签 -->
        <div class="tab-row">
          <button
            class="tab-btn"
            :class="{ active: activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            全部
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeFilter === 'closed' }"
            @click="activeFilter = 'closed'"
          >
            已关闭
          </button>
        </div>

        <!-- 预警列表 -->
        <div class="pf-list limited-scroll" v-if="filteredWarnings.length">
          <div
            class="warning-card"
            v-for="item in filteredWarnings"
            :key="item.id"
            :class="{ active: selectedWarning && selectedWarning.id === item.id }"
            @click="handleCardClick(item, $event)"
          >
            <div class="warning-top">
              <div class="top-left">
                <span class="level-badge" :class="levelClass(item.level)">
                  {{ item.levelText }}
                </span>
                <span class="warning-title">{{ item.title }}</span>
              </div>
              <span class="status-badge" :class="statusClass(item.status)">
                {{ statusText(item.status) }}
              </span>
            </div>

            <div class="warning-line boxed-line">
              {{ item.desc }}
            </div>

            <div class="warning-meta">
              <div class="meta-item boxed-line">
                <span class="meta-dot"></span>
                <span>{{ item.location }}</span>
              </div>
              <div class="meta-item boxed-line">
                <span class="meta-time">🕒 {{ formatDate(item.timeText) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="pf-empty" v-else>
          {{ loading ? "正在加载预警数据..." : "暂无预警数据" }}
        </div>
      </div>
    </div>

    <!-- 右侧：图表区域 -->
    <div class="pf-side right pointer-auto chart-side">
      <div class="pf-card chart-card" style="display: flex; flex-direction: column; gap: 16px;">
        <!-- 水质模式 -->
        <template v-if="activeType === 'water'">
          <!-- 图表1 -->
          <div class="single-chart">
            <div class="chart-header">
              <div class="chart-title">
                <span>📈 趋势图 1 · {{ metricLabel(chart1.metricKey) }}</span>
              </div>
              <div class="metric-selector-mini">
                <select v-model="chart1.metricKey" class="metric-select">
                  <option v-for="m in waterMetricOptions" :key="m.key" :value="m.key">{{ m.label }}</option>
                </select>
              </div>
            </div>
            <div v-if="chart1.fullData.length" class="chart-body">
              <div class="chart-canvas-container">
                <canvas
                  ref="chart1Canvas"
                  width="400"
                  height="140"
                  style="width: 100%; height: auto; display: block; border-radius: 6px; background: rgba(0,0,0,0.2);"
                  @mousemove="(e) => handleChartHover(e, chart1, 'chart1Canvas')"
                  @mouseleave="() => clearTooltip('chart1')"
                ></canvas>
                <div v-if="chart1.tooltip.visible" class="chart-tooltip" :style="chart1.tooltip.style">
                  <div>{{ chart1.tooltip.date }}</div>
                  <div>值: {{ chart1.tooltip.value }}</div>
                </div>
              </div>
            </div>
            <div v-else class="chart-empty">暂无数据</div>
          </div>

          <!-- 图表2 -->
          <div class="single-chart">
            <div class="chart-header">
              <div class="chart-title">
                <span>📉 趋势图 2 · {{ metricLabel(chart2.metricKey) }}</span>
              </div>
              <div class="metric-selector-mini">
                <select v-model="chart2.metricKey" class="metric-select">
                  <option v-for="m in waterMetricOptions" :key="m.key" :value="m.key">{{ m.label }}</option>
                </select>
              </div>
            </div>
            <div v-if="chart2.fullData.length" class="chart-body">
              <div class="chart-canvas-container">
                <canvas
                  ref="chart2Canvas"
                  width="400"
                  height="140"
                  style="width: 100%; height: auto; display: block; border-radius: 6px; background: rgba(0,0,0,0.2);"
                  @mousemove="(e) => handleChartHover(e, chart2, 'chart2Canvas')"
                  @mouseleave="() => clearTooltip('chart2')"
                ></canvas>
                <div v-if="chart2.tooltip.visible" class="chart-tooltip" :style="chart2.tooltip.style">
                  <div>{{ chart2.tooltip.date }}</div>
                  <div>值: {{ chart2.tooltip.value }}</div>
                </div>
              </div>
            </div>
            <div v-else class="chart-empty">暂无数据</div>
          </div>
        </template>

        <!-- 坝体模式（两个完全独立的图表） -->
        <template v-else-if="activeType === 'dam'">
          <!-- 图表1 -->
          <div class="single-chart">
            <div class="chart-header">
              <div class="chart-title">
                <span>📈 趋势图 1</span>
                <span v-if="damThreshold1" class="threshold-hint">阈值: {{ formatThreshold(damThreshold1) }}</span>
              </div>
            </div>
            <div class="dam-filter-row">
              <select v-model="damSensor1" class="dam-select" @change="onDamSensor1Change">
                <option value="">选择传感器</option>
                <option v-for="s in damSensors" :key="s" :value="s">{{ s }}</option>
              </select>
              <select v-model="damMeasure1" class="dam-select" :disabled="!damSensor1" @change="onDamMeasure1Change">
                <option value="">选择测量类型</option>
                <option v-for="m in damFilteredMeasures1" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div v-if="damSensor1 && damMeasure1 && damFullData1.length" class="chart-body">
              <div class="chart-canvas-container">
                <canvas
                  ref="damChart1Canvas"
                  width="400"
                  height="140"
                  style="width: 100%; height: auto; display: block; border-radius: 6px; background: rgba(0,0,0,0.2);"
                  @mousemove="(e) => handleDamChartHover(e, 'dam1')"
                  @mouseleave="() => clearDamTooltip('dam1')"
                ></canvas>
                <div v-if="damTooltip1.visible" class="chart-tooltip" :style="damTooltip1.style">
                  <div>{{ damTooltip1.date }}</div>
                  <div>值: {{ damTooltip1.value }}</div>
                </div>
              </div>
            </div>
            <div v-else class="chart-empty">请选择传感器和测量类型</div>
          </div>

          <!-- 图表2 -->
          <div class="single-chart">
            <div class="chart-header">
              <div class="chart-title">
                <span>📉 趋势图 2</span>
                <span v-if="damThreshold2" class="threshold-hint">阈值: {{ formatThreshold(damThreshold2) }}</span>
              </div>
            </div>
            <div class="dam-filter-row">
              <select v-model="damSensor2" class="dam-select" @change="onDamSensor2Change">
                <option value="">选择传感器</option>
                <option v-for="s in damSensors" :key="s" :value="s">{{ s }}</option>
              </select>
              <select v-model="damMeasure2" class="dam-select" :disabled="!damSensor2" @change="onDamMeasure2Change">
                <option value="">选择测量类型</option>
                <option v-for="m in damFilteredMeasures2" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div v-if="damSensor2 && damMeasure2 && damFullData2.length" class="chart-body">
              <div class="chart-canvas-container">
                <canvas
                  ref="damChart2Canvas"
                  width="400"
                  height="140"
                  style="width: 100%; height: auto; display: block; border-radius: 6px; background: rgba(0,0,0,0.2);"
                  @mousemove="(e) => handleDamChartHover(e, 'dam2')"
                  @mouseleave="() => clearDamTooltip('dam2')"
                ></canvas>
                <div v-if="damTooltip2.visible" class="chart-tooltip" :style="damTooltip2.style">
                  <div>{{ damTooltip2.date }}</div>
                  <div>值: {{ damTooltip2.value }}</div>
                </div>
              </div>
            </div>
            <div v-else class="chart-empty">请选择传感器和测量类型</div>
          </div>
        </template>
      </div>
    </div>

    <!-- 详情浮窗 -->
    <div
      v-if="detailPopup.visible"
      ref="detailPopupRef"
      class="detail-popup"
      :style="{ top: detailPopup.top + 'px', left: detailPopup.left + 'px' }"
    >
      <div class="popup-header drag-handle" @mousedown="startDrag">
        <span>预警详情</span>
        <button class="popup-close" @click="closeDetailPopup">×</button>
      </div>
      <div class="popup-body">
        <div class="detail-row">
          <span class="k">ID</span>
          <span class="v mono">{{ detailPopup.data.id }}</span>
        </div>
        <div class="detail-row">
          <span class="k">类型</span>
          <span class="v">{{ detailPopup.data.title }}</span>
        </div>
        <div class="detail-row">
          <span class="k">级别</span>
          <span class="v">
            <span class="level-badge small" :class="levelClass(detailPopup.data.level)">
              {{ detailPopup.data.levelText }}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="k">状态</span>
          <span class="v">
            <span class="status-badge small" :class="statusClass(detailPopup.data.status)">
              {{ statusText(detailPopup.data.status) }}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="k">日期</span>
          <span class="v">{{ formatDate(detailPopup.data.timeText) }}</span>
        </div>
        <div class="detail-row">
          <span class="k">点位</span>
          <span class="v">{{ detailPopup.data.location }}</span>
        </div>
        <div class="detail-row block">
          <span class="k">描述</span>
          <span class="v">{{ detailPopup.data.desc }}</span>
        </div>
      </div>
    </div>

    <div v-if="detailPopup.visible" class="popup-mask" @click="closeDetailPopup"></div>
  </template>
</template>

<script>
import { fetchOriginal } from '../../originalApi.js';
import { defineComponent, ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";

// ==================== 工具函数 ====================
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}
function formatNumber(value, digit = 3) {
  const n = num(value);
  if (n === null) return "-";
  return Number(n.toFixed(digit)).toString();
}
function avg(arr) {
  if (!arr || arr.length === 0) return null;
  const total = arr.reduce((sum, item) => sum + item, 0);
  return total / arr.length;
}
function levelToText(level) {
  if (level === "high") return "红色";
  if (level === "mid") return "橙色";
  if (level === "low") return "黄色";
  return "蓝色";
}
function statusTextMap(status) {
  if (status === "published") return "已发布";
  if (status === "processing") return "处置中";
  if (status === "closed") return "已关闭";
  return "未知";
}
function buildIssues(row, thresholdsMap) {
  const issues = [];
  const issueTags = [];
  for (const [key, th] of Object.entries(thresholdsMap)) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const val = num(value);
    if (val === null) continue;
    const minV = th.min;
    const maxV = th.max;
    let abnormal = false;
    if (minV !== null && val < minV) abnormal = true;
    if (maxV !== null && val > maxV) abnormal = true;
    if (abnormal) {
      const metricName = th.metric_name || key;
      issues.push(`${metricName}异常(${val})`);
      issueTags.push(metricName);
    }
  }
  return { issues, issueTags };
}
function buildWarningFromRow(row, thresholdsMap) {
  const { issues, issueTags } = buildIssues(row, thresholdsMap);
  if (issues.length === 0) return null;

  const arsenic = num(row.arsenic);
  const cod = num(row.cod);

  let level = "low";
  if ((arsenic !== null && arsenic > 0.5) || (cod !== null && cod > 150)) {
    level = "high";
  } else if (issues.length >= 3) {
    level = "mid";
  }

  let status = "published";
  if (level === "high") {
    status = "processing";
  } else if (level === "low") {
    status = "closed";
  }

  return {
    id: row.id,
    level,
    levelText: levelToText(level),
    status,
    title: "水质异常预警事件",
    desc: issues.join("，"),
    issueTags,
    location: row.site_name || "-",
    timeText: row.sample_date || "-",
    createdAt: row.sample_date || "",
    raw: row
  };
}
function groupTimeline(rows) {
  const map = {};
  rows.forEach((row) => {
    const date = row.sample_date || "未知日期";
    if (!map[date]) {
      map[date] = {
        date,
        count: 0,
        ph: [],
        fluoride: [],
        manganese: [],
        cadmium: [],
        lead_value: [],
        arsenic: [],
        cod: [],
        suspended_solids: []
      };
    }
    map[date].count += 1;
    ["ph", "fluoride", "manganese", "cadmium", "lead_value", "arsenic", "cod", "suspended_solids"].forEach((key) => {
      const value = num(row[key]);
      if (value !== null) map[date][key].push(value);
    });
  });
  return Object.values(map)
    .map((item) => ({
      ...item,
      ph_avg: avg(item.ph),
      fluoride_avg: avg(item.fluoride),
      manganese_avg: avg(item.manganese),
      cadmium_avg: avg(item.cadmium),
      lead_value_avg: avg(item.lead_value),
      arsenic_avg: avg(item.arsenic),
      cod_avg: avg(item.cod),
      suspended_solids_avg: avg(item.suspended_solids)
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
function getNiceTicks(min, max, maxTicks = 5) {
  const range = max - min;
  if (range === 0) return [min, min + 1];
  const roughStep = range / (maxTicks - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let niceStep;
  if (residual < 1.5) niceStep = magnitude;
  else if (residual < 3) niceStep = 2 * magnitude;
  else if (residual < 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.1; v += niceStep) {
    ticks.push(v);
  }
  return ticks;
}

export default defineComponent({
  name: "DisasterWarningPanel",
  props: {
    isWarningMode: { type: Boolean, default: false },
    activeType: { type: String, default: "water" }
  },
  emits: ["update:activeType"],
  setup(props, { emit }) {
    // -------------------- 响应式数据 --------------------
    const loading = ref(false);
    const lastUpdated = ref("");
    const activeFilter = ref("all");
    const selectedWarning = ref(null);
    const showTypeStats = ref(false);
    const thresholdsMap = ref({});

    // 水质数据
    const waterWarnings = ref([]);
    const waterRawRows = ref([]);
    const waterTimelineDays = ref([]);

    // 坝体数据
    const damWarnings = ref([]);
    const damSensors = ref([]);
    const damThresholdsMap = ref({});

    // 图表1独立状态
    const damSensor1 = ref("");
    const damMeasure1 = ref("");
    const damFilteredMeasures1 = ref([]);
    const damFullData1 = ref([]);
    const damWindowStart1 = ref(0);
    const damWindowSize = 6;
    const damWindowData1 = computed(() => {
      const total = damFullData1.value.length;
      if (total <= damWindowSize) return damFullData1.value;
      const start = damWindowStart1.value;
      return damFullData1.value.slice(start, Math.min(start + damWindowSize, total));
    });
    const damThreshold1 = ref(null);
    const damTooltip1 = ref({ visible: false, style: {}, date: "", value: "" });
    const damDrawData1 = ref(null);

    // 图表2独立状态
    const damSensor2 = ref("");
    const damMeasure2 = ref("");
    const damFilteredMeasures2 = ref([]);
    const damFullData2 = ref([]);
    const damWindowStart2 = ref(0);
    const damWindowData2 = computed(() => {
      const total = damFullData2.value.length;
      if (total <= damWindowSize) return damFullData2.value;
      const start = damWindowStart2.value;
      return damFullData2.value.slice(start, Math.min(start + damWindowSize, total));
    });
    const damThreshold2 = ref(null);
    const damTooltip2 = ref({ visible: false, style: {}, date: "", value: "" });
    const damDrawData2 = ref(null);

    // 图表引用
    const chart1Canvas = ref(null);
    const chart2Canvas = ref(null);
    const damChart1Canvas = ref(null);
    const damChart2Canvas = ref(null);

    // 水质图表配置
    const waterMetricOptions = ref([
      { key: "ph", label: "PH", digit: 2 },
      { key: "fluoride", label: "F-", digit: 3 },
      { key: "manganese", label: "锰", digit: 3 },
      { key: "cadmium", label: "镉", digit: 3 },
      { key: "lead_value", label: "铅", digit: 3 },
      { key: "arsenic", label: "砷", digit: 3 },
      { key: "cod", label: "COD", digit: 2 },
      { key: "suspended_solids", label: "悬浮物", digit: 2 }
    ]);

    const chart1 = ref({
      metricKey: "cod", windowStart: 0, windowSize: 6, fullData: [], windowData: [],
      tooltip: { visible: false, style: {}, date: "", value: "" }, drawData: null
    });
    const chart2 = ref({
      metricKey: "ph", windowStart: 0, windowSize: 6, fullData: [], windowData: [],
      tooltip: { visible: false, style: {}, date: "", value: "" }, drawData: null
    });

    // 详情浮窗
    const detailPopup = ref({ visible: false, top: 100, left: 400, data: {} });
    const detailPopupRef = ref(null);
    const dragging = ref(false);
    const dragOffset = ref({ x: 0, y: 0 });

    const apiBase = "/disaster-gw";

    // 当前预警列表
    const currentWarnings = computed(() => props.activeType === "water" ? waterWarnings.value : damWarnings.value);

    // 模式切换
    const switchMode = (mode) => emit("update:activeType", mode);

    // ==================== 水质逻辑 ====================
    const fetchWaterThresholds = async () => {
      try {
        const res = await fetchOriginal(`${apiBase}/thresholds`);
        const data = await res.json();
        if (data.success) {
          const map = {};
          data.data.forEach((t) => { map[t.metric_key] = { min: t.min_value, max: t.max_value, metric_name: t.metric_name }; });
          thresholdsMap.value = map;
        }
      } catch (e) { console.error("获取水质阈值失败", e); }
    };

    const fetchWaterMonitoringData = async () => {
      loading.value = true;
      try {
        const res = await fetchOriginal(`${apiBase}/monitoring-data`);
        const result = await res.json();
        if (result.success) {
          waterRawRows.value = result.data || [];
          waterTimelineDays.value = groupTimeline(waterRawRows.value);
          const warningList = waterRawRows.value
            .map((item) => buildWarningFromRow(item, thresholdsMap.value))
            .filter((item) => item !== null);
          waterWarnings.value = warningList;
          lastUpdated.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
          if (props.activeType === "water") {
            updateWaterChartData(chart1);
            updateWaterChartData(chart2);
            await nextTick();
            drawWaterChart(chart1, chart1Canvas);
            drawWaterChart(chart2, chart2Canvas);
          }
        }
      } catch (e) { console.error("获取水质监测数据失败", e); }
      finally { loading.value = false; }
    };

    const updateWaterChartData = (chartRef) => {
      const key = `${chartRef.value.metricKey}_avg`;
      const full = waterTimelineDays.value
        .map((item) => ({
          date: item.date,
          timestamp: new Date(item.date).getTime(),
          shortDate: shortDate(item.date),
          value: num(item[key]),
          count: item.count
        }))
        .filter((item) => item.value !== null && !isNaN(item.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);
      chartRef.value.fullData = full;
      chartRef.value.windowStart = 0;
      computeWaterChartWindow(chartRef);
    };

    const computeWaterChartWindow = (chartRef) => {
      const total = chartRef.value.fullData.length;
      const size = chartRef.value.windowSize;
      const start = chartRef.value.windowStart;
      chartRef.value.windowData = total <= size
        ? chartRef.value.fullData
        : chartRef.value.fullData.slice(start, Math.min(start + size, total));
    };

    const drawWaterChart = (chartRef, canvasRef) => {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = 400, height = 140;
      canvas.width = width;
      canvas.height = height;

      const data = chartRef.value.windowData;
      if (!data.length) { ctx.clearRect(0, 0, width, height); chartRef.value.drawData = null; return; }

      const values = data.map(d => d.value);
      let min = Math.min(...values);
      let max = Math.max(...values);
      if (min === max) { min -= 1; max += 1; }

      const ticks = getNiceTicks(min, max, 5);
      const yMin = ticks[0];
      const yMax = ticks[ticks.length - 1];

      const timestamps = data.map(d => d.timestamp);
      const tMin = Math.min(...timestamps);
      const tRange = Math.max(...timestamps) - tMin || 1;

      const padding = { left: 40, right: 15, top: 12, bottom: 28 };
      const graphW = width - padding.left - padding.right;
      const graphH = height - padding.top - padding.bottom;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(108,200,248,0.25)";
      ctx.lineWidth = 1;
      ticks.forEach(tick => {
        const y = padding.top + graphH - ((tick - yMin) / (yMax - yMin)) * graphH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(220,245,255,0.9)";
      ctx.font = "bold 10px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ticks.forEach(tick => {
        const y = padding.top + graphH - ((tick - yMin) / (yMax - yMin)) * graphH;
        ctx.fillText(formatNumber(tick, 2), padding.left - 6, y);
      });

      ctx.beginPath();
      data.forEach((item, i) => {
        const x = padding.left + ((item.timestamp - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.value - yMin) / (yMax - yMin)) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = chartRef === chart1 ? "#66d5ff" : "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      data.forEach(item => {
        const x = padding.left + ((item.timestamp - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.value - yMin) / (yMax - yMin)) * graphH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = chartRef === chart1 ? "#66d5ff" : "#fbbf24";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(220,245,255,0.85)";
      ctx.font = "9px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      data.forEach(item => {
        const x = padding.left + ((item.timestamp - tMin) / tRange) * graphW;
        ctx.fillText(item.shortDate, x, height - padding.bottom + 6);
      });

      chartRef.value.drawData = { data, tMin, tRange, yMin, yMax, padding, graphW, graphH, width, height };
    };

    const advanceWaterWindows = () => {
      [chart1, chart2].forEach(chartRef => {
        const total = chartRef.value.fullData.length;
        const size = chartRef.value.windowSize;
        if (total <= size) {
          chartRef.value.windowStart = 0;
        } else {
          const maxStart = total - size;
          chartRef.value.windowStart = chartRef.value.windowStart >= maxStart ? 0 : chartRef.value.windowStart + 1;
        }
        computeWaterChartWindow(chartRef);
        drawWaterChart(chartRef, chartRef === chart1 ? chart1Canvas : chart2Canvas);
      });
    };

    // ==================== 坝体逻辑 ====================
    const fetchDamOptions = async () => {
      try {
        const [sensorsRes, thresholdsRes] = await Promise.all([
          fetchOriginal(`${apiBase}/dam/sensors`),
          fetchOriginal(`${apiBase}/dam/thresholds`)
        ]);
        const sensorsData = await sensorsRes.json();
        const thresholdsData = await thresholdsRes.json();
        if (sensorsData.success) {
          damSensors.value = sensorsData.data;
          console.log("坝体传感器列表加载成功:", damSensors.value);
        } else {
          console.warn("坝体传感器接口返回失败:", sensorsData);
        }
        if (thresholdsData.success) {
          const map = {};
          thresholdsData.data.forEach(t => { map[`${t.sensor}|${t.measure_name}`] = t; });
          damThresholdsMap.value = map;
        } else {
          console.warn("坝体阈值接口返回失败:", thresholdsData);
        }
      } catch (e) {
        console.error("获取坝体选项失败", e);
      }
    };

    const fetchDamWarnings = async () => {
      try {
        const res = await fetchOriginal(`${apiBase}/dam/warnings`);
        const data = await res.json();
        if (data.success) {
          damWarnings.value = data.data.map(w => ({
            ...w,
            id: `${w.sensor}-${w.measure_name}-${w.refresh_time}`,
            level: w.level || "high",
            levelText: levelToText(w.level || "high"),
            status: w.status || "published",
            title: `${w.sensor} · ${w.measure_name}`,
            desc: w.desc,
            issueTags: [w.measure_name],
            location: w.sensor,
            timeText: w.refresh_time
          }));
        }
      } catch (e) { console.error("获取坝体预警失败", e); }
    };

    // 图表1传感器变更
    const onDamSensor1Change = async () => {
      damMeasure1.value = "";
      damFilteredMeasures1.value = [];
      damThreshold1.value = null;
      damFullData1.value = [];
      damWindowStart1.value = 0;
      if (damSensor1.value) {
        try {
          const res = await fetchOriginal(`${apiBase}/dam/measure_names_by_sensor?sensor=${damSensor1.value}`);
          const data = await res.json();
          if (data.success) damFilteredMeasures1.value = data.data;
        } catch (e) { console.error("获取图表1测量类型失败", e); }
      }
    };

    // 图表2传感器变更
    const onDamSensor2Change = async () => {
      damMeasure2.value = "";
      damFilteredMeasures2.value = [];
      damThreshold2.value = null;
      damFullData2.value = [];
      damWindowStart2.value = 0;
      if (damSensor2.value) {
        try {
          const res = await fetchOriginal(`${apiBase}/dam/measure_names_by_sensor?sensor=${damSensor2.value}`);
          const data = await res.json();
          if (data.success) damFilteredMeasures2.value = data.data;
        } catch (e) { console.error("获取图表2测量类型失败", e); }
      }
    };

    const updateDamThreshold1 = () => {
      if (!damSensor1.value || !damMeasure1.value) { damThreshold1.value = null; return; }
      const key = `${damSensor1.value}|${damMeasure1.value}`;
      damThreshold1.value = damThresholdsMap.value[key] || null;
    };
    const updateDamThreshold2 = () => {
      if (!damSensor2.value || !damMeasure2.value) { damThreshold2.value = null; return; }
      const key = `${damSensor2.value}|${damMeasure2.value}`;
      damThreshold2.value = damThresholdsMap.value[key] || null;
    };

    const fetchDamTrendData1 = async () => {
      if (!damSensor1.value || !damMeasure1.value) return;
      try {
        const res = await fetchOriginal(`${apiBase}/dam/trend?sensor=${damSensor1.value}&measure_name=${damMeasure1.value}&group_by=hour`);
        const data = await res.json();
        if (data.success) {
          damFullData1.value = data.data;
          damWindowStart1.value = 0;
          await nextTick();
          drawDamChart1();
        }
      } catch (e) { console.error("获取图表1趋势数据失败", e); }
    };
    const fetchDamTrendData2 = async () => {
      if (!damSensor2.value || !damMeasure2.value) return;
      try {
        const res = await fetchOriginal(`${apiBase}/dam/trend?sensor=${damSensor2.value}&measure_name=${damMeasure2.value}&group_by=hour`);
        const data = await res.json();
        if (data.success) {
          damFullData2.value = data.data;
          damWindowStart2.value = 0;
          await nextTick();
          drawDamChart2();
        }
      } catch (e) { console.error("获取图表2趋势数据失败", e); }
    };

    const onDamMeasure1Change = () => { updateDamThreshold1(); fetchDamTrendData1(); };
    const onDamMeasure2Change = () => { updateDamThreshold2(); fetchDamTrendData2(); };

    const drawDamChart1 = () => {
      const canvas = damChart1Canvas.value;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = 400, height = 140;
      canvas.width = width;
      canvas.height = height;

      const data = damWindowData1.value;
      if (!data.length) { ctx.clearRect(0, 0, width, height); damDrawData1.value = null; return; }

      const values = data.map(d => d.avg_value);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (damThreshold1.value) {
        if (damThreshold1.value.min_value !== null) minVal = Math.min(minVal, damThreshold1.value.min_value);
        if (damThreshold1.value.max_value !== null) maxVal = Math.max(maxVal, damThreshold1.value.max_value);
      }
      if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
      const paddingVal = (maxVal - minVal) * 0.1 || 1;
      minVal -= paddingVal;
      maxVal += paddingVal;

      const ticks = getNiceTicks(minVal, maxVal, 5);
      const yMin = ticks[0];
      const yMax = ticks[ticks.length - 1];

      const timestamps = data.map(d => new Date(d.time_bucket).getTime());
      const tMin = Math.min(...timestamps);
      const tRange = Math.max(...timestamps) - tMin || 1;

      const padding = { left: 45, right: 15, top: 12, bottom: 30 };
      const graphW = width - padding.left - padding.right;
      const graphH = height - padding.top - padding.bottom;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(108,200,248,0.25)";
      ctx.lineWidth = 1;
      ticks.forEach(tick => {
        const y = padding.top + graphH - ((tick - yMin) / (yMax - yMin)) * graphH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(220,245,255,0.9)";
      ctx.font = "bold 10px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ticks.forEach(tick => {
        const y = padding.top + graphH - ((tick - yMin) / (yMax - yMin)) * graphH;
        ctx.fillText(formatNumber(tick, 2), padding.left - 6, y);
      });

      if (damThreshold1.value) {
        const th = damThreshold1.value;
        ctx.strokeStyle = "#ff7b7b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        if (th.max_value !== null) {
          const y = padding.top + graphH - ((th.max_value - yMin) / (yMax - yMin)) * graphH;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
          ctx.fillStyle = "#ff9f9f";
          ctx.font = "9px \"Segoe UI\", sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(`上限 ${th.max_value}`, width - padding.right - 4, y - 4);
        }
        if (th.min_value !== null) {
          const y = padding.top + graphH - ((th.min_value - yMin) / (yMax - yMin)) * graphH;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
          ctx.fillStyle = "#ff9f9f";
          ctx.font = "9px \"Segoe UI\", sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(`下限 ${th.min_value}`, width - padding.right - 4, y - 4);
        }
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      data.forEach((item, i) => {
        const ts = new Date(item.time_bucket).getTime();
        const x = padding.left + ((ts - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.avg_value - yMin) / (yMax - yMin)) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#66d5ff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      data.forEach(item => {
        const ts = new Date(item.time_bucket).getTime();
        const x = padding.left + ((ts - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.avg_value - yMin) / (yMax - yMin)) * graphH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#66d5ff";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(220,245,255,0.85)";
      ctx.font = "9px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      data.forEach((item, idx) => {
        if (data.length <= 8 || idx % Math.ceil(data.length / 6) === 0) {
          const ts = new Date(item.time_bucket).getTime();
          const x = padding.left + ((ts - tMin) / tRange) * graphW;
          const d = new Date(item.time_bucket);
          const label = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
          ctx.fillText(label, x, height - padding.bottom + 6);
        }
      });

      damDrawData1.value = { data, tMin, tRange, yMin, yMax, padding, graphW, graphH, width, height };
    };

    const drawDamChart2 = () => {
      const canvas = damChart2Canvas.value;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const width = 400, height = 140;
      canvas.width = width;
      canvas.height = height;

      const data = damWindowData2.value;
      if (!data.length) { ctx.clearRect(0, 0, width, height); damDrawData2.value = null; return; }

      const values = data.map(d => d.avg_value);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (damThreshold2.value) {
        if (damThreshold2.value.min_value !== null) minVal = Math.min(minVal, damThreshold2.value.min_value);
        if (damThreshold2.value.max_value !== null) maxVal = Math.max(maxVal, damThreshold2.value.max_value);
      }
      if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
      const paddingVal = (maxVal - minVal) * 0.1 || 1;
      minVal -= paddingVal;
      maxVal += paddingVal;

      const ticks = getNiceTicks(minVal, maxVal, 5);
      const yMin = ticks[0];
      const yMax = ticks[ticks.length - 1];

      const timestamps = data.map(d => new Date(d.time_bucket).getTime());
      const tMin = Math.min(...timestamps);
      const tRange = Math.max(...timestamps) - tMin || 1;

      const padding = { left: 45, right: 15, top: 12, bottom: 30 };
      const graphW = width - padding.left - padding.right;
      const graphH = height - padding.top - padding.bottom;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(108,200,248,0.25)";
      ctx.lineWidth = 1;
      ticks.forEach(tick => {
        const y = padding.top + graphH - ((tick - yMin) / (yMax - yMin)) * graphH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(220,245,255,0.9)";
      ctx.font = "bold 10px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ticks.forEach(tick => {
        const y = padding.top + graphH - ((tick - yMin) / (yMax - yMin)) * graphH;
        ctx.fillText(formatNumber(tick, 2), padding.left - 6, y);
      });

      if (damThreshold2.value) {
        const th = damThreshold2.value;
        ctx.strokeStyle = "#ff7b7b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        if (th.max_value !== null) {
          const y = padding.top + graphH - ((th.max_value - yMin) / (yMax - yMin)) * graphH;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
          ctx.fillStyle = "#ff9f9f";
          ctx.font = "9px \"Segoe UI\", sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(`上限 ${th.max_value}`, width - padding.right - 4, y - 4);
        }
        if (th.min_value !== null) {
          const y = padding.top + graphH - ((th.min_value - yMin) / (yMax - yMin)) * graphH;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
          ctx.fillStyle = "#ff9f9f";
          ctx.font = "9px \"Segoe UI\", sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(`下限 ${th.min_value}`, width - padding.right - 4, y - 4);
        }
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      data.forEach((item, i) => {
        const ts = new Date(item.time_bucket).getTime();
        const x = padding.left + ((ts - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.avg_value - yMin) / (yMax - yMin)) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      data.forEach(item => {
        const ts = new Date(item.time_bucket).getTime();
        const x = padding.left + ((ts - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.avg_value - yMin) / (yMax - yMin)) * graphH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(220,245,255,0.85)";
      ctx.font = "9px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      data.forEach((item, idx) => {
        if (data.length <= 8 || idx % Math.ceil(data.length / 6) === 0) {
          const ts = new Date(item.time_bucket).getTime();
          const x = padding.left + ((ts - tMin) / tRange) * graphW;
          const d = new Date(item.time_bucket);
          const label = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
          ctx.fillText(label, x, height - padding.bottom + 6);
        }
      });

      damDrawData2.value = { data, tMin, tRange, yMin, yMax, padding, graphW, graphH, width, height };
    };

    const advanceDamWindows = () => {
      // 图表1滚动
      const total1 = damFullData1.value.length;
      if (total1 > damWindowSize) {
        const maxStart = total1 - damWindowSize;
        damWindowStart1.value = damWindowStart1.value >= maxStart ? 0 : damWindowStart1.value + 1;
      } else {
        damWindowStart1.value = 0;
      }
      drawDamChart1();

      // 图表2滚动
      const total2 = damFullData2.value.length;
      if (total2 > damWindowSize) {
        const maxStart = total2 - damWindowSize;
        damWindowStart2.value = damWindowStart2.value >= maxStart ? 0 : damWindowStart2.value + 1;
      } else {
        damWindowStart2.value = 0;
      }
      drawDamChart2();
    };

    // ==================== 交互 ====================
    const handleChartHover = (event, chartRef, canvasKey) => {
      const canvas = canvasKey === "chart1Canvas" ? chart1Canvas.value : chart2Canvas.value;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      const drawData = chartRef.value?.drawData;
      if (!drawData) return;

      const { data, tMin, tRange, yMin, yMax, padding, graphW, graphH } = drawData;
      let closest = null;
      let minDist = 25;

      data.forEach((item) => {
        const x = padding.left + ((item.timestamp - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.value - yMin) / (yMax - yMin)) * graphH;
        const dist = Math.hypot(mouseX - x, mouseY - y);
        if (dist < minDist) { minDist = dist; closest = { ...item, x, y }; }
      });

      if (closest) {
        const metricMeta = waterMetricOptions.value.find(m => m.key === chartRef.value.metricKey);
        chartRef.value.tooltip = {
          visible: true,
          style: { left: closest.x / scaleX + "px", top: closest.y / scaleY - 30 + "px" },
          date: closest.date,
          value: formatNumber(closest.value, metricMeta?.digit || 2)
        };
      } else {
        chartRef.value.tooltip.visible = false;
      }
    };

    const clearTooltip = (chartKey) => {
      if (chartKey === "chart1" && chart1.value) chart1.value.tooltip.visible = false;
      else if (chartKey === "chart2" && chart2.value) chart2.value.tooltip.visible = false;
    };

    const handleDamChartHover = (event, chartId) => {
      const canvas = chartId === "dam1" ? damChart1Canvas.value : damChart2Canvas.value;
      const drawData = chartId === "dam1" ? damDrawData1.value : damDrawData2.value;
      const tooltipRef = chartId === "dam1" ? damTooltip1 : damTooltip2;
      if (!canvas || !drawData) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;

      const { data, tMin, tRange, yMin, yMax, padding, graphW, graphH } = drawData;
      let closest = null;
      let minDist = 25;

      data.forEach((item) => {
        const ts = new Date(item.time_bucket).getTime();
        const x = padding.left + ((ts - tMin) / tRange) * graphW;
        const y = padding.top + graphH - ((item.avg_value - yMin) / (yMax - yMin)) * graphH;
        const dist = Math.hypot(mouseX - x, mouseY - y);
        if (dist < minDist) { minDist = dist; closest = { ...item, x, y, date: item.time_bucket, value: item.avg_value }; }
      });

      if (closest) {
        tooltipRef.value = {
          visible: true,
          style: { left: closest.x / scaleX + "px", top: closest.y / scaleY - 30 + "px" },
          date: closest.date,
          value: formatNumber(closest.value, 2)
        };
      } else {
        tooltipRef.value.visible = false;
      }
    };

    const clearDamTooltip = (chartId) => {
      if (chartId === "dam1") damTooltip1.value.visible = false;
      else damTooltip2.value.visible = false;
    };

    // ==================== 通用 ====================
    const shortDate = (date) => {
      if (!date) return "-";
      const d = new Date(date);
      if (isNaN(d.getTime())) return date;
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };
    const formatDate = (dateStr) => {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };
    const metricLabel = (key) => waterMetricOptions.value.find(m => m.key === key)?.label || key;
    const formatThreshold = (th) => {
      if (!th) return "未设置";
      const parts = [];
      if (th.min_value !== null) parts.push(`下限 ${th.min_value}`);
      if (th.max_value !== null) parts.push(`上限 ${th.max_value}`);
      return parts.length ? parts.join(" · ") : "未设置";
    };

    const levelClass = (level) => {
      if (level === "high") return "red";
      if (level === "mid") return "orange";
      if (level === "low") return "yellow";
      return "blue";
    };
    const statusClass = (status) => {
      if (status === "published") return "published";
      if (status === "processing") return "processing";
      if (status === "closed") return "closed";
      return "";
    };
    const statusText = (status) => statusTextMap(status);

    const filteredWarnings = computed(() => {
      const list = currentWarnings.value;
      if (activeFilter.value === "closed") return list.filter(w => w.status === "closed");
      return list;
    });
    const publishedCount = computed(() => currentWarnings.value.filter(w => w.status === "published").length);
    const processingCount = computed(() => currentWarnings.value.filter(w => w.status === "processing").length);
    const closedCount = computed(() => currentWarnings.value.filter(w => w.status === "closed").length);
    const totalTypeCount = computed(() => {
      const set = new Set();
      currentWarnings.value.forEach(w => w.issueTags?.forEach(t => set.add(t)));
      return set.size;
    });
    const typeStats = computed(() => {
      const map = {};
      currentWarnings.value.forEach(w => {
        if (w.issueTags) w.issueTags.forEach(tag => { map[tag] = (map[tag] || 0) + 1; });
      });
      return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    });

    const handleCardClick = (item, event) => {
      selectedWarning.value = item;
      const rect = event.currentTarget.getBoundingClientRect();
      let left = rect.right + 10;
      let top = rect.top + window.scrollY + 10;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const popupW = 280;
      const popupH = 300;
      if (left + popupW > winW) left = winW - popupW - 10;
      if (top + popupH > winH) top = winH - popupH - 10;
      if (left < 0) left = 10;
      if (top < 0) top = 10;
      detailPopup.value = { visible: true, top, left, data: item };
    };
    const closeDetailPopup = () => { detailPopup.value.visible = false; };

    const startDrag = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const popup = detailPopupRef.value;
      if (!popup) return;
      dragging.value = true;
      const rect = popup.getBoundingClientRect();
      dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      window.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", stopDrag);
    };
    const onDrag = (e) => {
      if (!dragging.value) return;
      e.preventDefault();
      let x = e.clientX - dragOffset.value.x;
      let y = e.clientY - dragOffset.value.y;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const popupW = 280;
      const popupH = 300;
      x = Math.max(0, Math.min(x, winW - popupW));
      y = Math.max(0, Math.min(y, winH - popupH));
      detailPopup.value.top = y;
      detailPopup.value.left = x;
    };
    const stopDrag = () => {
      dragging.value = false;
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDrag);
    };

    // ==================== 生命周期 ====================
    let waterScrollTimer = null;
    let damScrollTimer = null;
    let pollTimer = null;

    watch(() => props.activeType, async (newType) => {
      if (newType === "water") {
        if (damScrollTimer) clearInterval(damScrollTimer);
        await fetchWaterThresholds();
        await fetchWaterMonitoringData();
        waterScrollTimer = setInterval(advanceWaterWindows, 3000);
      } else {
        if (waterScrollTimer) clearInterval(waterScrollTimer);
        await fetchDamOptions();
        await fetchDamWarnings();
        // 重置双图表状态
        damSensor1.value = ""; damMeasure1.value = ""; damFullData1.value = []; damWindowStart1.value = 0;
        damSensor2.value = ""; damMeasure2.value = ""; damFullData2.value = []; damWindowStart2.value = 0;
        damScrollTimer = setInterval(advanceDamWindows, 4000);
      }
    }, { immediate: true });

    onMounted(() => {
      pollTimer = setInterval(() => {
        if (props.activeType === "water") {
          fetchWaterMonitoringData();
        } else {
          fetchDamWarnings();
        }
      }, 60000);
      window.addEventListener("resize", () => {
        if (props.activeType === "water") {
          drawWaterChart(chart1, chart1Canvas);
          drawWaterChart(chart2, chart2Canvas);
        } else {
          drawDamChart1();
          drawDamChart2();
        }
      });
    });

    onUnmounted(() => {
      if (pollTimer) clearInterval(pollTimer);
      if (waterScrollTimer) clearInterval(waterScrollTimer);
      if (damScrollTimer) clearInterval(damScrollTimer);
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("resize", () => {});
    });

    return {
      loading, lastUpdated, activeFilter, selectedWarning, showTypeStats,
      currentWarnings, filteredWarnings, publishedCount, processingCount, closedCount,
      totalTypeCount, typeStats, waterMetricOptions,
      chart1, chart2, chart1Canvas, chart2Canvas,
      damSensors,
      damSensor1, damMeasure1, damFilteredMeasures1, damFullData1, damThreshold1,
      damSensor2, damMeasure2, damFilteredMeasures2, damFullData2, damThreshold2,
      damChart1Canvas, damChart2Canvas, damTooltip1, damTooltip2,
      detailPopup, detailPopupRef,
      switchMode, onDamSensor1Change, onDamMeasure1Change,
      onDamSensor2Change, onDamMeasure2Change,
      handleChartHover, clearTooltip, handleDamChartHover, clearDamTooltip,
      handleCardClick, closeDetailPopup, startDrag,
      levelClass, statusClass, statusText, formatDate, shortDate, metricLabel, formatThreshold
    };
  }
});
</script>

<style scoped>
/* 全局重置 */
.pointer-auto { pointer-events: auto; }
.pf-side { position: absolute; top: 90px; width: 380px; height: calc(100% - 150px); z-index: 60; }
.pf-side.left { left: 0; }   /* 贴左边缘 */
.pf-side.right { right: 20px; }
.pf-card { width: 100%; height: 100%; overflow: auto; padding: 12px; border-radius: 14px; border: 1px solid rgba(0, 180, 255, 0.25); background: rgba(10, 18, 28, 0.4); backdrop-filter: blur(10px); box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35); color: #e7f6ff; }
.pf-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-wrap: wrap; }
.pf-h-title { font-weight: 900; text-shadow: 0 0 10px rgba(0, 240, 255, 0.25); }
.pf-h-sub { font-size: 11px; color: rgba(231, 246, 255, 0.65); }
.mode-switch-inline { display: flex; gap: 6px; margin: 10px 0 8px; }
.mode-btn-inline { flex: 1; height: 32px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.06); color: #e7f6ff; font-weight: 700; cursor: pointer; transition: all 0.2s; }
.mode-btn-inline.active { border-color: #00f0ff; background: rgba(0, 170, 255, 0.18); }
.stats-compact { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0 8px; }
.stat-item { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 6px 4px; text-align: center; }
.stat-label { font-size: 11px; color: rgba(231, 246, 255, 0.7); display: block; }
.stat-value { font-size: 18px; font-weight: 900; color: #e7f6ff; line-height: 1.2; }
.stat-value.warning { color: #fbbf24; }
.stat-value.strong { color: #22d3ee; }
.type-toggle-row { position: relative; margin-bottom: 8px; }
.type-toggle-btn { width: 100%; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.06); color: #e7f6ff; font-weight: 700; display: flex; justify-content: space-between; cursor: pointer; }
.toggle-arrow { transition: transform 0.2s; }
.toggle-arrow.open { transform: rotate(180deg); }
.type-stats-popup { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; z-index: 100; background: #0a1622; border: 1px solid #2a4a6a; border-radius: 10px; padding: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5); }
.type-stats-header { font-size: 12px; color: #8ce9ff; margin-bottom: 8px; }
.type-stats-list { display: grid; gap: 6px; }
.type-stats-row { display: flex; justify-content: space-between; font-size: 12px; }
.type-stats-empty { color: #aaa; text-align: center; }
.tab-row { display: flex; gap: 6px; margin: 8px 0; }
.tab-btn { flex: 1; height: 30px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.06); color: #e7f6ff; font-weight: 700; cursor: pointer; }
.tab-btn.active { border-color: #00f0ff; background: rgba(0, 170, 255, 0.18); }
.pf-list.limited-scroll { max-height: calc(100% - 240px); overflow-y: auto; margin-top: 8px; padding-right: 2px; }
.warning-card { padding: 10px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.05); margin-bottom: 8px; cursor: pointer; }
.warning-card.active { border-color: #00f0ff; }
.warning-top { display: flex; justify-content: space-between; align-items: center; }
.top-left { display: flex; align-items: center; gap: 6px; }
.warning-title { font-size: 14px; font-weight: 900; }
.level-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 900; }
.level-badge.red { background: linear-gradient(135deg, #ef4444, #f87171); }
.level-badge.orange { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.level-badge.yellow { background: linear-gradient(135deg, #eab308, #fde047); color: #3b2f00; }
.level-badge.blue { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
.status-badge { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 900; }
.status-badge.published { color: #7dd3fc; background: rgba(59, 130, 246, 0.16); }
.status-badge.processing { color: #fbbf24; background: rgba(245, 158, 11, 0.16); }
.status-badge.closed { color: #94a3b8; background: rgba(148, 163, 184, 0.14); }
.warning-line { margin-top: 8px; font-size: 11px; }
.warning-meta { margin-top: 8px; display: flex; gap: 6px; }
.meta-item { display: flex; align-items: center; gap: 4px; font-size: 10px; }
.meta-dot { width: 6px; height: 6px; border-radius: 50%; background: #fb7185; }
.boxed-line { padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.04); }
.chart-side .pf-card { padding: 12px; }
.single-chart { background: rgba(0, 0, 0, 0.2); border-radius: 10px; padding: 8px; border: 1px solid rgba(255, 255, 255, 0.08); }
.chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.chart-title { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700; }
.threshold-hint { font-size: 10px; font-weight: 400; color: #8ce9ff; background: rgba(0, 170, 255, 0.12); padding: 2px 8px; border-radius: 10px; }
.metric-select { background: rgba(10, 31, 53, 0.9); border: 1px solid #3c8dbc; border-radius: 6px; color: #e7f6ff; padding: 2px 6px; font-size: 11px; }
.chart-body { margin-top: 4px; }
.chart-canvas-container { position: relative; }
.chart-tooltip { position: absolute; background: rgba(0, 0, 0, 0.8); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; pointer-events: none; white-space: nowrap; z-index: 100; border: 1px solid #3c8dbc; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); transform: translate(-50%, -100%); font-weight: 500; }
.chart-empty { text-align: center; padding: 20px; color: #aaa; font-size: 12px; }
.dam-filter-row { display: flex; gap: 8px; margin-bottom: 8px; }
.dam-select { flex: 1; background: rgba(10, 31, 53, 0.9); border: 1px solid #3c8dbc; border-radius: 6px; color: #e7f6ff; padding: 6px 8px; font-size: 12px; cursor: pointer; }
.dam-select:disabled { opacity: 0.5; cursor: not-allowed; }
.detail-popup { position: fixed; z-index: 10000; width: 280px; background: #0a1a2f; border: 1px solid #3c8dbc; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6); color: #d9f6ff; padding: 12px; user-select: none; pointer-events: auto; }
.popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.drag-handle { cursor: move; user-select: none; }
.popup-close { background: none; border: none; color: #8ce9ff; font-size: 20px; cursor: pointer; line-height: 1; }
.popup-close:hover { color: #fff; }
.popup-body .detail-row { display: flex; margin-bottom: 6px; font-size: 12px; }
.detail-row .k { width: 50px; color: #8ab3d0; }
.detail-row .v { flex: 1; color: #e7f6ff; }
.detail-row.block { flex-direction: column; }
.detail-row.block .k { width: auto; margin-bottom: 4px; }
.level-badge.small { font-size: 10px; padding: 1px 6px; }
.status-badge.small { font-size: 10px; padding: 1px 6px; }
.popup-mask { position: fixed; inset: 0; z-index: 9999; background: transparent; pointer-events: auto; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: rgba(0, 240, 255, 0.3); border-radius: 6px; }
@media (max-width: 1100px) { .pf-side.right { display: none; } .pf-side.left { width: 320px; } }
@media (max-width: 768px) { .pf-side.left { width: 280px; } }
</style>