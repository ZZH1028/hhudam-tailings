<template>
  <template v-if="isPlanMode">
    <!-- 左侧：应急预案列表 -->
    <div class="pf-side left pointer-auto">
      <div class="pf-card">
        <!-- 固定头部区域 -->
        <div class="pf-fixed-header">
          <div class="pf-head">
            <div class="pf-h-title">应急预案</div>
            <div class="pf-h-sub">
              <span v-if="lastUpdated">更新时间：{{ lastUpdated }}</span>
              <span v-else>—</span>
            </div>
          </div>

          <div class="pf-msg" v-if="loading">
            <span class="dot"></span>
            <span>正在加载应急预案数据...</span>
          </div>

          <div class="pf-msg" v-else-if="error">
            <span class="dot err"></span>
            <span>{{ error }}</span>
          </div>

          <div class="plan-summary" v-else-if="plans.length">
            <div class="summary-row">
              <span class="label">预案总数</span>
              <span class="value strong">{{ plans.length }}</span>
            </div>
            <div class="summary-row">
              <span class="label">已启用预案</span>
              <span class="value success">{{ enabledCount }}</span>
            </div>
            <div class="summary-row">
              <span class="label">已停用预案</span>
              <span class="value muted">{{ disabledCount }}</span>
            </div>
          </div>

          <div class="tab-row" v-if="plans.length && !loading && !error">
            <button
              class="tab-btn"
              :class="{ active: activeFilter === 'all' }"
              @click="activeFilter = 'all'"
            >
              全部预案
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeFilter === 'enabled' }"
              @click="activeFilter = 'enabled'"
            >
              仅看已启用
            </button>
          </div>
        </div>

        <!-- 可滚动列表区域 -->
        <div class="pf-scrollable-list" v-if="filteredPlans.length && !loading && !error">
          <div
            class="plan-card"
            v-for="plan in filteredPlans"
            :key="plan.id"
            :class="{ active: selectedPlan && selectedPlan.id === plan.id }"
            @click="selectedPlan = plan"
          >
            <div class="plan-top">
              <div class="top-left">
                <span class="level-badge" :class="levelClass(plan.emergency_level)">
                  {{ plan.emergency_level }}
                </span>
                <span class="plan-title">{{ plan.plan_name }}</span>
              </div>
              <span class="status-badge" :class="plan.enabled ? 'enabled' : 'disabled'">
                {{ plan.enabled ? '已启用' : '已停用' }}
              </span>
            </div>

            <div class="boxed-line plan-line">
              编号：{{ plan.code }}
            </div>

            <div class="plan-extra">
              <div class="extra-item">
                <span class="extra-label">尾矿库：</span>
                <span>{{ plan.tailings_pond || '—' }}</span>
              </div>
              <div class="extra-item">
                <span class="extra-label">负责人：</span>
                <span>{{ plan.responsible_person || '—' }}</span>
                <span v-if="plan.contact_phone" class="extra-phone">{{ plan.contact_phone }}</span>
              </div>
            </div>

            <div class="plan-meta">
              <div class="meta-item boxed-line">
                <span>版本 v{{ plan.version }}</span>
              </div>
              <div class="meta-item boxed-line">
                <span>{{ plan.updatedAt }}</span>
              </div>
            </div>

            <div class="boxed-line note-line">
              {{ plan.note || '暂无备注说明' }}
            </div>
          </div>
        </div>

        <div class="pf-empty" v-else-if="!loading && !error">
          暂无应急预案数据
        </div>
      </div>
    </div>

    <!-- 右侧：预案详情 + 结构化处置流程（修复滚动） -->
    <div class="pf-side right pointer-auto">
      <div class="pf-card pf-card-right">
        <!-- 固定头部区域 -->
        <div class="pf-fixed-header">
          <div class="pf-head">
            <div class="pf-h-title">预案详情</div>
            <div class="pf-h-sub" v-if="selectedPlan">版本：v{{ selectedPlan.version }}</div>
            <div class="pf-h-sub" v-else>执行与处置流程</div>
          </div>
        </div>

        <!-- 可滚动内容区域 -->
        <div class="pf-scrollable-content">
          <div class="pf-empty" v-if="!selectedPlan">
            请从左侧选择一个应急预案查看详情
          </div>

          <template v-else>
            <div class="detail-section">
              <div class="detail-row">
                <span class="k">预案名称</span>
                <span class="v">{{ selectedPlan.plan_name }}</span>
              </div>

              <div class="detail-row">
                <span class="k">等级</span>
                <span class="v">
                  <span class="level-badge" :class="levelClass(selectedPlan.emergency_level)">
                    {{ selectedPlan.emergency_level }}
                  </span>
                </span>
              </div>

              <div class="detail-row">
                <span class="k">编号</span>
                <span class="v mono">{{ selectedPlan.code }}</span>
              </div>

              <div class="detail-row">
                <span class="k">尾矿库</span>
                <span class="v">{{ selectedPlan.tailings_pond || '—' }}</span>
              </div>

              <div class="detail-row">
                <span class="k">负责人</span>
                <span class="v">{{ selectedPlan.responsible_person || '—' }}</span>
              </div>

              <div class="detail-row" v-if="selectedPlan.contact_phone">
                <span class="k">联系电话</span>
                <span class="v">{{ selectedPlan.contact_phone }}</span>
              </div>

              <div class="detail-row">
                <span class="k">状态</span>
                <span class="v">
                  <span class="status-badge" :class="selectedPlan.enabled ? 'enabled' : 'disabled'">
                    {{ selectedPlan.enabled ? '已启用' : '已停用' }}
                  </span>
                </span>
              </div>

              <div class="detail-row">
                <span class="k">版本</span>
                <span class="v">v{{ selectedPlan.version }}</span>
              </div>

              <div class="detail-row">
                <span class="k">更新时间</span>
                <span class="v">{{ selectedPlan.updatedAt }}</span>
              </div>

              <div class="detail-row detail-row-text">
                <span class="k">备注</span>
                <span class="v">{{ selectedPlan.note || '无' }}</span>
              </div>
            </div>

            <div class="pf-divider"></div>

            <div class="pf-head small">
              <div class="pf-h-title">处置流程</div>
              <div class="pf-h-sub">执行步骤</div>
            </div>

            <div v-if="selectedPlan.handling_method" class="method-steps-container">
              <div
                class="step-item"
                v-for="(step, idx) in parseHandlingMethod(selectedPlan.handling_method)"
                :key="idx"
              >
                <div class="step-marker">{{ idx + 1 }}</div>
                <div class="step-content">{{ step }}</div>
              </div>
            </div>

            <div class="pf-empty" v-else>
              该预案暂无处置流程
            </div>
          </template>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { fetchOriginal } from '../../originalApi.js';
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps({
  isPlanMode: {
    type: Boolean,
    default: false
  }
});

