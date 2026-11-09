<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand-mark"><svg viewBox="0 0 34 34" aria-hidden="true"><path d="M7 26L13 8H21L27 26M4 26H30M9 20H25M11 14H23"/></svg></div>
      <nav aria-label="工程分析功能"><button v-for="item in navigation" :key="item.id" :class="{active:tab===item.id}" @click="setTab(item.id)"><span class="nav-icon" aria-hidden="true">{{item.icon}}</span><span>{{item.label}}</span></button></nav>
    </aside>
    <header class="topbar">
      <div class="platform-title"><h1>工程分析工作台</h1><span class="title-divider"></span><span class="workspace-title">{{navigation.find(item=>item.id===tab)?.label}}</span></div>
      <div class="topbar-right"><span class="service-status"><i></i>导入数据保存在当前浏览器</span><a class="secondary" :href="manualUrl" target="_blank" rel="noopener">使用说明 ↗</a></div>
    </header>
    <main class="workspace">
      <div class="map-stage" :class="{'map-dimmed':!['scene','flood'].includes(tab)}"><div id="platformMap" aria-label="工程三维地图"></div><div class="map-vignette"></div><div v-if="mapError" class="map-error" role="status"><b>三维场景未能初始化</b><p>{{mapError}}</p><p>请使用支持WebGL2的新版Chrome或Edge。坐标查询、知识库和文件导入仍可使用。</p></div></div>
      <template v-if="['scene','flood'].includes(tab)">
        <section class="scene-heading"><p class="eyebrow">{{tab==='flood'?'INUNDATION ANALYSIS':'SPATIAL WORKSPACE'}}</p><h2>{{tab==='flood'?'溃坝淹没过程':'工程三维场景'}}</h2><p>{{tab==='flood'?'以时间与位置连接每一个水深值。':'切换原站实景和导入模型，查看不同方位。'}}</p></section>
        <div class="scene-toolbar"><button v-for="v in views" :key="v.id" @click="scene?.view(v.id)">{{v.label}}</button><i></i><button @click="setInteraction('measure')">测距</button><button @click="setInteraction('area')">圈选</button><button v-if="tab==='flood'" @click="setInteraction('probe')">水深拾取</button></div>
        <section class="metric-strip" v-if="tab==='scene'"><div><span>三维模型</span><strong>{{models.length}}</strong><small>内置与本机导入</small></div><div><span>水深过程</span><strong>{{floods.length}}</strong><small>可回放的数据集</small></div><div><span>专业资料</span><strong>{{docs.length}}</strong><small>资料目录</small></div></section>
        <div class="map-source"><span class="tiny-dot"></span>{{activeModel?.name||'等待加载模型'}}<span v-if="modelBusy"> · 正在加载…</span><small>{{activeModel?.description}}</small></div>
        <aside class="scene-panel glass"><div class="panel-heading"><span>{{tab==='scene'?'模型与视角':'水深工作台'}}</span><span class="mini-label">{{tab==='scene'?'SCENE':'DEPTH'}}</span></div>
          <template v-if="tab==='scene'"><label>当前模型<select :value="modelId" @change="changeModel($event.target.value)"><option v-for="m in models" :key="m.id" :value="m.id">{{m.name}}</option></select></label><p class="panel-note">{{activeModel?.description}}</p><div class="view-grid"><button v-for="v in views" :key="v.id" @click="scene?.view(v.id)"><span>{{v.symbol}}</span>{{v.label}}视角</button></div><button class="secondary wide" @click="openImport('model')">＋ 导入 / 添加模型</button><div class="section-line"></div><p class="field-label">空间工具</p><div class="tool-pair"><button @click="setInteraction('measure')">测量距离</button><button @click="setInteraction('area')">圈定区域</button></div><p class="panel-note">{{measurementText}}</p><button class="text-btn" @click="clearMeasurements">清除测量与圈选</button><div class="section-line"></div><a class="resource-link" :href="manualUrl" rel="noopener" target="_blank">平台使用与导入说明<span>↗</span></a><button v-if="showFlood" class="primary wide scene-enter" @click="setTab('flood')">进入淹没分析 <span>→</span></button></template>
          <template v-else><label>背景模型<select :value="modelId" @change="changeModel($event.target.value)"><option v-for="m in models" :key="m.id" :value="m.id">{{m.name}}</option></select></label><label>水深数据<select v-model="floodId" @change="loadFlood(true)"><option v-for="f in floods" :key="f.id" :value="f.id">{{f.name}}</option></select></label><div class="source-tag" :class="{demo:isExample}">{{sourceLabel}}</div><div class="depth-stats"><div><span>当前时间</span><strong>{{currentTime.toFixed(1)}}<small> s</small></strong></div><div><span>当前最大水深</span><strong>{{frameStats.maximum.toFixed(2)}}<small> m</small></strong></div></div><div class="tool-pair"><button @click="locateFlood()">定位计算范围</button><button @click="waterVisible=!waterVisible">{{waterVisible?'隐藏水深层':'显示水深层'}}</button></div><button class="secondary wide" @click="openImport('flood')">＋ 导入OpenFOAM / 水深数据</button><div class="section-line"></div><div class="probe-heading"><span>位置水深查询</span><small>地图点击 / 坐标输入</small></div><div class="coordinate-form"><input type="number" step="any" v-model="probeLon" placeholder="经度" aria-label="查询经度"><input type="number" step="any" v-model="probeLat" placeholder="纬度" aria-label="查询纬度"><button @click="probeAt(probeLon,probeLat)">查询</button></div><div v-if="probe" class="probe-result"><span>{{probe.status==='wet'?'当前淹没水深':probe.status==='dry'?'当前状态：干燥':probe.status==='outside'?'超出模拟范围':'没有有效计算网格'}}</span><strong v-if="probe.depth!=null">{{probe.depth.toFixed(3)}}<small> m</small></strong><p v-else>{{probe.message}}</p><div v-if="probe.depth!=null" class="probe-details"><span>全过程最大 <b>{{probe.maximum_depth.toFixed(3)}} m</b></span><span>首次超过0.01m <b>{{probe.first_wet_time==null?'未发生':probe.first_wet_time+' s'}}</b></span></div><TrendChart v-if="probe.history" :values="probe.history" :labels="probe.times.map(t=>t+'s')" label="选定位置的水深过程"/></div><div v-else class="probe-empty"><button class="text-btn" @click="probeCenter">查询网格中心示例</button><span aria-hidden="true">＋</span><p>点击计算范围内任意位置<br>查询该点水深与过程曲线</p></div><details class="method-note"><summary>水深来源与计算口径</summary><p>{{flood?.method}}</p><p>高程基准：{{flood?.vertical_datum}}。范围外与缺测点不会显示为0米。</p></details></template>
        </aside>
        <div v-if="tab==='flood'&&flood" class="timeline glass"><button class="play-button" @click="playing=!playing" :aria-label="playing?'暂停':'播放'">{{playing?'Ⅱ':'▶'}}</button><button class="timeline-reset" @click="frame=0;playing=false" title="回到开始">↺</button><div class="timeline-slider"><div><b>{{flood.name}}</b><span>{{currentTime.toFixed(1)}} / {{flood.frames.at(-1).time}} s</span></div><input type="range" v-model.number="frame" min="0" :max="flood.frames.length-1" step="1" aria-label="模拟时间轴"></div><select v-model.number="playSpeed" aria-label="播放倍速"><option v-for="n in [1,2,4,8,16]" :key="n" :value="n">{{n}}×</option></select></div><div v-if="tab==='flood'&&waterVisible" class="depth-legend glass"><span>淹没水深 / m</span><div><i v-for="(color,i) in depthColors" :key="i" :style="{background:color}"></i></div><p><span>0</span><span>0.5</span><span>2</span><span>4+</span></p></div>
      </template>
      <section v-if="tab==='knowledge'" class="full-panel knowledge-workspace"><div class="page-heading"><div><p class="eyebrow">ENGINEERING KNOWLEDGE</p><h2>专业知识库</h2><p>从资料到答案，保留每一次引用的出处。</p></div><button class="primary" @click="openImport('knowledge')">＋ 导入专业资料</button></div><div class="knowledge-layout"><div class="knowledge-chat surface"><div class="subheading">资料问答<span class="badge">{{useAi?'原站 AI 问答':'资料检索模式'}}</span></div><div class="chat-content" ref="chatScroll"><div v-if="!chat.length" class="chat-empty"><span class="knowledge-symbol">⌘</span><h3>从一个专业问题开始</h3><p>点击引用可核对资料片段、原PDF页或说明。</p><button v-for="q in questionSuggestions" :key="q" @click="ask(q)">{{q}}<span>↗</span></button></div><article v-for="(m,i) in chat" :key="i" :class="['chat-message',m.role]"><span class="message-author">{{m.role==='user'?'你':'专业资料助手'}}</span><div class="message-text">{{m.content}}</div><div v-if="m.sources?.length" class="sources-list"><a v-for="(s,j) in m.sources" :key="s.id" :href="s.url" target="_blank" rel="noopener"><b>[{{j+1}}]</b><span>{{shortDoc(s.name)}}<small>{{s.page ? "PDF 第 " + s.page + " 页" : s.title || "文字资料"}}</small></span><i>↗</i></a></div></article><div v-if="asking" class="chat-loading"><i></i>正在检索资料并组织回答…</div></div><form class="chat-input" @submit.prevent="ask()"><textarea v-model="question" @keydown.enter.exact.prevent="ask()" placeholder="输入专业问题，如：浸润线升高为什么会影响坝坡稳定？" rows="2" aria-label="专业问题"></textarea><button class="primary" :disabled="asking||!question.trim()">发送 ↑</button></form><label class="chat-foot ai-choice"><input v-model="useAi" type="checkbox"> 使用原站 AI 组织回答</label><p class="chat-foot">启用后，问题与命中的资料片段会发送至原站 AI 接口。资料检索可独立使用。</p></div><div class="knowledge-library surface"><div class="subheading">专业资料<span class="mini-label">{{docs.length}} 份</span></div><form class="library-search" @submit.prevent="searchLibrary"><input v-model="searchText" placeholder="按关键词检索，如“反滤层”" aria-label="检索资料"><button>检索</button></form><div v-if="searchResults.length" class="search-results"><button class="text-btn" @click="searchResults=[]">返回资料目录</button><a v-for="s in searchResults" :key="s.id" :href="s.url" target="_blank" rel="noopener"><span>{{shortDoc(s.name)}}{{s.page ? " · 第 " + s.page + " 页" : ""}} ↗</span><p>{{s.text}}</p></a></div><div v-else class="doc-list"><article v-for="d in docs" :key="d.id"><span class="doc-number">{{d.type === "pdf" || d.pageCount ? "PDF" : "资料"}}</span><div><h4 :title="d.name">{{shortDoc(d.name)}}</h4><p>{{documentSummary(d)}}</p><span :class="['doc-state',{pending:d.status==='ocr_pending'}]">{{documentStatus(d)}}</span></div><a v-if="d.url" :href="d.url" target="_blank" rel="noopener" title="打开原文或入库文字">↗</a><button v-if="d.local" type="button" class="text-btn" @click="removeDoc(d)">移除</button></article></div></div></div></section>
    </main>
    <div v-if="toastText" class="toast" role="status">{{toastText}}</div>
    <div v-if="importDialog" class="modal-backdrop">
      <form class="modal import-modal" aria-labelledby="import-title" @submit.prevent="submitImport">
        <div class="modal-heading">
          <div><p class="eyebrow">IMPORT WORKSPACE</p><h2 id="import-title">{{importTitle}}</h2></div>
          <button type="button" class="close-btn" aria-label="关闭导入" :disabled="importBusy" @click="importDialog=false">×</button>
        </div>
        <div class="segmented">
          <button type="button" :class="{selected:importMode==='file'}" @click="setImportMode('file')">本地文件</button>
          <button type="button" :class="{selected:importMode==='url'}" @click="setImportMode('url')">HTTPS 地址</button>
          <button v-if="importKind==='model'" type="button" :class="{selected:importMode==='ion'}" @click="setImportMode('ion')">Cesium ion</button>
        </div>
        <label v-if="importKind==='model' || importMode==='url'">名称（可选）<input v-model.trim="importMeta.name" maxlength="100" placeholder="留空使用文件名"></label>
        <template v-if="importMode==='url'">
          <label v-if="importKind==='model'">模型格式<select v-model="importMeta.modelType"><option value="tileset">3D Tiles（tileset.json）</option><option value="glb">GLB / glTF</option></select></label>
          <label>文件直链<input v-model.trim="importMeta.url" type="url" required placeholder="https://…" autocomplete="off"></label>
          <p class="panel-note">可粘贴公开的 GitHub 文件页，平台会转换为原始文件地址。文件服务器需要允许跨域读取。</p>
        </template>
        <template v-else-if="importMode==='ion'">
          <label>资产编号<input v-model.trim="importMeta.ionId" inputmode="numeric" pattern="[0-9]+" required></label>
          <label>Cesium ion 只读令牌<input v-model="ionToken" type="password" autocomplete="off" required></label>
          <p class="panel-note">令牌只用于本次打开的工作台。原站实景已缓存时可以直接选用。</p>
        </template>
        <label v-else class="file-drop">
          <span>＋</span><b>{{importBlob?.name || fileHint}}</b>
          <input type="file" :accept="accepts[importKind]" @change="importBlob=$event.target.files[0]">
        </label>
        <template v-if="needsOrigin">
          <p class="field-label">WGS84 地理原点与局部坐标</p>
          <div class="form-grid">
            <label>原点经度<input type="number" step="any" min="-180" max="180" v-model="importMeta.longitude" required></label>
            <label>原点纬度<input type="number" step="any" min="-85" max="85" v-model="importMeta.latitude" required></label>
            <label>原点高程 / m<input type="number" step="any" v-model="importMeta.height" required></label>
            <label>坐标旋转 / °<input type="number" step="any" v-model="importMeta.yaw"></label>
          </div>
          <label v-if="importKind==='flood'">高程基准<input v-model.trim="importMeta.vertical_datum" placeholder="例如工程采用的地方高程基准"></label>
        </template>
        <p v-if="importKind==='flood'" class="panel-note">支持带水深字段的 JSON 或规则 CSV。OpenFOAM 算例、VTK 或 PVD 可先用<a :href="manualUrl+'#openfoam'" target="_blank" rel="noopener">转换工具</a>处理。</p>
        <p v-if="importKind==='knowledge'" class="panel-note">PDF 文字层用于检索。扫描件可导入原件，全文检索需要先做 OCR。</p>
        <div v-if="importBusy" class="import-progress" role="status"><i></i>{{importProgress}}</div>
        <p v-if="importError" class="error-text" role="alert">{{importError}}</p>
        <button type="submit" class="primary wide" :disabled="importBusy">{{importBusy?'处理中…':'确认导入'}}</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import TrendChart from './TrendChart.vue';
