<template>
  <div class="dam-page">
    <div class="bg-grid"></div>
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="page-shell">
      <!-- 页头 / 面包屑 -->
      <div class="page-header card-shell">
        <div class="header-left">
          <div class="header-tag">DAM BREAK SIMULATION · MODEL TRAINING</div>
          <h2>溃坝预演 · 模型训练与验证</h2>
          <p>支持上传文件训练/验证（JSON/CSV/TXT）</p>
        </div>

        <!-- 已移除右侧的实时联机和端口芯片，此处留空以保持布局 -->
        <div class="header-right"></div>
      </div>

      <!-- 面包屑 -->
      <div class="breadcrumb-card card-shell">
        <div class="breadcrumb">
          <span class="crumb">首页</span>
          <span class="sep">/</span>
          <span class="crumb">溃坝预演</span>
          <span class="sep">/</span>
          <span class="crumb active">模型训练与验证</span>
        </div>

        <div class="title-row">
          <div>
            <h1 class="page-title">训练与验证中心</h1>
            <p class="page-subtitle">支持上传 JSON / CSV / TXT 文件，训练线性回归模型并验证</p>
          </div>

          <div class="header-actions">
            <button class="action-btn ghost" @click="resetAll" :disabled="loading">重置</button>
            <button
              class="action-btn primary"
              @click="startTraining"
              :disabled="loading || (!trainingFile && !trainingData)"
              title="使用训练文件或训练数据训练模型"
            >
              {{ loading ? "处理中..." : "一键训练" }}
            </button>
          </div>
        </div>
      </div>

      <!-- 两列布局 -->
      <div class="grid">
        <!-- 左侧：数据输入 + 操作 -->
        <div class="col-left">
          <!-- 训练卡片 -->
          <div class="card card-shell">
            <div class="card-header">
              <div>
                <div class="card-title">训练数据</div>
                <div class="card-desc">优先上传文件，其次手动输入（JSON）</div>
              </div>
            </div>

            <div class="card-body">
              <!-- 文件上传 -->
              <div class="file-row">
                <label class="file-btn">
                  选择训练文件
                  <input
                    type="file"
                    accept=".json,.csv,.txt"
                    @change="onTrainingFileChange"
                    :disabled="loading"
                  />
                </label>
                <div class="file-name">
                  {{ trainingFileName || "未选择文件（可选）" }}
                </div>
                <button
                  class="action-btn ghost mini"
                  @click="clearTrainingFile"
                  :disabled="loading || !trainingFile"
                >
                  清除
                </button>
              </div>

              <!-- 备用 textarea -->
              <textarea
                v-model="trainingData"
                class="textarea"
                rows="8"
                placeholder="备用：请输入训练数据 JSON，例如：[[1,2],[2,4]]"
                :disabled="loading"
              ></textarea>

              <div class="action-row">
                <button
                  class="action-btn primary"
                  @click="startTraining"
                  :disabled="loading || (!trainingFile && !trainingData)"
                >
                  开始训练
                </button>
                <button
                  class="action-btn ghost"
                  @click="fillTrainDemo"
                  :disabled="loading"
                  title="填入示例数据"
                >
                  填入示例
                </button>
              </div>

              <div class="hint">
                支持文件格式：
                <span class="mono">JSON</span>（推荐）、
                <span class="mono">CSV</span>（两列：x,y）、
                <span class="mono">TXT</span>（内容为 JSON 或 CSV）。
              </div>
            </div>
          </div>

          <!-- 验证卡片 -->
          <div class="card card-shell">
            <div class="card-header">
              <div>
                <div class="card-title">验证数据</div>
                <div class="card-desc">需要先训练模型后才能验证</div>
              </div>
            </div>

            <div class="card-body">
              <!-- 文件上传 -->
              <div class="file-row">
                <label class="file-btn">
                  选择验证文件
                  <input
                    type="file"
                    accept=".json,.csv,.txt"
                    @change="onValidationFileChange"
                    :disabled="loading"
                  />
                </label>
                <div class="file-name">
                  {{ validationFileName || "未选择文件（可选）" }}
                </div>
                <button
                  class="action-btn ghost mini"
                  @click="clearValidationFile"
                  :disabled="loading || !validationFile"
                >
                  清除
                </button>
              </div>

              <!-- 备用 textarea -->
              <textarea
                v-model="validationData"
                class="textarea"
                rows="8"
                placeholder="备用：请输入验证数据 JSON，例如：[[6,12],[7,14]]"
                :disabled="loading"
              ></textarea>

              <div class="action-row">
                <button
                  class="action-btn secondary"
                  @click="startValidation"
                  :disabled="loading || !model || (!validationFile && !validationData)"
                >
                  验证模型
                </button>
                <button
                  class="action-btn ghost"
                  @click="fillValDemo"
                  :disabled="loading"
                  title="填入示例数据"
                >
                  填入示例
                </button>
              </div>

              <div class="hint" v-if="!model">
                提示：请先完成训练，生成模型参数后再验证。
              </div>
            </div>
          </div>

          <!-- 状态提示条 -->
          <div class="toast" v-if="status">
            <div class="dot" :class="{ ok: !isError, err: isError }"></div>
            <div class="toast-text">{{ status }}</div>
          </div>
        </div>

        <!-- 右侧：统计卡片 -->
        <div class="col-right">
          <div class="card stat-card card-shell">
            <div class="card-header">
              <div class="card-title">模型概览</div>
              <div class="tag" :class="{ ready: !!model }">
                {{ model ? "已就绪" : "未训练" }}
              </div>
            </div>

            <div class="card-body">
              <div class="stat-grid">
                <div class="stat-item">
                  <div class="stat-label">回归系数</div>
                  <div class="stat-value">{{ coefficientDisplay }}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">截距</div>
                  <div class="stat-value">{{ interceptDisplay }}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">均方误差 MSE</div>
                  <div class="stat-value">{{ mseDisplay }}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">预测输出</div>
                  <div class="stat-value small">{{ predictionsDisplay }}</div>
                </div>
              </div>

              <div class="divider"></div>

              <div class="mini-log">
                <div class="mini-log-title">运行状态</div>
                <div class="mini-log-body">
                  <div class="log-line">
                    <span class="k">训练来源：</span>
                    <span class="v">{{ trainingFile ? "文件" : (trainingData ? "文本" : "无") }}</span>
                  </div>
                  <div class="log-line">
                    <span class="k">验证来源：</span>
                    <span class="v">{{ validationFile ? "文件" : (validationData ? "文本" : "无") }}</span>
                  </div>
                  <div class="log-line">
                    <span class="k">接口：</span>
                    <span class="v">/train /validate（multipart 或 json）</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 结果详情卡 -->
          <div
            class="card card-shell"
            v-if="coefficient !== null || mse !== null || predictions !== null"
          >
            <div class="card-header">
              <div class="card-title">结果详情</div>
              <div class="card-desc">训练/验证输出明细</div>
            </div>
            <div class="card-body">
              <div class="detail">
                <div class="row">
                  <div class="key">回归系数</div>
                  <div class="val">{{ coefficientDisplay }}</div>
                </div>
                <div class="row">
                  <div class="key">截距</div>
                  <div class="val">{{ interceptDisplay }}</div>
                </div>
                <div class="row" v-if="predictions !== null">
                  <div class="key">预测流量</div>
                  <div class="val mono">{{ predictionsDisplay }}</div>
                </div>
                <div class="row" v-if="mse !== null">
                  <div class="key">MSE</div>
                  <div class="val">{{ mseDisplay }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading 覆盖层 -->
          <div class="loading-mask" v-if="loading">
            <div class="spinner"></div>
            <div class="loading-text">正在处理，请稍候...</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { originalAxios as axios } from '../../../originalApi.js';

export default {
  name: "DamBreakSimulation",
  data() {
    return {
      trainingData: "",
      validationData: "",
      trainingFile: null,
      validationFile: null,
      trainingFileName: "",
      validationFileName: "",
      status: "",
      isError: false,
      coefficient: null,
      intercept: null,
      model: null,
      predictions: null,
      mse: null,
      loading: false,
    };
  },
  computed: {
    coefficientDisplay() {
      return this.coefficient === null ? "—" : String(this.coefficient);
    },
    interceptDisplay() {
      return this.intercept === null ? "—" : String(this.intercept);
    },
    mseDisplay() {
      return this.mse === null ? "—" : String(this.mse);
    },
    predictionsDisplay() {
      if (this.predictions === null) return "—";
      try {
        return typeof this.predictions === "string"
          ? this.predictions
          : JSON.stringify(this.predictions);
      } catch {
        return String(this.predictions);
      }
    },
  },
  methods: {
    setStatus(msg, isError = false) {
      this.status = msg;
      this.isError = isError;
    },

    resetAll() {
      if (this.loading) return;
      this.trainingData = "";
      this.validationData = "";
      this.trainingFile = null;
      this.validationFile = null;
      this.trainingFileName = "";
      this.validationFileName = "";
      this.status = "";
      this.isError = false;
      this.coefficient = null;
      this.intercept = null;
      this.model = null;
      this.predictions = null;
      this.mse = null;
    },

    onTrainingFileChange(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      this.trainingFile = file;
      this.trainingFileName = file.name;
      this.setStatus(`已选择训练文件：${file.name}`, false);
    },

    onValidationFileChange(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      this.validationFile = file;
      this.validationFileName = file.name;
      this.setStatus(`已选择验证文件：${file.name}`, false);
    },

    clearTrainingFile() {
      this.trainingFile = null;
      this.trainingFileName = "";
      this.setStatus("已清除训练文件", false);
    },

    clearValidationFile() {
      this.validationFile = null;
      this.validationFileName = "";
      this.setStatus("已清除验证文件", false);
    },

    async parseFileToArray(file) {
      const text = await file.text();
      const trimmed = text.trim();

      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const json = JSON.parse(trimmed);
        if (Array.isArray(json)) return json;
        throw new Error("JSON 顶层不是数组（期望 [[x,y],...]）");
      }

      const lines = trimmed.split(/\r?\n/).filter(Boolean);
      const data = [];
      for (const line of lines) {
        const parts = line
          .split(/,|\s+/)
          .map((v) => v.trim())
          .filter(Boolean);
        if (parts.length < 2) continue;
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (Number.isNaN(x) || Number.isNaN(y)) continue;
        data.push([x, y]);
      }
      if (data.length === 0)
        throw new Error("CSV/TXT 解析失败：未解析到有效的两列数值数据");
      return data;
    },

    fillTrainDemo() {
      this.trainingData = JSON.stringify(
        [
          [1, 2],
          [2, 4],
          [3, 6],
          [4, 8],
          [5, 10],
        ],
        null,
        2
      );
      this.setStatus("已填入训练示例数据", false);
    },

    fillValDemo() {
      this.validationData = JSON.stringify(
        [
          [6, 12],
          [7, 14],
          [8, 16],
        ],
        null,
        2
      );
      this.setStatus("已填入验证示例数据", false);
    },

    async startTraining() {
      if (!this.trainingFile && !this.trainingData) {
        alert("请上传训练文件或输入训练数据");
        return;
      }

      this.setStatus("训练开始...", false);
      this.loading = true;

      try {
        if (this.trainingFile) {
          const form = new FormData();
          form.append("file", this.trainingFile);
          const res = await axios.post("http://localhost:5000/train", form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          this.applyTrainResponse(res.data);
          return;
        }

        let trainingData;
        try {
          trainingData = JSON.parse(this.trainingData);
        } catch {
          alert("训练数据格式错误，请确保数据为有效的 JSON 格式");
          this.setStatus("训练数据解析失败：JSON 格式不正确", true);
          return;
        }

        const res = await axios.post("http://localhost:5000/train", {
          data: trainingData,
        });
        this.applyTrainResponse(res.data);
      } catch (error) {
        this.setStatus("发生错误: " + (error?.message || String(error)), true);
      } finally {
        this.loading = false;
      }
    },

    applyTrainResponse(data) {
      this.setStatus(data.message || "训练完成", false);
      this.coefficient = data.coefficient;
      this.intercept = data.intercept;
      this.model = {
        coefficient: this.coefficient,
        intercept: this.intercept,
      };
      this.predictions = data.predictions;
      this.mse = data.mse;
    },

    async startValidation() {
      if (!this.model) {
        alert("请先训练模型！");
        return;
      }
      if (!this.validationFile && !this.validationData) {
        alert("请上传验证文件或输入验证数据");
        return;
      }

      this.setStatus("正在验证模型...", false);
      this.loading = true;

      try {
        if (this.validationFile) {
          const form = new FormData();
          form.append("file", this.validationFile);
          form.append("model", JSON.stringify(this.model));
          const res = await axios.post("http://localhost:5000/validate", form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          this.applyValidateResponse(res.data);
          return;
        }

        let validationData;
        try {
          validationData = JSON.parse(this.validationData);
        } catch {
          alert("验证数据格式错误，请确保数据为有效的 JSON 格式");
          this.setStatus("验证数据解析失败：JSON 格式不正确", true);
          return;
        }

        const res = await axios.post("http://localhost:5000/validate", {
          model: this.model,
          validation_data: validationData,
        });
        this.applyValidateResponse(res.data);
      } catch (error) {
        this.setStatus("验证错误: " + (error?.message || String(error)), true);
      } finally {
        this.loading = false;
      }
    },

    applyValidateResponse(data) {
      this.predictions = data.predictions;
      this.mse = data.mse;
      this.setStatus(data.message || "验证完成", false);
    },
  },
};
</script>

<style scoped>
/* 深色科技风背景 */
.dam-page {
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
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.2),
    inset 0 0 30px rgba(74, 176, 255, 0.04);
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

/* 移除了芯片相关样式，header-chip 和 dot 不再使用，但保留定义以防其他页面引用 */
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

.header-actions {
  display: flex;
  gap: 10px;
}

/* 两列布局 */
.grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

/* 卡片 */
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

/* 文件上传行 */
.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px dashed rgba(94, 196, 255, 0.2);
  border-radius: 12px;
  background: rgba(7, 22, 40, 0.72);
}

.file-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(94, 196, 255, 0.2);
  background: rgba(10, 31, 53, 0.9);
  color: #8ee9ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  user-select: none;
}

