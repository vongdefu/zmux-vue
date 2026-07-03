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
