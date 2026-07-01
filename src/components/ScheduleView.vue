<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  addTaskToWeek,
  deleteTaskInWeek,
  ensureCurrentWeek,
  initYearSchedule,
  loadSchedule,
  saveSchedule,
  toggleTaskInWeek,
} from '../services/scheduleStorage'
import { usePlayerStore } from '../stores/playerStore'

const emit = defineEmits(['back'])
const store = usePlayerStore()

const schedule = ref(loadSchedule())
const selectedYear = ref(new Date().getFullYear())
const expandedWeeks = ref({})
const reportWeekId = ref(null)
const showAnnual = ref(false)

// 内联添加任务
const addParentId = ref(null) // null=根任务, taskId=该任务的子任务
const addText = ref('')
const addInputRef = ref(null)

const currentYear = new Date().getFullYear()
const years = computed(() => {
  const result = []
  for (let y = currentYear - 4; y <= currentYear; y++) result.push(y)
  return result
})

const yearData = computed(() => {
  const yd = schedule.value[selectedYear.value]
  if (!yd) return { weeks: [] }
  return yd
})

const sortedWeeks = computed(() =>
  [...yearData.value.weeks].sort((a, b) => b.monday.localeCompare(a.monday))
)

const reportWeek = computed(() =>
  reportWeekId.value
    ? yearData.value.weeks.find(w => w.id === reportWeekId.value)
    : null
)

// 递归收集树中已完成/未完成任务
function collectByStatus(tasks, done) {
  const result = []
  for (const t of tasks) {
    const children = t.children?.length ? collectByStatus(t.children, done) : []
    if (t.completed === done) {
      result.push({ ...t, _children: children })
    } else if (children.length) {
      result.push(...children)
    }
  }
  return result
}

const reportDone = computed(() =>
  reportWeek.value ? collectByStatus(reportWeek.value.tasks, true) : []
)
const reportUndone = computed(() =>
  reportWeek.value ? collectByStatus(reportWeek.value.tasks, false) : []
)

// 初始化
onMounted(() => {
  initYearSchedule(schedule.value, selectedYear.value)
  saveSchedule(schedule.value)
})

watch(selectedYear, (year) => {
  initYearSchedule(schedule.value, year)
  saveSchedule(schedule.value)
  expandedWeeks.value = {}
  reportWeekId.value = null
})

function persist() {
  saveSchedule(schedule.value)
}

function toggleWeek(weekId) {
  expandedWeeks.value[weekId] = !expandedWeeks.value[weekId]
}

// ---- 内联添加任务 ----
function startAdd(parentId) {
  addParentId.value = parentId
  addText.value = ''
  nextTick(() => addInputRef.value?.focus())
}

function submitAdd(week) {
  const text = addText.value.trim()
  if (!text) { addParentId.value = null; return }
  addTaskToWeek(week, addParentId.value, text)
  addParentId.value = null
  addText.value = ''
  persist()
}

function cancelAdd() {
  addParentId.value = null
  addText.value = ''
}

function onToggleTask(week, taskId) {
  toggleTaskInWeek(week, taskId)
  persist()
}

function onDeleteTask(week, taskId) {
  deleteTaskInWeek(week, taskId)
  persist()
}

// ---- 周报 ----
let reportSaveTimer = null

function openReport(weekId) {
  ensureCurrentWeek(schedule.value, selectedYear.value)
  reportWeekId.value = weekId
}

function closeReport() {
  reportWeekId.value = null
  if (reportSaveTimer) clearTimeout(reportSaveTimer)
}

function onReportSummaryInput(e) {
  if (!reportWeek.value) return
  reportWeek.value.report.summary = e.target.innerText
  if (reportSaveTimer) clearTimeout(reportSaveTimer)
  reportSaveTimer = setTimeout(() => {
    persist()
    store.showToast('已保存')
    reportSaveTimer = null
  }, 2000)
}

