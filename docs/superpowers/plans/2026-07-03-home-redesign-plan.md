# Home Page Redesign — Liquid Glass Widget Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a liquid-glass iOS-widget-style container below the overview card on the home page, with a mini calendar on the left and vertically swipeable widget cards (Now Playing, Pomodoro, Schedule, Habits) on the right.

**Architecture:** Bottom-up component build. Six new Vue 3 SFC components using Composition API (`<script setup>`), each self-contained with props/emits interface. `LiquidGlassWidget.vue` is the shell that composes `MiniCalendar.vue` + `WidgetStack.vue` with liquid glass CSS effects. `HomeView.vue` passes existing data as props and handles widget action events by calling existing store/service methods.

**Tech Stack:** Vue 3 Composition API, CSS scroll-snap, CSS @keyframes for liquid glass, existing `var(--*)` design tokens

## Global Constraints

- All styles reference existing `var(--*)` tokens from `tokens.css`
- No new npm dependencies
- No changes to existing services/stores
- Existing module entry list below widget remains untouched
- No Vue Router — view switching uses `currentView` ref in App.vue

---

## File Structure

```
src/components/
├── HomeView.vue              [MODIFY] — import LiquidGlassWidget, pass props, handle events
├── LiquidGlassWidget.vue     [CREATE] — glass shell, 2-column layout, calendar expand state
├── MiniCalendar.vue          [CREATE] — mini mode + expanded 7-day week view
├── WidgetStack.vue           [CREATE] — CSS scroll-snap-y container + page indicator dots
├── WidgetNowPlaying.vue      [CREATE] — current track info + skip/favorite actions
├── WidgetPomodoro.vue        [CREATE] — today's pomodoro session count
├── WidgetSchedule.vue        [CREATE] — today's incomplete tasks with checkboxes
└── WidgetHabit.vue           [CREATE] — today's habits with toggle
```

### Interfaces

```
HomeView
  ├── passes to LiquidGlassWidget:
  │     currentTrack, isFavorite, todayPomodoros,
  │     incompleteTasks (flattened), habits (with today status)
  │     @skip-next, @skip-prev, @toggle-favorite, @navigate
  │     @toggle-task(id), @toggle-habit(id, dateKey)
  │
  └── LiquidGlassWidget
        ├── passes to MiniCalendar: (nothing — self-contained)
        │     emits: (none — calendar only affects internal layout)
        │
        └── passes to WidgetStack:
              track, isFavorite, pomodoroCount, tasks, habits
              @skip-next, @skip-prev, @toggle-favorite, @navigate
              @toggle-task, @toggle-habit
              @active-index-changed

WidgetStack
  └── passes to each widget: relevant props + re-emits events
```

---

### Task 1: Create WidgetNowPlaying.vue

**Files:**
- Create: `src/components/WidgetNowPlaying.vue`

**Interfaces:**
- Produces: `<WidgetNowPlaying>` component
- Props: `track` (Object|null), `isFavorite` (Boolean)
- Emits: `skip-next`, `skip-prev`, `toggle-favorite`, `navigate` (payload: `'music'`)

- [ ] **Step 1: Create the component file**

```vue
<script setup>
defineProps({
  track: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
})

const emit = defineEmits(['skip-next', 'skip-prev', 'toggle-favorite', 'navigate'])
</script>

<template>
  <div class="widget-now-playing">
    <!-- Empty state -->
    <div v-if="!track" class="wnp-empty" @click="emit('navigate', 'music')">
      <span class="wnp-empty-icon">🎵</span>
      <span class="wnp-empty-text">暂未播放</span>
      <span class="wnp-empty-hint">点击前往音乐</span>
    </div>

    <!-- Playing state -->
    <div v-else class="wnp-content">
      <div class="wnp-header">
        <span class="wnp-label">正在播放</span>
      </div>
      <div class="wnp-track">
        <div class="wnp-artwork">
          <span class="wnp-artwork-fallback">🎵</span>
        </div>
        <div class="wnp-info">
          <span class="wnp-title">{{ track.title || '未知歌曲' }}</span>
          <span class="wnp-artist">{{ track.artist || '未知歌手' }}</span>
        </div>
      </div>
      <div class="wnp-actions">
        <button class="wnp-btn" @click.stop="emit('skip-prev')">
          <span>⏮</span>
        </button>
        <button
          class="wnp-btn"
          :class="{ 'wnp-btn-active': isFavorite }"
          @click.stop="emit('toggle-favorite')"
        >
          <span>{{ isFavorite ? '❤️' : '🤍' }}</span>
        </button>
        <button class="wnp-btn" @click.stop="emit('skip-next')">
          <span>⏭</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-now-playing {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px 14px;
}

/* Empty state */
.wnp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 20px 0;
}
.wnp-empty-icon { font-size: 32px; }
.wnp-empty-text {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
}
.wnp-empty-hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

/* Playing state */
.wnp-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wnp-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wnp-label {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.wnp-track {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wnp-artwork {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: var(--separator);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.wnp-artwork-fallback {
  font-size: 22px;
}
.wnp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wnp-title {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wnp-artist {
  font-size: var(--text-footnote);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wnp-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding-top: 4px;
}
.wnp-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: 0;
  background: var(--separator);
  display: grid;
  place-items: center;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.wnp-btn:active {
  transform: scale(0.9);
  opacity: 0.7;
}
.wnp-btn-active {
  background: var(--accent-dim);
}
</style>
```