const plans = ref([]);
const selectedPlan = ref(null);
const loading = ref(false);
const error = ref('');
const lastUpdated = ref('');
const activeFilter = ref('all');

// ========== 工具函数 ==========
const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '-');
  } catch (e) {
    return dateStr;
  }
};

const parseHandlingMethod = (methodStr) => {
  if (!methodStr) return [];

  let steps = [];
  const str = methodStr.trim();

  if (str.includes('；') || str.includes(';')) {
    steps = str.split(/[；;]/).filter(s => s.trim());
  } else if (/\d+[\.\、]\s*/.test(str)) {
    steps = str.split(/\d+[\.\、]\s*/).filter(s => s.trim());
  } else if (str.includes('\n')) {
    steps = str.split('\n').filter(s => s.trim());
  } else {
    steps = [str];
  }

  return steps.map(step => step.replace(/^\d+[\.\、]\s*/, '').trim()).filter(s => s);
};

const normalizePlan = (item) => {
  return {
    id: item.id,
    plan_name: item.plan_name || item.name || '未命名预案',
    code: item.code || '—',
    emergency_level: item.emergency_level || item.level || 'Ⅲ级',
    tailings_pond: item.tailings_pond || '',
    responsible_person: item.responsible_person || '',
    contact_phone: item.contact_phone || '',
    handling_method: item.handling_method || '',
    enabled: Boolean(item.enabled),
    version: item.version || '1.0',
    updatedAt: formatDateTime(item.updated_at || item.updatedAt || ''),
    note: item.note || ''
  };
};

const enabledCount = computed(() => plans.value.filter((item) => item.enabled).length);
const disabledCount = computed(() => plans.value.filter((item) => !item.enabled).length);

const filteredPlans = computed(() => {
  if (activeFilter.value === 'enabled') {
    return plans.value.filter((item) => item.enabled);
  }
  return plans.value;
});

const levelClass = (level) => {
  if (!level) return 'blue';
  if (level.includes('Ⅰ') || level === 'I') return 'red';
  if (level.includes('Ⅱ') || level === 'II') return 'orange';
  if (level.includes('Ⅲ') || level === 'III') return 'blue';
  if (level.includes('Ⅳ') || level === 'IV') return 'green';
  return 'blue';
};