// ---- 滑动删除 ----
const swipeState = ref({ taskId: null, startX: 0, deltaX: 0 })

function onTouchStart(taskId, e) {
  swipeState.value = { taskId, startX: e.touches[0].clientX, deltaX: 0 }
}
function onTouchMove(e) {
  if (!swipeState.value.taskId) return
  swipeState.value.deltaX = e.touches[0].clientX - swipeState.value.startX
}
function onTouchEnd(week) {
  if (swipeState.value.deltaX < -80) {
    onDeleteTask(week, swipeState.value.taskId)
  }
  swipeState.value = { taskId: null, startX: 0, deltaX: 0 }
}
function swipeStyle(taskId) {
  if (swipeState.value.taskId !== taskId) return {}
  const dx = Math.min(0, swipeState.value.deltaX)
  return { transform: `translateX(${dx}px)`, transition: swipeState.value.deltaX ? 'none' : 'transform 0.2s ease' }
}

// 树形扁平化（用于模板渲染）
function flatTree(tasks, depth = 0) {
  const result = []
  for (const t of tasks) {
    result.push({ ...t, depth })
    if (t.children?.length) result.push(...flatTree(t.children, depth + 1))
  }
  return result
}

// 递归渲染报告中的任务（带缩进）
function reportItemTree(tasks, depth = 0) {
  const result = []
  for (const t of tasks) {
    result.push({ ...t, depth })
    if (t._children?.length) result.push(...reportItemTree(t._children, depth + 1))
  }
  return result
}
</script>

