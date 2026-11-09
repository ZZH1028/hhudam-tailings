<template>
  <div class="file-panel" v-if="isShow">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="title">
        <span class="dot" /> 文件资料中心 / Documents
      </div>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <!-- 搜索 -->
    <div class="search-row">
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="输入关键字，例如：应急预案 / 调度方案"
        @keyup.enter="searchFiles"
      />
      <button class="search-btn" @click="searchFiles">搜索</button>
      <button class="search-btn ghost" @click="syncToAi" :disabled="syncing">{{ syncing ? "同步中…" : "同步到AI" }}</button>
    </div>

    <!-- 当前关联大坝 -->
    <div class="filter-row" v-if="damId">
      <span class="filter-tag">
        关联大坝：{{ damId }}
      </span>
      <button class="clear-filter" @click="clearDamFilter">清除</button>
    </div>

    <!-- 结果列表 -->
    <div class="result-list">
      <div v-if="loading" class="empty">
        正在搜索…
      </div>

      <div v-else-if="files.length === 0" class="empty">
        暂无结果，可尝试更换关键字
      </div>

      <div
        v-else
        v-for="file in files"
        :key="file.id"
        class="file-item"
      >
        <div class="file-main">
          <div class="file-name">
            <span class="file-type">{{ file.type }}</span>
            {{ file.name }}
          </div>
          <div class="file-meta">
            <span v-if="file.damId" class="meta-item">
              关联大坝：{{ file.damId }}
            </span>
            <span class="meta-item path">
              {{ file.relPath }}
            </span>
          </div>
        </div>

        <div class="file-actions">
          <!-- 地图定位（和 Cesium 联动） -->
          <button class="link-btn" @click="openOnMap(file)">定位</button>
          <!-- 打开文件 -->
          <button class="link-btn primary" @click="openFile(file)">
            打开
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fetchOriginal, originalUrl } from '../../originalApi.js';
import {ref, watch } from 'vue';

// 后端地址（走 8080 代理转发到 3001，本机与外网演示均可访问）
const API_BASE = '/ai-gw';

const props = defineProps({
  // 是否显示这个面板
  isShow: {
    type: Boolean,
    default: false
  },
  // 当前选中的大坝/站点 ID（可选，用来自动按大坝过滤）
  damId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['close', 'requestFlyToDam']);

const keyword = ref('');
const files = ref([]);
const loading = ref(false);

const syncing = ref(false);

// 将资料目录索引同步到 AI 知识库（RAG）
const syncToAi = async () => {
  if (syncing.value) return;
  syncing.value = true;
  try {
    const res = await fetchOriginal(`${API_BASE}/ai/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ damId: props.damId || null })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || '同步失败');

    // 同步成功后，提示并可选择自动搜索
    console.log('AI索引完成', data);
  } catch (e) {
    console.error('同步到AI失败', e);
  } finally {
    syncing.value = false;
  }
};

watch(
  () => props.damId,
  newVal => {
    if (newVal && props.isShow) {
      searchFiles();
    }
  }
);

// 搜索接口调用
const searchFiles = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (keyword.value) params.append('q', keyword.value);
    if (props.damId) params.append('damId', props.damId);

    const res = await fetchOriginal(`${API_BASE}/files/search?${params.toString()}`);
    files.value = await res.json();
  } catch (e) {
    console.error('搜索文件出错', e);
    files.value = [];
  } finally {
    loading.value = false;
  }
};

// 清除大坝过滤
const clearDamFilter = () => {
  emit('requestFlyToDam', null, { onlyClearFilter: true });
};

// 通知父组件：在地图上定位到该文件关联的大坝
const openOnMap = file => {
  if (!file.damId) return;
  emit('requestFlyToDam', file.damId);
};

// 打开文件（浏览器新标签）
const openFile = file => {
  window.open(originalUrl(`${API_BASE}/files/${file.id}`), '_blank', 'noopener');
};
</script>

<style scoped>
.file-panel {
  width: 380px;
  min-height: 260px;
  max-height: 520px;
  background: linear-gradient(
      135deg,
      rgba(6, 22, 46, 0.96),
      rgba(3, 10, 25, 0.98)
    );
  border-radius: 16px;
  border: 1px solid rgba(0, 240, 255, 0.4);
  box-shadow:
    0 12px 35px rgba(0, 0, 0, 0.85),
    0 0 25px rgba(0, 240, 255, 0.3);
  padding: 10px 12px;
  color: #e6f1ff;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.title {
  font-size: 14px;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00f0ff;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.9);
}

.close-btn {
  border: none;
  background: transparent;
  color: #9badc6;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.close-btn:hover {
  color: #ffffff;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.search-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(121, 152, 187, 0.7);
  background: rgba(5, 20, 40, 0.85);
  color: #e6f1ff;
  font-size: 13px;
  outline: none;
}

.search-input::placeholder {
  color: rgba(160, 184, 210, 0.75);
}

.search-btn {

  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 240, 255, 0.7);
  background: rgba(0, 240, 255, 0.18);
  color: #e6f9ff;
  cursor: pointer;
  font-size: 13px;
}

.filter-row {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.filter-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 240, 255, 0.15);
  border: 1px solid rgba(0, 240, 255, 0.6);
}

.clear-filter {
  border: none;
  background: transparent;
  color: #9badc6;
  cursor: pointer;
  font-size: 12px;
}

.result-list {
  margin-top: 8px;
  overflow-y: auto;
  max-height: 380px;
}

.empty {
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: #9badc6;
}

.file-item {
  margin-bottom: 8px;
  padding: 8px 8px;
  border-radius: 10px;
  background: rgba(6, 26, 50, 0.9);
  border: 1px solid rgba(49, 86, 122, 0.7);
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.file-item:hover {
  border-color: rgba(0, 240, 255, 0.9);
  box-shadow: 0 0 14px rgba(0, 240, 255, 0.5);
}

.file-name {
  font-size: 13px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-type {
  font-size: 11px;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 240, 255, 0.18);
  border: 1px solid rgba(0, 240, 255, 0.8);
}

.file-meta {
  font-size: 11px;
  color: #9badc6;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-item.path {
  opacity: 0.8;
}

.file-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 70px;
}

.link-btn {
  padding: 3px 6px;
  border-radius: 8px;
  border: 1px solid rgba(121, 152, 187, 0.8);
  background: transparent;
  color: #e6f1ff;
  font-size: 12px;
  cursor: pointer;
}

.link-btn.primary {
  border-color: rgba(0, 240, 255, 0.9);
  background: rgba(0, 240, 255, 0.18);
}
.search-btn.ghost {
  border-color: rgba(121, 152, 187, 0.7);
  background: rgba(5, 20, 40, 0.45);
}

</style>