import { assetUrl, deleteLocal, importFile, importUrl, readAll, saveLocal } from './browserData.js';
import { finiteNumber, parseDepthCsv, queryDepth, readOrigin, validateDepth } from './depthData.js';
import { askDocuments, indexDocument, searchDocuments, starterDocs } from './knowledge.js';
import './platform.css';

const showFlood = new URLSearchParams(location.search).get('view') !== 'reader';
const navigation = [
  { id: 'scene', label: '三维场景', icon: '◇' },
  ...(showFlood ? [{ id: 'flood', label: '溃坝淹没', icon: '≋' }] : []),
  { id: 'knowledge', label: '专业知识', icon: '▤' },
];
const views = [
  { id: 'overview', label: '总览', symbol: '◈' },
  { id: 'top', label: '俯视', symbol: '⊞' },
  { id: 'front', label: '坝前', symbol: '⌑' },
  { id: 'side', label: '侧面', symbol: '◇' },
];
const depthColors = ['#8bdbed', '#4db8d9', '#228dd0', '#3067c7', '#6045b9', '#9c48b7'];
const questionSuggestions = ['浸润线升高为什么会影响坝坡稳定？', '土石坝反滤层与排水体有什么作用？', '如何把 OpenFOAM 结果导入网页？'];
const accepts = { model: '.glb', flood: '.json,.csv', knowledge: '.pdf,.txt,.md' };
const manualUrl = assetUrl('manual.html');
const tab = ref('scene');
const models = shallowRef([]);
const modelId = ref('');
const modelBusy = ref(false);
const mapError = ref('');
const measurement = ref(null);
const floods = shallowRef([]);
const floodId = ref('demo');
const flood = shallowRef(null);
const frame = ref(0);
const waterVisible = ref(true);
const playing = ref(false);
const playSpeed = ref(8);
const probe = ref(null);
const probeLon = ref('');
const probeLat = ref('');
const docs = shallowRef([]);
const chat = ref([]);
const chatScroll = ref(null);
const question = ref('');
const asking = ref(false);
const useAi = ref(false);
const searchText = ref('');
const searchResults = ref([]);
const toastText = ref('');
const importDialog = ref(false);
const importKind = ref('model');
const importMode = ref('file');
const importBlob = shallowRef(null);
const importBusy = ref(false);
const importError = ref('');
const importProgress = ref('');
const ionToken = ref('');
const importMeta = reactive({});
let scene, toastTimer, playback, demo, handbookLoad, previousPoint;
let modelGeneration = 0;
const objectUrls = new Map();