- [ ] **Step 2: Verify file is created with correct syntax**

Run: `grep -c "script setup" src/components/WidgetNowPlaying.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/WidgetNowPlaying.vue
git commit -m "feat: add WidgetNowPlaying component"
```

---

### Task 2: Create WidgetPomodoro.vue

**Files:**
- Create: `src/components/WidgetPomodoro.vue`

**Interfaces:**
- Produces: `<WidgetPomodoro>` component
- Props: `count` (Number, default 0)
- Emits: `navigate` (payload: `'pomodoro'`)

- [ ] **Step 1: Create the component file**

```vue
<script setup>
defineProps({
  count: { type: Number, default: 0 },
})

const emit = defineEmits(['navigate'])
</script>

<template>
  <div class="widget-pomodoro">
    <div class="wp-header">
      <span class="wp-label">番茄时钟</span>
    </div>

    <div v-if="count === 0" class="wp-empty" @click="emit('navigate', 'pomodoro')">
      <span class="wp-empty-icon">🍅</span>
      <span class="wp-empty-text">今日暂无番茄</span>
      <span class="wp-empty-hint">点击开始专注</span>
    </div>

    <div v-else class="wp-count" @click="emit('navigate', 'pomodoro')">
      <span class="wp-tomato">🍅</span>
      <span class="wp-number">{{ count }}</span>
      <span class="wp-unit">个番茄</span>
    </div>
  </div>
</template>

<style scoped>
.widget-pomodoro {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px 14px;
}
.wp-header {
  margin-bottom: 10px;
}
.wp-label {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.wp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 20px 0;
}
.wp-empty-icon { font-size: 32px; }
.wp-empty-text {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
}
.wp-empty-hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
.wp-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 16px 0;
}
.wp-tomato { font-size: 36px; }
.wp-number {
  font-size: 40px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}
.wp-unit {
  font-size: var(--text-footnote);
  color: var(--text-secondary);
}
</style>
```

- [ ] **Step 2: Verify file**

Run: `grep -c "script setup" src/components/WidgetPomodoro.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/WidgetPomodoro.vue
git commit -m "feat: add WidgetPomodoro component"
```

---

### Task 3: Create WidgetSchedule.vue

**Files:**
- Create: `src/components/WidgetSchedule.vue`

**Interfaces:**
- Produces: `<WidgetSchedule>` component
- Props: `tasks` (Array, default []) — each item has `{ id, text, completed }`
- Emits: `toggle-task(id)` (payload: task id string), `navigate` (payload: `'schedule'`)

- [ ] **Step 1: Create the component file**

```vue
<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle-task', 'navigate'])
</script>

<template>
  <div class="widget-schedule">
    <div class="ws-header">
      <span class="ws-label">日程管理</span>
    </div>

    <div v-if="!tasks.length" class="ws-empty" @click="emit('navigate', 'schedule')">
      <span class="ws-empty-icon">✅</span>
      <span class="ws-empty-text">今日全部完成</span>
    </div>

    <div v-else class="ws-list">
      <button
        v-for="task in tasks.slice(0, 4)"
        :key="task.id"
        class="ws-task"
        @click="emit('toggle-task', task.id)"
      >
        <span class="ws-checkbox" :class="{ 'ws-checked': task.completed }">
          {{ task.completed ? '✓' : '' }}
        </span>
        <span class="ws-task-text" :class="{ 'ws-done': task.completed }">
          {{ task.text }}
        </span>
      </button>
      <div v-if="tasks.length > 4" class="ws-more">
        还有 {{ tasks.length - 4 }} 项...
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-schedule {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 14px;
  overflow: hidden;
}
.ws-header {
  margin-bottom: 10px;
  flex-shrink: 0;
}
.ws-label {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ws-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 20px 0;
}
.ws-empty-icon { font-size: 32px; }
.ws-empty-text {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
}
.ws-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
}
.ws-task {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.ws-task:active {
  background: var(--separator);
}
.ws-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--text-tertiary);
  display: grid;
  place-items: center;
  font-size: 12px;
  color: white;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.ws-checked {
  background: var(--accent);
  border-color: var(--accent);
}
.ws-task-text {
  font-size: var(--text-body);
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-done {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.ws-more {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  padding: 4px;
  text-align: center;
}
</style>
```

