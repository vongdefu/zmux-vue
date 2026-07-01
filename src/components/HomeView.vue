<script setup>
import { computed, onMounted, ref } from 'vue'
import { usePlayerStore } from '../stores/playerStore'
import { loadPomodoro, dateKey } from '../services/pomodoroStorage'
import { loadSchedule } from '../services/scheduleStorage'
import { loadHabits } from '../services/habitStorage'
import { getTodayMondayStr } from '../services/scheduleStorage'

const emit = defineEmits(['navigate'])
const store = usePlayerStore()

/* ===== 时间问候 ===== */
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return '早上好'
  if (h >= 12 && h < 18) return '下午好'
  return '晚上好'
})

const todayDateStr = computed(() => {
  const d = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`
})

/* ===== 今日概览数据 ===== */
// 数据在每次挂载时从 localStorage 刷新（App.vue 中 v-if 切换会重新创建组件）
const currentTrackTitle = computed(() =>
  store.state.currentTrack?.title || null,
)

const todayPomodoros = ref(0)
function refreshPomodoros() {
  const data = loadPomodoro()
  if (data.today === dateKey(new Date())) {
    todayPomodoros.value = data.sessions
  } else {
    todayPomodoros.value = 0
  }
}

const incompleteTasks = ref(0)
function countIncomplete(tasks) {
  let count = 0
  for (const t of tasks) {
    if (!t.completed) count++
    if (t.children?.length) count += countIncomplete(t.children)
  }
  return count
}
function refreshSchedule() {
  const schedule = loadSchedule()
  const year = new Date().getFullYear()
  const yearData = schedule[year]
  if (!yearData?.weeks?.length) { incompleteTasks.value = 0; return }
  const todayMonday = getTodayMondayStr()
  const week = yearData.weeks.find(w => w.monday === todayMonday)
  incompleteTasks.value = week ? countIncomplete(week.tasks || []) : 0
}

const habitStreak = ref(0)
function calcStreak() {
  const habits = loadHabits()
  if (!habits.length) { habitStreak.value = 0; return }

  // 找出所有习惯中最长的当前连续天数
  let maxStreak = 0
  const today = dateKey(new Date())
  const yesterday = dateKey(new Date(Date.now() - 86400000))

  for (const habit of habits) {
    const completions = habit.completions || {}
    // 连续从今天或昨天开始倒推
    let startDate = completions[today] ? today : completions[yesterday] ? yesterday : null
    if (!startDate) continue
    let streak = 0
    const cursor = new Date(startDate)
    while (completions[dateKey(cursor)]) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    if (streak > maxStreak) maxStreak = streak
  }
  habitStreak.value = maxStreak
}

onMounted(() => {
  refreshPomodoros()
  refreshSchedule()
  calcStreak()
})

/* ===== 概览条目 ===== */
const overviewItems = computed(() => [
  {
    key: 'music',
    icon: '🎵',
    label: '正在播放',
    value: currentTrackTitle.value || '暂未播放',
    navigateTo: 'music',
  },
  {
    key: 'pomodoro',
    icon: '🍅',
    label: '今日番茄',
    value: todayPomodoros.value ? `${todayPomodoros.value} 个番茄` : '暂无记录',
    navigateTo: 'pomodoro',
  },
  {
    key: 'schedule',
    icon: '📅',
    label: '待办日程',
    value: incompleteTasks.value ? `${incompleteTasks.value} 项未完成` : '全部完成 ✓',
    navigateTo: 'schedule',
  },
])

/* ===== 模块列表 ===== */
const modules = computed(() => [
  {
    id: 'music',
    icon: '🎵',
    label: '美好音乐',
    color: '#fa233b',
    bg: 'linear-gradient(135deg, #fa233b, #ff7a90)',
    summary: currentTrackTitle.value
      ? `正在播放：${currentTrackTitle.value}`
      : '搜索歌曲，发现好音乐',
  },
  {
    id: 'schedule',
    icon: '📅',
    label: '日程管理',
    color: '#007AFF',
    bg: 'linear-gradient(135deg, #007AFF, #5ac8fa)',
    summary: incompleteTasks.value
      ? `${incompleteTasks.value} 项日程待完成`
      : '本周暂无待办',
  },
  {
    id: 'habit',
    icon: '✅',
    label: '习惯跟踪',
    color: '#31c27c',
    bg: 'linear-gradient(135deg, #31c27c, #30d158)',
    summary: habitStreak.value
      ? `已连续打卡 ${habitStreak.value} 天`
      : '开始培养一个好习惯',
  },
  {
    id: 'pomodoro',
    icon: '🍅',
    label: '番茄时钟',
    color: '#ff9f0a',
    bg: 'linear-gradient(135deg, #ff9f0a, #ffcc00)',
    summary: todayPomodoros.value
      ? `今日完成 ${todayPomodoros.value} 个番茄`
      : '专注工作，高效产出',
  },
])
</script>

<template>
  <div class="home-view">
    <!-- iOS Large Title 区 -->
    <header class="home-hero">
      <h1 class="home-greeting">{{ greeting }}</h1>
      <p class="home-date">{{ todayDateStr }}</p>
    </header>

    <!-- 今日概览卡片 -->
    <section class="overview-card glass">
      <div class="overview-title">今日概览</div>
      <div class="overview-grid">
        <button
          v-for="item in overviewItems"
          :key="item.key"
          class="overview-item"
          @click="emit('navigate', item.navigateTo)"
        >
          <span class="overview-icon">{{ item.icon }}</span>
          <span class="overview-label">{{ item.label }}</span>
          <span class="overview-value">{{ item.value }}</span>
        </button>
      </div>
    </section>

    <!-- 模块入口列表（iOS Setting 风格） -->
    <section class="module-list">
      <button
        v-for="(mod, idx) in modules"
        :key="mod.id"
        class="module-row"
        :class="{ 'module-row-last': idx === modules.length - 1 }"
        @click="emit('navigate', mod.id)"
      >
        <span class="module-icon-block" :style="{ background: mod.bg }">
          {{ mod.icon }}
        </span>
        <span class="module-text">
          <span class="module-label">{{ mod.label }}</span>
          <span class="module-summary">{{ mod.summary }}</span>
        </span>
        <span class="module-chevron">›</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 18px 120px;
  overflow-y: auto;
}

/* ===== Hero / Large Title ===== */
.home-hero {
  padding: 48px 4px 24px;
}

.home-greeting {
  margin: 0;
  font-size: var(--text-large-title);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.home-date {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: var(--text-headline);
  font-weight: 500;
}

/* ===== 今日概览卡片 ===== */
.overview-card {
  border-radius: var(--radius-lg);
  padding: 20px 18px;
  margin-bottom: var(--space-lg);
}

.overview-title {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 14px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.overview-item {
  border: 0;
  border-radius: var(--radius-md);
  padding: 14px 10px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease;
  text-align: center;
}

.overview-item:active {
  transform: scale(0.97);
  opacity: 0.7;
}

.overview-icon {
  font-size: 26px;
  line-height: 1;
}

.overview-label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
}

.overview-value {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 100%;
}

/* ===== 模块入口列表 ===== */
.module-list {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);
}

.module-row {
  width: 100%;
  border: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--bg-card);
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.module-row:not(.module-row-last) {
  border-bottom: 0.5px solid var(--separator);
}

.module-row:active {
  transform: scale(0.97);
  opacity: 0.7;
}

.module-icon-block {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  font-size: 22px;
  flex-shrink: 0;
}

.module-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.module-label {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
}

.module-summary {
  font-size: var(--text-footnote);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.module-chevron {
  font-size: 20px;
  color: var(--text-tertiary);
  font-weight: 300;
  flex-shrink: 0;
}
</style>
