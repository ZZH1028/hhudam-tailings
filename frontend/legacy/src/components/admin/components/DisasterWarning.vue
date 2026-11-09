<template>
  <div class="warning-page">
    <div class="bg-grid"></div>
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="page-shell">
      <!-- 页面标题区 -->
      <div class="page-header card-shell">
        <div class="header-left">
          <div class="header-tag">DISASTER WARNING</div>
          <h2>灾害预警</h2>
          <p>基于监测指标阈值识别异常过程，动态展示各点位时序变化与预警状态。</p>
        </div>
        <div class="header-right">
          <!-- 类型切换标签 -->
          <div class="type-switch">
            <button
              class="type-tab"
              :class="{ active: activeType === 'water' }"
              @click="switchType('water')"
            >
              💧 水质监测
            </button>
            <button
              class="type-tab"
              :class="{ active: activeType === 'dam' }"
              @click="switchType('dam')"
            >
              🏗️ 坝体安全
            </button>
          </div>
        </div>
      </div>

      <!-- 顶部概览卡片（水质模式） -->
      <div class="top-panel" v-if="activeType === 'water'">
        <div class="summary-card">
          <div class="summary-label">监测记录</div>
          <div class="summary-value">{{ totalRecords }}</div>
          <div class="summary-sub">水质样本总数</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">已发布预警</div>
          <div class="summary-value">{{ stats.published }}</div>
          <div class="summary-sub">待处置</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">处置中</div>
          <div class="summary-value">{{ stats.processing }}</div>
          <div class="summary-sub">处理中</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">已关闭</div>
          <div class="summary-value">{{ stats.closed }}</div>
          <div class="summary-sub">历史预警</div>
        </div>
      </div>

      <!-- 顶部概览卡片（坝体模式：预警统计） -->
      <div class="top-panel" v-if="activeType === 'dam'">
        <div class="summary-card">
          <div class="summary-label">监测记录</div>
          <div class="summary-value">{{ damTotalRecords }}</div>
          <div class="summary-sub">坝体数据总数</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">已发布预警</div>
          <div class="summary-value">{{ damStats.published }}</div>
          <div class="summary-sub">待处置</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">处置中</div>
          <div class="summary-value">{{ damStats.processing }}</div>
          <div class="summary-sub">处理中</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">已关闭</div>
          <div class="summary-value">{{ damStats.closed }}</div>
          <div class="summary-sub">历史预警</div>
        </div>
      </div>

      <!-- 工具栏筛选区（水质模式） -->
      <div class="toolbar-card card-shell" v-if="activeType === 'water'">
        <div class="toolbar-left">
          <div class="toolbar-title">监测筛选</div>
          <div class="toolbar-sub">按时间与点位查询动态过程</div>
        </div>
        <div class="toolbar-controls">
          <div class="control-item">
            <label>日期</label>
            <input v-model="filters.date" type="date" class="control-input" />
          </div>
          <div class="control-item control-wide">
            <label>点位</label>
            <input
              v-model="filters.site_name"
              type="text"
              class="control-input"
              placeholder="请输入点位名称关键词"
            />
          </div>
          <div class="control-buttons">
            <button class="action-btn primary" @click="refreshWarnings">查询数据</button>
            <button class="action-btn ghost" @click="resetFilters">重置条件</button>
            <button class="action-btn ghost" @click="toggleViewClosed">
              {{ viewClosed ? "查看最新预警" : "查看已关闭预警" }}
            </button>
          </div>
        </div>
      </div>

      <!-- 工具栏筛选区（坝体模式） -->
      <div class="toolbar-card card-shell" v-if="activeType === 'dam'">
        <div class="toolbar-left">
          <div class="toolbar-title">坝体监测筛选</div>
          <div class="toolbar-sub">选择传感器与测量指标</div>
        </div>
        <div class="toolbar-controls dam-controls">
          <div class="control-item">
            <label>传感器</label>
            <select v-model="damFilters.sensor" class="control-input" @change="onSensorChange">
              <option value="">请选择传感器</option>
              <option v-for="s in damSensors" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="control-item">
            <label>测量类型</label>
            <select v-model="damFilters.measureName" class="control-input" @change="onMeasureChange" :disabled="!damFilters.sensor">
              <option value="">请选择测量类型</option>
              <option v-for="m in filteredMeasureNames" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="control-item">
            <label>时间范围</label>
            <select v-model="damFilters.timeRange" class="control-input" @change="onDamFilterChange">
              <option value="1">最近1天</option>
              <option value="3">最近3天</option>
              <option value="7">最近7天</option>
              <option value="30">最近30天</option>
              <option value="all">全部时间</option>
            </select>
          </div>
          <div class="control-buttons">
            <button class="action-btn primary" @click="refreshDamData">查询数据</button>
            <button class="action-btn ghost" @click="resetDamFilters">重置条件</button>
          </div>
        </div>
      </div>

      <!-- 主内容区（水质模式：快捷操作 + 预警列表） -->
      <div class="main-grid-single" v-if="activeType === 'water'">
        <div class="panel-card card-shell">
          <div class="action-panel-top">
            <div class="panel-head compact-head">
              <div>
                <div class="panel-title">快捷操作</div>
                <div class="panel-sub">常用功能入口</div>
              </div>
            </div>
            <div class="action-grid">
              <button class="action-btn primary" @click="toast('已模拟：发布预警')">发布预警</button>
              <button class="action-btn ghost" @click="openThresholdConfig">阈值配置</button>
              <button class="action-btn ghost" @click="openExportDialog">导出报表</button>
              <button class="action-btn ghost" @click="refreshWarnings">刷新监测</button>
            </div>
          </div>

          <div class="warning-section">
            <div class="panel-head">
              <div>
                <div class="panel-title">预警事件列表</div>
                <div class="panel-sub">基于阈值识别的异常监测结果</div>
              </div>
              <div class="panel-mark">{{ viewClosed ? "已关闭视图" : "活动视图" }}</div>
            </div>

            <div class="warning-list limited-scroll">
              <div
                class="warning-row"
                v-for="w in warnings"
                :key="w.id"
                :class="[`warning-${w.level}`]"
              >
                <div class="warning-left">
                  <div class="level-ring" :class="w.level">
                    <span>{{ w.levelText }}</span>
                  </div>
                </div>
                <div class="warning-center">
                  <div class="warning-title-line">
                    <div class="warning-title">{{ w.title }}</div>
                    <div class="warning-status" :class="w.status">
                      {{ statusText(w.status) }}
                    </div>
                  </div>
                  <div class="warning-desc">{{ w.desc }}</div>
                  <div class="warning-tags">
                    <span
                      class="mini-tag"
                      v-for="(tag, index) in w.issueTags"
                      :key="`${w.id}-${index}`"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
                <div class="warning-right">
                  <div class="meta-block">
                    <div class="meta-label">监测日期</div>
                    <div class="meta-value">{{ formatDate(w.timeText) }}</div>
                  </div>
                  <div class="meta-block">
                    <div class="meta-label">监测点位</div>
                    <div class="meta-value">{{ w.location }}</div>
                  </div>
                </div>
              </div>
              <div v-if="loading" class="empty-box">正在加载监测数据...</div>
              <div v-else-if="warnings.length === 0" class="empty-box">当前条件下暂无预警数据</div>
            </div>
          </div>

          <transition name="fade">
            <div class="toast" v-if="msg">{{ msg }}</div>
          </transition>
        </div>
      </div>

      <!-- 主内容区（坝体模式：快捷操作 + 预警列表 + 图表 + 表格） -->
      <div class="dam-main-section" v-if="activeType === 'dam'">
        <!-- 坝体快捷操作区域 -->
        <div class="panel-card card-shell">
          <div class="action-panel-top">
            <div class="panel-head compact-head">
              <div>
                <div class="panel-title">快捷操作</div>
                <div class="panel-sub">坝体安全常用功能入口</div>
              </div>
            </div>
            <div class="action-grid">
              <button class="action-btn primary" @click="publishDamWarning">发布预警</button>
              <button class="action-btn ghost" @click="openDamThresholdConfig">阈值配置</button>
              <button class="action-btn ghost" @click="openDamExportDialog">导出报表</button>
              <button class="action-btn ghost" @click="refreshDamData">刷新监测</button>
            </div>
          </div>
        </div>

        <!-- 坝体预警事件卡片（一次显示两条，可滚动） -->
        <div class="panel-card card-shell dam-warning-card">
          <div class="panel-head">
            <div>
              <div class="panel-title">坝体安全预警</div>
              <div class="panel-sub">基于阈值识别的异常监测结果</div>
            </div>
            <button class="action-btn ghost small" @click="refreshDamWarnings">刷新预警</button>
          </div>
          <div class="dam-warning-scroll-container">
            <div class="warning-list dam-warning-list">
              <div
                class="warning-row"
                v-for="(w, idx) in damWarnings"
                :key="`dam-warn-${idx}`"
                :class="[`warning-${w.level}`]"
              >
                <div class="warning-left">
                  <div class="level-ring" :class="w.level">
                    <span>{{ w.levelText }}</span>
                  </div>
                </div>
                <div class="warning-center">
                  <div class="warning-title-line">
                    <div class="warning-title">{{ w.sensor }} · {{ w.measure_name }}</div>
                    <div class="warning-status" :class="w.status">
                      {{ statusText(w.status) }}
                    </div>
                  </div>
                  <div class="warning-desc">{{ w.desc }}</div>
                  <div class="warning-tags">
                    <span class="mini-tag">当前值 {{ w.value }} {{ w.unit }}</span>
                    <span class="mini-tag" v-if="w.min_threshold !== null">下限 {{ w.min_threshold }}</span>
                    <span class="mini-tag" v-if="w.max_threshold !== null">上限 {{ w.max_threshold }}</span>
                  </div>
                </div>
                <div class="warning-right">
                  <div class="meta-block">
                    <div class="meta-label">监测时间</div>
                    <div class="meta-value">{{ formatDateTime(w.refresh_time) }}</div>
                  </div>
                </div>
              </div>
              <div v-if="damWarningsLoading" class="empty-box">正在加载预警数据...</div>
              <div v-else-if="damWarnings.length === 0" class="empty-box">当前暂无坝体安全预警</div>
            </div>
          </div>
        </div>

        <!-- 趋势图表卡片 -->
        <div class="timeline-card card-shell" v-if="damFilters.sensor && damFilters.measureName">
          <div class="panel-head timeline-head">
            <div>
              <div class="panel-title">趋势分析</div>
              <div class="panel-sub">
                {{ damFilters.sensor }} · {{ damFilters.measureName }}
                <span v-if="damThreshold">（阈值：{{ formatThreshold(damThreshold) }}）</span>
              </div>
            </div>
          </div>

          <div v-if="damTrendData.length > 0" class="chart-layout">
            <div class="chart-main">
              <div class="chart-summary">
                <div class="chart-summary-item">
                  <div class="summary-mini-label">当前指标</div>
                  <div class="summary-mini-value">{{ damFilters.measureName }}</div>
                </div>
                <div class="chart-summary-item">
                  <div class="summary-mini-label">窗口数据量</div>
                  <div class="summary-mini-value">{{ damWindowData.length }}</div>
                </div>
                <div class="chart-summary-item">
                  <div class="summary-mini-label">最新值</div>
                  <div class="summary-mini-value">{{ formatNumber(damLatestWindowValue, 2) }}</div>
                </div>
                <div class="chart-summary-item">
                  <div class="summary-mini-label">阈值参考</div>
                  <div class="summary-mini-value">{{ damThreshold ? formatThreshold(damThreshold) : '未设置' }}</div>
                </div>
              </div>

              <div class="chart-box">
                <svg class="trend-chart" viewBox="0 0 1000 360" preserveAspectRatio="none">
                  <g class="chart-grid">
                    <line
                      v-for="(y, i) in damChartGridY"
                      :key="`gy-${i}`"
                      :x1="chartBox.left"
                      :y1="y"
                      :x2="chartBox.right"
                      :y2="y"
                    />
                  </g>

                  <!-- 阈值线 -->
                  <line
                    v-if="damUpperThresholdY !== null"
                    class="threshold-line"
                    :x1="chartBox.left"
                    :y1="damUpperThresholdY"
                    :x2="chartBox.right"
                    :y2="damUpperThresholdY"
                  />
                  <text
                    v-if="damUpperThresholdY !== null"
                    class="threshold-text"
                    :x="chartBox.right - 6"
                    :y="damUpperThresholdY - 8"
                    text-anchor="end"
                  >
                    上限 {{ damThreshold.max_value }}
                  </text>

                  <line
                    v-if="damLowerThresholdY !== null"
                    class="threshold-line"
                    :x1="chartBox.left"
                    :y1="damLowerThresholdY"
                    :x2="chartBox.right"
                    :y2="damLowerThresholdY"
                  />
                  <text
                    v-if="damLowerThresholdY !== null"
                    class="threshold-text"
                    :x="chartBox.right - 6"
                    :y="damLowerThresholdY - 8"
                    text-anchor="end"
                  >
                    下限 {{ damThreshold.min_value }}
                  </text>

                  <!-- 坐标轴 -->
                  <line
                    class="axis-line"
                    :x1="chartBox.left"
                    :y1="chartBox.bottom"
                    :x2="chartBox.right"
                    :y2="chartBox.bottom"
                  />
                  <line
                    class="axis-line"
                    :x1="chartBox.left"
                    :y1="chartBox.top"
                    :x2="chartBox.left"
                    :y2="chartBox.bottom"
                  />

                  <!-- 折线 -->
                  <path v-if="damChartLinePath" class="line-path" :d="damChartLinePath" />

                  <!-- 数据点 -->
                  <g v-for="(point, index) in damWindowSeries" :key="`pt-${index}`">
                    <circle class="point-ring" :cx="point.x" :cy="point.y" r="5" />
                    <circle class="point-core" :cx="point.x" :cy="point.y" r="2.5" />
                  </g>

                  <!-- Y轴刻度 -->
                  <g v-for="(tick, index) in damYAxisTicks" :key="`y-${index}`">
                    <text
                      class="axis-text y-text"
                      :x="chartBox.left - 12"
                      :y="tick.y + 4"
                      text-anchor="end"
                    >
                      {{ tick.label }}
                    </text>
                  </g>

                  <!-- X轴刻度（显示完整日期） -->
                  <g v-for="(point, index) in damWindowSeries" :key="`x-${index}`">
                    <text
                      v-if="damWindowSeries.length <= 12 || index % Math.ceil(damWindowSeries.length / 6) === 0"
                      class="axis-text x-text"
                      :x="point.x"
                      :y="chartBox.bottom + 24"
                      text-anchor="middle"
                    >
                      {{ point.fullDate }}
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            <div class="chart-side-simple">
              <div class="small-title">窗口数据</div>
              <div class="mini-list">
                <div class="mini-row" v-for="(item, idx) in damWindowData" :key="idx">
                  <span>{{ formatDateTime(item.time_bucket) }}</span>
                  <span :class="{ 'abnormal-value': isAbnormalValue(item.avg_value) }">
                    {{ formatNumber(item.avg_value, 2) }}
                  </span>
                </div>
              </div>
              <div class="scroll-hint">图表自动滚动播放中</div>
            </div>
          </div>
          <div v-else class="empty-box">请选择传感器和测量类型后查询</div>
        </div>
        <div class="empty-box" v-else>请在上方选择传感器和测量类型</div>

        <!-- 原始数据表格 -->
        <div class="panel-card card-shell dam-table-card" v-if="damRawData.length > 0">
          <div class="panel-head">
            <div>
              <div class="panel-title">原始监测数据</div>
              <div class="panel-sub">最近100条记录</div>
            </div>
          </div>
          <div class="table-scroll">
            <table class="dam-data-table">
              <thead>
                <tr>
                  <th>传感器</th>
                  <th>测量类型</th>
                  <th>数值</th>
                  <th>单位</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in damRawData.slice(0, 100)" :key="idx">
                  <td>{{ row.sensor }}</td>
                  <td>{{ row.measure_name }}</td>
                  <td :class="{ 'abnormal-value': isRowAbnormal(row) }">{{ formatNumber(row.value, 3) }}</td>
                  <td>{{ row.unit }}</td>
                  <td>{{ formatDateTime(row.refresh_time) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 水质时间动态展示（水质模式） -->
      <div class="timeline-card card-shell" v-if="activeType === 'water'">
        <div class="panel-head timeline-head">
          <div>
            <div class="panel-title">时间动态展示</div>
            <div class="panel-sub">按窗口滚动展示监测指标变化趋势</div>
          </div>
          <div class="metric-tabs">
            <button
              v-for="metric in metricOptions"
              :key="metric.key"
              class="metric-tab"
              :class="{ active: selectedMetric === metric.key }"
              @click="changeMetric(metric.key)"
            >
              {{ metric.label }}
            </button>
          </div>
        </div>

        <div v-if="visibleChartData.length > 0" class="chart-layout">
          <div class="chart-main">
            <div class="chart-summary">
              <div class="chart-summary-item">
                <div class="summary-mini-label">当前指标</div>
                <div class="summary-mini-value">{{ selectedMetricMeta.label }}</div>
              </div>
              <div class="chart-summary-item">
                <div class="summary-mini-label">窗口数据量</div>
                <div class="summary-mini-value">{{ visibleChartData.length }}</div>
              </div>
              <div class="chart-summary-item">
                <div class="summary-mini-label">最新值</div>
                <div class="summary-mini-value">{{ latestMetricValue }}</div>
              </div>
              <div class="chart-summary-item">
                <div class="summary-mini-label">阈值参考</div>
                <div class="summary-mini-value">{{ selectedMetricMeta.thresholdText || '未设置' }}</div>
              </div>
            </div>

            <div class="chart-box">
              <svg class="trend-chart" viewBox="0 0 1000 360" preserveAspectRatio="none">
                <g class="chart-grid">
                  <line
                    v-for="(y, i) in chartGridY"
                    :key="`gy-${i}`"
                    :x1="chartBox.left"
                    :y1="y"
                    :x2="chartBox.right"
                    :y2="y"
                  />
                  <line
                    v-for="(x, i) in chartGridX"
                    :key="`gx-${i}`"
                    :x1="x"
                    :y1="chartBox.top"
                    :x2="x"
                    :y2="chartBox.bottom"
                  />
                </g>

                <line
                  v-if="upperThresholdLineY !== null"
                  class="threshold-line"
                  :x1="chartBox.left"
                  :y1="upperThresholdLineY"
                  :x2="chartBox.right"
                  :y2="upperThresholdLineY"
                />
                <text
                  v-if="upperThresholdLineY !== null"
                  class="threshold-text"
                  :x="chartBox.right - 6"
                  :y="upperThresholdLineY - 8"
                  text-anchor="end"
                >
                  上限 {{ selectedMetricMeta.maxThreshold }}
                </text>

                <line
                  v-if="lowerThresholdLineY !== null"
                  class="threshold-line"
                  :x1="chartBox.left"
                  :y1="lowerThresholdLineY"
                  :x2="chartBox.right"
                  :y2="lowerThresholdLineY"
                />
                <text
                  v-if="lowerThresholdLineY !== null"
                  class="threshold-text"
                  :x="chartBox.right - 6"
                  :y="lowerThresholdLineY - 8"
                  text-anchor="end"
                >
                  下限 {{ selectedMetricMeta.minThreshold }}
                </text>

                <line
                  class="axis-line"
                  :x1="chartBox.left"
                  :y1="chartBox.bottom"
                  :x2="chartBox.right"
                  :y2="chartBox.bottom"
                />
                <line
                  class="axis-line"
                  :x1="chartBox.left"
                  :y1="chartBox.top"
                  :x2="chartBox.left"
                  :y2="chartBox.bottom"
                />

                <path v-if="chartLinePath" class="line-path" :d="chartLinePath" />

                <g
                  v-for="(point, index) in visibleChartSeries"
                  :key="`pt-${index}`"
                  class="point-group"
                >
                  <circle class="point-ring" :cx="point.x" :cy="point.y" r="6" />
                  <circle class="point-core" :cx="point.x" :cy="point.y" r="3.2" />
                  <text
                    class="point-value"
                    :x="point.x"
                    :y="point.y - 12"
                    text-anchor="middle"
                  >
                    {{ point.display }}
                  </text>
                </g>

                <g v-for="(point, index) in visibleChartSeries" :key="`x-${index}`">
                  <text
                    v-if="visibleChartSeries.length <= 12 || index % Math.ceil(visibleChartSeries.length / 8) === 0"
                    class="axis-text x-text"
                    :x="point.x"
                    :y="chartBox.bottom + 24"
                    text-anchor="middle"
                  >
                    {{ point.shortDate }}
                  </text>
                </g>

                <g v-for="(tick, index) in yAxisTicks" :key="`y-${index}`">
                  <text
                    class="axis-text y-text"
                    :x="chartBox.left - 12"
                    :y="tick.y + 4"
                    text-anchor="end"
                  >
                    {{ tick.label }}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          <div class="chart-side-simple">
            <div class="small-title">当前窗口记录</div>
            <div class="mini-list">
              <div class="mini-row" v-for="(item, idx) in visibleChartData" :key="idx">
                <span>{{ formatDate(item.date) }}</span>
                <span>{{ formatMetricValue(item.value) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-box">暂无时间动态数据</div>
      </div>
    </div>

    <!-- 导出报表弹窗（水质专用） -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="closeExportDialog">
      <div class="modal-card export-modal" ref="exportModal" @mousedown="initDrag" :style="modalStyle">
        <div class="modal-header drag-handle">
          <h3>导出报表配置</h3>
          <button class="modal-close" @click="closeExportDialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>开始日期</label>
            <input type="date" v-model="exportForm.startDate" class="modal-input" />
          </div>
          <div class="form-row">
            <label>结束日期</label>
            <input type="date" v-model="exportForm.endDate" class="modal-input" />
          </div>
          <div class="form-row">
            <label>数据类型（可多选）</label>
            <div class="checkbox-group">
              <label v-for="type in dataTypeOptions" :key="type.value" class="checkbox-item">
                <input type="checkbox" :value="type.value" v-model="exportForm.dataTypes" />
                {{ type.label }}
              </label>
            </div>
          </div>
          <div class="form-row">
            <label>来源点位（可多选）</label>
            <select v-model="exportForm.sources" multiple class="modal-select" size="4">
              <option v-for="site in siteOptions" :key="site" :value="site">{{ site }}</option>
            </select>
            <div class="select-hint">按住 Ctrl 可多选</div>
          </div>
          <div class="form-row">
            <label>报表名称</label>
            <input type="text" v-model="exportForm.fileName" class="modal-input" placeholder="例如：2025年第一季度水质报告" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn cancel" @click="closeExportDialog">取消</button>
          <button class="modal-btn confirm" @click="confirmExport">导出</button>
        </div>
      </div>
    </div>

    <!-- 阈值配置弹窗（水质） -->
    <div v-if="showThresholdModal" class="modal-overlay" @click.self="closeThresholdConfig">
      <div class="modal-card threshold-modal" ref="thresholdModal" @mousedown="initThresholdDrag" :style="thresholdModalStyle">
        <div class="modal-header drag-handle">
          <h3>预警阈值配置</h3>
          <button class="modal-close" @click="closeThresholdConfig">&times;</button>
        </div>
        <div class="modal-body">
          <table class="threshold-table">
            <thead>
              <tr>
                <th>指标</th>
                <th>最小值</th>
                <th>最大值</th>
                <th>单位</th>
                <th>描述</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in thresholds" :key="item.metric_key">
                <td>{{ item.metric_name }}</td>
                <td>
                  <input v-if="editingKey === item.metric_key" type="number" step="0.01" v-model="editForm.min_value" />
                  <span v-else>{{ item.min_value ?? '无' }}</span>
                </td>
                <td>
                  <input v-if="editingKey === item.metric_key" type="number" step="0.01" v-model="editForm.max_value" />
                  <span v-else>{{ item.max_value ?? '无' }}</span>
                </td>
                <td>{{ item.unit || '-' }}</td>
                <td>
                  <input v-if="editingKey === item.metric_key" type="text" v-model="editForm.description" />
                  <span v-else>{{ item.description || '-' }}</span>
                </td>
                <td>
                  <template v-if="editingKey === item.metric_key">
                    <button class="save-btn" @click="saveThreshold(item.metric_key)">保存</button>
                    <button class="cancel-btn" @click="cancelEdit">取消</button>
                  </template>
                  <button v-else class="edit-btn" @click="startEdit(item)">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 坝体阈值配置弹窗 -->
    <div v-if="showDamThresholdModal" class="modal-overlay" @click.self="closeDamThresholdConfig">
      <div class="modal-card threshold-modal" ref="damThresholdModal" @mousedown="initDamThresholdDrag" :style="damThresholdModalStyle">
        <div class="modal-header drag-handle">
          <h3>坝体预警阈值配置</h3>
          <button class="modal-close" @click="closeDamThresholdConfig">&times;</button>
        </div>
        <div class="modal-body">
          <table class="threshold-table">
            <thead>
              <tr>
                <th>传感器</th>
                <th>测量类型</th>
                <th>最小值</th>
                <th>最大值</th>
                <th>单位</th>
                <th>描述</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in damThresholds" :key="item.id">
                <td>{{ item.sensor }}</td>
                <td>{{ item.measure_name }}</td>
                <td>
                  <input v-if="damEditingKey === item.id" type="number" step="0.01" v-model="damEditForm.min_value" />
                  <span v-else>{{ item.min_value ?? '无' }}</span>
                </td>
                <td>
                  <input v-if="damEditingKey === item.id" type="number" step="0.01" v-model="damEditForm.max_value" />
                  <span v-else>{{ item.max_value ?? '无' }}</span>
                </td>
                <td>{{ item.unit || '-' }}</td>
                <td>
                  <input v-if="damEditingKey === item.id" type="text" v-model="damEditForm.description" />
                  <span v-else>{{ item.description || '-' }}</span>
                </td>
                <td>
                  <template v-if="damEditingKey === item.id">
                    <button class="save-btn" @click="saveDamThreshold(item.id)">保存</button>
                    <button class="cancel-btn" @click="cancelDamEdit">取消</button>
                  </template>
                  <button v-else class="edit-btn" @click="startDamEdit(item)">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 坝体导出报表弹窗（复选框样式，且数据类型根据选中传感器过滤） -->
    <div v-if="showDamExportModal" class="modal-overlay" @click.self="closeDamExportDialog">
      <div class="modal-card export-modal" ref="damExportModal" @mousedown="initDamExportDrag" :style="damModalStyle">
        <div class="modal-header drag-handle">
          <h3>导出坝体报表配置</h3>
          <button class="modal-close" @click="closeDamExportDialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>传感器</label>
            <select v-model="damExportForm.sensor" class="modal-input" @change="onExportSensorChange">
              <option value="">全部传感器</option>
              <option v-for="s in damSensors" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>数据类型（可多选）</label>
            <div class="checkbox-group">
              <label v-for="type in exportMeasureOptions" :key="type" class="checkbox-item">
                <input type="checkbox" :value="type" v-model="damExportForm.measureNames" />
                {{ type }}
              </label>
            </div>
            <div v-if="exportMeasureOptions.length === 0" class="select-hint">请先选择传感器</div>
          </div>
          <div class="form-row">
            <label>开始日期</label>
            <input type="date" v-model="damExportForm.startDate" class="modal-input" />
          </div>
          <div class="form-row">
            <label>结束日期</label>
            <input type="date" v-model="damExportForm.endDate" class="modal-input" />
          </div>
          <div class="form-row">
            <label>报表名称</label>
            <input type="text" v-model="damExportForm.fileName" class="modal-input" placeholder="例如：坝体监测报告" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn cancel" @click="closeDamExportDialog">取消</button>
          <button class="modal-btn confirm" @click="confirmDamExport">导出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { fetchOriginal } from '../../../originalApi.js';
// 工具函数
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
  if (level === "high") return "红";
  if (level === "mid") return "橙";
  if (level === "low") return "黄";
  return "蓝";
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

function calculateStats(warnings) {
  const stats = { published: 0, processing: 0, closed: 0 };
  for (const w of warnings) {
    if (w.status === "published") stats.published += 1;
    else if (w.status === "processing") stats.processing += 1;
    else if (w.status === "closed") stats.closed += 1;
  }
  return stats;
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

    [
      "ph",
      "fluoride",
      "manganese",
      "cadmium",
      "lead_value",
      "arsenic",
      "cod",
      "suspended_solids"
    ].forEach((key) => {
      const value = num(row[key]);
      if (value !== null) {
        map[date][key].push(value);
      }
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

export default {
  name: "DisasterWarning",
  data() {
    return {
      msg: "",
      timer: null,
      poller: null,
      chartScrollTimer: null,
      damChartScrollTimer: null,
      // 当前激活的类型：'water' 或 'dam'
      activeType: "water",
      // 水质相关数据
      warnings: [],
      allWarnings: [],
      rawRows: [],
      timelineDays: [],
      viewClosed: false,
      loading: false,
      backendPort: 3002,
      apiBase: "/disaster-gw",
      selectedMetric: "cod",
      chartWindowSize: 6,
      chartWindowStart: 0,
      chartBox: {
        left: 72,
        right: 960,
        top: 28,
        bottom: 300
      },
      filters: {
        date: "",
        site_name: ""
      },
      metricOptions: [
        { key: "ph", label: "PH", digit: 2, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "fluoride", label: "F-", digit: 3, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "manganese", label: "锰", digit: 3, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "cadmium", label: "镉", digit: 3, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "lead_value", label: "铅", digit: 3, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "arsenic", label: "砷", digit: 3, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "cod", label: "COD", digit: 2, minThreshold: null, maxThreshold: null, thresholdText: "未设置" },
        { key: "suspended_solids", label: "悬浮物", digit: 2, minThreshold: null, maxThreshold: null, thresholdText: "未设置" }
      ],
      showExportModal: false,
      exportForm: {
        startDate: "",
        endDate: "",
        dataTypes: [],
        sources: [],
        fileName: ""
      },
      dataTypeOptions: [
        { label: "pH值", value: "ph" },
        { label: "氟化物", value: "fluoride" },
        { label: "锰", value: "manganese" },
        { label: "镉", value: "cadmium" },
        { label: "铅", value: "lead_value" },
        { label: "砷", value: "arsenic" },
        { label: "COD", value: "cod" },
        { label: "悬浮物", value: "suspended_solids" }
      ],
      siteOptions: [],
      showThresholdModal: false,
      thresholds: [],
      editingKey: null,
      editForm: { min_value: null, max_value: null, description: '' },
      thresholdsMap: {},
      modalStyle: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
      thresholdModalStyle: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
      dragging: false,
      dragType: null,
      dragOffset: { x: 0, y: 0 },
      // 坝体相关数据
      damSensors: [],
      damMeasureNames: [],
      filteredMeasureNames: [],
      damRawData: [],
      damTrendData: [],
      damLatestData: [],
      damWarnings: [],
      damWarningsLoading: false,
      damThresholdsMap: {},
      damFilters: {
        sensor: "",
        measureName: "",
        timeRange: "all"
      },
      damWindowSize: 6,
      damWindowStart: 0,
      damThreshold: null,
      // 坝体快捷操作相关
      showDamThresholdModal: false,
      showDamExportModal: false,
      damThresholds: [],
      damEditingKey: null,
      damEditForm: { min_value: null, max_value: null, description: '' },
      damExportForm: {
        sensor: "",
        measureNames: [],
        startDate: '',
        endDate: '',
        fileName: ''
      },
      exportMeasureList: [],
      damModalStyle: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
      damThresholdModalStyle: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
      // 坝体预警统计缓存
      damAllWarnings: [],
      damViewClosed: false,
    };
  },
  computed: {
    // 水质统计
    stats() {
      return calculateStats(this.allWarnings);
    },
    closedWarnings() {
      return this.allWarnings.filter((w) => w.status === "closed");
    },
    totalRecords() {
      return this.rawRows.length;
    },
    selectedMetricMeta() {
      return this.metricOptions.find((item) => item.key === this.selectedMetric) || this.metricOptions[0];
    },
    fullChartData() {
      const key = `${this.selectedMetric}_avg`;
      return this.timelineDays
        .map((item) => {
          const date = item.date;
          const timestamp = new Date(date).getTime();
          return {
            date,
            timestamp,
            shortDate: this.shortDate(date),
            value: num(item[key]),
            count: item.count
          };
        })
        .filter((item) => item.value !== null && !isNaN(item.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    visibleChartData() {
      if (this.fullChartData.length <= this.chartWindowSize) {
        return this.fullChartData;
      }
      return this.fullChartData.slice(
        this.chartWindowStart,
        this.chartWindowStart + this.chartWindowSize
      );
    },
    chartMinMax() {
      if (this.visibleChartData.length === 0) return { min: 0, max: 1 };
      const values = this.visibleChartData.map((item) => item.value);
      const minThreshold = num(this.selectedMetricMeta.minThreshold);
      const maxThreshold = num(this.selectedMetricMeta.maxThreshold);
      let min = Math.min(...values);
      let max = Math.max(...values);
      if (minThreshold !== null) min = Math.min(min, minThreshold);
      if (maxThreshold !== null) max = Math.max(max, maxThreshold);
      if (this.selectedMetric === "ph") {
        min = Math.min(min, 5.5);
        max = Math.max(max, 9.5);
      }
      if (min === max) { min -= 1; max += 1; }
      const padding = (max - min) * 0.12 || 1;
      return { min: Math.max(0, min - padding), max: max + padding };
    },
    visibleChartSeries() {
      const data = this.visibleChartData;
      if (data.length === 0) return [];
      const { left, right, top, bottom } = this.chartBox;
      const { min, max } = this.chartMinMax;
      const width = right - left;
      const height = bottom - top;
      const timestamps = data.map(d => d.timestamp);
      const tMin = Math.min(...timestamps);
      const tMax = Math.max(...timestamps);
      const tRange = tMax - tMin || 1;
      return data.map((item) => {
        const ratio = (item.timestamp - tMin) / tRange;
        const x = left + ratio * width;
        const valueRatio = (item.value - min) / (max - min || 1);
        const y = bottom - valueRatio * height;
        return { ...item, x, y, display: formatNumber(item.value, this.selectedMetricMeta.digit) };
      });
    },
    chartLinePath() {
      if (this.visibleChartSeries.length === 0) return "";
      return this.visibleChartSeries.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    },
    chartGridY() {
      const rows = 5;
      const arr = [];
      for (let i = 0; i <= rows; i++) {
        arr.push(this.chartBox.top + ((this.chartBox.bottom - this.chartBox.top) * i) / rows);
      }
      return arr;
    },
    chartGridX() {
      const data = this.visibleChartData;
      if (data.length === 0) return [];
      const { left, right } = this.chartBox;
      const timestamps = data.map(d => d.timestamp);
      const tMin = Math.min(...timestamps);
      const tMax = Math.max(...timestamps);
      const tRange = tMax - tMin || 1;
      const gridCount = Math.min(data.length, 8);
      const lines = [];
      for (let i = 0; i <= gridCount; i++) {
        const targetTimestamp = tMin + (tRange * i) / gridCount;
        const x = left + ((targetTimestamp - tMin) / tRange) * (right - left);
        lines.push(x);
      }
      return lines;
    },
    upperThresholdLineY() {
      const threshold = num(this.selectedMetricMeta.maxThreshold);
      if (threshold === null || this.visibleChartSeries.length === 0) return null;
      const { min, max } = this.chartMinMax;
      const { top, bottom } = this.chartBox;
      const ratio = (threshold - min) / (max - min || 1);
      return bottom - ratio * (bottom - top);
    },
    lowerThresholdLineY() {
      const threshold = num(this.selectedMetricMeta.minThreshold);
      if (threshold === null || this.visibleChartSeries.length === 0) return null;
      const { min, max } = this.chartMinMax;
      const { top, bottom } = this.chartBox;
      const ratio = (threshold - min) / (max - min || 1);
      return bottom - ratio * (bottom - top);
    },
    yAxisTicks() {
      const { min, max } = this.chartMinMax;
      const total = 5;
      const list = [];
      for (let i = 0; i <= total; i++) {
        const value = max - ((max - min) * i) / total;
        const y = this.chartBox.top + ((this.chartBox.bottom - this.chartBox.top) * i) / total;
        list.push({ y, label: formatNumber(value, this.selectedMetricMeta.digit) });
      }
      return list;
    },
    latestMetricValue() {
      if (this.visibleChartData.length === 0) return "-";
      const last = this.visibleChartData[this.visibleChartData.length - 1];
      return formatNumber(last.value, this.selectedMetricMeta.digit);
    },
    // 坝体图表计算属性
    damWindowData() {
      if (this.damTrendData.length <= this.damWindowSize) return this.damTrendData;
      return this.damTrendData.slice(this.damWindowStart, this.damWindowStart + this.damWindowSize);
    },
    damWindowSeries() {
      const data = this.damWindowData;
      if (data.length === 0) return [];
      const { left, right, top, bottom } = this.chartBox;
      const values = data.map(d => d.avg_value);
      const timestamps = data.map(d => new Date(d.time_bucket).getTime());
      const tMin = Math.min(...timestamps);
      const tMax = Math.max(...timestamps);
      const tRange = tMax - tMin || 1;
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (this.damThreshold) {
        if (this.damThreshold.min_value !== null) minVal = Math.min(minVal, this.damThreshold.min_value);
        if (this.damThreshold.max_value !== null) maxVal = Math.max(maxVal, this.damThreshold.max_value);
      }
      if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
      const padding = (maxVal - minVal) * 0.12 || 1;
      minVal = minVal - padding;
      maxVal = maxVal + padding;
      return data.map((item) => {
        const ts = new Date(item.time_bucket).getTime();
        const ratio = (ts - tMin) / tRange;
        const x = left + ratio * (right - left);
        const valueRatio = (item.avg_value - minVal) / (maxVal - minVal || 1);
        const y = bottom - valueRatio * (bottom - top);
        const d = new Date(item.time_bucket);
        const fullDate = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
        return { ...item, x, y, fullDate };
      });
    },
    damChartLinePath() {
      if (this.damWindowSeries.length === 0) return "";
      return this.damWindowSeries.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    },
    damChartGridY() {
      const rows = 5;
      const arr = [];
      for (let i = 0; i <= rows; i++) {
        arr.push(this.chartBox.top + ((this.chartBox.bottom - this.chartBox.top) * i) / rows);
      }
      return arr;
    },
    damYAxisTicks() {
      const data = this.damWindowData;
      if (data.length === 0) return [];
      const values = data.map(d => d.avg_value);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (this.damThreshold) {
        if (this.damThreshold.min_value !== null) minVal = Math.min(minVal, this.damThreshold.min_value);
        if (this.damThreshold.max_value !== null) maxVal = Math.max(maxVal, this.damThreshold.max_value);
      }
      if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
      const padding = (maxVal - minVal) * 0.12 || 1;
      minVal = minVal - padding;
      maxVal = maxVal + padding;
      const total = 5;
      const list = [];
      for (let i = 0; i <= total; i++) {
        const value = maxVal - ((maxVal - minVal) * i) / total;
        const y = this.chartBox.top + ((this.chartBox.bottom - this.chartBox.top) * i) / total;
        list.push({ y, label: formatNumber(value, 2) });
      }
      return list;
    },
    damUpperThresholdY() {
      if (!this.damThreshold || this.damThreshold.max_value === null || this.damWindowSeries.length === 0) return null;
      const data = this.damWindowData;
      const values = data.map(d => d.avg_value);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (this.damThreshold.min_value !== null) minVal = Math.min(minVal, this.damThreshold.min_value);
      if (this.damThreshold.max_value !== null) maxVal = Math.max(maxVal, this.damThreshold.max_value);
      if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
      const padding = (maxVal - minVal) * 0.12 || 1;
      minVal = minVal - padding;
      maxVal = maxVal + padding;
      const { top, bottom } = this.chartBox;
      const ratio = (this.damThreshold.max_value - minVal) / (maxVal - minVal || 1);
      return bottom - ratio * (bottom - top);
    },
    damLowerThresholdY() {
      if (!this.damThreshold || this.damThreshold.min_value === null || this.damWindowSeries.length === 0) return null;
      const data = this.damWindowData;
      const values = data.map(d => d.avg_value);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (this.damThreshold.min_value !== null) minVal = Math.min(minVal, this.damThreshold.min_value);
      if (this.damThreshold.max_value !== null) maxVal = Math.max(maxVal, this.damThreshold.max_value);
      if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
      const padding = (maxVal - minVal) * 0.12 || 1;
      minVal = minVal - padding;
      maxVal = maxVal + padding;
      const { top, bottom } = this.chartBox;
      const ratio = (this.damThreshold.min_value - minVal) / (maxVal - minVal || 1);
      return bottom - ratio * (bottom - top);
    },
    damWindowAvg() {
      if (this.damWindowData.length === 0) return 0;
      const sum = this.damWindowData.reduce((acc, cur) => acc + cur.avg_value, 0);
      return sum / this.damWindowData.length;
    },
    damLatestWindowValue() {
      if (this.damWindowData.length === 0) return 0;
      return this.damWindowData[this.damWindowData.length - 1].avg_value;
    },
    // 坝体预警统计
    damStats() {
      return calculateStats(this.damAllWarnings);
    },
    damTotalRecords() {
      return this.damRawData.length;
    },
    // 导出弹窗中可选的测量类型（响应式）
    exportMeasureOptions() {
      return this.exportMeasureList;
    }
  },
  methods: {
    statusText(status) {
      return statusTextMap(status);
    },
    shortDate(date) {
      if (!date) return "-";
      const d = new Date(date);
      if (isNaN(d.getTime())) return date;
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },
    formatDate(dateStr) {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },
    formatDateTime(dateStr) {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
    },
    formatMetricValue(value) {
      return formatNumber(value, this.selectedMetricMeta.digit);
    },
    formatNumber,
    formatThreshold(th) {
      if (!th) return '未设置';
      const parts = [];
      if (th.min_value !== null) parts.push(`下限 ${th.min_value}`);
      if (th.max_value !== null) parts.push(`上限 ${th.max_value}`);
      return parts.length ? parts.join(' · ') : '未设置';
    },
    isAbnormalValue(val) {
      if (!this.damThreshold) return false;
      const th = this.damThreshold;
      if (th.min_value !== null && val < th.min_value) return true;
      if (th.max_value !== null && val > th.max_value) return true;
      return false;
    },
    isRowAbnormal(row) {
      if (!row) return false;
      const key = `${row.sensor}|${row.measure_name}`;
      const th = this.damThresholdsMap[key];
      if (!th) return false;
      const val = num(row.value);
      if (val === null) return false;
      if (th.min_value !== null && val < th.min_value) return true;
      if (th.max_value !== null && val > th.max_value) return true;
      return false;
    },
    toast(text) {
      this.msg = text;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.msg = ""; }, 1800);
    },
    switchType(type) {
      this.activeType = type;
      if (type === 'water') {
        this.refreshWarnings();
      } else {
        this.loadDamOptions();
        this.refreshDamLatest();
        this.refreshDamWarnings();
        this.stopDamChartScroll();
      }
    },
    // 水质方法
    buildQueryString() {
      const params = new URLSearchParams();
      if (this.filters.date) params.append("date", this.filters.date);
      if (this.filters.site_name) params.append("site_name", this.filters.site_name);
      const query = params.toString();
      return query ? `?${query}` : "";
    },
    async refreshWarnings() {
      this.loading = true;
      try {
        const response = await fetchOriginal(`${this.apiBase}/monitoring-data${this.buildQueryString()}`);
        const result = await response.json();
        if (!result.success) { this.toast("接口返回失败"); return; }
        const rows = result.data || [];
        const warningList = rows.map(item => buildWarningFromRow(item, this.thresholdsMap)).filter(item => item !== null);
        this.rawRows = rows;
        this.allWarnings = warningList;
        this.timelineDays = groupTimeline(rows);
        this.warnings = this.viewClosed ? this.closedWarnings : warningList.filter(w => w.status !== "closed");
        this.resetChartWindowIfNeeded();
      } catch (error) {
        console.error(error);
        this.toast("获取后端数据失败");
      } finally {
        this.loading = false;
      }
    },
    toggleViewClosed() {
      this.viewClosed = !this.viewClosed;
      this.warnings = this.viewClosed ? this.closedWarnings : this.allWarnings.filter(w => w.status !== "closed");
    },
    resetFilters() {
      this.filters.date = "";
      this.filters.site_name = "";
      this.refreshWarnings();
    },
    changeMetric(metricKey) {
      this.selectedMetric = metricKey;
      this.chartWindowStart = 0;
      this.restartChartScroll();
    },
    advanceChartWindow() {
      const total = this.fullChartData.length;
      if (total <= this.chartWindowSize) { this.chartWindowStart = 0; return; }
      const maxStart = total - this.chartWindowSize;
      this.chartWindowStart = this.chartWindowStart >= maxStart ? 0 : this.chartWindowStart + 1;
    },
    startChartScroll() {
      if (this.chartScrollTimer) clearInterval(this.chartScrollTimer);
      this.chartScrollTimer = setInterval(() => { this.advanceChartWindow(); }, 3000);
    },
    restartChartScroll() { this.startChartScroll(); },
    resetChartWindowIfNeeded() {
      const total = this.fullChartData.length;
      if (total <= this.chartWindowSize) { this.chartWindowStart = 0; return; }
      if (this.chartWindowStart > total - this.chartWindowSize) this.chartWindowStart = 0;
    },
    async fetchThresholds() {
      try {
        const res = await fetchOriginal(`${this.apiBase}/thresholds`);
        const data = await res.json();
        if (data.success) {
          this.thresholds = data.data;
          const map = {};
          data.data.forEach(t => { map[t.metric_key] = { min: t.min_value, max: t.max_value, metric_name: t.metric_name }; });
          this.thresholdsMap = map;
          this.metricOptions.forEach(opt => {
            const th = map[opt.key];
            if (th) {
              opt.minThreshold = th.min;
              opt.maxThreshold = th.max;
              if (th.min !== null && th.max !== null) opt.thresholdText = `${th.min}~${th.max}`;
              else if (th.max !== null) opt.thresholdText = `≤${th.max}`;
              else if (th.min !== null) opt.thresholdText = `≥${th.min}`;
              else opt.thresholdText = '未设置';
            } else {
              opt.minThreshold = null;
              opt.maxThreshold = null;
              opt.thresholdText = '未设置';
            }
          });
        }
      } catch (e) { console.error('获取阈值失败', e); }
    },
    openThresholdConfig() { this.showThresholdModal = true; this.fetchThresholds(); },
    closeThresholdConfig() { this.showThresholdModal = false; this.cancelEdit(); },
    startEdit(item) {
      this.editingKey = item.metric_key;
      this.editForm = { min_value: item.min_value, max_value: item.max_value, description: item.description || '' };
    },
    cancelEdit() { this.editingKey = null; this.editForm = { min_value: null, max_value: null, description: '' }; },
    async saveThreshold(key) {
      const payload = {
        min_value: this.editForm.min_value === '' ? null : parseFloat(this.editForm.min_value),
        max_value: this.editForm.max_value === '' ? null : parseFloat(this.editForm.max_value),
        description: this.editForm.description
      };
      try {
        const res = await fetchOriginal(`${this.apiBase}/thresholds/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          this.toast('阈值保存成功');
          this.cancelEdit();
          await this.fetchThresholds();
        } else {
          this.toast('保存失败：' + data.message);
        }
      } catch (e) { this.toast('请求失败'); }
    },
    async fetchSiteOptions() {
      try {
        const res = await fetchOriginal(`${this.apiBase}/monitoring-sites`);
        const data = await res.json();
        if (data.success) this.siteOptions = data.data;
      } catch (e) { console.error('获取点位失败', e); }
    },
    openExportDialog() {
      this.fetchSiteOptions();
      this.exportForm = {
        startDate: this.filters.date || "",
        endDate: "",
        dataTypes: [],
        sources: [],
        fileName: `监测报表_${new Date().toISOString().slice(0,10).replace(/-/g, '/')}`
      };
      this.showExportModal = true;
    },
    closeExportDialog() { this.showExportModal = false; },
    async confirmExport() {
      try {
        const params = new URLSearchParams();
        if (this.exportForm.startDate) params.append('start_date', this.exportForm.startDate);
        if (this.exportForm.endDate) params.append('end_date', this.exportForm.endDate);
        if (this.exportForm.dataTypes.length) params.append('fields', this.exportForm.dataTypes.join(','));
        if (this.exportForm.sources.length) params.append('sites', this.exportForm.sources.join(','));
        let fileName = this.exportForm.fileName.trim() || `监测报表_${new Date().getTime()}`;
        if (!fileName.endsWith('.xlsx')) fileName += '.xlsx';
        const url = `${this.apiBase}/export-report?${params.toString()}`;
        const response = await fetchOriginal(url);
        if (!response.ok) throw new Error((await response.json()).message || '导出失败');
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        this.toast('导出成功');
        this.closeExportDialog();
      } catch (e) { this.toast(`导出失败：${e.message}`); }
    },
    // 坝体方法
    async loadDamOptions() {
      try {
        const [sensorsRes, measureRes, thresholdsRes] = await Promise.all([
          fetchOriginal(`${this.apiBase}/dam/sensors`),
          fetchOriginal(`${this.apiBase}/dam/measure_names`),
          fetchOriginal(`${this.apiBase}/dam/thresholds`)
        ]);
        const sensorsData = await sensorsRes.json();
        const measureData = await measureRes.json();
        const thresholdsData = await thresholdsRes.json();
        if (sensorsData.success) this.damSensors = sensorsData.data;
        if (measureData.success) this.damMeasureNames = measureData.data;
        if (thresholdsData.success) {
          const map = {};
          thresholdsData.data.forEach(t => { map[`${t.sensor}|${t.measure_name}`] = t; });
          this.damThresholdsMap = map;
        }
      } catch (e) { console.error('加载坝体选项失败', e); }
    },
    onSensorChange() {
      this.damFilters.measureName = "";
      this.filteredMeasureNames = [];
      this.damThreshold = null;
      if (this.damFilters.sensor) {
        this.fetchMeasureNamesBySensor(this.damFilters.sensor);
      }
      this.stopDamChartScroll();
    },
    async fetchMeasureNamesBySensor(sensor) {
      try {
        const res = await fetchOriginal(`${this.apiBase}/dam/measure_names_by_sensor?sensor=${sensor}`);
        const data = await res.json();
        if (data.success) {
          this.filteredMeasureNames = data.data;
        }
      } catch (e) { console.error('获取测量类型失败', e); }
    },
    async fetchExportMeasureList(sensor) {
      try {
        const res = await fetchOriginal(`${this.apiBase}/dam/measure_names_by_sensor?sensor=${sensor}`);
        const data = await res.json();
        if (data.success) {
          this.exportMeasureList = data.data;
        } else {
          this.exportMeasureList = [];
        }
      } catch (e) {
        console.error('获取导出测量类型失败', e);
        this.exportMeasureList = [];
      }
    },
    onMeasureChange() {
      this.updateDamThreshold();
      this.stopDamChartScroll();
      if (this.damFilters.sensor && this.damFilters.measureName) {
        this.refreshDamData();
      }
    },
    updateDamThreshold() {
      if (!this.damFilters.sensor || !this.damFilters.measureName) {
        this.damThreshold = null;
        return;
      }
      const key = `${this.damFilters.sensor}|${this.damFilters.measureName}`;
      this.damThreshold = this.damThresholdsMap[key] || null;
    },
    async refreshDamLatest() {
      try {
        const res = await fetchOriginal(`${this.apiBase}/dam/latest`);
        const data = await res.json();
        if (data.success) this.damLatestData = data.data;
      } catch (e) { console.error('获取最新数据失败', e); }
    },
    async refreshDamWarnings() {
      this.damWarningsLoading = true;
      try {
        const res = await fetchOriginal(`${this.apiBase}/dam/warnings`);
        const data = await res.json();
        if (data.success) {
          this.damWarnings = data.data;
          // 生成预警统计用数据（模拟水质预警结构）
          this.damAllWarnings = data.data.map(w => ({
            ...w,
            id: `${w.sensor}-${w.measure_name}-${w.refresh_time}`,
            status: w.status || 'published',
            level: w.level || 'high'
          }));
        }
      } catch (e) { console.error('获取预警失败', e); }
      finally { this.damWarningsLoading = false; }
    },
    async refreshDamData() {
      if (!this.damFilters.sensor || !this.damFilters.measureName) return;
      this.loading = true;
      try {
        let startTime = '', endTime = '';
        if (this.damFilters.timeRange !== 'all') {
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - parseInt(this.damFilters.timeRange));
          startTime = start.toISOString().slice(0,19).replace('T',' ');
          endTime = end.toISOString().slice(0,19).replace('T',' ');
        }
        // 趋势数据
        let trendUrl = `${this.apiBase}/dam/trend?sensor=${this.damFilters.sensor}&measure_name=${this.damFilters.measureName}&group_by=hour`;
        if (startTime) trendUrl += `&start_time=${startTime}&end_time=${endTime}`;
        const trendRes = await fetchOriginal(trendUrl);
        const trendData = await trendRes.json();
        if (trendData.success) {
          this.damTrendData = trendData.data;
          this.damWindowStart = 0;
          this.startDamChartScroll();
        }
        // 原始数据
        let dataUrl = `${this.apiBase}/dam/data?sensor=${this.damFilters.sensor}&measure_name=${this.damFilters.measureName}`;
        if (startTime) dataUrl += `&start_time=${startTime}&end_time=${endTime}`;
        const dataRes = await fetchOriginal(dataUrl);
        const raw = await dataRes.json();
        if (raw.success) this.damRawData = raw.data;
      } catch (e) {
        console.error('获取坝体数据失败', e);
        this.toast('获取数据失败');
      } finally {
        this.loading = false;
      }
    },
    onDamFilterChange() {
      if (this.damFilters.sensor && this.damFilters.measureName) {
        this.refreshDamData();
      }
    },
    resetDamFilters() {
      this.damFilters = { sensor: "", measureName: "", timeRange: "all" };
      this.filteredMeasureNames = [];
      this.damThreshold = null;
      this.damTrendData = [];
      this.damRawData = [];
      this.stopDamChartScroll();
    },
    advanceDamWindow() {
      const total = this.damTrendData.length;
      if (total <= this.damWindowSize) { this.damWindowStart = 0; return; }
      const maxStart = total - this.damWindowSize;
      this.damWindowStart = this.damWindowStart >= maxStart ? 0 : this.damWindowStart + 1;
    },
    startDamChartScroll() {
      if (this.damChartScrollTimer) clearInterval(this.damChartScrollTimer);
      this.damChartScrollTimer = setInterval(() => { this.advanceDamWindow(); }, 4000);
    },
    stopDamChartScroll() {
      if (this.damChartScrollTimer) {
        clearInterval(this.damChartScrollTimer);
        this.damChartScrollTimer = null;
      }
    },
    // 坝体快捷操作方法
    publishDamWarning() {
      this.toast('已模拟：发布坝体预警');
    },
    openDamThresholdConfig() {
      this.showDamThresholdModal = true;
      this.fetchDamThresholds();
    },
    closeDamThresholdConfig() {
      this.showDamThresholdModal = false;
      this.cancelDamEdit();
    },
    async fetchDamThresholds() {
      try {
        const res = await fetchOriginal(`${this.apiBase}/dam/thresholds`);
        const data = await res.json();
        if (data.success) {
          this.damThresholds = data.data;
        }
      } catch (e) {
        console.error('获取坝体阈值失败', e);
      }
    },
    startDamEdit(item) {
      this.damEditingKey = item.id;
      this.damEditForm = {
        min_value: item.min_value,
        max_value: item.max_value,
        description: item.description || ''
      };
    },
    cancelDamEdit() {
      this.damEditingKey = null;
      this.damEditForm = { min_value: null, max_value: null, description: '' };
    },
    async saveDamThreshold(id) {
      const payload = {
        min_value: this.damEditForm.min_value === '' ? null : parseFloat(this.damEditForm.min_value),
        max_value: this.damEditForm.max_value === '' ? null : parseFloat(this.damEditForm.max_value),
        description: this.damEditForm.description
      };
      try {
        const res = await fetchOriginal(`${this.apiBase}/dam/thresholds/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          this.toast('坝体阈值保存成功');
          this.cancelDamEdit();
          await this.fetchDamThresholds();
          const updated = this.damThresholds.find(t => t.id === id);
          if (updated) {
            const key = `${updated.sensor}|${updated.measure_name}`;
            this.damThresholdsMap[key] = updated;
          }
          this.updateDamThreshold();
        } else {
          this.toast('保存失败：' + data.message);
        }
      } catch (e) {
        this.toast('请求失败');
      }
    },
    openDamExportDialog() {
      this.damExportForm = {
        sensor: "",
        measureNames: [],
        startDate: '',
        endDate: '',
        fileName: `坝体监测报表_${new Date().toISOString().slice(0,10).replace(/-/g, '/')}`
      };
      this.exportMeasureList = [];
      this.showDamExportModal = true;
    },
    closeDamExportDialog() {
      this.showDamExportModal = false;
    },
    onExportSensorChange() {
      this.damExportForm.measureNames = [];
      if (this.damExportForm.sensor) {
        this.fetchExportMeasureList(this.damExportForm.sensor);
      } else {
        this.exportMeasureList = [];
      }
    },
    async confirmDamExport() {
      try {
        const params = new URLSearchParams();
        if (this.damExportForm.startDate) params.append('start_date', this.damExportForm.startDate);
        if (this.damExportForm.endDate) params.append('end_date', this.damExportForm.endDate);
        if (this.damExportForm.sensor) params.append('sensors', this.damExportForm.sensor);
        if (this.damExportForm.measureNames.length) params.append('measure_names', this.damExportForm.measureNames.join(','));
        let fileName = this.damExportForm.fileName.trim() || `坝体监测报表_${new Date().getTime()}`;
        if (!fileName.endsWith('.xlsx')) fileName += '.xlsx';
        const url = `${this.apiBase}/dam/export?${params.toString()}`;
        const response = await fetchOriginal(url);
        if (!response.ok) throw new Error((await response.json()).message || '导出失败');
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        this.toast('坝体报表导出成功');
        this.closeDamExportDialog();
      } catch (e) {
        this.toast(`导出失败：${e.message}`);
      }
    },
    // 弹窗拖拽
    initDrag(e) {
      if (!e.target.closest('.drag-handle')) return;
      this.dragging = true;
      this.dragType = 'export';
      const rect = this.$refs.exportModal.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      window.addEventListener('mousemove', this.onDrag);
      window.addEventListener('mouseup', this.stopDrag);
    },
    initThresholdDrag(e) {
      if (!e.target.closest('.drag-handle')) return;
      this.dragging = true;
      this.dragType = 'threshold';
      const rect = this.$refs.thresholdModal.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      window.addEventListener('mousemove', this.onDrag);
      window.addEventListener('mouseup', this.stopDrag);
    },
    initDamExportDrag(e) {
      if (!e.target.closest('.drag-handle')) return;
      this.dragging = true;
      this.dragType = 'damExport';
      const rect = this.$refs.damExportModal.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      window.addEventListener('mousemove', this.onDrag);
      window.addEventListener('mouseup', this.stopDrag);
    },
    initDamThresholdDrag(e) {
      if (!e.target.closest('.drag-handle')) return;
      this.dragging = true;
      this.dragType = 'damThreshold';
      const rect = this.$refs.damThresholdModal.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      window.addEventListener('mousemove', this.onDrag);
      window.addEventListener('mouseup', this.stopDrag);
    },
    onDrag(e) {
      if (!this.dragging) return;
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      if (this.dragType === 'export') {
        this.modalStyle = { left: x + 'px', top: y + 'px', transform: 'none' };
      } else if (this.dragType === 'threshold') {
        this.thresholdModalStyle = { left: x + 'px', top: y + 'px', transform: 'none' };
      } else if (this.dragType === 'damExport') {
        this.damModalStyle = { left: x + 'px', top: y + 'px', transform: 'none' };
      } else if (this.dragType === 'damThreshold') {
        this.damThresholdModalStyle = { left: x + 'px', top: y + 'px', transform: 'none' };
      }
    },
    stopDrag() {
      this.dragging = false;
      this.dragType = null;
      window.removeEventListener('mousemove', this.onDrag);
      window.removeEventListener('mouseup', this.stopDrag);
    }
  },
  mounted() {
    this.fetchThresholds().then(() => this.refreshWarnings());
    this.poller = setInterval(() => {
      if (this.activeType === 'water') this.refreshWarnings();
      else { this.refreshDamLatest(); this.refreshDamWarnings(); }
    }, 60 * 1000);
    this.startChartScroll();
    this.fetchSiteOptions();
    this.loadDamOptions();
  },
  beforeUnmount() {
    if (this.timer) clearTimeout(this.timer);
    if (this.poller) clearInterval(this.poller);
    if (this.chartScrollTimer) clearInterval(this.chartScrollTimer);
    if (this.damChartScrollTimer) clearInterval(this.damChartScrollTimer);
    window.removeEventListener('mousemove', this.onDrag);
    window.removeEventListener('mouseup', this.stopDrag);
  }
};
</script>

<style scoped>
.warning-page {
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
.top-panel,
.toolbar-card,
.main-grid-single,
.timeline-card {
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

/* 类型切换按钮 */
.type-switch {
  display: flex;
  gap: 8px;
  background: rgba(8, 25, 45, 0.6);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(86, 207, 255, 0.2);
}

.type-tab {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #9adfff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.type-tab:hover {
  background: rgba(26, 135, 255, 0.15);
  color: #d0f0ff;
}

.type-tab.active {
  background: linear-gradient(90deg, #1a87ff, #1ce0ff);
  color: #fff;
  box-shadow: 0 4px 12px rgba(28, 148, 255, 0.3);
}

.top-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  position: relative;
  min-height: 130px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(93, 196, 255, 0.16);
  background: linear-gradient(180deg, rgba(9, 32, 58, 0.9), rgba(7, 21, 38, 0.95));
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.18),
    inset 0 0 30px rgba(53, 168, 255, 0.06);
  overflow: hidden;
}

.summary-card::after {
  content: "";
  position: absolute;
  top: -34px;
  right: -20px;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
}

.summary-label {
  font-size: 13px;
  color: rgba(203, 239, 255, 0.76);
}

.summary-value {
  margin-top: 12px;
  font-size: 36px;
  line-height: 1;
  font-weight: 800;
  color: #ffffff;
}

.summary-sub {
  margin-top: 10px;
  font-size: 12px;
  color: rgba(190, 229, 247, 0.62);
  line-height: 1.6;
}

.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.toolbar-left {
  min-width: 180px;
}

.toolbar-title,
.panel-title {
  color: #ebfbff;
  font-size: 18px;
  font-weight: 700;
}

.toolbar-sub,
.panel-sub {
  margin-top: 6px;
  color: rgba(199, 237, 252, 0.64);
  font-size: 13px;
  line-height: 1.6;
}

.toolbar-controls {
  display: grid;
  grid-template-columns: 180px minmax(220px, 1fr) auto;
  gap: 14px;
  align-items: end;
  width: 100%;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.control-item label {
  font-size: 12px;
  color: rgba(198, 239, 255, 0.75);
}

.control-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(94, 196, 255, 0.2);
  border-radius: 10px;
  background: rgba(9, 25, 45, 0.9);
  color: #e6fbff;
  outline: none;
  box-sizing: border-box;
}

.control-input::placeholder {
  color: rgba(189, 225, 239, 0.42);
}

.control-input:focus {
  border-color: rgba(98, 205, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(76, 172, 255, 0.08);
}

.control-buttons,
.action-grid {
  display: grid;
  gap: 10px;
}

.control-buttons {
  grid-template-columns: repeat(3, auto);
  justify-content: end;
}

/* 单列主区域 */
.main-grid-single {
  display: block;
}

.panel-card {
  padding: 16px;
}

/* 快捷操作区域（上方） */
.action-panel-top {
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(99, 205, 255, 0.1);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 8px;
}

.action-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-align: left;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
}

.action-btn.primary {
  color: #ffffff;
  background: linear-gradient(90deg, #1a87ff, #1ce0ff);
}

.action-btn.primary:hover {
  opacity: 0.95;
  transform: translateY(-1px);
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

/* 预警列表区域 */
.warning-section {
  margin-top: 8px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.compact-head {
  margin-bottom: 12px;
}

.panel-mark {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(0, 170, 255, 0.08);
  border: 1px solid rgba(93, 196, 255, 0.18);
  color: #8ce9ff;
  font-size: 12px;
  white-space: nowrap;
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.limited-scroll {
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

.limited-scroll::-webkit-scrollbar {
  width: 8px;
}

.limited-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(108, 196, 238, 0.26);
}

.warning-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 180px;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(112, 208, 255, 0.12);
  background: linear-gradient(90deg, rgba(12, 31, 54, 0.9), rgba(8, 23, 43, 0.94));
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.warning-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.warning-high {
  box-shadow: inset 3px 0 0 #ff5b7d;
}

.warning-mid {
  box-shadow: inset 3px 0 0 #ffb347;
}

.warning-low {
  box-shadow: inset 3px 0 0 #ffe066;
}

.level-ring {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  border: 2px solid transparent;
  background: rgba(10, 20, 36, 0.75);
}

.level-ring.high {
  border-color: rgba(255, 91, 125, 0.8);
  box-shadow: 0 0 18px rgba(255, 91, 125, 0.38);
}

.level-ring.mid {
  border-color: rgba(255, 179, 71, 0.8);
  box-shadow: 0 0 18px rgba(255, 179, 71, 0.3);
}

.level-ring.low {
  border-color: rgba(255, 224, 102, 0.8);
  box-shadow: 0 0 18px rgba(255, 224, 102, 0.25);
  color: #fff7bf;
}

.warning-center {
  min-width: 0;
}

.warning-title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.warning-title {
  font-size: 15px;
  font-weight: 700;
  color: #f0fdff;
}

.warning-status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid rgba(86, 207, 255, 0.2);
  white-space: nowrap;
}

.warning-status.published {
  color: #67d7ff;
  background: rgba(34, 146, 255, 0.08);
}

.warning-status.processing {
  color: #ff9277;
  background: rgba(255, 116, 77, 0.1);
}

.warning-status.closed {
  color: #9ef0c6;
  background: rgba(0, 255, 170, 0.08);
}

.warning-desc {
  margin-top: 8px;
  color: rgba(205, 236, 248, 0.78);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
}

.warning-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.mini-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #9feaff;
  background: rgba(0, 170, 255, 0.08);
  border: 1px solid rgba(115, 211, 255, 0.16);
}

.warning-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.meta-block {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(7, 22, 40, 0.72);
  border: 1px solid rgba(106, 203, 255, 0.1);
}

.meta-label {
  font-size: 12px;
  color: rgba(187, 229, 246, 0.58);
}

.meta-value {
  margin-top: 6px;
  font-size: 13px;
  color: #e7fcff;
  word-break: break-all;
}

.toast {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  color: #aef6d1;
  background: rgba(11, 54, 41, 0.8);
  border: 1px solid rgba(83, 211, 151, 0.18);
  font-size: 13px;
}

.timeline-card {
  padding: 16px;
}

.timeline-head {
  align-items: flex-start;
  gap: 16px;
}

.metric-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.metric-tab {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(94, 196, 255, 0.18);
  border-radius: 999px;
  background: rgba(9, 25, 45, 0.7);
  color: #9adfff;
  cursor: pointer;
  transition: 0.2s ease;
}

.metric-tab:hover {
  border-color: rgba(94, 196, 255, 0.35);
}

.metric-tab.active {
  color: #ffffff;
  background: linear-gradient(90deg, rgba(24, 126, 255, 0.95), rgba(28, 224, 255, 0.95));
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(28, 148, 255, 0.22);
}

.chart-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
  align-items: stretch;
}

.chart-main {
  min-width: 0;
}

.chart-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.chart-summary-item {
  padding: 14px;
  border-radius: 14px;
  background: rgba(8, 22, 39, 0.7);
  border: 1px solid rgba(99, 205, 255, 0.08);
}

.summary-mini-label {
  font-size: 12px;
  color: rgba(188, 229, 244, 0.66);
}

.summary-mini-value {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  color: #f8feff;
}

.chart-box {
  width: 100%;
  height: 380px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(97, 199, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(8, 23, 42, 0.96), rgba(7, 18, 35, 0.98)),
    radial-gradient(circle at top, rgba(23, 138, 255, 0.08), transparent 30%);
}

.trend-chart {
  width: 100%;
  height: 100%;
  display: block;
}

.chart-grid line {
  stroke: rgba(108, 200, 248, 0.12);
  stroke-width: 1;
}

.axis-line {
  stroke: rgba(135, 221, 255, 0.4);
  stroke-width: 1.5;
}

.axis-text {
  fill: rgba(198, 236, 250, 0.72);
  font-size: 12px;
}

.line-path {
  fill: none;
  stroke: #66d5ff;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
  filter: drop-shadow(0 0 8px rgba(102, 213, 255, 0.42));
  transition: d 0.5s ease;
}

.threshold-line {
  stroke: rgba(255, 118, 118, 0.95);
  stroke-width: 1.8;
  stroke-dasharray: 8 6;
}

.threshold-text {
  fill: rgba(255, 172, 172, 0.95);
  font-size: 12px;
}

.point-ring {
  fill: rgba(102, 213, 255, 0.18);
  stroke: rgba(129, 225, 255, 0.6);
  stroke-width: 1;
}

.point-core {
  fill: #d7f7ff;
}

.point-value {
  fill: #ecfdff;
  font-size: 11px;
}

.chart-side-simple {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(97, 199, 255, 0.12);
  background: rgba(8, 22, 39, 0.76);
}

.small-title {
  margin-bottom: 10px;
  color: rgba(204, 241, 255, 0.72);
  font-size: 13px;
  font-weight: 600;
}

.mini-list {
  display: grid;
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
}

.mini-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(7, 20, 36, 0.82);
  border: 1px solid rgba(107, 201, 250, 0.08);
  color: #e8fbff;
  font-size: 13px;
}

.empty-box {
  display: grid;
  place-items: center;
  min-height: 120px;
  border-radius: 14px;
  border: 1px dashed rgba(112, 208, 255, 0.14);
  color: rgba(203, 238, 252, 0.58);
  background: rgba(7, 20, 36, 0.65);
  font-size: 14px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 导出/阈值弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal-card {
  position: absolute;
  background: #0a1a2f;
  border: 1px solid rgba(86, 207, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  color: #d9f6ff;
}

.export-modal {
  width: 420px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.threshold-modal {
  width: 750px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(86, 207, 255, 0.2);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: #8ce9ff;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.form-row {
  margin-bottom: 18px;
}

.form-row label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: rgba(212, 243, 255, 0.9);
}

.modal-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(8, 25, 45, 0.9);
  border: 1px solid rgba(94, 196, 255, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: #1ce0ff;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  background: rgba(8, 25, 45, 0.5);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(94, 196, 255, 0.15);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #c7f6ff;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #1a87ff;
  cursor: pointer;
}

.modal-select {
  width: 100%;
  padding: 8px;
  background: rgba(8, 25, 45, 0.9);
  border: 1px solid rgba(94, 196, 255, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
}

.modal-select option {
  background: #0a1a2f;
  color: #fff;
  padding: 4px;
}

.select-hint {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(200, 230, 255, 0.6);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(86, 207, 255, 0.2);
}

.modal-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.modal-btn.cancel {
  background: rgba(20, 40, 60, 0.8);
  color: #b0d9f0;
  border: 1px solid rgba(94, 196, 255, 0.2);
}

.modal-btn.confirm {
  background: linear-gradient(90deg, #1a87ff, #1ce0ff);
  color: #fff;
}

.modal-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.drag-handle {
  cursor: move;
  user-select: none;
}

/* 阈值表格样式 */
.threshold-table {
  width: 100%;
  border-collapse: collapse;
  color: #d9f6ff;
}

.threshold-table th,
.threshold-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #1e3a5a;
  text-align: left;
}

.threshold-table th {
  background: #0f2740;
  font-weight: 600;
  position: sticky;
  top: 0;
}

/* 阈值表格内输入框：小框效果 */
.threshold-table input {
  width: 100%;
  max-width: 100px;
  padding: 4px 6px;
  background: #0a1a2f;
  border: 1px solid #3c8dbc;
  color: white;
  border-radius: 4px;
}

.edit-btn,
.save-btn,
.cancel-btn {
  padding: 4px 8px;
  margin-right: 4px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.edit-btn {
  background: #1a87ff;
  color: white;
}

.save-btn {
  background: #28a745;
  color: white;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

/* 坝体相关新增样式 */
.dam-latest-panel {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dam-card {
  min-height: 110px;
}

.dam-controls {
  grid-template-columns: 1fr 1fr 1fr auto;
}

.dam-main-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dam-warning-card {
  margin-bottom: 0;
}

/* 坝体预警滚动容器：固定高度显示两条预警 */
.dam-warning-scroll-container {
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.dam-warning-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.dam-warning-scroll-container::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(108, 196, 238, 0.26);
}

.dam-warning-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dam-table-card {
  margin-top: 0;
}

.table-scroll {
  max-height: 400px;
  overflow-y: auto;
  border-radius: 12px;
}

.dam-data-table {
  width: 100%;
  border-collapse: collapse;
  color: #d9f6ff;
  font-size: 13px;
}

.dam-data-table th,
.dam-data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid rgba(86, 207, 255, 0.12);
}

.dam-data-table th {
  background: rgba(8, 30, 52, 0.9);
  color: #b0e4ff;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.dam-data-table tr:hover {
  background: rgba(26, 135, 255, 0.06);
}

.empty-cell {
  text-align: center !important;
  color: rgba(200, 230, 255, 0.5);
  padding: 30px !important;
}

.abnormal-value {
  color: #ff7b7b;
  font-weight: 600;
}

.scroll-hint {
  margin-top: 10px;
  font-size: 11px;
  color: rgba(180, 220, 255, 0.5);
  text-align: center;
}

.action-btn.small {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
}

/* 响应式布局 */
@media (max-width: 1440px) {
  .chart-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .top-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .page-header,
  .toolbar-card,
  .timeline-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-controls {
    grid-template-columns: 1fr;
  }

  .control-buttons {
    grid-template-columns: 1fr 1fr 1fr;
    justify-content: stretch;
  }

  .action-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-box {
    height: 340px;
  }

  .warning-row {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .warning-right {
    grid-column: 2 / 3;
  }

  .limited-scroll {
    max-height: 420px;
  }
}

@media (max-width: 768px) {
  .warning-page {
    padding: 14px;
  }

  .page-header h2 {
    font-size: 24px;
  }

  .top-panel,
  .chart-summary,
  .action-grid,
  .control-buttons {
    grid-template-columns: 1fr;
  }

  .metric-tabs {
    justify-content: flex-start;
  }

  .chart-box {
    height: 300px;
  }

  .header-right {
    justify-content: flex-start;
  }

  .limited-scroll {
    max-height: 380px;
  }
}
</style>