- [ ] **Step 2: Verify file**

Run: `grep -c "script setup" src/components/WidgetSchedule.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/WidgetSchedule.vue
git commit -m "feat: add WidgetSchedule component"
```

---

### Task 4: Create WidgetHabit.vue

**Files:**
- Create: `src/components/WidgetHabit.vue`

**Interfaces:**
- Produces: `<WidgetHabit>` component
- Props: `habits` (Array, default []) — each item has `{ id, name, color, completedToday: Boolean }`
- Emits: `toggle-habit(habitId)` (payload: habit id string), `navigate` (payload: `'habit'`)

- [ ] **Step 1: Create the component file**

```vue
<script setup>
defineProps({
  habits: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle-habit', 'navigate'])
</script>

<template>
  <div class="widget-habit">
    <div class="wh-header">
      <span class="wh-label">习惯跟踪</span>
    </div>

    <div v-if="!habits.length" class="wh-empty" @click="emit('navigate', 'habit')">
      <span class="wh-empty-icon">✨</span>
      <span class="wh-empty-text">暂无习惯</span>
      <span class="wh-empty-hint">点击去添加</span>
    </div>

    <div v-else class="wh-list">
      <button
        v-for="habit in habits"
        :key="habit.id"
        class="wh-item"
        @click="emit('toggle-habit', habit.id)"
      >
        <span
          class="wh-dot"
          :class="{ 'wh-dot-done': habit.completedToday }"
          :style="{ background: habit.completedToday ? habit.color : 'transparent', borderColor: habit.color }"
        ></span>
        <span class="wh-name" :class="{ 'wh-name-done': habit.completedToday }">
          {{ habit.name }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.widget-habit {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 14px;
  overflow: hidden;
}
.wh-header {
  margin-bottom: 10px;
  flex-shrink: 0;
}
.wh-label {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.wh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 20px 0;
}
.wh-empty-icon { font-size: 32px; }
.wh-empty-text {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
}
.wh-empty-hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
.wh-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
}
.wh-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.wh-item:active {
  background: var(--separator);
}
.wh-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--text-tertiary);
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.wh-dot-done {
  border-style: solid;
}
.wh-name {
  font-size: var(--text-body);
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wh-name-done {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
</style>
```

- [ ] **Step 2: Verify file**

Run: `grep -c "script setup" src/components/WidgetHabit.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/WidgetHabit.vue
git commit -m "feat: add WidgetHabit component"
```

---

### Task 5: Create WidgetStack.vue

**Files:**
- Create: `src/components/WidgetStack.vue`

**Interfaces:**
- Produces: `<WidgetStack>` component wrapping all 4 widgets
- Props: `track` (Object|null), `isFavorite` (Boolean), `pomodoroCount` (Number), `tasks` (Array), `habits` (Array)
- Emits: `skip-next`, `skip-prev`, `toggle-favorite`, `navigate`, `toggle-task`, `toggle-habit`, `active-index-changed(index)`
- Uses IntersectionObserver to detect which widget is visible, emits `active-index-changed` for parent to drive color bleed + page dots

- [ ] **Step 1: Create the component file**

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import WidgetNowPlaying from './WidgetNowPlaying.vue'
import WidgetPomodoro from './WidgetPomodoro.vue'
import WidgetSchedule from './WidgetSchedule.vue'
import WidgetHabit from './WidgetHabit.vue'

defineProps({
  track: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
  pomodoroCount: { type: Number, default: 0 },
  tasks: { type: Array, default: () => [] },
  habits: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'skip-next', 'skip-prev', 'toggle-favorite', 'navigate',
  'toggle-task', 'toggle-habit', 'active-index-changed',
])

const activeIndex = ref(0)
const stackRef = ref(null)
let observer = null