const activeModel = computed(() => models.value.find(model => model.id === modelId.value));
const currentTime = computed(() => flood.value?.frames[frame.value]?.time ?? 0);
const frameStats = computed(() => {
  let maximum = 0;
  const depths = flood.value?.frames[frame.value]?.depth || [];
  for (const [i, depth] of depths.entries()) if (flood.value.valid[i]) maximum = Math.max(maximum, depth);
  return { maximum };
});
const isExample = computed(() => ['demonstration', 'format_example'].includes(flood.value?.source_type));
const sourceLabel = computed(() => ({
  demonstration: '理想矩形河槽示例 · 非工程预测',
  format_example: '格式验证示例 · 非工程预测',
  openfoam: '导入的 OpenFOAM 计算结果',
  imported: '用户导入的水深数据',
})[flood.value?.source_type] || '等待加载');
const measurementText = computed(() => {
  if (measurement.value?.area != null) return '圈定面积约 ' + measurement.value.area.toFixed(1) + ' m²';
  if (measurement.value?.distance != null) return '累计空间距离 ' + measurement.value.distance.toFixed(2) + ' m';
  return '选择工具后在模型上依次点击。';
});
const importTitle = computed(() => ({ model: '导入 / 添加模型', flood: '导入 OpenFOAM 与水深数据', knowledge: '导入专业资料' })[importKind.value]);
const fileHint = computed(() => ({ model: '选择单文件 GLB', flood: '选择水深网格 JSON 或规则 CSV', knowledge: '选择 PDF、TXT 或 Markdown' })[importKind.value]);
const needsOrigin = computed(() => {
  if (importKind.value === 'model') return importMode.value === 'file' || (importMode.value === 'url' && importMeta.modelType === 'glb');
  if (importKind.value !== 'flood') return false;
  const name = importMode.value === 'file' ? importBlob.value?.name : importMeta.url;
  return /\.csv(?:[?#]|$)/i.test(name || '');
});

function toast(message) {
  toastText.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastText.value = ''; }, 5000);
}

