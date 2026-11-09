<template>
  <div class="emergency-page">
    <div class="bg-grid"></div>
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="page-shell">
      <!-- 页头 -->
      <div class="page-header card-shell">
        <div class="header-left">
          <div class="header-tag">EMERGENCY RESPONSE CENTER</div>
          <h2>尾矿库应急预案</h2>
          <p>负责人、处理方法、适用尾矿库</p>
        </div>
        <div class="header-right">

        </div>
      </div>

      <!-- 面包屑 -->
      <div class="breadcrumb-card card-shell">
        <div class="breadcrumb">
          <span class="crumb">首页</span>
          <span class="sep">/</span>
          <span class="crumb">应急预案</span>
          <span class="sep">/</span>
          <span class="crumb active">尾矿库应急预案</span>
        </div>
        <div class="title-row">
          <div>
            <h1 class="page-title">应急预案列表</h1>
            <p class="page-subtitle">支持按名称、等级、尾矿库筛选，管理负责人与处置方法</p>
          </div>
        </div>
      </div>

      <!-- 两列布局 -->
      <div class="grid">
        <!-- 左侧：预案列表（可滚动） -->
        <div class="col-left">
          <div class="card card-shell">
            <div class="card-header">
              <div>
                <div class="card-title">预案列表</div>
                <div class="card-desc">支持按关键字与等级筛选</div>
              </div>
            </div>

            <!-- 搜索栏 + 操作按钮在同一行 -->
            <div class="list-toolbar">
              <div class="filters">
                <input
                  class="input"
                  v-model="keyword"
                  placeholder="搜索：预案名称/尾矿库/负责人"
                />
                <select class="select" v-model="level">
                  <option value="">全部等级</option>
                  <option value="Ⅰ级">Ⅰ级（特别重大）</option>
                  <option value="Ⅱ级">Ⅱ级（重大）</option>
                  <option value="Ⅲ级">Ⅲ级（较大）</option>
                  <option value="Ⅳ级">Ⅳ级（一般）</option>
                </select>
              </div>
              <div class="toolbar-actions">
                <button class="action-btn ghost" @click="resetFilters">重置筛选</button>
                <button class="action-btn primary" @click="openCreateModal">新增预案</button>
              </div>
            </div>

            <!-- 可滚动的列表区域 -->
            <div class="card-body scrollable-list">
              <div class="table">
                <div class="thead">
                  <div class="th">预案名称</div>
                  <div class="th">等级</div>
                  <div class="th">尾矿库</div>
                  <div class="th">负责人</div>
                  <div class="th">状态</div>
                  <div class="th right">操作</div>
                </div>

                <div
                  class="trow"
                  v-for="item in filteredPlans"
                  :key="item.id"
                  :class="{ active: selectedPlan && selectedPlan.id === item.id }"
                >
                  <div class="td">
                    <div class="name">{{ item.plan_name }}</div>
                    <div class="sub">编号：{{ item.code }}</div>
                  </div>
                  <div class="td">
                    <span class="pill" :class="levelClass(item.emergency_level)">
                      {{ item.emergency_level }}
                    </span>
                  </div>
                  <div class="td">{{ item.tailings_pond || '—' }}</div>
                  <div class="td">
                    <div>{{ item.responsible_person || '—' }}</div>
                    <div class="sub">{{ item.contact_phone }}</div>
                  </div>
                  <div class="td">
                    <span class="status" :class="{ on: item.enabled }">
                      {{ item.enabled ? '启用' : '停用' }}
                    </span>
                  </div>
                  <div class="td right">
                    <button class="link-btn" @click="selectPlan(item)">查看</button>
                    <button class="link-btn danger" @click="deletePlan(item)">删除</button>
                    <button class="link-btn" @click="openEditModal(item)">编辑</button>
                  </div>
                </div>

                <div v-if="filteredPlans.length === 0" class="empty">
                  暂无数据（请调整筛选条件或新增预案）
                </div>
              </div>
            </div>
          </div>

          <!-- 处置方法区域（优化为步骤展示） -->
          <div class="card card-shell">
            <div class="card-header">
              <div>
                <div class="card-title">处置方法 / 流程</div>
                <div class="card-desc">当前选中预案的详细处理方法</div>
              </div>
            </div>
            <div class="card-body">
              <div v-if="!selectedPlan" class="hint">
                请先在上方选择一个预案查看处理方法。
              </div>
              <div v-else class="handling-method-box">
                <div class="method-header">
                  <span class="badge">📋 处置步骤</span>
                  <span class="update-time">{{ formatTime(selectedPlan.updated_at) }}</span>
                </div>

                <!-- 结构化步骤展示 -->
                <div v-if="selectedPlan.handling_method" class="method-steps">
                  <div
                    class="step-item"
                    v-for="(step, index) in parseHandlingMethod(selectedPlan.handling_method)"
                    :key="index"
                  >
                    <div class="step-marker">{{ index + 1 }}</div>
                    <div class="step-content">{{ step }}</div>
                  </div>
                </div>

                <!-- 无处理方法时的占位 -->
                <div v-else class="method-empty">
                  <span class="empty-icon">📭</span>
                  <span>暂无详细处置步骤</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：概览 / 详情 -->
        <div class="col-right">
          <div class="card stat-card card-shell">
            <div class="card-header">
              <div class="card-title">概览</div>
              <div class="tag">尾矿库应急中心</div>
            </div>
            <div class="card-body">
              <div class="stat-grid">
                <div class="stat-item">
                  <div class="stat-label">预案总数</div>
                  <div class="stat-value">{{ plans.length }}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">启用预案</div>
                  <div class="stat-value">{{ enabledCount }}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">筛选结果</div>
                  <div class="stat-value">{{ filteredPlans.length }}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">选中预案</div>
                  <div class="stat-value small">
                    {{ selectedPlan ? selectedPlan.plan_name : '—' }}
                  </div>
                </div>
              </div>
              <div class="divider"></div>
              <div class="mini-panel">
                <div class="mini-title"></div>
                <div class="mini-text">

                </div>
                <div class="mini-text" style="margin-top:8px;">
                  <span v-if="plans.length" style="color:#8ce9ff;">✓ 已加载 {{ plans.length }} 条预案</span>
                  <span v-else style="color:#ff9277;">○ 暂无数据</span>
                </div>
              </div>
            </div>
          </div>

          <div class="card card-shell" v-if="selectedPlan">
            <div class="card-header">
              <div>
                <div class="card-title">预案详情</div>
                <div class="card-desc">ID：{{ selectedPlan.id }}</div>
              </div>
            </div>
            <div class="card-body">
              <div class="detail">
                <div class="row">
                  <div class="key">预案名称</div>
                  <div class="val">{{ selectedPlan.plan_name }}</div>
                </div>
                <div class="row">
                  <div class="key">编号</div>
                  <div class="val mono">{{ selectedPlan.code }}</div>
                </div>
                <div class="row">
                  <div class="key">适用尾矿库</div>
                  <div class="val">{{ selectedPlan.tailings_pond || '—' }}</div>
                </div>
                <div class="row">
                  <div class="key">应急等级</div>
                  <div class="val">
                    <span class="pill" :class="levelClass(selectedPlan.emergency_level)">
                      {{ selectedPlan.emergency_level }}
                    </span>
                  </div>
                </div>
                <div class="row">
                  <div class="key">负责人</div>
                  <div class="val">{{ selectedPlan.responsible_person || '—' }}</div>
                </div>
                <div class="row">
                  <div class="key">联系电话</div>
                  <div class="val">{{ selectedPlan.contact_phone || '—' }}</div>
                </div>
                <div class="row">
                  <div class="key">版本</div>
                  <div class="val">v{{ selectedPlan.version }}</div>
                </div>
                <div class="row">
                  <div class="key">状态</div>
                  <div class="val">
                    <span class="status" :class="{ on: selectedPlan.enabled }">
                      {{ selectedPlan.enabled ? '启用' : '停用' }}
                    </span>
                  </div>
                </div>
                <div class="row">
                  <div class="key">更新时间</div>
                  <div class="val">{{ formatTime(selectedPlan.updated_at) }}</div>
                </div>
                <div class="row">
                  <div class="key">备注</div>
                  <div class="val">{{ selectedPlan.note || '—' }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card card-shell" v-else>
            <div class="card-header">
              <div class="card-title">预案详情</div>
              <div class="card-desc">请选择一个预案查看</div>
            </div>
            <div class="card-body">
              <div class="hint">
                点击左侧列表中的“查看”或行区域选中预案。
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增/编辑模态框 -->
      <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
        <div class="modal card-shell">
          <div class="modal-header">
            <h3>{{ modalTitle }}</h3>
            <button class="close-btn" @click="closeModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>预案名称 <span class="required">*</span></label>
              <input class="input" v-model="form.plan_name" placeholder="例：坝体渗漏应急处置方案" />
            </div>
            <div class="form-group">
              <label>编号 <span class="required">*</span></label>
              <input class="input" v-model="form.code" placeholder="例：PLAN-001" />
            </div>
            <div class="form-group">
              <label>适用尾矿库 <span class="required">*</span></label>
              <input class="input" v-model="form.tailings_pond" placeholder="例：张家沟尾矿库" />
            </div>
            <div class="form-group">
              <label>负责人 <span class="required">*</span></label>
              <input class="input" v-model="form.responsible_person" placeholder="姓名" />
            </div>
            <div class="form-group">
              <label>联系电话 <span class="required">*</span></label>
              <input class="input" v-model="form.contact_phone" placeholder="手机号码" />
            </div>
            <div class="form-group">
              <label>应急等级</label>
              <select class="select" v-model="form.emergency_level">
                <option value="Ⅰ级">Ⅰ级（特别重大）</option>
                <option value="Ⅱ级">Ⅱ级（重大）</option>
                <option value="Ⅲ级">Ⅲ级（较大）</option>
                <option value="Ⅳ级">Ⅳ级（一般）</option>
              </select>
            </div>
            <div class="form-group">
              <label>版本</label>
              <input class="input" v-model="form.version" placeholder="1.0" />
            </div>
            <div class="form-group">
              <label>启用状态</label>
              <select class="select" v-model="form.enabled">
                <option :value="true">启用</option>
                <option :value="false">停用</option>
              </select>
            </div>
            <div class="form-group">
              <label>处理方法 <span class="required">*</span></label>
              <textarea
                class="input textarea"
                v-model="form.handling_method"
                rows="5"
                placeholder="详细处置步骤，可分点描述（例如：1. 步骤一；2. 步骤二）"
              ></textarea>
            </div>
            <div class="form-group">
              <label>备注</label>
              <textarea class="input textarea" v-model="form.note" rows="2" placeholder="可选"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="action-btn ghost" @click="closeModal">取消</button>
            <button class="action-btn primary" @click="submitForm">{{ modalSubmitText }}</button>
          </div>
        </div>
      </div>

      <!-- 通知条 -->
      <div class="toast" v-if="toast">
        <div class="dot" :class="{ ok: !toastError, err: toastError }"></div>
        <div class="toast-text">{{ toast }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { originalAxios as axios } from '../../../originalApi.js';

const API_BASE = "/emergency-api";

export default {
  name: "EmergencyPlan",
  data() {
    return {
      keyword: "",
      level: "",
      toast: "",
      toastError: false,
      plans: [],
      selectedPlan: null,

      showModal: false,
      isEditMode: false,
      editingId: null,
      form: {
        plan_name: "",
        code: "",
        tailings_pond: "",
        responsible_person: "",
        contact_phone: "",
        emergency_level: "Ⅲ级",
        version: "1.0",
        enabled: true,
        handling_method: "",
        note: "",
      },
    };
  },
  computed: {
    filteredPlans() {
      const kw = this.keyword.trim().toLowerCase();
      return this.plans.filter((p) => {
        const hitKw =
          !kw ||
          (p.plan_name && p.plan_name.toLowerCase().includes(kw)) ||
          (p.tailings_pond && p.tailings_pond.toLowerCase().includes(kw)) ||
          (p.responsible_person && p.responsible_person.toLowerCase().includes(kw)) ||
          (p.code && p.code.toLowerCase().includes(kw));
        const hitLv = !this.level || p.emergency_level === this.level;
        return hitKw && hitLv;
      });
    },
    enabledCount() {
      return this.plans.filter((p) => p.enabled).length;
    },
    modalTitle() {
      return this.isEditMode ? "编辑应急预案" : "新增应急预案";
    },
    modalSubmitText() {
      return this.isEditMode ? "保存修改" : "立即创建";
    },
  },
  mounted() {
    this.loadPlans();
  },
  methods: {
    formatTime(timestamp) {
      if (!timestamp) return "—";
      const d = new Date(timestamp);
      return d.toLocaleString("zh-CN", { hour12: false });
    },
    levelClass(level) {
      if (level === "Ⅰ级") return "lv-Ⅰ";
      if (level === "Ⅱ级") return "lv-Ⅱ";
      if (level === "Ⅲ级") return "lv-Ⅲ";
      if (level === "Ⅳ级") return "lv-Ⅳ";
      return "lv-Ⅲ";
    },
    notify(msg, isErr = false) {
      this.toast = msg;
      this.toastError = isErr;
      setTimeout(() => {
        this.toast = "";
        this.toastError = false;
      }, 3000);
    },

    // 解析处理方法字符串为步骤数组
    parseHandlingMethod(methodStr) {
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
    },

    async loadPlans() {
      try {
        const res = await axios.get(`${API_BASE}/plans`);
        if (res.data.code === 200) {
          this.plans = res.data.data || [];
          if (this.plans.length > 0) {
            this.selectedPlan = this.plans[0];
          } else {
            this.selectedPlan = null;
          }
          this.notify(`已加载 ${this.plans.length} 条预案`);
        } else {
          this.notify(res.data.msg || "加载失败", true);
        }
      } catch (err) {
        console.error("加载失败：", err);
        this.notify("加载失败，请确保后端运行在端口 3004", true);
      }
    },

    resetFilters() {
      this.keyword = "";
      this.level = "";
      this.notify("已重置筛选条件");
    },

    selectPlan(item) {
      this.selectedPlan = item;
    },

    openCreateModal() {
      this.isEditMode = false;
      this.editingId = null;
      this.form = {
        plan_name: "",
        code: "",
        tailings_pond: "",
        responsible_person: "",
        contact_phone: "",
        emergency_level: "Ⅲ级",
        version: "1.0",
        enabled: true,
        handling_method: "",
        note: "",
      };
      this.showModal = true;
    },

    openEditModal(item) {
      this.isEditMode = true;
      this.editingId = item.id;
      this.form = {
        plan_name: item.plan_name,
        code: item.code,
        tailings_pond: item.tailings_pond,
        responsible_person: item.responsible_person,
        contact_phone: item.contact_phone,
        emergency_level: item.emergency_level,
        version: item.version,
        enabled: Boolean(item.enabled),
        handling_method: item.handling_method,
        note: item.note || "",
      };
      this.showModal = true;
    },

    closeModal() {
      this.showModal = false;
    },

    async submitForm() {
      const required = [
        "plan_name",
        "code",
        "tailings_pond",
        "responsible_person",
        "contact_phone",
        "handling_method",
      ];
      for (const field of required) {
        if (!this.form[field]) {
          this.notify(`请填写 ${field}`, true);
          return;
        }
      }

      const payload = {
        ...this.form,
        enabled: this.form.enabled ? 1 : 0,
      };

      try {
        let res;
        if (this.isEditMode) {
          res = await axios.put(`${API_BASE}/plans/${this.editingId}`, payload);
        } else {
          res = await axios.post(`${API_BASE}/plans`, payload);
        }

        if (res.data.code === 200) {
          this.notify(this.isEditMode ? "修改成功" : "新增成功");
          this.closeModal();
          await this.loadPlans();
        } else {
          this.notify(res.data.msg || "操作失败", true);
        }
      } catch (err) {
        console.error(err);
        this.notify("请求失败，请检查后端", true);
      }
    },

    async deletePlan(item) {
      if (!confirm(`确定删除预案“${item.plan_name}”吗？`)) return;
      try {
        const res = await axios.delete(`${API_BASE}/plans/${item.id}`);
        if (res.data.code === 200) {
          this.notify("删除成功");
          if (this.selectedPlan && this.selectedPlan.id === item.id) {
            this.selectedPlan = null;
          }
          await this.loadPlans();
        } else {
          this.notify(res.data.msg || "删除失败", true);
        }
      } catch (err) {
        console.error(err);
        this.notify("删除请求失败", true);
      }
    },
  },
};
</script>

<style scoped>
/* ==================== 全局深色科技风背景 ==================== */
.emergency-page {
  position: relative;
  min-height: 100%;
  padding: 18px;
  color: #d9f6ff;
  background: radial-gradient(circle at 12% 10%, rgba(34, 132, 255, 0.16), transparent 26%),
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
  background-image: linear-gradient(rgba(93, 196, 255, 0.05) 1px, transparent 1px),
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
.breadcrumb-card,
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
.breadcrumb-card {
  padding: 16px 20px;
}
.breadcrumb {
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.crumb.active {
  color: #8ce9ff;
  font-weight: 600;
}
.sep {
  opacity: 0.6;
}
.title-row {
  margin-top: 14px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  color: #ebfbff;
  font-weight: 700;
}
.page-subtitle {
  margin: 6px 0 0 0;
  color: rgba(199, 237, 252, 0.64);
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: 1.65fr 1fr;
  gap: 16px;
}
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.card {
  padding: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.card-title {
  color: #ebfbff;
  font-size: 18px;
  font-weight: 700;
}
.card-desc {
  margin-top: 6px;
  color: rgba(199, 237, 252, 0.64);
  font-size: 13px;
  line-height: 1.6;
}
.card-body {
  padding: 4px 0 0;
}

/* 工具栏（搜索 + 按钮） */
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
}
.toolbar-actions {
  display: flex;
  gap: 10px;
}

.input,
.select {
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
  min-width: 200px;
}
.select {
  min-width: 140px;
}
.input::placeholder {
  color: rgba(189, 225, 239, 0.42);
}
.input:focus,
.select:focus {
  border-color: rgba(98, 205, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(76, 172, 255, 0.08);
}

/* 按钮 */
.action-btn {
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
.action-btn.primary {
  color: #ffffff;
  background: linear-gradient(90deg, #1a87ff, #1ce0ff);
}
.action-btn.primary:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}
.action-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.action-btn.ghost {
  color: #8ee9ff;
  background: rgba(10, 31, 53, 0.9);
  border-color: rgba(94, 196, 255, 0.2);
}
.action-btn.ghost:hover {
  border-color: rgba(94, 196, 255, 0.35);
  background: rgba(14, 37, 63, 0.95);
}

.link-btn {
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid rgba(94, 196, 255, 0.2);
  background: rgba(10, 31, 53, 0.7);
  color: #8ee9ff;
  cursor: pointer;
  transition: all 0.15s ease;
}
.link-btn:hover {
  border-color: rgba(94, 196, 255, 0.35);
  background: rgba(14, 37, 63, 0.95);
}
.link-btn.danger {
  color: #ff9277;
  border-color: rgba(255, 116, 77, 0.2);
}
.link-btn.danger:hover {
  border-color: rgba(255, 116, 77, 0.4);
  background: rgba(255, 116, 77, 0.1);
}

/* 可滚动列表区域 */
.scrollable-list {
  max-height: 380px;
  overflow-y: auto;
  padding-right: 4px;
  position: relative;
}
.table {
  display: grid;
  gap: 8px;
}
.thead {
  display: grid;
  grid-template-columns: 1.6fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr;
  padding: 10px 10px;
  background: rgba(8, 22, 39, 0.9);
  border: 1px solid rgba(99, 205, 255, 0.08);
  border-radius: 10px;
  font-size: 12px;
  color: rgba(198, 239, 255, 0.75);
  font-weight: 700;
  position: sticky;
  top: 0;
  z-index: 5;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.trow {
  display: grid;
  grid-template-columns: 1.6fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr;
  padding: 10px 10px;
  border: 1px solid rgba(99, 205, 255, 0.08);
  border-radius: 10px;
  background: rgba(8, 22, 39, 0.5);
}
.trow:hover {
  background: rgba(14, 37, 63, 0.95);
}
.trow.active {
  border-color: rgba(98, 205, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(76, 172, 255, 0.08);
}
.th,
.td {
  font-size: 12px;
  color: #e7fcff;
}
.right {
  text-align: right;
}
.name {
  font-weight: 800;
  color: #f0fdff;
}
.sub {
  margin-top: 3px;
  color: rgba(187, 229, 246, 0.58);
  font-size: 11px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.empty {
  padding: 16px 10px;
  color: rgba(203, 238, 252, 0.58);
  font-size: 12px;
  text-align: center;
}

/* 等级标签 */
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid rgba(93, 196, 255, 0.18);
  background: rgba(0, 170, 255, 0.08);
  color: #8ce9ff;
}
.lv-Ⅰ {
  background: rgba(255, 91, 125, 0.15);
  color: #ff8d9a;
  border-color: rgba(255, 91, 125, 0.3);
}
.lv-Ⅱ {
  background: rgba(255, 179, 71, 0.15);
  color: #ffb86c;
  border-color: rgba(255, 179, 71, 0.3);
}
.lv-Ⅲ {
  background: rgba(0, 191, 255, 0.15);
  color: #7ad0ff;
  border-color: rgba(0, 191, 255, 0.3);
}
.lv-Ⅳ {
  background: rgba(0, 255, 174, 0.1);
  color: #6eebc3;
  border-color: rgba(0, 255, 174, 0.25);
}

/* 状态 */
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: rgba(187, 229, 246, 0.58);
}
.status::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #5cd6ff;
  opacity: 0.6;
}
.status.on {
  color: #9ef0c6;
}
.status.on::before {
  background: #00ffbf;
  opacity: 1;
  box-shadow: 0 0 10px rgba(0, 255, 191, 0.8);
}

/* 处置方法区域 */
.handling-method-box {
  background: rgba(7, 22, 40, 0.72);
  border: 1px solid rgba(106, 203, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
}
.method-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(110, 196, 239, 0.15);
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 30px;
  background: rgba(0, 170, 255, 0.15);
  border: 1px solid rgba(0, 240, 255, 0.2);
  color: #8ce9ff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.update-time {
  font-size: 11px;
  color: rgba(187, 229, 246, 0.58);
  font-family: ui-monospace, monospace;
}
.method-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.step-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.step-marker {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(26, 135, 255, 0.25), rgba(28, 224, 255, 0.15));
  border: 1px solid rgba(0, 240, 255, 0.3);
  color: #9ef0ff;
  font-weight: 900;
  font-size: 13px;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.1);
}
.step-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.7;
  color: #d9f6ff;
  padding-top: 4px;
  word-break: break-word;
}
.method-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 20px;
  color: rgba(187, 229, 246, 0.5);
  font-size: 13px;
  gap: 10px;
}
.empty-icon {
  font-size: 32px;
  opacity: 0.6;
}
.hint {
  font-size: 13px;
  color: rgba(203, 238, 252, 0.6);
  padding: 20px;
  text-align: center;
}

/* 右侧概览 */
.tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 170, 255, 0.08);
  border: 1px solid rgba(93, 196, 255, 0.18);
  color: #8ce9ff;
}
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.stat-item {
  background: rgba(7, 22, 40, 0.72);
  border: 1px solid rgba(106, 203, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
}
.stat-label {
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
}
.stat-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 800;
  color: #f8feff;
  word-break: break-word;
}
.stat-value.small {
  font-size: 13px;
  font-weight: 700;
  color: #e7fcff;
}
.divider {
  height: 1px;
  background: rgba(110, 196, 239, 0.08);
  margin: 14px 0;
}
.mini-title {
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
  margin-bottom: 8px;
}
.mini-text {
  font-size: 12px;
  color: rgba(215, 244, 255, 0.82);
  line-height: 1.6;
}
code {
  background: rgba(26, 135, 255, 0.15);
  padding: 2px 6px;
  border-radius: 6px;
  color: #8ce9ff;
  font-family: monospace;
}