.file-btn:hover {
  border-color: rgba(94, 196, 255, 0.35);
  background: rgba(14, 37, 63, 0.95);
}

.file-btn input[type="file"] {
  display: none;
}

.file-name {
  flex: 1;
  font-size: 12px;
  color: rgba(215, 244, 255, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文本域 */
.textarea {
  width: 100%;
  min-height: 160px;
  border: 1px solid rgba(94, 196, 255, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  resize: vertical;
  background: rgba(9, 25, 45, 0.9);
  color: #e6fbff;
  margin-top: 12px;
  box-sizing: border-box;
}

.textarea:focus {
  border-color: rgba(98, 205, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(76, 172, 255, 0.08);
}

.textarea::placeholder {
  color: rgba(189, 225, 239, 0.42);
}

/* 按钮行 */
.action-row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
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

.action-btn.secondary {
  color: #ffffff;
  background: linear-gradient(90deg, #2a6f9c, #1e90ff);
}

.action-btn.secondary:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.action-btn.secondary:disabled {
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

.action-btn.ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.ghost.mini {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
}

/* 提示文本 */
.hint {
  margin-top: 10px;
  font-size: 12px;
  color: rgba(198, 239, 255, 0.75);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: rgba(26, 135, 255, 0.15);
  padding: 2px 6px;
  border-radius: 6px;
  color: #8ce9ff;
}

/* Toast 通知 */
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

/* 右侧统计卡片 */
.stat-card .card-header {
  align-items: center;
}

.tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 170, 255, 0.08);
  border: 1px solid rgba(93, 196, 255, 0.18);
  color: #8ce9ff;
}

.tag.ready {
  background: rgba(0, 255, 174, 0.1);
  color: #6eebc3;
  border-color: rgba(0, 255, 174, 0.25);
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

.mini-log-title {
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
  margin-bottom: 10px;
}

.mini-log-body {
  display: grid;
  gap: 8px;
}

.log-line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.log-line .k {
  color: rgba(187, 229, 246, 0.58);
}

.log-line .v {
  color: #e7fcff;
  font-weight: 600;
}

/* 详情行 */
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

/* Loading 遮罩 */
.col-right {
  position: relative;
}

.loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(7, 17, 29, 0.8);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  backdrop-filter: blur(4px);
  z-index: 10;
}

.spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid rgba(92, 214, 255, 0.15);
  border-top-color: #5cd6ff;
  animation: spin 0.9s linear infinite;
}

.loading-text {
  font-size: 12px;
  color: rgba(215, 244, 255, 0.82);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .file-row {
    flex-wrap: wrap;
  }
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>