const loadEmergencyPlans = async () => {
  loading.value = true;
  error.value = '';
  selectedPlan.value = null;

  try {
    const url = '/emergency-api/plans';
    const resp = await fetchOriginal(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!resp.ok) {
      throw new Error(`请求失败（状态码：${resp.status}）`);
    }

    const data = await resp.json();

    if (data.code === 200 && Array.isArray(data.data)) {
      plans.value = data.data.map(item => normalizePlan(item));
      lastUpdated.value = new Date().toLocaleString('zh-CN');
    } else {
      throw new Error(data.msg || '数据格式异常，未获取到有效预案列表');
    }
  } catch (e) {
    plans.value = [];
    error.value = e?.message || '加载应急预案失败';
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.isPlanMode,
  (val) => {
    if (val && !plans.value.length && !loading.value) {
      loadEmergencyPlans();
    }
  },
  { immediate: true }
);

watch(filteredPlans, (list) => {
  if (!list.length) {
    selectedPlan.value = null;
    return;
  }

  if (!selectedPlan.value || !list.find((item) => item.id === selectedPlan.value.id)) {
    selectedPlan.value = list[0];
  }
});

onMounted(() => {
  if (props.isPlanMode) {
    loadEmergencyPlans();
  }
});
</script>

<style scoped>
.pointer-auto {
  pointer-events: auto;
}

.pf-side {
  position: absolute;
  top: 90px;
  width: 420px;
  height: calc(100% - 150px);
  z-index: 60;
  pointer-events: auto;
}

.pf-side.left {
  left: 0;
}

.pf-side.right {
  right: 20px;
}

.pf-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 180, 255, 0.25);
  background: rgba(10, 18, 28, 0.4);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
  color: #e7f6ff;
  overflow: hidden;
}

/* 固定头部区域 */
.pf-fixed-header {
  flex-shrink: 0;
}

/* 可滚动列表区域（左侧） */
.pf-scrollable-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
  padding-right: 4px;
  display: grid;
  gap: 12px;
}

/* 右侧可滚动内容区域 */
.pf-scrollable-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
  padding-right: 4px;
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

.pf-msg {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #94a3b8;
}

.dot.err {
  background: #ef4444;
}

.pf-empty {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(231, 246, 255, 0.6);
}

.pf-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 12px 0;
}

.plan-summary {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.summary-row .label {
  color: rgba(231, 246, 255, 0.72);
}

.summary-row .value {
  color: #e7f6ff;
  font-weight: 900;
}

.summary-row .value.success {
  color: #22c55e;
}

.summary-row .value.muted {
  color: rgba(231, 246, 255, 0.65);
}

.summary-row .value.strong {
  color: #67e8f9;
}

.tab-row {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.tab-btn {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e7f6ff;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s ease;
}

.tab-btn.active {
  border: 1px solid rgba(0, 240, 255, 0.25);
  background: rgba(0, 170, 255, 0.18);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.12);
}

.plan-card {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  cursor: pointer;
}

.plan-card:hover {
  border-color: rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 18px rgba(0, 240, 255, 0.08);
}

.plan-card.active {
  border-color: rgba(0, 240, 255, 0.3);
  box-shadow: 0 0 18px rgba(0, 240, 255, 0.12);
}

.plan-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-title {
  font-size: 15px;
  font-weight: 900;
  color: #e7f6ff;
}

.level-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 50px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  color: #fff;
}

.level-badge.red {
  background: linear-gradient(135deg, #ef4444, #f87171);
}

.level-badge.orange {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
}

.level-badge.blue {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
}

.level-badge.green {
  background: linear-gradient(135deg, #16a34a, #4ade80);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.status-badge.enabled {
  color: #86efac;
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(134, 239, 172, 0.2);
}

.status-badge.disabled {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.boxed-line {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.plan-line {
  margin-top: 10px;
  color: #e7f6ff;
  font-size: 12px;
  line-height: 1.6;
}

.plan-extra {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extra-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 12px;
  color: #e7f6ff;
}

.extra-label {
  color: rgba(231, 246, 255, 0.65);
}

.extra-phone {
  color: rgba(231, 246, 255, 0.6);
  margin-left: 6px;
  font-family: monospace;
}

.plan-meta {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(231, 246, 255, 0.72);
  font-size: 12px;
}

.note-line {
  margin-top: 10px;
  color: rgba(231, 246, 255, 0.75);
  font-size: 12px;
  line-height: 1.6;
}

.detail-section {
  display: grid;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.detail-row .k {
  color: rgba(231, 246, 255, 0.62);
  flex-shrink: 0;
}

.detail-row .v {
  color: #e7f6ff;
  font-weight: 900;
  text-align: right;
}

.detail-row-text {
  align-items: flex-start;
}

.detail-row-text .v {
  text-align: left;
  line-height: 1.6;
}

.method-steps-container {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
}

.step-marker {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(0, 170, 255, 0.15);
  border: 1px solid rgba(0, 240, 255, 0.2);
  color: #8ce9ff;
  font-weight: 900;
  font-size: 13px;
}

.step-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.7;
  color: #d9f6ff;
  word-break: break-word;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(0, 240, 255, 0.3);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 240, 255, 0.6);
}

@media (max-width: 1100px) {
  .pf-side.right {
    display: none;
  }
}
</style>