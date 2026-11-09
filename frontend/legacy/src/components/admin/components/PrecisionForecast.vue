<template>
  <div class="weather-page">
    <div class="bg-grid"></div>
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="page-shell">
      <div class="page-header card-shell">
        <div class="header-left">
          <div class="header-tag">PRECISION WEATHER FORECAST</div>
          <h2>精准预报</h2>
          <p>接入天气预报接口，展示当前天气、未来 7 天、未来 24 小时趋势</p>
        </div>
        <div class="header-right">

        </div>
      </div>

      <!-- 查询卡片 -->
      <div class="card card-shell">
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
              @keyup.enter="searchCity(true)"
              :disabled="loading"
            />
            <button class="btn primary" @click="searchCity(true)" :disabled="loading || !city.trim()">
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

          <div v-if="candidates.length > 0" class="candidate-wrap">
            <div class="candidate-title">
              找到 {{ candidates.length }} 个匹配项，请选择更准确的位置：
            </div>
            <div class="candidate-list">
              <button
                v-for="c in candidates"
                :key="c.id"
                class="candidate"
                :class="{ active: location && location.id === c.id }"
                @click="selectLocation(c)"
                :disabled="loading"
              >
                <div class="c-name">
                  <b>{{ c.name }}</b>
                  <span class="muted"> · {{ c.admin1 || "—" }} · {{ c.country }}</span>
                </div>
                <div class="c-meta mono">
                  {{ Number(c.latitude).toFixed(3) }}, {{ Number(c.longitude).toFixed(3) }}
                </div>
              </button>
            </div>
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

      <!-- 当前天气 + 提示 -->
      <div class="grid-2">
        <div class="card card-shell">
          <div class="card-head">
            <div>
              <div class="card-title">当前天气</div>
              <div class="card-sub">温度、风、湿度等关键要素</div>
            </div>
            <div class="badge" v-if="current">{{ currentDesc }}</div>
          </div>
          <div class="card-body">
            <div v-if="!current" class="empty">请先搜索并选择城市。</div>
            <div v-else class="now-layout">
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
                  <div class="kpi-label">风速</div>
                  <div class="kpi-value">{{ valOrDash(Math.round(current.wind_speed_10m), " km/h") }}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">体感温度</div>
                  <div class="kpi-value">{{ valOrDash(Math.round(current.apparent_temperature), "°C") }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card card-shell">
          <div class="card-head">
            <div>
              <div class="card-title">预报提示</div>
              <div class="card-sub">示例规则</div>
            </div>
          </div>
          <div class="card-body">
            <div v-if="!daily || daily.length === 0" class="empty">暂无预报数据。</div>
            <div v-else class="tips">
              <div class="tip" v-for="t in tips" :key="t.title">
                <div class="tip-title">
                  <span class="dot" :class="t.level"></span>
                  {{ t.title }}
                </div>
                <div class="tip-desc">{{ t.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 未来7天 -->
      <div class="card card-shell">
        <div class="card-head">
          <div>
            <div class="card-title">未来 7 天预报</div>
            <div class="card-sub">最高/最低温、降水、风速</div>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!daily || daily.length === 0" class="empty">暂无数据</div>
          <div v-else class="days">
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
                <div class="mini">
                  <div class="k">日照</div>
                  <div class="v">{{ sunshineHours(d.sunshine) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 未来24小时 -->
      <div class="card card-shell">
        <div class="card-head">
          <div>
            <div class="card-title">未来 24 小时趋势</div>
            <div class="card-sub">温度 / 降水 / 风速（取前 24 条小时数据）</div>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!hourlyRows || hourlyRows.length === 0" class="empty">暂无数据</div>
          <div v-else class="table">
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
  </div>
</template>

<script>
import { originalAxios as axios } from '../../../originalApi.js';

export default {
  name: "PrecisionForecast",
  data() {
    return {
      city: "郴州市",
      countryCode: "CN",
      loading: false,
      status: "",
      error: "",
      candidates: [],
      location: null,
      weatherTimezone: "",
      lastUpdated: "",
      current: null,
      hourlyRows: [],
      daily: [],
      parentMsgHandler: null,
    };
  },
  computed: {
    currentDesc() {
      return this.current ? this.weatherDescFromCode(this.current.weather_code) : "—";
    },
    currentIcon() {
      return this.current ? this.weatherIconFromCode(this.current.weather_code) : "⛅";
    },
    currentTimeDisplay() {
      if (!this.current?.time) return "—";
      return this.formatIso(this.current.time);
    },
    windDir() {
      if (!this.current || this.current.wind_direction_10m == null) return "—";
      const deg = Number(this.current.wind_direction_10m);
      const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北", "北"];
      const idx = Math.round(deg / 45);
      return `${dirs[idx]}（${Math.round(deg)}°）`;
    },
    visibilityKm() {
      if (!this.current || this.current.visibility == null) return "—";
      return `${(Number(this.current.visibility) / 1000).toFixed(1)} km`;
    },
    tips() {
      if (!this.daily || this.daily.length === 0) return [];
      const today = this.daily[0];
      const arr = [];
      if (today.precip_sum >= 20) {
        arr.push({ level: "err", title: "强降水提示", desc: `预计今日累计降水 ${today.precip_sum} mm，建议关注短时强降雨与积涝风险。` });
      } else if (today.precip_sum >= 5) {
        arr.push({ level: "warn", title: "降水提示", desc: `预计今日有降水（累计 ${today.precip_sum} mm），外出注意携带雨具。` });
      } else {
        arr.push({ level: "ok", title: "降水较少", desc: `预计今日降水较少（${today.precip_sum} mm），总体影响较小。` });
      }
      if (today.wind_max >= 35) {
        arr.push({ level: "warn", title: "大风提示", desc: `预计最大风速 ${Math.round(today.wind_max)} km/h，注意户外作业安全。` });
      } else {
        arr.push({ level: "ok", title: "风力正常", desc: `预计最大风速 ${Math.round(today.wind_max)} km/h。` });
      }
      const dT = Math.abs(today.temp_max - today.temp_min);
      if (dT >= 10) {
        arr.push({ level: "warn", title: "昼夜温差较大", desc: `今日温差约 ${Math.round(dT)}°C，注意增减衣物。` });
      }
      return arr;
    },
  },
  mounted() {
    axios.defaults.timeout = 20000;
    this.parentMsgHandler = (e) => {
      // 允许与当前页面同源的消息（本机 localhost 与外网穿透域名均可）
      if (e.origin !== window.location.origin) return;
      const data = e.data || {};
      if (data.source !== "portal8080") return;
      if (data.type === "precisionForecast:requestData") this.emitWeatherSnapshot();
      if (data.type === "precisionForecast:setCity") {
        const { city, countryCode, autoLoad } = data.payload || {};
        if (typeof city === "string" && city.trim()) this.city = city.trim();
        if (typeof countryCode === "string") this.countryCode = countryCode;
        if (autoLoad) this.searchCity(true);
      }
    };
    window.addEventListener("message", this.parentMsgHandler);
    this.searchCity(true);
    window.__precisionForecastGetSnapshot = () => this.getSnapshot();
  },
  beforeUnmount() {
    if (this.parentMsgHandler) {
      window.removeEventListener("message", this.parentMsgHandler);
      this.parentMsgHandler = null;
    }
    if (window.__precisionForecastGetSnapshot) delete window.__precisionForecastGetSnapshot;
  },
  methods: {
    valOrDash(v, suffix = "") {
      if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
      return `${v}${suffix}`;
    },
    formatIso(iso) { return String(iso).replace("T", " "); },
    formatDateTime(input) {
      const d = input ? new Date(input) : new Date();
      if (Number.isNaN(d.getTime())) return new Date().toLocaleString("zh-CN");
      return d.toLocaleString("zh-CN", { hour12: false });
    },
    useDemoCity() { this.city = "郴州市"; this.countryCode = "CN"; this.searchCity(true); },
    async searchCity(autoSelectFirst = false) {
      const name = String(this.city || "").trim();
      if (!name) { this.error = "请输入城市名称"; return; }
      this.loading = true; this.error = ""; this.status = "正在获取天气数据...";
      this.candidates = []; this.location = null; this.current = null; this.daily = []; this.hourlyRows = [];
      this.weatherTimezone = ""; this.lastUpdated = "";
      try {
        const res = await axios.get('/api/precision-forecast/snapshot', {
          params: { city: name, country: this.countryCode }
        });
        const responseData = res.data;
        if (responseData.code !== 200) throw new Error(responseData.message || "接口返回错误");
        this.location = responseData.location;
        if (Array.isArray(responseData.candidates) && responseData.candidates.length) {
          this.candidates = responseData.candidates;
          this.status = "城市匹配完成，天气数据加载成功";
        } else if (this.location) {
          this.candidates = [this.location];
          this.status = "天气数据加载完成";
        }
        const weather = responseData.weather || {};
        this.weatherTimezone = weather.timezone || '';
        this.lastUpdated = this.formatDateTime(responseData.lastUpdated || new Date());
        this.current = weather.current || null;
        this.hourlyRows = this.buildHourlyRows(weather).slice(0, 24);
        this.daily = this.buildDailyRows(weather).slice(0, 7);
        this.emitWeatherSnapshot();
      } catch (e) {
        console.error('请求天气数据失败：', e);
        this.error = e.message || '请求失败，请检查城市名称或网络';
        this.status = '';
      } finally { this.loading = false; }
    },
    async selectLocation(c) {
      this.location = c; this.loading = true; this.error = ""; this.status = `正在获取${c.name}的天气数据...`;
      try {
        const res = await axios.get('/disaster-gw/precision-forecast/forecast', {
          params: { lat: c.latitude, lon: c.longitude }
        });
        const responseData = res.data;
        if (responseData.code !== 200) throw new Error(responseData.message || "获取天气失败");
        const weather = responseData.data || {};
        this.weatherTimezone = weather.timezone || '';
        this.lastUpdated = this.formatDateTime(new Date());
        this.current = weather.current || null;
        this.hourlyRows = this.buildHourlyRows(weather).slice(0, 24);
        this.daily = this.buildDailyRows(weather).slice(0, 7);
        this.status = `${c.name}天气数据加载完成`;
        this.emitWeatherSnapshot();
      } catch (e) {
        this.error = e.message || `获取${c.name}天气失败`;
        this.status = '';
      } finally { this.loading = false; }
    },
    buildHourlyRows(w) {
      const h = w.hourly || {};
      const times = h.time || [], temps = h.temperature_2m || [], prec = h.precipitation || [];
      const codes = h.weather_code || [], wind = h.wind_speed_10m || [];
      const now = Date.now();
      const startIndex = times.findIndex((t) => new Date(t).getTime() >= now);
      const begin = startIndex >= 0 ? startIndex : 0;
      const end = Math.min(begin + 24, times.length);
      const rows = [];
      for (let i = begin; i < end; i++) {
        rows.push({ time: this.formatIso(times[i]), temp: temps[i], precip: prec[i], weather_code: codes[i], wind: wind[i] });
      }
      return rows;
    },
    buildDailyRows(w) {
      const d = w.daily || {};
      const dates = d.time || [], tmax = d.temperature_2m_max || [], tmin = d.temperature_2m_min || [];
      const p = d.precipitation_sum || [], windMax = d.wind_speed_10m_max || [], code = d.weather_code || [], sunshine = d.sunshine_duration || [];
      const rows = [];
      for (let i = 0; i < dates.length; i++) {
        rows.push({
          date: dates[i], weekday: this.weekdayCN(dates[i]), temp_max: tmax[i], temp_min: tmin[i],
          precip_sum: p[i], wind_max: windMax[i], weather_code: code[i], sunshine: sunshine[i]
        });
      }
      return rows;
    },
    weekdayCN(dateStr) {
      const d = new Date(`${dateStr}T00:00:00`);
      const ws = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      return ws[d.getDay()];
    },
    sunshineHours(seconds) {
      if (seconds == null) return "—";
      const h = Number(seconds) / 3600;
      return `${h.toFixed(1)} h`;
    },
    weatherDescFromCode(code) {
      const c = Number(code);
      if (c === 0) return "晴"; if (c === 1) return "大致晴"; if (c === 2) return "多云"; if (c === 3) return "阴";
      if (c === 45 || c === 48) return "雾"; if (c >= 51 && c <= 57) return "毛毛雨"; if (c >= 61 && c <= 67) return "雨";
      if (c >= 71 && c <= 77) return "雪"; if (c >= 80 && c <= 82) return "阵雨"; if (c >= 85 && c <= 86) return "阵雪";
      if (c >= 95) return "雷暴"; return "未知";
    },
    weatherIconFromCode(code) {
      const c = Number(code);
      if (c === 0) return "☀️"; if (c === 1) return "🌤️"; if (c === 2) return "⛅"; if (c === 3) return "☁️";
      if (c === 45 || c === 48) return "🌫️"; if (c >= 51 && c <= 57) return "🌦️"; if (c >= 61 && c <= 67) return "🌧️";
      if (c >= 71 && c <= 77) return "🌨️"; if (c >= 80 && c <= 82) return "🌧️"; if (c >= 85 && c <= 86) return "🌨️";
      if (c >= 95) return "⛈️"; return "⛅";
    },
    postToParent(type, payload) {
      if (window.self === window.top) return;
      try {
        const safePayload = JSON.parse(JSON.stringify(payload));
        window.parent.postMessage({ source: "precisionForecast", type, payload: safePayload }, window.location.origin);
      } catch (err) { console.warn("[postMessage ignored]", type, err?.message || err); }
    },
    getSnapshot() {
      return {
        city: this.city, countryCode: this.countryCode, location: this.location, weatherTimezone: this.weatherTimezone,
        lastUpdated: this.lastUpdated, current: this.current,
        daily: Array.isArray(this.daily) ? this.daily.slice(0, 7) : [],
        hourlyRows: Array.isArray(this.hourlyRows) ? this.hourlyRows.slice(0, 24) : [],
      };
    },
    emitWeatherSnapshot() { this.postToParent("precisionForecast:data", this.getSnapshot()); },
  },
};
</script>

<style scoped>
/* 全局深色科技风背景 */
.weather-page {
  position: relative;
  min-height: 100%;
  padding: 18px;
  color: #d9f6ff;
  background:
    radial-gradient(circle at 12% 10%, rgba(34, 132, 255, 0.16), transparent 26%),
    radial-gradient(circle at 90% 8%, rgba(21, 255, 208, 0.1), transparent 22%),
    linear-gradient(180deg, #07111d 0%, #091726 52%, #081321 100%);
  overflow-x: hidden;
}

.page-shell {
  position: relative;
  z-index: 1;
  width: 100%;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(93, 196, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(93, 196, 255, 0.05) 1px, transparent 1px);
  background-size: 26px 26px;
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(68px);
  opacity: 0.4;
  pointer-events: none;
}

.bg-glow-1 {
  width: 240px;
  height: 240px;
  background: rgba(0, 191, 255, 0.18);
  top: 4%;
  right: 4%;
}

.bg-glow-2 {
  width: 260px;
  height: 260px;
  background: rgba(0, 255, 174, 0.12);
  left: -70px;
  bottom: 8%;
}

.card-shell {
  border-radius: 20px;
  border: 1px solid rgba(98, 204, 255, 0.14);
  background: linear-gradient(180deg, rgba(8, 24, 44, 0.92), rgba(7, 19, 36, 0.96));
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2), inset 0 0 30px rgba(74, 176, 255, 0.04);
  backdrop-filter: blur(8px);
}

.page-header,
.card {
  margin-bottom: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.header-left {
  min-width: 0;
}

.header-tag {
  display: inline-block;
  margin-bottom: 10px;
  padding: 5px 10px;
  border: 1px solid rgba(86, 207, 255, 0.35);
  border-radius: 999px;
  color: #86e8ff;
  font-size: 12px;
  letter-spacing: 1px;
  background: rgba(7, 43, 78, 0.45);
}

.page-header h2 {
  margin: 0;
  font-size: 32px;
  color: #f4fdff;
  letter-spacing: 1px;
  line-height: 1.2;
}

.page-header p {
  margin: 10px 0 0;
  color: rgba(211, 241, 255, 0.74);
  font-size: 14px;
  line-height: 1.7;
  max-width: 720px;
}

.header-right {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.header-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(86, 207, 255, 0.22);
  background: rgba(6, 28, 50, 0.72);
  color: #c7f6ff;
  font-size: 13px;
  box-shadow: inset 0 0 24px rgba(42, 140, 201, 0.08);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5cd6ff;
  box-shadow: 0 0 10px rgba(92, 214, 255, 0.8);
}

.dot.live {
  background: #00ffbf;
  box-shadow: 0 0 10px rgba(0, 255, 191, 0.8);
}

.card {
  padding: 16px;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-title {
  color: #ebfbff;
  font-size: 18px;
  font-weight: 700;
}

.card-sub {
  margin-top: 6px;
  color: rgba(199, 237, 252, 0.64);
  font-size: 13px;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.select,
.input {
  height: 38px;
  border: 1px solid rgba(94, 196, 255, 0.2);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
  background: rgba(9, 25, 45, 0.9);
  color: #e6fbff;
  box-sizing: border-box;
}

.input {
  width: 260px;
}

.input::placeholder {
  color: rgba(189, 225, 239, 0.42);
}

.input:focus,
.select:focus {
  border-color: rgba(98, 205, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(76, 172, 255, 0.08);
}

.btn {
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn.primary {
  color: #ffffff;
  background: linear-gradient(90deg, #1a87ff, #1ce0ff);
}

.btn.primary:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn.ghost {
  color: #8ee9ff;
  background: rgba(10, 31, 53, 0.9);
  border-color: rgba(94, 196, 255, 0.2);
}

.btn.ghost:hover {
  border-color: rgba(94, 196, 255, 0.35);
  background: rgba(14, 37, 63, 0.95);
}

.badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 170, 255, 0.08);
  border: 1px solid rgba(93, 196, 255, 0.18);
  color: #8ce9ff;
  white-space: nowrap;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(8, 22, 39, 0.7);
  border: 1px solid rgba(99, 205, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
  color: #d9f6ff;
  font-size: 13px;
}

.alert.err {
  border-color: rgba(255, 91, 125, 0.3);
}

.dot.ok {
  background: #00ffbf;
  box-shadow: 0 0 10px rgba(0, 255, 191, 0.8);
}

.dot.err {
  background: #ff5b7d;
  box-shadow: 0 0 10px rgba(255, 91, 125, 0.8);
}

.dot.warn {
  background: #ffb347;
  box-shadow: 0 0 10px rgba(255, 179, 71, 0.8);
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 6px;
  color: rgba(215, 244, 255, 0.82);
  font-size: 12px;
}

.meta-item .k {
  color: rgba(198, 239, 255, 0.75);
}

.meta-item .v {
  color: #e7fcff;
  font-weight: 700;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.candidate-wrap {
  margin-top: 6px;
}

.candidate-title {
  font-size: 12px;
  color: rgba(198, 239, 255, 0.75);
  margin-bottom: 10px;
}

.candidate-list {
  display: grid;
  gap: 10px;
}

.candidate {
  text-align: left;
  border: 1px solid rgba(112, 208, 255, 0.12);
  background: linear-gradient(90deg, rgba(12, 31, 54, 0.9), rgba(8, 23, 43, 0.94));
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: inherit;
}

.candidate:hover {
  background: rgba(14, 37, 63, 0.95);
  transform: translateY(-1px);
}

.candidate.active {
  border-color: rgba(98, 205, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(76, 172, 255, 0.08);
}

.c-name {
  font-size: 13px;
  color: #e7fcff;
}

.muted {
  color: rgba(198, 239, 255, 0.75);
  font-weight: 500;
}

.c-meta {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
}

.grid-2 {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.now-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 14px;
}

.now-main {
  border: 1px solid rgba(112, 208, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 31, 54, 0.9), rgba(8, 23, 43, 0.94));
  border-radius: 14px;
  padding: 14px;
}

.now-top {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 12px;
}

.now-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(7, 22, 40, 0.72);
  border: 1px solid rgba(106, 203, 255, 0.1);
  font-size: 20px;
}

.now-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 170, 255, 0.08);
  border: 1px solid rgba(93, 196, 255, 0.18);
  color: #8ce9ff;
}

.tag.ghost {
  background: rgba(7, 22, 40, 0.72);
  border: 1px solid rgba(106, 203, 255, 0.1);
  color: rgba(215, 244, 255, 0.82);
}

.now-time {
  margin-top: 6px;
  color: rgba(198, 239, 255, 0.75);
  font-size: 12px;
}

.now-temp-row {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
}

.now-temp {
  font-size: 52px;
  font-weight: 900;
  color: #f4fdff;
  line-height: 1;
}

.now-sub {
  font-size: 13px;
  color: rgba(215, 244, 255, 0.82);
  line-height: 1.6;
}

.now-sub b {
  color: #f0fdff;
  font-weight: 900;
}

.now-divider {
  height: 1px;
  background: rgba(110, 196, 239, 0.08);
  margin: 14px 0;
}

.now-footer {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.mini-stat {
  background: rgba(7, 22, 40, 0.72);
  border: 1px solid rgba(106, 203, 255, 0.1);
  border-radius: 12px;
  padding: 10px;
}

.mini-k {
  color: rgba(187, 229, 246, 0.58);
  font-size: 12px;
}

.mini-v {
  margin-top: 6px;
  color: #e7fcff;
  font-weight: 900;
  font-size: 13px;
}

.now-kpis {
  display: grid;
  gap: 10px;
}

.kpi-card {
  border: 1px solid rgba(106, 203, 255, 0.1);
  background: rgba(7, 22, 40, 0.72);
  border-radius: 14px;
  padding: 12px;
}

.kpi-label {
  color: rgba(187, 229, 246, 0.58);
  font-size: 12px;
}

.kpi-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 900;
  color: #f8feff;
}

.empty {
  color: rgba(203, 238, 252, 0.58);
  font-size: 13px;
  padding: 10px 0;
}

.tips {
  display: grid;
  gap: 10px;
}

.tip {
  border: 1px solid rgba(112, 208, 255, 0.12);
  background: rgba(7, 22, 40, 0.72);
  border-radius: 12px;
  padding: 12px;
}

.tip-title {
  font-weight: 900;
  color: #f0fdff;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tip-desc {
  margin-top: 6px;
  color: rgba(205, 236, 248, 0.78);
  font-size: 12px;
}

.days {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.day {
  border: 1px solid rgba(112, 208, 255, 0.12);
  background: rgba(7, 22, 40, 0.72);
  border-radius: 12px;
  padding: 12px;
}

.day-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.day-date {
  color: rgba(215, 244, 255, 0.82);
  font-size: 12px;
  font-weight: 700;
}

.day-ico {
  font-size: 18px;
}

.day-mid {
  margin-top: 10px;
}

.temp {
  font-size: 16px;
  color: #f0fdff;
}

.temp b {
  font-weight: 900;
}

.desc {
  margin-top: 6px;
  color: rgba(198, 239, 255, 0.75);
  font-size: 12px;
}

.day-kpis {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.mini {
  border: 1px solid rgba(106, 203, 255, 0.1);
  border-radius: 12px;
  background: rgba(7, 20, 36, 0.82);
  padding: 8px;
}

.mini .k {
  color: rgba(187, 229, 246, 0.58);
  font-size: 12px;
}

.mini .v {
  margin-top: 4px;
  color: #e7fcff;
  font-weight: 900;
  font-size: 12px;
}

.table {
  display: grid;
  gap: 8px;
}

.thead {
  display: grid;
  grid-template-columns: 1.1fr 1.3fr 0.7fr 0.7fr 0.7fr;
  padding: 10px;
  background: rgba(8, 22, 39, 0.7);
  border: 1px solid rgba(99, 205, 255, 0.08);
  border-radius: 10px;
  font-size: 12px;
  color: rgba(198, 239, 255, 0.75);
  font-weight: 700;
}

.trow {
  display: grid;
  grid-template-columns: 1.1fr 1.3fr 0.7fr 0.7fr 0.7fr;
  padding: 10px;
  border: 1px solid rgba(99, 205, 255, 0.08);
  border-radius: 10px;
  background: rgba(8, 22, 39, 0.5);
}

.trow:hover {
  background: rgba(14, 37, 63, 0.95);
}

.th,
.td {
  font-size: 12px;
  color: #e7fcff;
}

@media (max-width: 1100px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
  .now-layout {
    grid-template-columns: 1fr;
  }
  .now-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .days {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .days {
    grid-template-columns: 1fr;
  }
  .input {
    width: 100%;
  }
  .now-kpis {
    grid-template-columns: 1fr;
  }
  .now-temp-row {
    grid-template-columns: 1fr;
  }
  .now-temp {
    font-size: 46px;
  }
  .now-footer {
    grid-template-columns: 1fr;
  }
}
</style>