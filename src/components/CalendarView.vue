<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  loadCalendarData, saveCalendarData, addEvent, updateEvent, deleteEvent,
  addCalendar, deleteCalendar, updateCalendar, expandRecurringEvents,
  exportICS, importICS, generateUID,
} from '../services/calendarStorage'
import MonthGrid from './calendar/MonthGrid.vue'
import WeekView from './calendar/WeekView.vue'
import DayView from './calendar/DayView.vue'
import EventSheet from './calendar/EventSheet.vue'
import CalendarList from './calendar/CalendarList.vue'

const emit = defineEmits(['back'])

const data = ref(loadCalendarData())
const currentView = ref('month')
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const weekStart = ref(mondayOf(selectedDate.value))
const sheetVisible = ref(false)
const editingEvent = ref(null)
const showCalendarList = ref(false)
const searchQuery = ref('')

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value + 1}月`)

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  const q = searchQuery.value.toLowerCase()
  return data.value.events.filter(e => e.title.toLowerCase().includes(q))
})

function onSelectDate(dateStr) {
  selectedDate.value = dateStr
  currentView.value = 'day'
}

function onSelectEvent(evt) {
  editingEvent.value = evt
  sheetVisible.value = true
}

function onNewEvent(dateStr, hour) {
  editingEvent.value = null
  sheetVisible.value = true
  // Pre-fill will be handled by EventSheet watch
}

function onSaveEvent(evt) {
  if (editingEvent.value?.id && data.value.events.find(e => e.id === editingEvent.value.id)) {
    updateEvent(data.value, editingEvent.value.id, evt)
  } else {
    addEvent(data.value, evt)
  }
  sheetVisible.value = false
  editingEvent.value = null
}

function onDeleteEvent(id) {
  deleteEvent(data.value, id)
  sheetVisible.value = false
  editingEvent.value = null
}

function onAddCalendar({ name, color }) {
  addCalendar(data.value, { id: generateUID('cal'), name, color })
}

function onDeleteCalendar(id) {
  deleteCalendar(data.value, id)
}

function onImport(e) {
  const file = e.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const count = importICS(data.value, reader.result)
    if (count) data.value = loadCalendarData() // refresh
  }
  reader.readAsText(file)
}

function onExport() {
  const ics = exportICS(data.value)
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'zmux-calendar.ics'; a.click()
  URL.revokeObjectURL(url)
}

function prevMonth() {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
  else currentMonth.value--
}
function nextMonth() {
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
  else currentMonth.value++
}
function today() {
  const now = new Date()
  currentYear.value = now.getFullYear()
  currentMonth.value = now.getMonth()
  selectedDate.value = now.toISOString().slice(0, 10)
  weekStart.value = mondayOf(selectedDate.value)
  currentView.value = 'month'
}
function prevDay() { selectedDate.value = shiftDate(selectedDate.value, -1) }
function nextDay() { selectedDate.value = shiftDate(selectedDate.value, 1) }
function shiftDate(d, n) { const nd = new Date(d + 'T00:00:00'); nd.setDate(nd.getDate() + n); return nd.toISOString().slice(0, 10) }

watch(selectedDate, () => { weekStart.value = mondayOf(selectedDate.value) })
</script>

<template>
  <div class="calendar-view">
    <!-- Top Bar -->
    <header class="cv-top-bar">
      <button class="cv-back" @click="emit('back')">←</button>
      <h1>日历管理</h1>
      <button class="cv-list-btn" @click="showCalendarList = !showCalendarList">☰</button>
    </header>

    <!-- Search -->
    <input v-model="searchQuery" class="cv-search" placeholder="搜索事件…" />
    <div v-if="searchQuery && searchResults.length" class="cv-search-results">
      <button v-for="e in searchResults" :key="e.id" class="cv-sr-item" @click="onSelectEvent(e); searchQuery = ''">
        <span class="cv-sr-dot" :style="{ background: data.calendars.find(c=>c.id===e.calendarId)?.color }"></span>
        <span>{{ e.title }}</span>
        <span class="cv-sr-date">{{ e.start?.slice(0,10) }}</span>
      </button>
    </div>

    <!-- View Switcher -->
    <div class="cv-switcher">
      <button v-for="v in ['month','week','day']" :key="v"
        class="cv-sw-btn" :class="{ active: currentView === v }"
        @click="currentView = v">{{ {month:'月',week:'周',day:'日'}[v] }}</button>
    </div>

    <!-- Calendar List sidebar -->
    <CalendarList v-if="showCalendarList"
      :calendars="data.calendars"
      @add="onAddCalendar" @delete="onDeleteCalendar"
      @export="onExport" @import="onImport"
      @settings="(p) => { Object.assign(data.settings, p); saveCalendarData(data) }" />

    <!-- Month Navigation -->
    <div v-if="currentView === 'month'" class="cv-nav">
      <button @click="prevMonth">‹</button>
      <span>{{ monthLabel }}</span>
      <button @click="nextMonth">›</button>
      <button class="cv-today" @click="today">今天</button>
    </div>
    <MonthGrid v-if="currentView === 'month'"
      :data="data" :year="currentYear" :month="currentMonth"
      @select-date="onSelectDate" @select-event="onSelectEvent" @new-event="onNewEvent" />

    <!-- Day Navigation -->
    <div v-if="currentView === 'day'" class="cv-nav">
      <button @click="prevDay">‹</button>
      <span>{{ selectedDate }}</span>
      <button @click="nextDay">›</button>
      <button class="cv-today" @click="today">今天</button>
    </div>
    <DayView v-if="currentView === 'day'"
      :data="data" :date="selectedDate"
      @select-event="onSelectEvent" @new-event="onNewEvent" />

    <!-- Week View -->
    <WeekView v-if="currentView === 'week'"
      :data="data" :weekStart="weekStart"
      @select-date="onSelectDate" @select-event="onSelectEvent" @new-event="onNewEvent" />

    <!-- Add button -->
    <button class="cv-fab" @click="onNewEvent(selectedDate)">+</button>

    <!-- Event Sheet -->
    <EventSheet
      :visible="sheetVisible" :event="editingEvent" :data="data"
      @close="sheetVisible = false" @save="onSaveEvent" @delete="onDeleteEvent" />
  </div>
</template>

<style scoped>
.calendar-view { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-canvas); }
.cv-top-bar { flex-shrink: 0; display: flex; align-items: center; gap: 14px; padding: 14px 18px 10px; }
.cv-back { width: 34px; height: 34px; border: 0; border-radius: 999px; background: rgba(118,118,128,0.1); color: var(--text-secondary); font-size: 16px; cursor: pointer; display: grid; place-items: center; }
.cv-top-bar h1 { margin: 0; font-size: 22px; font-weight: 800; flex: 1; }
.cv-list-btn { border: 0; background: none; font-size: 20px; cursor: pointer; color: var(--text-secondary); }
.cv-search { margin: 0 18px 8px; padding: 8px 12px; border: 0; border-radius: var(--radius-sm); background: var(--separator); font-size: var(--text-body); color: var(--text-primary); }
.cv-search-results { margin: 0 18px 8px; max-height: 200px; overflow-y: auto; }
.cv-sr-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; border: 0; background: none; text-align: left; cursor: pointer; font-size: var(--text-body); color: var(--text-primary); }
.cv-sr-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cv-sr-date { margin-left: auto; font-size: var(--text-caption); color: var(--text-tertiary); }
.cv-switcher { display: flex; margin: 0 18px 8px; border-radius: var(--radius-sm); background: var(--separator); padding: 2px; }
.cv-sw-btn { flex: 1; padding: 6px; border: 0; border-radius: 8px; background: transparent; font-size: var(--text-footnote); font-weight: 600; color: var(--text-secondary); cursor: pointer; text-align: center; }
.cv-sw-btn.active { background: var(--bg-card); color: var(--text-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.cv-nav { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 18px; flex-shrink: 0; }
.cv-nav button { border: 0; background: none; font-size: 20px; color: var(--accent); cursor: pointer; }
.cv-nav span { font-size: var(--text-headline); font-weight: 700; color: var(--text-primary); min-width: 140px; text-align: center; }
.cv-today { font-size: var(--text-footnote) !important; }
.cv-fab { position: absolute; bottom: 100px; right: 20px; width: 48px; height: 48px; border-radius: 50%; border: 0; background: var(--accent); color: white; font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(236,65,65,0.4); z-index: 10; }
</style>