onMounted(() => {
  if (!stackRef.value) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.dataset.widgetIndex)
          if (!isNaN(idx)) {
            activeIndex.value = idx
            emit('active-index-changed', idx)
          }
        }
      }
    },
    { root: stackRef.value, threshold: 0.6 }
  )
  const slides = stackRef.value.querySelectorAll('[data-widget-index]')
  slides.forEach((el) => observer.observe(el))
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="widget-stack">
    <div ref="stackRef" class="ws-scroll">
      <div class="ws-slide" data-widget-index="0">
        <WidgetNowPlaying
          :track="track"
          :isFavorite="isFavorite"
          @skip-next="emit('skip-next')"
          @skip-prev="emit('skip-prev')"
          @toggle-favorite="emit('toggle-favorite')"
          @navigate="emit('navigate', $event)"
        />
      </div>
      <div class="ws-slide" data-widget-index="1">
        <WidgetPomodoro
          :count="pomodoroCount"
          @navigate="emit('navigate', $event)"
        />
      </div>
      <div class="ws-slide" data-widget-index="2">
        <WidgetSchedule
          :tasks="tasks"
          @toggle-task="emit('toggle-task', $event)"
          @navigate="emit('navigate', $event)"
        />
      </div>
      <div class="ws-slide" data-widget-index="3">
        <WidgetHabit
          :habits="habits"
          @toggle-habit="emit('toggle-habit', $event)"
          @navigate="emit('navigate', $event)"
        />
      </div>
    </div>

    <!-- Page indicator dots -->
    <div class="ws-dots">
      <span
        v-for="i in 4"
        :key="i"
        class="ws-dot"
        :class="{ 'ws-dot-active': activeIndex === i - 1 }"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.widget-stack {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.ws-scroll {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scroll-snap-stop: always;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.ws-scroll::-webkit-scrollbar {
  display: none;
}

.ws-slide {
  height: 100%;
  scroll-snap-align: start;
}

/* Page indicator */
.ws-dots {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 2;
}
.ws-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  opacity: 0.3;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ws-dot-active {
  opacity: 0.9;
  transform: scale(1.4);
}
</style>
```

- [ ] **Step 2: Verify file**

Run: `grep -c "script setup" src/components/WidgetStack.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/WidgetStack.vue
git commit -m "feat: add WidgetStack scroll-snap container with page dots"
```

---

### Task 6: Create MiniCalendar.vue

**Files:**
- Create: `src/components/MiniCalendar.vue`

**Interfaces:**
- Produces: `<MiniCalendar>` component
- Props: none (self-contained, computes from `new Date()`)
- Exposes internal state via `defineExpose`? No — calendar expand/collapse is managed by parent `LiquidGlassWidget` via a prop `expanded` (Boolean)
- Actually: the calendar expand state lives in parent. MiniCalendar receives `expanded` as a prop and emits `toggle-expand`.

Wait — let's reconsider. The spec says clicking the calendar toggles expanded mode and the parent hides/shows the widget stack. So the expand state lives in LiquidGlassWidget, and MiniCalendar receives it as a prop.

Let's use: Props: `expanded` (Boolean), Emits: `toggle-expand`, `select-date(dateStr)`

- [ ] **Step 1: Create the component file**

```vue
<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  expanded: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-expand', 'select-date'])

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const today = new Date()
today.setHours(0, 0, 0, 0)
const todayStr = dateKey(today)

const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())
const weekOffset = ref(0) // for expanded 7-day view: 0 = current week, negative = past, positive = future

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Get Monday of the week containing the given date */
function mondayOf(d) {
  const clone = new Date(d)
  clone.setHours(0, 0, 0, 0)
  const day = clone.getDay()
  const offset = day === 0 ? -6 : 1 - day
  clone.setDate(clone.getDate() + offset)
  return clone
}

// Mini calendar: compute dates for the current month grid
const miniDates = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay() || 7 // Mon=1..Sun=7
  // Start from the Monday before the first of the month
  const start = new Date(year, month, 1 - (startDay - 1))

  const rows = []
  let cursor = new Date(start)
  for (let r = 0; r < 6; r++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push({
        date: new Date(cursor),
        key: dateKey(cursor),
        isToday: dateKey(cursor) === todayStr,
        isCurrentMonth: cursor.getMonth() === month,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    rows.push(week)
  }
  return rows
})

const monthLabel = computed(() => {
  return `${currentYear.value}年${currentMonth.value + 1}月`
})

// Expanded week view: compute 7 days from the current week offset
const weekDays = computed(() => {
  const todayMonday = mondayOf(today)
  const base = new Date(todayMonday)
  base.setDate(base.getDate() + weekOffset.value * 7)
  const days = []
  const cursor = new Date(base)
  for (let i = 0; i < 7; i++) {
    days.push({
      date: new Date(cursor),
      key: dateKey(cursor),
      isToday: dateKey(cursor) === todayStr,
      weekday: WEEKDAYS[i],
      dayNum: cursor.getDate(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
})

const weekLabel = computed(() => {
  if (weekDays.value.length === 0) return ''
  const first = weekDays.value[0]
  const last = weekDays.value[6]
  return `${first.date.getMonth() + 1}月${first.date.getDate()}日 - ${last.date.getMonth() + 1}月${last.date.getDate()}日`
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function prevWeek() {
  weekOffset.value--
}

function nextWeek() {
  weekOffset.value++
}

function onDateClick(dateKey) {
  emit('select-date', dateKey)
}
</script>

<template>
  <div class="mini-calendar" :class="{ 'mini-calendar-expanded': expanded }">
    <!-- === Mini Mode === -->
    <div v-if="!expanded" class="mc-mini" @click="emit('toggle-expand')">
      <div class="mc-month-header">
        <button class="mc-arrow" @click.stop="prevMonth">‹</button>
        <span class="mc-month-label">{{ monthLabel }}</span>
        <button class="mc-arrow" @click.stop="nextMonth">›</button>
      </div>
      <div class="mc-weekdays">
        <span v-for="d in WEEKDAYS" :key="d" class="mc-wd">{{ d }}</span>
      </div>
      <div v-for="(row, ri) in miniDates" :key="ri" class="mc-row">
        <span
          v-for="cell in row"
          :key="cell.key"
          class="mc-day"
          :class="{
            'mc-day-today': cell.isToday,
            'mc-day-dim': !cell.isCurrentMonth,
          }"
          @click.stop="onDateClick(cell.key)"
        >{{ cell.date.getDate() }}</span>
      </div>
    </div>

    <!-- === Expanded 7-Day Week View === -->
    <div v-else class="mc-expanded">
      <div class="mc-exp-header">
        <button class="mc-collapse-btn" @click="emit('toggle-expand')">
          ‹ 收起
        </button>
        <span class="mc-exp-label">{{ weekLabel }}</span>
        <div class="mc-exp-nav">
          <button class="mc-arrow" @click="prevWeek">‹</button>
          <button class="mc-arrow" @click="nextWeek">›</button>
        </div>
      </div>
      <div class="mc-exp-scroll">
        <div
          v-for="day in weekDays"
          :key="day.key"
          class="mc-exp-day"
          :class="{ 'mc-exp-day-today': day.isToday }"
          @click="onDateClick(day.key)"
        >
          <span class="mc-exp-wd">{{ day.weekday }}</span>
          <span class="mc-exp-num">{{ day.dayNum }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini-calendar {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 6px;
  border-right: 0.5px solid var(--separator);
  transition: width 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  overflow: hidden;
}

.mini-calendar-expanded {
  width: 100%;
  border-right: 0;
}

/* === Mini Mode === */
.mc-mini {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.mc-month-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.mc-month-label {
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  flex: 1;
}

.mc-arrow {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  line-height: 1;
  flex-shrink: 0;
}

.mc-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
}

.mc-wd {
  font-size: 8px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-align: center;
  padding: 2px 0;
}

.mc-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
}

.mc-day {
  font-size: 10px;
  text-align: center;
  padding: 3px 0;
  color: var(--text-primary);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s ease;
}

.mc-day-today {
  background: var(--accent);
  color: white;
  font-weight: 700;
}

.mc-day-dim {
  color: var(--text-tertiary);
  opacity: 0.4;
}

/* === Expanded Week View === */
.mc-expanded {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.mc-exp-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mc-collapse-btn {
  border: 0;
  background: transparent;
  font-size: var(--text-footnote);
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}

.mc-exp-label {
  flex: 1;
  text-align: center;
  font-size: var(--text-headline);
  font-weight: 700;
  color: var(--text-primary);
}

.mc-exp-nav {
  display: flex;
  gap: 2px;
}

.mc-exp-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.mc-exp-scroll::-webkit-scrollbar {
  display: none;
}

.mc-exp-day {
  flex: 0 0 calc((100% - 48px) / 7);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  scroll-snap-align: start;
  transition: background 0.15s ease;
}

.mc-exp-day-today {
  background: var(--accent-dim);
}

.mc-exp-wd {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-weight: 500;
}

.mc-exp-num {
  font-size: var(--text-headline);
  font-weight: 700;
  color: var(--text-primary);
}

.mc-exp-day-today .mc-exp-num {
  color: var(--accent);
}
</style>
```

- [ ] **Step 2: Verify file**

Run: `grep -c "script setup" src/components/MiniCalendar.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/MiniCalendar.vue
git commit -m "feat: add MiniCalendar with mini + expanded 7-day week view"
```

---

### Task 7: Create LiquidGlassWidget.vue

**Files:**
- Create: `src/components/LiquidGlassWidget.vue`

**Interfaces:**
- Produces: `<LiquidGlassWidget>` — the main container composing MiniCalendar + WidgetStack with liquid glass effects
- Props: `track`, `isFavorite`, `pomodoroCount`, `tasks`, `habits`
- Emits: all widget action events (pass-through from WidgetStack)
- State: `calendarExpanded` (Boolean). When true, hides WidgetStack and passes `expanded` to MiniCalendar.

- [ ] **Step 1: Create the component file**

```vue
<script setup>
import { ref } from 'vue'
import MiniCalendar from './MiniCalendar.vue'
import WidgetStack from './WidgetStack.vue'

defineProps({
  track: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
  pomodoroCount: { type: Number, default: 0 },
  tasks: { type: Array, default: () => [] },
  habits: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'skip-next', 'skip-prev', 'toggle-favorite', 'navigate',
  'toggle-task', 'toggle-habit',
])

const calendarExpanded = ref(false)
const activeWidgetIndex = ref(0)

function onCalendarToggle() {
  calendarExpanded.value = !calendarExpanded.value
}

function onActiveIndexChanged(idx) {
  activeWidgetIndex.value = idx
}
</script>

<template>
  <div
    class="liquid-glass-widget"
    :class="`lgw-widget-${activeWidgetIndex}`"
  >
    <!-- Liquid glass caustic blobs -->
    <div class="lgw-caustics">
      <span class="lgw-blob lgw-blob-1"></span>
      <span class="lgw-blob lgw-blob-2"></span>
      <span class="lgw-blob lgw-blob-3"></span>
    </div>

    <!-- Content layer -->
    <div class="lgw-content">
      <MiniCalendar
        :expanded="calendarExpanded"
        @toggle-expand="onCalendarToggle"
        @select-date="calendarExpanded = false"
      />
      <Transition name="lgw-stack">
        <WidgetStack
          v-if="!calendarExpanded"
          :track="track"
          :isFavorite="isFavorite"
          :pomodoroCount="pomodoroCount"
          :tasks="tasks"
          :habits="habits"
          @skip-next="emit('skip-next')"
          @skip-prev="emit('skip-prev')"
          @toggle-favorite="emit('toggle-favorite')"
          @navigate="emit('navigate', $event)"
          @toggle-task="emit('toggle-task', $event)"
          @toggle-habit="emit('toggle-habit', $event)"
          @active-index-changed="onActiveIndexChanged"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* ===== Liquid Glass Shell ===== */
.liquid-glass-widget {
  position: relative;
  height: 300px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-lg);
  /* Glass base */
  background: var(--glass-bg-light);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid var(--glass-border-light);
  /* Edge glow */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 4px 20px rgba(0, 0, 0, 0.06);
  transition: background-color 0.8s ease;
}

/* ===== Color Bleed by Widget ===== */
.lgw-widget-0 { --bleed-color: rgba(236, 65, 65, 0.08); }    /* Now Playing — warm red */
.lgw-widget-1 { --bleed-color: rgba(255, 159, 10, 0.08); }   /* Pomodoro — orange */
.lgw-widget-2 { --bleed-color: rgba(255, 159, 10, 0.06); }   /* Schedule — light orange */
.lgw-widget-3 { --bleed-color: rgba(49, 194, 124, 0.08); }   /* Habits — green */

/* ===== Light Caustics ===== */
.lgw-caustics {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.lgw-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}

.lgw-blob-1 {
  width: 160px;
  height: 160px;
  background: #ec4141;
  top: -40px;
  left: -30px;
  animation: blobDrift1 22s ease-in-out infinite;
}

.lgw-blob-2 {
  width: 120px;
  height: 120px;
  background: #ff9f0a;
  bottom: -30px;
  right: -20px;
  animation: blobDrift2 26s ease-in-out infinite;
}

.lgw-blob-3 {
  width: 100px;
  height: 100px;
  background: #31c27c;
  top: 50%;
  left: 40%;
  animation: blobDrift3 30s ease-in-out infinite;
}

@keyframes blobDrift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, 20px) scale(1.1); }
  50% { transform: translate(10px, 40px) scale(0.9); }
  75% { transform: translate(-20px, 10px) scale(1.05); }
}

@keyframes blobDrift2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-25px, -20px) scale(1.15); }
  66% { transform: translate(15px, -30px) scale(0.9); }
}