/* 详情 */
.detail .row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(110, 196, 239, 0.08);
}
.detail .row:last-child {
  border-bottom: none;
}
.detail .key {
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
  min-width: 90px;
}
.detail .val {
  font-size: 13px;
  color: #e7fcff;
  font-weight: 700;
  text-align: right;
  word-break: break-word;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 0;
}
.modal-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(94, 196, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.modal-header h3 {
  margin: 0;
  color: #ebfbff;
  font-size: 20px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #8ce9ff;
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  padding: 20px;
}
.form-group {
  margin-bottom: 18px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #c7f6ff;
}
.required {
  color: #ff5b7d;
  margin-left: 2px;
}
.textarea {
  min-height: 80px;
  resize: vertical;
}
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(94, 196, 255, 0.15);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Toast */
.toast {
  margin-top: 16px;
  background: rgba(8, 22, 39, 0.9);
  border: 1px solid rgba(99, 205, 255, 0.08);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
}
.dot.ok {
  background: #00ffbf;
  box-shadow: 0 0 10px rgba(0, 255, 191, 0.8);
}
.dot.err {
  background: #ff5b7d;
  box-shadow: 0 0 10px rgba(255, 91, 125, 0.8);
}
.toast-text {
  font-size: 13px;
  color: #e7fcff;
}

/* 响应式 */
@media (max-width: 600px) {
  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  .input,
  .select {
    width: 100%;
  }
  .toolbar-actions {
    justify-content: flex-end;
  }
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>