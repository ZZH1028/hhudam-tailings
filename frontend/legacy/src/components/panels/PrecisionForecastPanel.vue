<template>
  <div class="page">
    <div class="page-title">
      <h2>精准预报 - 天气预报</h2>
      <p>接入天气预报接口，展示当前天气、未来 7 天、未来 24 小时趋势</p>
    </div>

    <!-- 查询卡片 -->
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">天气查询</div>
          <div class="card-sub">支持城市候选选择，避免定位同名城市</div>
        </div>

        <div class="actions">
          <select class="select" v-model="countryCode" :disabled="loading">
            <option value="CN">中国(CN)</option>
            <option value="">不限国家</option>
          </select>

          <input
            class="input"
            v-model="city"
            placeholder="例如：北京市 / 上海市 / 广州市 / 郴州市 / 来宾市"
            @keyup.enter="searchCity"
            :disabled="loading"
          />

          <button class="btn primary" @click="searchCity" :disabled="loading || !city.trim()">
            {{ loading ? "加载中..." : "搜索并加载" }}
          </button>

          <button class="btn ghost" @click="useDemoCity" :disabled="loading">
            示例：郴州市
          </button>
        </div>
      </div>

      <div class="card-body">
        <div v-if="error" class="alert err">
          <span class="dot err"></span>
          <span>{{ error }}</span>
        </div>

        <div v-if="status" class="alert" :class="{ ok: !error, err: !!error }">
          <span class="dot" :class="{ ok: !error, err: !!error }"></span>
          <span>{{ status }}</span>
        </div>

        <div class="meta-row" v-if="location">
          <div class="meta-item">
            <span class="k">定位：</span>
            <span class="v">{{ location.name }}（{{ location.country }}）</span>
          </div>
          <div class="meta-item">
            <span class="k">坐标：</span>
            <span class="v mono">{{ location.latitude }}, {{ location.longitude }}</span>
          </div>
          <div class="meta-item">
            <span class="k">时区：</span>
            <span class="v">{{ weatherTimezone || "—" }}</span>
          </div>
          <div class="meta-item">
            <span class="k">更新时间：</span>
            <span class="v">{{ lastUpdated || "—" }}</span>
          </div>
          <div class="meta-item">
            <span class="k">单位：</span>
            <span class="v">°C / km·h⁻¹ / mm</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前天气 -->
    <div class="grid-2" v-if="current">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">当前天气</div>
            <div class="card-sub">温度、风、湿度等关键要素</div>
          </div>
          <div class="badge">{{ currentDesc }}</div>
        </div>

        <div class="card-body">
          <div class="now-layout">
            <div class="now-main">
              <div class="now-top">
                <div class="now-icon">{{ currentIcon }}</div>
                <div class="now-meta">
                  <div class="now-title">
                    <span class="tag">{{ currentDesc }}</span>
                    <span class="tag ghost">{{ location?.name || "—" }}</span>
                  </div>
                  <div class="now-time">
                    当前时间：<span class="mono">{{ currentTimeDisplay }}</span>
                  </div>
                </div>
              </div>

              <div class="now-temp-row">
                <div class="now-temp">{{ Math.round(current.temperature_2m) }}°C</div>
                <div class="now-sub">
                  <div>体感：<b>{{ valOrDash(Math.round(current.apparent_temperature), "°C") }}</b></div>
                  <div>风速：<b>{{ Math.round(current.wind_speed_10m) }} km/h</b></div>
                </div>
              </div>

              <div class="now-divider"></div>

              <div class="now-footer">
                <div class="mini-stat">
                  <div class="mini-k">风向</div>
                  <div class="mini-v">{{ windDir }}</div>
                </div>
                <div class="mini-stat">
                  <div class="mini-k">云量</div>
                  <div class="mini-v">{{ valOrDash(current.cloud_cover, "%") }}</div>
                </div>
                <div class="mini-stat">
                  <div class="mini-k">降水</div>
                  <div class="mini-v">{{ valOrDash(current.precipitation, " mm") }}</div>
                </div>
              </div>
            </div>

            <div class="now-kpis">
              <div class="kpi-card">
                <div class="kpi-label">相对湿度</div>
                <div class="kpi-value">{{ valOrDash(current.relative_humidity_2m, "%") }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">气压</div>
                <div class="kpi-value">{{ valOrDash(current.surface_pressure, " hPa") }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">能见度</div>
                <div class="kpi-value">{{ visibilityKm }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">体感温度</div>
                <div class="kpi-value">{{ valOrDash(Math.round(current.apparent_temperature), "°C") }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">风速</div>
                <div class="kpi-value">{{ valOrDash(Math.round(current.wind_speed_10m), " km/h") }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 未来7天 -->
    <div class="card" v-if="daily.length">
      <div class="card-head">
        <div>
          <div class="card-title">未来 7 天预报</div>
          <div class="card-sub">最高/最低温、降水、风速</div>
        </div>
      </div>

      <div class="card-body">
        <div class="days">
          <div class="day" v-for="d in daily" :key="d.date">
            <div class="day-top">
              <div class="day-date">{{ d.weekday }} · {{ d.date }}</div>
              <div class="day-ico">{{ weatherIconFromCode(d.weather_code) }}</div>
            </div>

            <div class="day-mid">
              <div class="temp">
                <b>{{ Math.round(d.temp_max) }}°</b>
                <span>/</span>
                <span>{{ Math.round(d.temp_min) }}°</span>
              </div>
              <div class="desc">{{ weatherDescFromCode(d.weather_code) }}</div>
            </div>

            <div class="day-kpis">
              <div class="mini">
                <div class="k">降水</div>
                <div class="v">{{ d.precip_sum }} mm</div>
              </div>
              <div class="mini">
                <div class="k">风速</div>
                <div class="v">{{ Math.round(d.wind_max) }} km/h</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 未来24小时 -->
    <div class="card" v-if="hourlyRows.length">
      <div class="card-head">
        <div>
          <div class="card-title">未来 24 小时趋势</div>
          <div class="card-sub">温度 / 降水 / 风速（取前 24 条小时数据）</div>
        </div>
      </div>

      <div class="card-body">
        <div class="table">
          <div class="thead">
            <div class="th">时间</div>
            <div class="th">天气</div>
            <div class="th">温度</div>
            <div class="th">降水</div>
            <div class="th">风速</div>
          </div>

          <div class="trow" v-for="r in hourlyRows" :key="r.time">
            <div class="td mono">{{ r.time }}</div>
            <div class="td">{{ weatherIconFromCode(r.weather_code) }} {{ weatherDescFromCode(r.weather_code) }}</div>
            <div class="td"><b>{{ Math.round(r.temp) }}°C</b></div>
            <div class="td">{{ r.precip }} mm</div>
            <div class="td">{{ Math.round(r.wind) }} km/h</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { originalAxios as axios } from '../../originalApi.js';
import { ref, computed } from 'vue';

// 响应式数据
const city = ref('郴州市');
const countryCode = ref('CN');
const loading = ref(false);
const status = ref('');
const error = ref('');

const location = ref(null);
const weatherTimezone = ref('');
const lastUpdated = ref('');
const current = ref(null);
const hourlyRows = ref([]);
const daily = ref([]);

// 计算属性
const currentDesc = computed(() => (current.value ? weatherDescFromCode(current.value.weather_code) : '—'));
const currentIcon = computed(() => (current.value ? weatherIconFromCode(current.value.weather_code) : '⛅'));
const currentTimeDisplay = computed(() => (current.value?.time ? formatIso(current.value.time) : '—'));
const windDir = computed(() => {
  if (!current.value || current.value.wind_direction_10m == null) return '—';
  const deg = Number(current.value.wind_direction_10m);
  const dirs = ['北','东北','东','东南','南','西南','西','西北','北'];
  const idx = Math.round(deg / 45);
  return `${dirs[idx]}（${Math.round(deg)}°）`;
});
const visibilityKm = computed(() => {
  if (!current.value || current.value.visibility == null) return '—';
  return `${(Number(current.value.visibility)/1000).toFixed(1)} km`;
});

// 工具函数
function valOrDash(v, suffix='') {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${v}${suffix}`;
}

function formatIso(iso) {
  return String(iso).replace('T', ' ');
}

function weekdayCN(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const ws = ['周日','周一','周二','周三','周四','周五','周六'];
  return ws[d.getDay()];
}

function buildHourlyRows(w) {
  const h = w.hourly || {};
  const times = h.time || [];
  const temps = h.temperature_2m || [];
  const prec = h.precipitation || [];
  const codes = h.weather_code || [];
  const wind = h.wind_speed_10m || [];
  const now = Date.now();
  const startIndex = times.findIndex(t => new Date(t).getTime() >= now);
  const begin = startIndex >=0 ? startIndex : 0;
  const end = Math.min(begin + 24, times.length);
  return times.slice(begin,end).map((t,i)=>({
    time: formatIso(times[begin+i]),
    temp: temps[begin+i],
    precip: prec[begin+i],
    weather_code: codes[begin+i],
    wind: wind[begin+i]
  }));
}

function buildDailyRows(w) {
  const d = w.daily || {};
  const dates = d.time || [];
  const tmax = d.temperature_2m_max || [];
  const tmin = d.temperature_2m_min || [];
  const p = d.precipitation_sum || [];
  const windMax = d.wind_speed_10m_max || [];
  const code = d.weather_code || [];
  return dates.map((date,i)=>({
    date,
    weekday: weekdayCN(date),
    temp_max: tmax[i],
    temp_min: tmin[i],
    precip_sum: p[i],
    wind_max: windMax[i],
    weather_code: code[i]
  }));
}

function weatherDescFromCode(code) {
  const c = Number(code);
  if(c===0) return '晴';
  if(c===1) return '大致晴';
  if(c===2) return '多云';
  if(c===3) return '阴';
  if(c===45||c===48) return '雾';
  if(c>=51&&c<=57) return '毛毛雨';
  if(c>=61&&c<=67) return '雨';
  if(c>=71&&c<=77) return '雪';
  if(c>=80&&c<=82) return '阵雨';
  if(c>=85&&c<=86) return '阵雪';
  if(c>=95) return '雷暴';
  return `天气码 ${c}`;
}

function weatherIconFromCode(code) {
  const c = Number(code);
  if(c===0) return '☀️';
  if(c===1) return '🌤️';
  if(c===2) return '⛅';
  if(c===3) return '☁️';
  if(c===45||c===48) return '🌫️';
  if(c>=51&&c<=57) return '🌦️';
  if(c>=61&&c<=67) return '🌧️';
  if(c>=71&&c<=77) return '🌨️';
  if(c>=80&&c<=82) return '🌧️';
  if(c>=85&&c<=86) return '🌨️';
  if(c>=95) return '⛈️';
  return '⛅';
}

// 核心请求函数（只请求本地代理接口，无跨域）
async function searchCity() {
  if (!city.value.trim()) return;
  loading.value = true;
  error.value = '';
  status.value = '正在获取天气数据...';

  try {
    // 只请求本地代理的 snapshot 接口，参数完全匹配代理要求
    const res = await axios.get('/api/precision-forecast/snapshot', {
      params: {
        city: city.value.trim(),
        country: countryCode.value // 匹配代理的 country 参数
      }
    });

    const snap = res.data;
    location.value = snap.location;
    const w = snap.weather || {};

    // 赋值数据
    weatherTimezone.value = w.timezone || '';
    lastUpdated.value = snap.lastUpdated || '';
    current.value = w.current || null;
    hourlyRows.value = buildHourlyRows(w);
    daily.value = buildDailyRows(w);

    status.value = '天气数据加载完成';
  } catch(e) {
    console.error('请求失败：', e);
    error.value = e?.response?.data?.message || e.message || '请求失败，请重试';
    status.value = '';
  } finally {
    loading.value = false;
  }
}

// 示例城市快捷按钮
function useDemoCity() {
  city.value = '郴州市';
  countryCode.value = 'CN';
  searchCity();
}

// 初始化加载
searchCity();
</script>

<style scoped>
/* 保留原有样式，确保UI不变 */
.page-title h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}
.page-title p {
  margin: 6px 0 16px;
  color: #909399;
  font-size: 13px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.card {
  background: #fff;
  border: 1px solid #e9edf3;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(31, 45, 61, 0.06);
  overflow: hidden;
  margin-bottom: 16px;
}

.card-head {
  padding: 14px 16px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid #f0f2f5;
  gap: 12px;
}

.card-title {
  font-weight: 700;
  color: #303133;
  font-size: 14px;
}
.card-sub {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.card-body {
  padding: 16px;
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.select,
.input {
  height: 34px;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  padding: 0 10px;
  font-size: 12px;
  outline: none;
  background: #fbfcfe;
  color: #303133;
}
.input {
  width: 260px;
}
.input:focus,
.select:focus {
  border-color: rgba(64, 158, 255, 0.6);
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.12);
  background: #fff;
}

.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}
.btn.primary {
  background: #409eff;
  color: #fff;
}
.btn.primary:disabled {
  background: #c7d6ea;
  cursor: not-allowed;
}
.btn.ghost {
  background: #fff;
  color: #2a3c54;
  border-color: rgba(15, 23, 42, 0.14);
}
.btn.ghost:hover {
  background: #f3f6fb;
}

.badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid rgba(79, 70, 229, 0.15);
  white-space: nowrap;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
  color: #303133;
}
.alert.err {
  border-color: rgba(245, 108, 108, 0.25);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #94a3b8;
}
.dot.ok { background: #22c55e; }
.dot.err { background: #ef4444; }

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 6px;
  color: #606266;
  font-size: 12px;
}
.meta-item .k { color: #909399; }
.meta-item .v { color: #303133; font-weight: 700; }

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.now-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.now-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.now-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.now-icon {
  font-size: 48px;
}
.now-meta {
  flex: 1;
}
.now-title {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.now-time {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.now-temp-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.now-temp {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
}
.now-sub {
  font-size: 12px;
  color: #606266;
}
.now-divider {
  height: 1px;
  background: #e9edf3;
  margin: 8px 0;
}
.now-footer {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.mini-stat {
  flex: 1;
  min-width: 80px;
}
.mini-k {
  font-size: 12px;
  color: #909399;
}
.mini-v {
  font-size: 13px;
  color: #303133;
  font-weight: 700;
  margin-top: 4px;
}

.now-kpis {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.kpi-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}
.kpi-label {
  font-size: 12px;
  color: #909399;
}
.kpi-value {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  margin-top: 4px;
}

.days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.day {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}
.day-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.day-date {
  font-size: 12px;
  color: #606266;
}
.day-ico {
  font-size: 20px;
}
.day-mid {
  margin-bottom: 8px;
}
.temp {
  font-size: 14px;
  font-weight: 700;
  color: #303133;
}
.desc {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
}
.day-kpis {
  display: flex;
  gap: 8px;
  font-size: 12px;
}
.mini {
  flex: 1;
}
.mini .k {
  color: #909399;
}
.mini .v {
  color: #303133;
  font-weight: 700;
  margin-top: 4px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}
.thead {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr 1fr;
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 8px 8px 0 0;
  font-weight: 700;
  font-size: 12px;
  color: #606266;
}
.trow {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr 1fr;
  padding: 8px 12px;
  border-bottom: 1px solid #e9edf3;
  font-size: 12px;
  align-items: center;
}
.trow:last-child {
  border-bottom: none;
}
.td {
  color: #303133;
}
</style>