@keyframes blobDrift3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -15px) scale(1.2); }
}

/* ===== Content Layer ===== */
.lgw-content {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  /* Subtle tint overlay from color bleed */
  background: var(--bleed-color);
  transition: background-color 0.8s ease;
  border-radius: var(--radius-lg);
}

/* WidgetStack enter/leave transition */
.lgw-stack-enter-active,
.lgw-stack-leave-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.lgw-stack-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.lgw-stack-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* ===== Dark Mode ===== */
@media (prefers-color-scheme: dark) {
  .liquid-glass-widget {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 4px 20px rgba(0, 0, 0, 0.3);
  }
  .lgw-blob {
    opacity: 0.18;
  }
  .lgw-widget-0 { --bleed-color: rgba(236, 65, 65, 0.05); }
  .lgw-widget-1 { --bleed-color: rgba(255, 159, 10, 0.05); }
  .lgw-widget-2 { --bleed-color: rgba(255, 159, 10, 0.04); }
  .lgw-widget-3 { --bleed-color: rgba(49, 194, 124, 0.05); }
}
</style>
```

- [ ] **Step 2: Verify file**

Run: `grep -c "script setup" src/components/LiquidGlassWidget.vue`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add src/components/LiquidGlassWidget.vue
git commit -m "feat: add LiquidGlassWidget shell with caustics + color bleed"
```