async function loadJson(path) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error('网页资源读取失败。');
  return response.json();
}

function objectUrl(id, blob) {
  if (!objectUrls.has(id)) objectUrls.set(id, URL.createObjectURL(blob));
  return objectUrls.get(id);
}

async function loadModels() {
  const local = await readAll('models').catch(() => []);
  const config = await loadJson('data/scene.json').catch(() => ({}));
  models.value = [
    ...(config.original ? [{
      id: 'original', name: '原站尾矿库实景', kind: 'tileset',
      url: assetUrl('models/original_scene/tileset.json'), description: '原站 Cesium 实景模型缓存',
    }] : []),
    {
      id: 'schematic', name: '示例坝体与地形', kind: 'glb', url: assetUrl('models/dam_schematic.glb'),
      longitude: 118.754, latitude: 32.045, height: 0, description: '示意模型，可与理想河槽演示结果配合查看',
    },
    {
      id: 'terrain', name: '示例地形', kind: 'glb', url: assetUrl('models/terrain_schematic.glb'),
      longitude: 118.754, latitude: 32.045, height: 0, description: '不含坝体的示意地形',
    },
    ...local.map(model => ({ ...model, url: model.blob ? objectUrl(model.id, model.blob) : model.url })),
  ];
}

async function changeModel(id) {
  const model = models.value.find(item => item.id === id);
  if (!model) return;
  const generation = ++modelGeneration;
  modelBusy.value = true;
  try {
    if (scene) await scene.load(model, ionToken.value);
    if (generation === modelGeneration) modelId.value = id;
  } catch (error) {
    if (generation === modelGeneration) toast(error.message);
  } finally {
    if (generation === modelGeneration) modelBusy.value = false;
  }
}