<template>
  <div class="schedule-view">
    <header class="s-top-bar">
      <button class="s-back" @click="emit('back')">←</button>
      <h1>日程管理</h1>
    </header>

    <div class="s-body">

      <!-- Slogan -->
      <div class="s-slogan">
        <div class="slogan-wrap">
          <span class="slogan-track">
            <span class="slogan-item">看五年，想三年，踏踏实实干一年</span>
            <span class="slogan-gap">✦</span>
            <span class="slogan-item">看五年，想三年，踏踏实实干一年</span>
          </span>
        </div>
      </div>

      <!-- 年份标签 -->
      <div class="s-year-bar">
        <div class="s-year-tabs">
          <button
            v-for="y in years" :key="y"
            class="s-year-btn"
            :class="{ active: selectedYear === y && !showAnnual }"
            @click="selectedYear = y; showAnnual = false"
          >{{ y }}年</button>
        </div>
        <button
          class="s-annual-btn"
          :class="{ active: showAnnual }"
          @click="showAnnual = true"
        >年报</button>
      </div>

      <!-- 任务详情 -->
      <div class="s-content">

        <div v-if="showAnnual" class="annual-placeholder">
          <span class="annual-icon">📊</span>
          <p>{{ selectedYear }} 年度报告</p>
          <span class="annual-hint">即将上线，敬请期待</span>
        </div>

        <!-- 周报视图 -->
        <template v-else-if="reportWeekId">
          <div class="report-view">
            <div class="report-head">
              <button class="rpt-back" @click="closeReport">← 返回</button>
              <h2>周报 · {{ reportWeek?.label?.replace('第 ', '') }}</h2>
            </div>

            <div class="report-section">
              <h3>✅ 已完成</h3>
              <div v-if="reportDone.length" class="report-tree">
                <div
                  v-for="t in reportItemTree(reportDone)" :key="t.id"
                  class="rpt-item done"
                  :style="{ paddingLeft: `${12 + t.depth * 16}px` }"
                >
                  <span class="rpt-bullet">✓</span>
                  <span class="rpt-text">{{ t.text }}</span>
                </div>
              </div>
              <p v-else class="rpt-empty">暂无</p>
            </div>

            <div class="report-section">
              <h3>⏳ 未完成</h3>
              <div v-if="reportUndone.length" class="report-tree">
                <div
                  v-for="t in reportItemTree(reportUndone)" :key="t.id"
                  class="rpt-item"
                  :style="{ paddingLeft: `${12 + t.depth * 16}px` }"
                >
                  <span class="rpt-bullet">○</span>
                  <span class="rpt-text">{{ t.text }}</span>
                </div>
              </div>
              <p v-else class="rpt-empty">暂无</p>
            </div>

            <div class="report-section">
              <h3>📝 总结</h3>
              <div
                class="rpt-summary"
                contenteditable="true"
                @input="onReportSummaryInput"
                v-text="reportWeek?.report?.summary || ''"
              />
              <p class="rpt-save-hint">每 2 秒自动保存</p>
            </div>
          </div>
        </template>

        <!-- 周列表 -->
        <template v-else>
          <div
            v-for="week in sortedWeeks" :key="week.id"
            class="week-card" :class="{ locked: week.locked }"
          >
            <div class="week-header">
              <div class="week-label" @click="toggleWeek(week.id)">
                <span class="week-arrow">{{ expandedWeeks[week.id] ? '▼' : '▶' }}</span>
                <span class="week-name">{{ week.label }}</span>
                <span v-if="week.locked" class="week-lock">🔒</span>
              </div>
              <div class="week-actions">
                <button class="week-report-btn" @click="openReport(week.id)">周报</button>
                <button
                  class="week-toggle-btn"
                  :class="{ open: expandedWeeks[week.id] }"
                  @click="toggleWeek(week.id)"
                >{{ expandedWeeks[week.id] ? '−' : '+' }}</button>
              </div>
            </div>

            <div v-if="expandedWeeks[week.id]" class="week-body">
              <!-- 任务树 -->
              <div v-if="week.tasks.length || addParentId.value === null" class="task-tree">
                <div
                  v-for="item in flatTree(week.tasks)" :key="item.id"
                  class="task-node"
                  :style="{ paddingLeft: `${8 + item.depth * 20}px`, ...swipeStyle(item.id) }"
                  @touchstart.passive="!week.locked && onTouchStart(item.id, $event)"
                  @touchmove.passive="!week.locked && onTouchMove($event)"
                  @touchend="!week.locked && onTouchEnd(week)"
                >
                  <button
                    class="task-check"
                    :class="{ done: item.completed }"
                    :disabled="week.locked"
                    @click="!week.locked && onToggleTask(week, item.id)"
                  >
                    <span v-if="item.completed">✓</span>
                  </button>
                  <span
                    class="task-text"
                    :class="{ completed: item.completed }"
                    @click="!week.locked && onToggleTask(week, item.id)"
                  >{{ item.text }}</span>
                  <button
                    v-if="!week.locked"
                    class="task-sub-btn" title="添加子任务"
                    @click="startAdd(item.id)"
                  >+</button>
                  <button
                    v-if="!week.locked"
                    class="task-del-btn"
                    @click="onDeleteTask(week, item.id)"
                  >×</button>

                  <!-- 内联添加子任务输入框 -->
                  <div v-if="addParentId === item.id" class="task-add-inline">
                    <input
                      ref="addInputRef"
                      v-model="addText"
                      placeholder="子任务名称..."
                      @keydown.enter="submitAdd(week)"
                      @keydown.escape="cancelAdd"
                      @blur="submitAdd(week)"
                    />
                  </div>
                </div>

                <!-- 根任务的内联输入框 -->
                <div v-if="addParentId === null" class="task-add-inline root">
                  <input
                    ref="addInputRef"
                    v-model="addText"
                    placeholder="新任务名称..."
                    @keydown.enter="submitAdd(week)"
                    @keydown.escape="cancelAdd"
                    @blur="submitAdd(week)"
                  />
                </div>
              </div>

              <div v-if="!week.tasks.length && addParentId !== null" class="task-empty">
                <span>📋</span>
                <p v-if="week.locked">本周无任务记录</p>
                <p v-else>暂无任务</p>
              </div>

              <!-- 添加根任务按钮 -->
              <button
                v-if="!week.locked && addParentId !== null"
                class="task-add-root"
                @click="startAdd(null)"
              >+ 添加任务</button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-view { width: 100%; height: 100%; display: flex; flex-direction: column; }