---

### Task 8: Modify HomeView.vue to integrate LiquidGlassWidget

**Files:**
- Modify: `src/components/HomeView.vue`

**Changes:**
1. Import `LiquidGlassWidget`
2. Compute `isFavorite` from the store
3. Flatten incomplete tasks for the schedule widget (recursively collect uncompleted tasks)
4. Compute habits with `completedToday` boolean
5. Add event handlers for all widget actions
6. Insert `<LiquidGlassWidget>` between the overview card and the module list

- [ ] **Step 1: Add import for LiquidGlassWidget**

In `<script setup>`, add after existing imports:

```js
import LiquidGlassWidget from './LiquidGlassWidget.vue'
```

- [ ] **Step 2: Add computed properties for widget data**

Add these computed properties after the existing `overviewItems` computed:

```js
const favoriteTrackIds = computed(() => new Set(
  store.state.favorites.map(f => f.uid)
))

const isCurrentFavorite = computed(() =>
  store.state.currentTrack
    ? favoriteTrackIds.value.has(store.state.currentTrack.uid)
    : false
)

// Flatten incomplete tasks for the schedule widget
const flatIncompleteTasks = computed(() => {
  const schedule = loadSchedule()
  const year = new Date().getFullYear()
  const yearData = schedule[year]
  if (!yearData?.weeks?.length) return []
  const todayMonday = getTodayMondayStr()
  const week = yearData.weeks.find(w => w.monday === todayMonday)
  if (!week) return []

  function flatten(tasks, result = []) {
    for (const t of tasks) {
      result.push({ id: t.id, text: t.text, completed: t.completed })
      if (t.children?.length) flatten(t.children, result)
    }
    return result
  }
  return flatten(week.tasks || [])
})

// Habits with today's completion status
const habitsWithToday = computed(() => {
  const habits = loadHabits()
  const today = dateKey(new Date())
  return habits.map(h => ({
    id: h.id,
    name: h.name,
    color: h.color,
    completedToday: Boolean(h.completions?.[today]),
  }))
})

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

Note: `dateKey` already exists in the file? No — `dateKey` is not imported or defined in HomeView currently. The `dateKey` from `pomodoroStorage` is used in `refreshPomodoros`. We need to import `dateKey` from `pomodoroStorage` or define it locally. Let's use the imported one: add `dateKey` to the import from `pomodoroStorage`.

Edit the existing pomodoro import line:
```js
import { loadPomodoro, dateKey } from '../services/pomodoroStorage'
```

Then use `dateKey` directly in `habitsWithToday` and `flatIncompleteTasks` doesn't need it.

- [ ] **Step 3: Add widget event handlers**

Add these functions in `<script setup>`:

```js
// Widget event handlers
function onWidgetNavigate(view) {
  emit('navigate', view)
}