function setInteraction(mode) {
  scene?.setMode(mode);
  measurement.value = null;
  toast({ probe: '点击计算区域可查询水深', measure: '请依次点击要测量的位置', area: '请依次点击至少三个位置' }[mode]);
}

function clearMeasurements() {
  scene?.clearMeasure();
  measurement.value = null;
  scene?.setMode('probe');
}

function drawFlood() {
  if (scene && tab.value === 'flood' && waterVisible.value && flood.value) {
    scene.drawFlood(flood.value, frame.value);
  } else {
    scene?.clearFlood();
  }
}

function locateFlood() {
  if (flood.value) scene?.flyGrid(flood.value);
}

async function loadFlood(fly = false) {
  const id = floodId.value;
  try {
    const next = id === 'demo' ? await (demo ??= loadJson('data/flood_demo.json').then(validateDepth))
      : floods.value.find(item => item.id === id)?.dataset;
    if (id !== floodId.value || !next) return;
    playing.value = false;
    previousPoint = null;
    probe.value = null;
    probeLon.value = '';
    probeLat.value = '';
    frame.value = 0;
    flood.value = next;
    scene?.clearMarker();
    drawFlood();
    if (fly) locateFlood();
  } catch (error) {
    demo = null;
    toast(error.message);
  }
}

