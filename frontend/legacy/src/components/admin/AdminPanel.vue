<template>
  <div class="layout" :class="{ embed: embedMode }">
    <aside class="sider" v-if="!embedMode">
      <div class="brand">
        <div class="brand-icon">💧</div>
        <div class="brand-title">尾矿库安全管理平台</div>
      </div>

      <nav class="menu">
        <button
          class="menu-item"
          :class="{ active: currentModule === '用户界面' || showUserFullscreen }"
          @click="goToModule('用户界面')"
        >
          <span class="mi-ico">🗺️</span>
          <span>用户界面</span>
        </button>

        <button
          class="menu-item"
          :class="{ active: currentModule === '精准预报' && !showUserFullscreen }"
          @click="goToModule('精准预报')"
        >
          <span class="mi-ico">📈</span>
          <span>精准预报</span>
        </button>

        <button
          class="menu-item"
          :class="{ active: currentModule === '灾害预警' && !showUserFullscreen }"
          @click="goToModule('灾害预警')"
        >
          <span class="mi-ico">⚠️</span>
          <span>灾害预警</span>
        </button>

        <button
          class="menu-item"
          :class="{ active: currentModule === '溃坝预演' && !showUserFullscreen }"
          @click="goToModule('溃坝预演')"
        >
          <span class="mi-ico">🧪</span>
          <span>溃坝预演</span>
        </button>

        <button
          class="menu-item"
          :class="{ active: currentModule === '应急预案' && !showUserFullscreen }"
          @click="goToModule('应急预案')"
        >
          <span class="mi-ico">📋</span>
          <span>应急预案</span>
        </button>

        <button
          class="menu-item"
          :class="{ active: currentModule === '用户管理' && !showUserFullscreen }"
          @click="goToModule('用户管理')"
        >
          <span class="mi-ico">👥</span>
          <span>用户管理</span>
        </button>
      </nav>

      <div class="sider-footer">
        <div class="mini-tip">v1.0</div>
      </div>
    </aside>

    <section class="main">
      <header class="topbar" v-if="!embedMode">
        <div class="topbar-left">
          <div class="breadcrumb">
            <span class="bc-item">首页</span>
            <span class="bc-sep">/</span>
            <span class="bc-item active">{{ topbarTitle }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <div class="search">
            <span class="search-ico">🔎</span>
            <input class="search-input" placeholder="搜索..." />
          </div>
          <button class="icon-btn" title="通知">🔔</button>
          <button class="icon-btn" title="设置">⚙️</button>
          <div class="user">
            <div class="avatar">👤</div>
            <div class="user-name">管理员</div>
          </div>
        </div>
      </header>

      <main
        class="content"
        :class="{ 'content-user-view': currentModule === '用户界面' }"
      >
        <component :is="currentComponent" />
      </main>
    </section>

    <div
      v-if="showUserFullscreen && !embedMode"
      class="user-fullscreen"
    >
      <div class="user-fullscreen-toolbar">
        <div class="ufs-title">用户界面</div>
        <button class="exit-user-btn" @click="exitUserView">
          退出用户界面
        </button>
      </div>

      <div class="user-fullscreen-body">
        <UserDashboard :embedded="true" />
      </div>
    </div>
  </div>
</template>

<script>
import PrecisionForecast from './components/PrecisionForecast.vue';
import DisasterWarning from './components/DisasterWarning.vue';
import DamBreakSimulation from './components/DamBreakSimulation.vue';
import EmergencyPlan from './components/EmergencyPlan.vue';
import UserDashboard from '../user/UserDashboard.vue';
import UserManagement from './components/UserManagement.vue';

export default {
  name: 'AdminPanel',
  components: {
    UserDashboard,
    PrecisionForecast,
    DisasterWarning,
    DamBreakSimulation,
    EmergencyPlan,
    UserManagement
  },
  data() {
    return {
      currentModule: '精准预报',
      embedMode: false,
      showUserFullscreen: false,
      lastAdminModule: '精准预报'
    };
  },
  computed: {
    currentComponent() {
      if (this.embedMode) return 'PrecisionForecast';

      switch (this.currentModule) {
        case '用户界面':
          return 'PrecisionForecast';
        case '精准预报':
          return 'PrecisionForecast';
        case '灾害预警':
          return 'DisasterWarning';
        case '溃坝预演':
          return 'DamBreakSimulation';
        case '应急预案':
          return 'EmergencyPlan';
        case '用户管理':
          return 'UserManagement';
        default:
          return 'PrecisionForecast';
      }
    },
    topbarTitle() {
      return this.showUserFullscreen ? '用户界面' : this.currentModule;
    }
  },
  mounted() {
    const sp = new URLSearchParams(window.location.search);
    const embedByQuery = sp.get('embed') === '1';
    const embedByIframe = window.self !== window.top;
    this.embedMode = embedByQuery || embedByIframe;
  },
  methods: {
    goToModule(name) {
      if (this.embedMode) return;

      if (name === '用户界面') {
        this.lastAdminModule =
          this.currentModule === '用户界面'
            ? '精准预报'
            : this.currentModule || '精准预报';

        this.currentModule = '用户界面';
        this.showUserFullscreen = true;
        return;
      }

      this.showUserFullscreen = false;
      this.currentModule = name;
    },
    exitUserView() {
      this.showUserFullscreen = false;
      this.currentModule = this.lastAdminModule || '精准预报';
    }
  }
};
</script>

<style scoped>
.layout {
  height: 100vh;
  display: flex;
  background: #07111d; /* 深色底色，与灾害预警页一致 */
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    'Noto Sans',
    'Liberation Sans',
    sans-serif;
}

.layout.embed {
  background: transparent;
  height: 100%;
  min-height: 100vh;
}

/* 侧边栏保持原有深色风格，微调与整体更融合 */
.sider {
  width: 240px;
  background: linear-gradient(180deg, #0a1622 0%, #08111c 100%);
  color: #d9e2ef;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(74, 176, 255, 0.12);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid rgba(86, 207, 255, 0.15);
}

.brand-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(28, 224, 255, 0.12);
  border: 1px solid rgba(28, 224, 255, 0.2);
}

.brand-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: #f0fdff;
  text-shadow: 0 0 8px rgba(0, 200, 255, 0.3);
}