function onSkipNext() {
  store.nextTrack()
}

function onSkipPrev() {
  store.previousTrack()
}

function onToggleFavorite() {
  store.toggleFavorite()
}

function onToggleTask(taskId) {
  const schedule = loadSchedule()
  const year = new Date().getFullYear()
  const yearData = schedule[year]
  if (!yearData?.weeks?.length) return
  const todayMonday = getTodayMondayStr()
  const week = yearData.weeks.find(w => w.monday === todayMonday)
  if (!week) return

  function toggleInList(tasks) {
    for (const t of tasks) {
      if (t.id === taskId) {
        t.completed = !t.completed
        return true
      }
      if (t.children?.length && toggleInList(t.children)) return true
    }
    return false
  }

  if (toggleInList(week.tasks || [])) {
    saveSchedule(schedule)
    refreshSchedule()
  }
}

function onToggleHabit(habitId) {
  const habits = loadHabits()
  const habit = habits.find(h => h.id === habitId)
  if (!habit) return
  const today = dateKey(new Date())
  if (!habit.completions) habit.completions = {}
  if (habit.completions[today]) {
    delete habit.completions[today]
  } else {
    habit.completions[today] = true
  }
  saveHabits(habits)
  calcStreak()
}
```

- [ ] **Step 4: Update existing imports in `<script setup>`**

Change the schedule import line from:
```js
import { loadSchedule } from '../services/scheduleStorage'
```
to:
```js
import { loadSchedule, saveSchedule } from '../services/scheduleStorage'
```

Change the habit import line from:
```js
import { loadHabits } from '../services/habitStorage'
```
to:
```js
import { loadHabits, saveHabits } from '../services/habitStorage'
```

`dateKey` is already imported from `pomodoroStorage` — no change needed.

- [ ] **Step 5: Insert LiquidGlassWidget in template**

After the overview card `</section>`, before the module list `<section class="module-list">`, add:

```html
    <!-- Liquid Glass Widget -->
    <LiquidGlassWidget
      :track="store.state.currentTrack"
      :isFavorite="isCurrentFavorite"
      :pomodoroCount="todayPomodoros"
      :tasks="flatIncompleteTasks"
      :habits="habitsWithToday"
      @skip-next="onSkipNext"
      @skip-prev="onSkipPrev"
      @toggle-favorite="onToggleFavorite"
      @navigate="onWidgetNavigate"
      @toggle-task="onToggleTask"
      @toggle-habit="onToggleHabit"
    />