.s-top-bar {
  flex-shrink: 0; display: flex; align-items: center; gap: 14px;
  padding: 14px 18px 10px;
}
.s-back {
  width: 34px; height: 34px; border: 0; border-radius: 999px;
  background: rgba(118,118,128,0.1); color: var(--text-secondary);
  font-size: 16px; cursor: pointer; display: grid; place-items: center;
}
.s-top-bar h1 { margin: 0; font-size: 22px; font-weight: 800; }

.s-body {
  flex: 1; overflow-y: auto; padding: 0 18px 120px;
  display: flex; flex-direction: column; gap: 0;
}

/* ---- Slogan ---- */
.s-slogan { padding: 8px 0 10px; }
.slogan-wrap {
  overflow: hidden; white-space: nowrap; border-radius: 12px; padding: 10px 0;
  background: linear-gradient(135deg, rgba(250,35,59,0.06), rgba(0,122,255,0.06));
  mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
}
.slogan-track { display: inline-block; animation: slogan-scroll 14s linear infinite; }
.slogan-item {
  font-size: 14px; font-weight: 700;
  background: linear-gradient(135deg, var(--accent), #007aff);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.slogan-gap { padding: 0 24px; color: var(--text-tertiary); font-size: 12px; }
@keyframes slogan-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* ---- 年份标签 ---- */
.s-year-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0 10px;
  border-bottom: 1px solid rgba(118,118,128,0.10);
}
.s-year-tabs { display: flex; gap: 4px; }
.s-year-btn {
  border: 0; border-radius: 8px; padding: 6px 11px;
  background: transparent; color: var(--text-secondary);
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.s-year-btn.active { background: var(--accent); color: white; }
.s-annual-btn {
  border: 0; border-radius: 8px; padding: 6px 13px;
  background: rgba(250,35,59,0.08); color: var(--accent);
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.s-annual-btn.active { background: var(--accent); color: white; }

/* ---- 内容 ---- */
.s-content { flex: 1; padding-top: 8px; display: flex; flex-direction: column; gap: 8px; }

/* ---- 周卡片 ---- */
.week-card { border-radius: 14px; background: white; overflow: hidden; }
.week-card.locked { opacity: 0.65; }
.week-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px;
}
.week-label { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; min-width: 0; }
.week-arrow { font-size: 10px; color: var(--text-tertiary); flex-shrink: 0; width: 12px; text-align: center; }
.week-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.week-lock { font-size: 12px; }
.week-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.week-report-btn {
  border: 0; border-radius: 6px; padding: 4px 10px;
  background: rgba(0,122,255,0.08); color: #007aff;
  font-size: 12px; font-weight: 700; cursor: pointer;
}
.week-toggle-btn {
  width: 26px; height: 26px; border: 0; border-radius: 999px;
  background: rgba(118,118,128,0.1); color: var(--text-secondary);
  font-size: 16px; font-weight: 700; cursor: pointer;
  display: grid; place-items: center; line-height: 1;
}
.week-toggle-btn.open { background: var(--accent); color: white; }
.week-body { padding: 0 14px 14px; }

/* ---- 任务树 ---- */
.task-tree { display: flex; flex-direction: column; }
.task-node {
  display: flex; align-items: center; gap: 8px;
  min-height: 40px; padding: 2px 0;
  position: relative; touch-action: pan-y; user-select: none;
  flex-wrap: wrap;
}
.task-check {
  width: 22px; height: 22px; flex-shrink: 0;
  border: 2px solid rgba(118,118,128,0.25); border-radius: 999px;
  background: transparent; cursor: pointer;
  display: grid; place-items: center;
  font-size: 12px; color: transparent;
}
.task-check.done { background: var(--accent); border-color: var(--accent); color: white; }
.task-text {
  flex: 1; min-width: 0; font-size: 14px; line-height: 1.5;
  color: var(--text-primary); cursor: pointer; word-break: break-word;
}
.task-text.completed {
  color: var(--text-tertiary);
  text-decoration: underline wavy rgba(250,35,59,0.5);
}
.task-sub-btn {
  width: 22px; height: 22px; flex-shrink: 0;
  border: 0; border-radius: 6px;
  background: rgba(0,122,255,0.08); color: #007aff;
  font-size: 14px; font-weight: 700; cursor: pointer;
  display: grid; place-items: center;
}
.task-del-btn {
  width: 22px; height: 22px; flex-shrink: 0;
  border: 0; border-radius: 6px; background: transparent;
  color: var(--text-tertiary); font-size: 15px; cursor: pointer;
  display: grid; place-items: center;
}
.task-del-btn:active { background: rgba(250,35,59,0.1); color: var(--accent); }

/* 内联添加输入框 */
.task-add-inline {
  width: 100%; padding: 4px 0 4px 30px;
}
.task-add-inline.root {
  padding-left: 0; margin-top: 4px;
}
.task-add-inline input {
  width: 100%; border: 1px solid var(--accent); border-radius: 8px;
  padding: 7px 10px; font-size: 14px; outline: none;
  background: white; color: var(--text-primary);
  box-sizing: border-box;
}

.task-add-root {
  border: 1px dashed rgba(118,118,128,0.25); border-radius: 10px;
  padding: 8px; width: 100%; background: transparent;
  color: var(--text-secondary); font-size: 13px; cursor: pointer; margin-top: 4px;
}
.task-add-root:active { background: rgba(118,118,128,0.04); }

.task-empty {
  display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 4px;
  color: var(--text-tertiary);
}
.task-empty span { font-size: 24px; }
.task-empty p { margin: 0; font-size: 13px; }

/* ---- 年报 ---- */
.annual-placeholder {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  padding: 48px 0; color: var(--text-tertiary);
}
.annual-icon { font-size: 48px; }
.annual-placeholder p { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.annual-hint { font-size: 13px; }

/* ---- 周报 ---- */
.report-view { display: flex; flex-direction: column; gap: 14px; }
.report-head { display: flex; align-items: center; gap: 10px; }
.rpt-back {
  border: 0; border-radius: 999px; padding: 5px 12px;
  background: rgba(250,35,59,0.08); color: var(--accent);
  font-size: 12px; font-weight: 700; cursor: pointer;
}
.report-head h2 { margin: 0; font-size: 17px; }
.report-section h3 { margin: 0 0 6px; font-size: 14px; font-weight: 700; }
.report-tree { display: flex; flex-direction: column; gap: 4px; }
.rpt-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 10px;
  background: rgba(255,255,255,0.7);
}
.rpt-bullet { font-size: 12px; flex-shrink: 0; width: 16px; text-align: center; }
.rpt-item.done .rpt-text {
  text-decoration: underline wavy rgba(250,35,59,0.4); color: var(--text-tertiary);
}
.rpt-text { font-size: 14px; color: var(--text-primary); }
.rpt-empty { margin: 0; font-size: 13px; color: var(--text-tertiary); }
.rpt-summary {
  min-height: 80px; padding: 10px 12px; border-radius: 12px;
  background: white; font-size: 14px; color: var(--text-primary);
  outline: none; white-space: pre-wrap; word-break: break-word;
}
.rpt-summary:empty::before { content: '记录本周的工作总结...'; color: var(--text-tertiary); }
.rpt-save-hint { margin: 4px 0 0; font-size: 11px; color: var(--text-tertiary); }
</style>