.menu {
  padding: 10px 10px 0;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  margin: 8px 0;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  color: #b8d8f0;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.menu-item:hover {
  background: rgba(86, 207, 255, 0.08);
  border-color: rgba(86, 207, 255, 0.15);
  color: #e0f2ff;
}

.menu-item.active {
  background: rgba(28, 224, 255, 0.12);
  border-color: rgba(28, 224, 255, 0.35);
  color: #ffffff;
  box-shadow: inset 0 0 12px rgba(28, 224, 255, 0.08);
}

.mi-ico {
  width: 24px;
  display: inline-flex;
  justify-content: center;
  filter: drop-shadow(0 0 4px rgba(0, 200, 255, 0.3));
}

.sider-footer {
  margin-top: auto;
  padding: 12px 16px;
  opacity: 0.7;
  font-size: 12px;
  color: #8ab3d0;
  border-top: 1px solid rgba(86, 207, 255, 0.1);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

/* 顶部栏改为深色玻璃态 */
.topbar {
  height: 56px;
  flex-shrink: 0;
  background: linear-gradient(180deg, rgba(8, 24, 44, 0.92), rgba(7, 19, 36, 0.96));
  border-bottom: 1px solid rgba(98, 204, 255, 0.16);
  box-shadow: inset 0 0 30px rgba(74, 176, 255, 0.04), 0 4px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.breadcrumb {
  font-size: 13px;
  color: rgba(190, 229, 247, 0.7);
}

.bc-item.active {
  color: #ebfbff;
  font-weight: 600;
  text-shadow: 0 0 6px rgba(0, 200, 255, 0.3);
}

.bc-sep {
  margin: 0 8px;
  color: rgba(140, 220, 255, 0.4);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(9, 25, 45, 0.9);
  border: 1px solid rgba(94, 196, 255, 0.2);
  padding: 6px 12px;
  border-radius: 10px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.search-ico {
  opacity: 0.7;
  filter: drop-shadow(0 0 4px rgba(0, 200, 255, 0.3));
}

.search-input {
  border: none;
  outline: none;
  background: transparent;
  width: 180px;
  font-size: 13px;
  color: #e6fbff;
}

.search-input::placeholder {
  color: rgba(189, 225, 239, 0.5);
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(94, 196, 255, 0.25);
  background: rgba(10, 31, 53, 0.9);
  color: #8ee9ff;
  cursor: pointer;
  transition: all 0.15s ease;
  display: grid;
  place-items: center;
  font-size: 16px;
  box-shadow: inset 0 0 12px rgba(42, 140, 201, 0.08);
}

.icon-btn:hover {
  border-color: rgba(94, 196, 255, 0.5);
  background: rgba(14, 37, 63, 0.95);
  color: #c2f0ff;
  transform: translateY(-1px);
}

.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 6px;
}

.avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(9, 25, 45, 0.9);
  border: 1px solid rgba(94, 196, 255, 0.25);
  color: #8ee9ff;
  font-size: 18px;
}

.user-name {
  font-size: 13px;
  color: #d9f6ff;
  font-weight: 500;
}

.content {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  background: transparent;
}

.content-user-view {
  background: #07111d;
}

.content > * {
  width: 100%;
}

/* 全屏用户界面 (保持原风格，与灾害预警页面统一) */
.user-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background:
    radial-gradient(circle at 50% 0%, rgba(0, 180, 255, 0.08), transparent 26%),
    linear-gradient(180deg, #02070d 0%, #07111c 45%, #0a2036 100%);
  display: flex;
  flex-direction: column;
}

.user-fullscreen-toolbar {
  position: relative;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background:
    linear-gradient(
      90deg,
      rgba(6, 18, 38, 0.96) 0%,
      rgba(10, 36, 68, 0.94) 35%,
      rgba(8, 54, 88, 0.92) 65%,
      rgba(5, 20, 40, 0.96) 100%
    );
  border-bottom: 1px solid rgba(87, 210, 255, 0.22);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.28),
    inset 0 -1px 0 rgba(130, 235, 255, 0.1);
  backdrop-filter: blur(14px);
  overflow: hidden;
}