async function setTab(id) {
  playing.value = false;
  tab.value = id;
  if (id === 'flood') {
    scene?.setMode('probe');
    if (flood.value?.source_type === 'demonstration') await changeModel('schematic');
    if (tab.value !== 'flood') return;
    waterVisible.value = true;
    drawFlood();
    locateFlood();
  } else {
    scene?.clearFlood();
    scene?.clearMarker();
  }
}

function probeAt(longitude, latitude) {
  if (!flood.value) return;
  try {
    const result = queryDepth(flood.value, longitude, latitude, frame.value);
    previousPoint = [result.longitude, result.latitude];
    probe.value = result;
    probeLon.value = result.longitude.toFixed(8);
    probeLat.value = result.latitude.toFixed(8);
    scene?.marker(result);
  } catch (error) {
    toast(error.message);
  }
}

function probeCenter() {
  const data = flood.value;
  if (!data) return;
  const coordinates = scene?.gridCenter(data);
  if (coordinates) probeAt(...coordinates);
  else probeAt(data.origin.longitude, data.origin.latitude);
}

watch(waterVisible, drawFlood);
watch(frame, () => {
  drawFlood();
  if (previousPoint) probeAt(...previousPoint);
});
watch(playing, active => {
  clearInterval(playback);
  if (!active || !flood.value) return;
  const frames = flood.value.frames;
  if (frame.value === frames.length - 1) frame.value = 0;
  let target = frames[frame.value].time;
  let last = performance.now();
  playback = setInterval(() => {
    const now = performance.now();
    target += (now - last) / 1000 * playSpeed.value;
    last = now;
    let next = frame.value;
    while (next < frames.length - 1 && frames[next + 1].time <= target) next++;
    frame.value = next;
    if (next === frames.length - 1) playing.value = false;
  }, 90);
});