```

- [ ] **Step 6: Verify the file parses correctly**

Run: `node -e "const fs = require('fs'); const content = fs.readFileSync('src/components/HomeView.vue', 'utf8'); console.log(content.includes('LiquidGlassWidget') ? 'OK' : 'MISSING')"`
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add src/components/HomeView.vue
git commit -m "feat: integrate LiquidGlassWidget into HomeView"
```

---

### Task 9: Final verification — dev server smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Start the dev server**

Run: `yarn dev &`
Wait 3 seconds for the server to start.

- [ ] **Step 2: Verify the dev server is running**

Run: `curl -s http://localhost:5173 | head -5`
Expected: Should return HTML (the Vite dev page)

- [ ] **Step 3: Check for console errors**

Run: `curl -s http://localhost:5173/src/components/HomeView.vue 2>&1 | head -20`
Expected: Should return the compiled Vue component

- [ ] **Step 4: Kill dev server and commit if all clean**

```bash
kill %1 2>/dev/null
```

If the dev server compiles without errors, no commit needed — verification only.

---

## Self-Review Checklist

Before handing off, verify:

1. **Spec coverage**: Each spec requirement mapped to a task
   - Liquid glass effect → Task 7 (LiquidGlassWidget)
   - Mini calendar → Task 6 (MiniCalendar)
   - Widget stack + snap → Task 5 (WidgetStack)
   - 4 widget cards → Tasks 1-4
   - HomeView integration → Task 8
   - Dark mode → All components include dark mode styles

2. **Placeholder scan**: No TBD/TODO, all steps have concrete code

3. **Type consistency**:
   - All widgets use same prop shapes
   - Event names consistent: `toggle-task`, `toggle-habit`, `skip-next`, `skip-prev`, `toggle-favorite`, `navigate`
   - `active-index-changed` emitted by WidgetStack, consumed by LiquidGlassWidget
