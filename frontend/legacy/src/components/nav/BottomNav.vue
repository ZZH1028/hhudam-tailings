<template>
  <div class="bottom-dock-container pointer-auto">
    <div class="dock-bg">
      <div
        class="dock-item"
        v-for="nav in navItems"
        :key="nav.id"
        :class="{ active: currentPre === nav.id }"
        @click="onNavClick(nav.id)"
      >
        <div class="dock-icon">{{ nav.icon }}</div>
        <div class="dock-label">{{ nav.label }}</div>
        <div class="dock-light"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(["currentPre"]);

// ✅ 保留原有事件，新增应急预案对应的事件
const emit = defineEmits(["update:currentPre", "nav", "openDisasterPanel", "openEmergencyPlanPanel"]);

// 精准预报、灾害预警等导航项（保留原有内容）
const navItems = [
  { id: "forecast", label: "精准预报", icon: "🌦️" },
  { id: "warning", label: "灾害预警", icon: "⚡" },
  { id: "home", label: "系统首页", icon: "🏠" },
  { id: "damBreak", label: "溃坝预演", icon: "🎬" },
  { id: "plan", label: "应急预案", icon: "📚" },
];

const onNavClick = (id) => {
  // 更新当前选中状态（保留原有逻辑）
  emit("update:currentPre", id);
  // 通知App.vue点击了哪个模块（保留原有逻辑）
  emit("nav", id);

  // ✅ 原有：点击“灾害预警”触发面板打开
  if (id === "warning") {
    emit("openDisasterPanel");
  }
  // ✅ 新增：点击“应急预案”触发对应的面板打开事件
  else if (id === "plan") {
    emit("openEmergencyPlanPanel");
  }
};
</script>

<style scoped>
.bottom-dock-container {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
}

.dock-bg {
  background: rgba(0, 20, 40, 0.85);
  border: 1px solid rgba(0, 122, 245, 0.5);
  border-radius: 40px;
  padding: 10px 30px;
  display: flex;
  gap: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  position: relative;
  padding: 5px 15px;
  transition: all 0.3s;
}

.dock-icon {
  font-size: 24px;
  margin-bottom: 5px;
  transition: transform 0.3s;
}

.dock-label {
  color: #888;
  font-size: 12px;
  font-weight: bold;
}

.dock-light {
  position: absolute;
  bottom: -5px;
  width: 0;
  height: 2px;
  background: #00f0ff;
  transition: width 0.3s;
  box-shadow: 0 0 10px #00f0ff;
}

.dock-item:hover .dock-icon,
.dock-item.active .dock-icon {
  transform: translateY(-5px) scale(1.2);
}

.dock-item:hover .dock-label,
.dock-item.active .dock-label {
  color: #fff;
}

.dock-item.active .dock-light {
  width: 80%;
}
</style>