const shortDoc = name => name.replace(/^\d+水工设计手册（第二版）/, '').replace(/\.pdf$/i, '').replace(/\(\d+\)$/, '').trim();
function documentSummary(doc) {
  return doc.pageCount ? doc.pageCount + ' 页 · ' + doc.pagesWithText + ' 页有文字索引' : (doc.entries?.length || 0) + ' 个文字片段';
}
function documentStatus(doc) {
  if (doc.pageCount && !doc.pagesWithText) return '扫描件，待 OCR';
  return doc.local ? '已导入当前浏览器' : '平台资料';
}
async function loadDocs() {
  const builtIn = await loadJson('data/handbooks/catalog.json').catch(() => []);
  const local = await readAll('docs').catch(() => []);
  docs.value = [
    ...starterDocs.map(doc => ({ ...doc, url: manualUrl })),
    ...builtIn.map(doc => ({ ...doc, entries: [], url: assetUrl('cite.html?doc=' + doc.id) })),
    ...local.map(doc => ({ ...doc, local: true, url: objectUrl(doc.id, doc.file) })),
  ];
}
async function searchableDocs() {
  const builtIn = docs.value.filter(doc => doc.count);
  if (!handbookLoad) {
    handbookLoad = Promise.all(builtIn.map(async doc => {
      const entries = await loadJson('data/handbooks/' + doc.id + '.json');
      return {
        ...doc,
        entries: entries.map(entry => ({ ...entry, url: doc.url + '&page=' + entry.page })),
      };
    })).catch(error => {
      handbookLoad = null;
      throw error;
    });
  }
  return [...docs.value.filter(doc => !doc.count), ...await handbookLoad];
}
async function ask(text) {
  const query = (typeof text === 'string' ? text : question.value).trim();
  if (!query || asking.value) return;
  question.value = '';
  chat.value.push({ role: 'user', content: query });
  asking.value = true;
  try {
    const answer = await askDocuments(await searchableDocs(), query, useAi.value);
    chat.value.push({ role: 'assistant', ...answer });
  } catch (error) {
    chat.value.push({ role: 'assistant', content: error.message });
  } finally {
    asking.value = false;
    await nextTick();
    chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight, behavior: 'smooth' });
  }
}
async function searchLibrary() {
  const query = searchText.value.trim();
  if (!query) return;
  try {
    searchResults.value = searchDocuments(await searchableDocs(), query, 12);
    if (!searchResults.value.length) toast('没有找到匹配片段，请换一个专业术语。');
  } catch (error) {
    toast(error.message);
  }
}
async function removeDoc(doc) {
  try {
    await deleteLocal('docs', doc.id);
    URL.revokeObjectURL(objectUrls.get(doc.id));
    objectUrls.delete(doc.id);
    chat.value = [];
    searchResults.value = [];
    await loadDocs();
    toast('已移除资料。');
  } catch (error) {
    toast(error.message);
  }
}

function setImportMode(mode) {
  importMode.value = mode;
  importError.value = '';
}
function openImport(kind) {
  importKind.value = kind;
  setImportMode('file');
  importBlob.value = null;
  Object.assign(importMeta, {
    name: '', url: '', modelType: 'tileset', ionId: '', longitude: '', latitude: '', height: 0, yaw: 0, vertical_datum: '',
  });
  importDialog.value = true;
}