.user-fullscreen-toolbar::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 50%, rgba(0, 255, 255, 0.1), transparent 22%),
    radial-gradient(circle at 80% 50%, rgba(0, 170, 255, 0.12), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0));
}

.user-fullscreen-toolbar::after {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(0, 240, 255, 0.05),
    rgba(0, 240, 255, 0.85),
    rgba(0, 240, 255, 0.05)
  );
  box-shadow: 0 0 14px rgba(0, 240, 255, 0.35);
}

.ufs-title {
  position: relative;
  z-index: 1;
  color: #f2fbff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 2px;
  text-shadow:
    0 0 10px rgba(0, 240, 255, 0.25),
    0 0 22px rgba(0, 180, 255, 0.14);
}

.exit-user-btn {
  position: relative;
  z-index: 1;
  height: 40px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid rgba(105, 225, 255, 0.35);
  background: linear-gradient(180deg, rgba(24, 86, 126, 0.72), rgba(10, 54, 92, 0.82));
  color: #f3fbff;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 16px rgba(0, 170, 255, 0.16);
  transition: all 0.2s ease;
}

.exit-user-btn:hover {
  transform: translateY(-1px);
  background: linear-gradient(180deg, rgba(30, 108, 156, 0.82), rgba(13, 67, 110, 0.92));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 0 20px rgba(0, 200, 255, 0.24);
}

.user-fullscreen-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.user-fullscreen-body > * {
  width: 100%;
  height: 100%;
}

.layout.embed .content {
  padding: 0;
  overflow: visible;
}

@media (max-width: 900px) {
  .sider {
    width: 200px;
  }

  .search-input {
    width: 120px;
  }

  .user-fullscreen-toolbar {
    height: 58px;
    padding: 0 12px;
  }

  .ufs-title {
    font-size: 16px;
    letter-spacing: 1px;
  }

  .exit-user-btn {
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
  }
}
</style>