async function addModel(file) {
  const kind = importMode.value === 'ion' ? 'ion' : file ? 'glb' : importMeta.modelType;
  const id = crypto.randomUUID();
  const model = {
    id, kind, name: importMeta.name || file?.name || (kind === 'ion' ? 'Ion ' + importMeta.ionId : decodeURIComponent(importUrl(importMeta.url).pathname.split('/').at(-1) || '导入模型')),
    description: '当前浏览器导入的模型',
  };
  if (kind === 'glb') {
    Object.assign(model, readOrigin(importMeta), { heading: finiteNumber(importMeta.yaw || 0, '坐标旋转角') });
  }
  if (file) {
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (String.fromCharCode(...signature) !== 'glTF') throw new Error('请选择有效的单文件 GLB 模型。');
    model.blob = file.slice(0, file.size, 'model/gltf-binary');
  } else {
    model.url = kind === 'ion' ? importMeta.ionId : importUrl(importMeta.url).href;
  }
  const displayModel = { ...model, url: model.blob ? objectUrl(id, model.blob) : model.url };
  if (scene) {
    try {
      await scene.load(displayModel, ionToken.value);
    } catch {
      if (model.blob) {
        URL.revokeObjectURL(displayModel.url);
        objectUrls.delete(id);
      }
      throw new Error('模型加载失败，请检查文件格式、令牌或跨域访问权限。');
    }
  }
  await saveLocal('models', model);
  models.value = [...models.value, displayModel];
  modelId.value = id;
  tab.value = 'scene';
}

async function addFlood(file) {
  const text = await file.text();
  const csv = /\.csv$/i.test(file.name) || file.type.startsWith('text/csv');
  let dataset;
  if (csv) {
    dataset = parseDepthCsv(text, { ...importMeta, name: importMeta.name || file.name });
  } else {
    let input;
    try { input = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('请选择规则水深 CSV 或有效的水深网格 JSON。'); }
    dataset = validateDepth({ ...input, name: importMeta.name || input?.name || file.name });
  }
  const item = { id: crypto.randomUUID(), name: dataset.name, dataset: markRaw(dataset) };
  await saveLocal('floods', item);
  floods.value = [...floods.value, item];
  tab.value = 'flood';
  floodId.value = item.id;
  scene?.setMode('probe');
  await loadFlood(true);
}

async function submitImport() {
  if (importBusy.value) return;
  importBusy.value = true;
  importProgress.value = '正在读取文件…';
  importError.value = '';
  try {
    const remoteModel = importKind.value === 'model' && importMode.value !== 'file';
    const file = remoteModel ? null : await importFile(importMode.value === 'url' ? importMeta.url : importBlob.value, importMode.value === 'url');
    if (importKind.value === 'model') {
      importProgress.value = '正在加载模型…';
      await addModel(file);
    } else if (importKind.value === 'flood') {
      importProgress.value = '正在验证水深网格…';
      await addFlood(file);
    } else {
      const doc = await indexDocument(file, importMeta.name || file.name, progress => { importProgress.value = progress; });
      await saveLocal('docs', doc);
      await loadDocs();
      tab.value = 'knowledge';
    }
    importDialog.value = false;
    toast('导入完成。');
  } catch (error) {
    importError.value = error.name === 'QuotaExceededError' ? '浏览器可用存储不足，请移除旧资料后重试。' : error.message;
  } finally {
    importBusy.value = false;
  }
}

onMounted(async () => {
  const boot = Promise.all([
    loadModels(), loadDocs(),
    readAll('floods').catch(() => []).then(local => {
      floods.value = [{ id: 'demo', name: '理想矩形河槽瞬时溃坝示例' }, ...local];
    }),
  ]);
  try {
    const { PlatformScene } = await import('./platformScene.js');
    scene = new PlatformScene('platformMap',
      (longitude, latitude) => { if (tab.value === 'flood') probeAt(longitude, latitude); },
      result => { measurement.value = result; });
  } catch (error) {
    // Clear the blocking widget error panel left by a failed Cesium initialization.
    document.getElementById('platformMap')?.replaceChildren();
    mapError.value = error.message;
  }
  await boot;
  await Promise.all([changeModel(models.value[0]?.id), showFlood ? loadFlood() : null]);
});
onBeforeUnmount(() => {
  clearTimeout(toastTimer);
  clearInterval(playback);
  scene?.destroy();
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
});
</script>
