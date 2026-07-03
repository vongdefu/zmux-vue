# Calendar Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a full-featured calendar management page with month/week/day views, event CRUD, recurring events, and .ics import/export.

**Architecture:** Bottom-up build. Foundation layer (`calendarStorage.js`) first, then leaf components (MonthGrid, WeekView, DayView, MiniEventCard, EventSheet, CalendarList), then compose in CalendarView, finally wire App.vue + HomeView. All data via localStorage key `zmux-calendar-v1`.

**Tech Stack:** Vue 3 Composition API, CSS Grid (month), CSS time-axis layout (week/day), localStorage persistence, iCalendar RFC 5545 subset for .ics

## Global Constraints

- All styles reference existing `var(--*)` tokens from `tokens.css`
- No new npm dependencies
- Does NOT modify or remove existing ScheduleView
- Navigation: HomeView module list → `emit('navigate', 'calendar')` → App.vue `currentView = 'calendar'`
- CalendarView emits `back` to return to home
- Default week starts on Monday (weekStartsOn: 1)

---

### Task 1: Create calendarStorage.js (Data Layer)

**Files:**
- Create: `src/services/calendarStorage.js`

**Interfaces:**
- Produces: `loadCalendarData()`, `saveCalendarData(data)`, `addEvent(event)`, `updateEvent(id, patch)`, `deleteEvent(id)`, `addCalendar(cal)`, `updateCalendar(id, patch)`, `deleteCalendar(id)`, `updateSettings(patch)`, `getEventsForDate(date)`, `expandRecurringEvents(from, to)`, `exportICS()`, `importICS(icsString)`, `generateUID()`, `DEFAULT_CALENDARS`, `CALENDAR_COLORS`

- [ ] **Step 1: Create the service file**

```js
// src/services/calendarStorage.js
const STORAGE_KEY = 'zmux-calendar-v1'

export const CALENDAR_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30',
  '#AF52DE', '#5AC8FA', '#FF6482', '#5856D6',
]

export const DEFAULT_CALENDARS = [
  { id: 'cal-default-work', name: '工作', color: '#007AFF' },
  { id: 'cal-default-personal', name: '个人', color: '#34C759' },
  { id: 'cal-default-family', name: '家庭', color: '#FF9500' },
  { id: 'cal-default-important', name: '重要', color: '#FF3B30' },
]

function getDefaultData() {
  return {
    calendars: DEFAULT_CALENDARS.map(c => ({ ...c })),
    events: [],
    settings: {
      weekStartsOn: 1,
      defaultCalendarId: 'cal-default-work',
    },
  }
}

export function loadCalendarData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const data = JSON.parse(raw)
    return {
      calendars: data.calendars || [],
      events: data.events || [],
      settings: { ...getDefaultData().settings, ...data.settings },
    }
  } catch {
    return getDefaultData()
  }
}

export function saveCalendarData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function generateUID(prefix = 'evt') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

// --- Calendar CRUD ---

export function addCalendar(data, cal) {
  data.calendars.push(cal)
  saveCalendarData(data)
}

export function updateCalendar(data, id, patch) {
  const cal = data.calendars.find(c => c.id === id)
  if (cal) Object.assign(cal, patch)
  saveCalendarData(data)
}

export function deleteCalendar(data, id) {
  if (data.calendars.length <= 1) return false
  data.calendars = data.calendars.filter(c => c.id !== id)
  // Reassign events from deleted calendar to first remaining
  const fallbackId = data.calendars[0].id
  data.events.forEach(e => { if (e.calendarId === id) e.calendarId = fallbackId })
  saveCalendarData(data)
  return true
}

// --- Event CRUD ---

export function addEvent(data, event) {
  data.events.push(event)
  saveCalendarData(data)
}

export function updateEvent(data, id, patch) {
  const idx = data.events.findIndex(e => e.id === id)
  if (idx >= 0) Object.assign(data.events[idx], patch)
  saveCalendarData(data)
}

export function deleteEvent(data, id) {
  data.events = data.events.filter(e => e.id !== id && !e.id.startsWith(id + '-'))
  saveCalendarData(data)
}

// --- Query ---

export function getEventsForDate(data, dateStr) {
  const instances = expandRecurringEvents(data, dateStr, dateStr)
  return instances.filter(e => {
    const startDay = e.start.slice(0, 10)
    const endDay = e.end.slice(0, 10)
    return dateStr >= startDay && dateStr <= endDay
  }).sort((a, b) => a.start.localeCompare(b.start))
}

function dateKey(d) {
  if (typeof d === 'string') return d.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay()
}

// --- Recurring Event Expansion ---

export function expandRecurringEvents(data, fromStr, toStr) {
  const result = []
  for (const event of data.events) {
    if (!event.recurrence) {
      result.push(event)
      continue
    }
    const rec = event.recurrence
    const endLimit = rec.endDate ? new Date(rec.endDate + 'T23:59:59') : new Date(Date.now() + 365 * 86400000)
    const toLimit = new Date(toStr + 'T23:59:59')
    const limit = endLimit < toLimit ? endLimit : toLimit

    let cursor = new Date(event.start.slice(0, 10) + 'T00:00:00')
    const fromDate = new Date(fromStr + 'T00:00:00')

    while (cursor <= limit) {
      const curStr = dateKey(cursor)
      if (cursor >= fromDate) {
        const origStart = event.start.slice(11)
        const origEnd = event.end.slice(11)
        result.push({
          ...event,
          id: `${event.id}-${curStr}`,
          _originalId: event.id,
          start: `${curStr}${origStart ? 'T' + origStart : ''}`,
          end: `${curStr}${origEnd ? 'T' + origEnd : ''}`,
        })
      }

      // Advance cursor based on recurrence type
      switch (rec.type) {
        case 'daily':
          cursor.setDate(cursor.getDate() + (rec.interval || 1))
          break
        case 'weekly':
          cursor.setDate(cursor.getDate() + 7 * (rec.interval || 1))
          break
        case 'monthly':
          cursor.setMonth(cursor.getMonth() + (rec.interval || 1))
          break
        case 'yearly':
          cursor.setFullYear(cursor.getFullYear() + (rec.interval || 1))
          break
        default:
          cursor.setDate(cursor.getDate() + 1)
      }
    }
  }
  return result
}

// --- ICS Export ---

function escapeICS(text) {
  return (text || '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n')
}

function fmtICSDate(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function exportICS(data) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//zmux//Calendar//CN']
  for (const event of data.events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}`)
    lines.push(`DTSTART:${fmtICSDate(event.start)}`)
    lines.push(`DTEND:${fmtICSDate(event.end)}`)
    lines.push(`SUMMARY:${escapeICS(event.title)}`)
    if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`)
    if (event.notes) lines.push(`DESCRIPTION:${escapeICS(event.notes)}`)
    if (event.recurrence) {
      const r = event.recurrence
      const freq = r.type.toUpperCase().slice(0, 2) + r.type.slice(1) // daily -> DAILY
      lines.push(`RRULE:FREQ=${freq};INTERVAL=${r.interval || 1}`)
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// --- ICS Import (basic) ---

export function importICS(data, icsString) {
  const events = []
  const blocks = icsString.split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const get = (prop) => {
      const re = new RegExp(`^${prop}[;:](.+)$`, 'im')
      const m = block.match(re)
      return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n') : ''
    }
    const dtStart = get('DTSTART')
    const dtEnd = get('DTEND')
    if (!dtStart || !get('SUMMARY')) continue

    const parseDT = (s) => {
      if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
      return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}`
    }

    events.push({
      id: generateUID(),
      calendarId: data.calendars[0]?.id || 'cal-default-work',
      title: get('SUMMARY'),
      location: get('LOCATION'),
      notes: get('DESCRIPTION'),
      start: parseDT(dtStart),
      end: parseDT(dtEnd || dtStart),
      allDay: dtStart.length === 8,
      recurrence: null,
      invitees: [],
      attachments: [],
      alerts: [],
    })
  }
  for (const e of events) data.events.push(e)
  saveCalendarData(data)
  return events.length
}
```

- [ ] **Step 2: Verify file**

Run: `grep -c "function" src/services/calendarStorage.js`
Expected: `14`

- [ ] **Step 3: Commit**

```bash
git add src/services/calendarStorage.js
git commit -m "feat: add calendarStorage data layer"
```

---

### Task 2: Create MiniEventCard.vue

**Files:**
- Create: `src/components/calendar/MiniEventCard.vue`

**Interfaces:**
- Props: `event` (Object), `calendars` (Array)
- Emits: `click` (payload: event object)
- Produces: Tiny colored dot + truncated title label for month grid cells

- [ ] **Step 1: Create component**

```vue
<script setup>
const props = defineProps({
  event: { type: Object, required: true },
  calendars: { type: Array, default: () => [] },
})

const emit = defineEmits(['click'])

const cal = calendars.length
  ? calendars.find(c => c.id === props.event.calendarId)
  : null

const dotColor = cal?.color || '#007AFF'
</script>

<template>
  <button class="mini-event" :style="{ '--dot': dotColor }" @click.stop="emit('click', event)">
    <span class="me-dot"></span>
    <span class="me-title">{{ event.title }}</span>
  </button>
</template>

<style scoped>
.mini-event {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 2px 4px;
  border: 0;
  border-radius: 3px;
  background: color-mix(in srgb, var(--dot) 15%, transparent);
  cursor: pointer;
  text-align: left;
  overflow: hidden;
}
.me-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--dot);
  flex-shrink: 0;
}
.me-title {
  font-size: 10px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/MiniEventCard.vue
git commit -m "feat: add MiniEventCard component"
```

---

### Task 3: Create MonthGrid.vue

**Files:**
- Create: `src/components/calendar/MonthGrid.vue`

**Interfaces:**
- Consumes: `MiniEventCard`, `calendarStorage.getEventsForDate`
- Props: `data` (Object — the full calendar data), `year` (Number), `month` (Number, 0-11)
- Emits: `select-date(dateStr)`, `select-event(event)`, `new-event(dateStr)`
- Produces: 6×7 month grid with event dots

- [ ] **Step 1: Create component**

```vue
<script setup>
import { computed } from 'vue'
import { getEventsForDate } from '../../services/calendarStorage'
import MiniEventCard from './MiniEventCard.vue'

const props = defineProps({
  data: { type: Object, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
})

const emit = defineEmits(['select-date', 'select-event', 'new-event'])

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

const weekStartsOn = computed(() => props.data.settings?.weekStartsOn ?? 1)

const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']

const headerDays = computed(() => {
  const arr = []
  for (let i = 0; i < 7; i++) {
    arr.push(WEEKDAYS_SHORT[(weekStartsOn.value + i) % 7])
  }
  return arr
})

const weeks = computed(() => {
  const firstDay = new Date(props.year, props.month, 1)
  const startDayOfWeek = firstDay.getDay()
  // Calculate offset to the first displayed day based on weekStartsOn
  let offset = startDayOfWeek - weekStartsOn.value
  if (offset < 0) offset += 7
  const startDate = new Date(props.year, props.month, 1 - offset)

  const rows = []
  const cursor = new Date(startDate)
  for (let r = 0; r < 6; r++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`
      row.push({
        dateKey,
        dayNum: cursor.getDate(),
        isToday: dateKey === todayStr,
        isCurrentMonth: cursor.getMonth() === props.month,
        events: getEventsForDate(props.data, dateKey).slice(0, 3),
        totalEvents: getEventsForDate(props.data, dateKey).length,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    rows.push(row)
  }
  return rows
})
</script>

<template>
  <div class="month-grid">
    <div class="mg-header">
      <span v-for="d in headerDays" :key="d" class="mg-hd">{{ d }}</span>
    </div>
    <div v-for="(row, ri) in weeks" :key="ri" class="mg-row">
      <div
        v-for="cell in row" :key="cell.dateKey"
        class="mg-cell"
        :class="{ 'mg-other-month': !cell.isCurrentMonth }"
        @click="emit('select-date', cell.dateKey)"
      >
        <span class="mg-day" :class="{ 'mg-today': cell.isToday }">{{ cell.dayNum }}</span>
        <div v-if="cell.events.length" class="mg-events">
          <MiniEventCard
            v-for="evt in cell.events" :key="evt.id"
            :event="evt" :calendars="data.calendars"
            @click="emit('select-event', $event)"
          />
          <span v-if="cell.totalEvents > 3" class="mg-more">+{{ cell.totalEvents - 3 }}</span>
        </div>
        <button class="mg-add" @click.stop="emit('new-event', cell.dateKey)">+</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-grid { display: flex; flex-direction: column; gap: 0; }
.mg-header { display: grid; grid-template-columns: repeat(7, 1fr); }
.mg-hd {
  text-align: center; font-size: var(--text-caption);
  font-weight: 600; color: var(--text-tertiary); padding: 6px 0;
}
.mg-row { display: grid; grid-template-columns: repeat(7, 1fr); }
.mg-cell {
  min-height: 80px; border-right: 0.5px solid var(--separator);
  border-bottom: 0.5px solid var(--separator); padding: 4px;
  display: flex; flex-direction: column; gap: 1px; cursor: pointer;
  position: relative;
}
.mg-cell:nth-child(7n) { border-right: 0; }
.mg-other-month { opacity: 0.35; }
.mg-day { font-size: 12px; font-weight: 500; color: var(--text-primary); line-height: 1; }
.mg-today {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent); color: white; font-weight: 700;
}
.mg-events { display: flex; flex-direction: column; gap: 1px; flex: 1; overflow: hidden; }
.mg-more { font-size: 9px; color: var(--text-tertiary); padding-left: 10px; }
.mg-add {
  position: absolute; top: 2px; right: 2px;
  width: 18px; height: 18px; border: 0; border-radius: 50%;
  background: transparent; color: var(--text-tertiary); font-size: 14px;
  cursor: pointer; display: none; align-items: center; justify-content: center;
  opacity: 0;
}
.mg-cell:hover .mg-add { display: flex; opacity: 0.6; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/MonthGrid.vue
git commit -m "feat: add MonthGrid component"
```

---

### Task 4: Create WeekView.vue and DayView.vue

**Files:**
- Create: `src/components/calendar/WeekView.vue`
- Create: `src/components/calendar/DayView.vue`

Since WeekView and DayView share the same time-axis logic, DayView is a specialized single-day version.

**Interfaces (WeekView):**
- Props: `data`, `weekStart` (String 'YYYY-MM-DD'), `weekStartsOn` (Number)
- Emits: `select-date`, `select-event`, `new-event(dateStr, hour)`

**Interfaces (DayView):**
- Props: `data`, `date` (String 'YYYY-MM-DD')
- Emits: `select-event`, `new-event(dateStr, hour)`

- [ ] **Step 1: Create WeekView.vue**

```vue
<script setup>
import { computed } from 'vue'
import { getEventsForDate } from '../../services/calendarStorage'

const props = defineProps({
  data: { type: Object, required: true },
  weekStart: { type: String, required: true },
})

const emit = defineEmits(['select-date', 'select-event', 'new-event'])

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const days = computed(() => {
  const result = []
  const start = new Date(props.weekStart + 'T00:00:00')
  const todayStr = new Date().toISOString().slice(0, 10)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dk = d.toISOString().slice(0, 10)
    result.push({
      dateKey: dk,
      dayNum: d.getDate(),
      weekday: ['日','一','二','三','四','五','六'][d.getDay()],
      isToday: dk === todayStr,
      allDayEvents: getEventsForDate(props.data, dk).filter(e => e.allDay),
      timedEvents: getEventsForDate(props.data, dk).filter(e => !e.allDay),
    })
  }
  return result
})

function getEventStyle(evt) {
  const startMin = parseInt(evt.start.slice(11,13)) * 60 + parseInt(evt.start.slice(14,16) || '0')
  const endMin = parseInt(evt.end.slice(11,13)) * 60 + parseInt(evt.end.slice(14,16) || '0')
  const top = (startMin / 60) * 100
  const height = Math.max(((endMin - startMin) / 60) * 100, 2)
  return { top: top + '%', height: height + '%' }
}

function getCalColor(calId) {
  return props.data.calendars.find(c => c.id === calId)?.color || '#007AFF'
}
</script>

<template>
  <div class="week-view">
    <!-- Day headers -->
    <div class="wv-header-row">
      <div class="wv-time-gutter"></div>
      <div v-for="d in days" :key="d.dateKey" class="wv-day-head"
        :class="{ 'wv-today': d.isToday }"
        @click="emit('select-date', d.dateKey)">
        <span class="wv-wd">{{ d.weekday }}</span>
        <span class="wv-dn">{{ d.dayNum }}</span>
      </div>
    </div>
    <!-- All-day strip -->
    <div class="wv-allday-row">
      <div class="wv-time-gutter"></div>
      <div v-for="d in days" :key="d.dateKey" class="wv-allday-cell">
        <span v-for="e in d.allDayEvents" :key="e.id" class="wv-allday-tag"
          :style="{ background: getCalColor(e.calendarId) }"
          @click="emit('select-event', e)">{{ e.title }}</span>
      </div>
    </div>
    <!-- Time grid -->
    <div class="wv-grid-scroll">
      <div class="wv-grid">
        <div class="wv-time-col">
          <span v-for="h in HOURS" :key="h" class="wv-hour">{{ String(h).padStart(2,'0') }}:00</span>
        </div>
        <div v-for="d in days" :key="d.dateKey" class="wv-col"
          @click="emit('new-event', d.dateKey)">
          <div v-for="h in HOURS" :key="h" class="wv-slot"
            @click.stop="emit('new-event', d.dateKey, h)"></div>
          <div v-for="e in d.timedEvents" :key="e.id" class="wv-event"
            :style="{ ...getEventStyle(e), background: getCalColor(e.calendarId) }"
            @click.stop="emit('select-event', e)">
            <span class="wv-ev-title">{{ e.title }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-view { display: flex; flex-direction: column; height: 100%; }
.wv-header-row { display: flex; }
.wv-time-gutter { width: 48px; flex-shrink: 0; }
.wv-day-head {
  flex: 1; text-align: center; padding: 8px 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: center;
}
.wv-today .wv-dn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent); color: white; font-weight: 700;
}
.wv-wd { font-size: var(--text-caption); color: var(--text-tertiary); }
.wv-dn { font-size: var(--text-headline); font-weight: 600; color: var(--text-primary); }
.wv-allday-row { display: flex; border-bottom: 0.5px solid var(--separator); min-height: 28px; }
.wv-allday-cell { flex: 1; padding: 2px; display: flex; flex-wrap: wrap; gap: 2px; }
.wv-allday-tag {
  font-size: 9px; color: white; padding: 1px 4px; border-radius: 3px;
  white-space: nowrap; overflow: hidden; cursor: pointer;
}
.wv-grid-scroll { flex: 1; overflow-y: auto; }
.wv-grid { display: flex; }
.wv-time-col { width: 48px; flex-shrink: 0; display: flex; flex-direction: column; }
.wv-hour { height: 60px; font-size: 9px; color: var(--text-tertiary); text-align: right; padding-right: 6px; }
.wv-col { flex: 1; position: relative; border-left: 0.5px solid var(--separator); }
.wv-slot { height: 60px; border-bottom: 0.5px solid var(--separator); cursor: pointer; }
.wv-event {
  position: absolute; left: 1px; right: 1px; border-radius: 4px;
  padding: 2px 4px; overflow: hidden; cursor: pointer; z-index: 1;
}
.wv-ev-title { font-size: 9px; color: white; font-weight: 600; white-space: nowrap; }
</style>
```

- [ ] **Step 2: Create DayView.vue**

```vue
<script setup>
import { computed } from 'vue'
import { getEventsForDate } from '../../services/calendarStorage'

const props = defineProps({
  data: { type: Object, required: true },
  date: { type: String, required: true },
})

const emit = defineEmits(['select-event', 'new-event'])

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const allDayEvents = computed(() =>
  getEventsForDate(props.data, props.date).filter(e => e.allDay)
)
const timedEvents = computed(() =>
  getEventsForDate(props.data, props.date).filter(e => !e.allDay)
)

function getEventStyle(evt) {
  const startMin = parseInt(evt.start.slice(11,13)) * 60 + parseInt(evt.start.slice(14,16) || '0')
  const endMin = parseInt(evt.end.slice(11,13)) * 60 + parseInt(evt.end.slice(14,16) || '0')
  const topPct = (startMin / 60) * 100
  const hPct = Math.max(((endMin - startMin) / 60) * 100, 2)
  return { top: topPct + '%', height: hPct + '%' }
}

function getCalColor(calId) {
  return props.data.calendars.find(c => c.id === calId)?.color || '#007AFF'
}
</script>

<template>
  <div class="day-view">
    <div class="dv-allday" v-if="allDayEvents.length">
      <span v-for="e in allDayEvents" :key="e.id" class="dv-allday-tag"
        :style="{ background: getCalColor(e.calendarId) }"
        @click="emit('select-event', e)">{{ e.title }}</span>
    </div>
    <div class="dv-grid-scroll">
      <div class="dv-grid">
        <div class="dv-time-col">
          <span v-for="h in HOURS" :key="h" class="dv-hour">{{ String(h).padStart(2,'0') }}:00</span>
        </div>
        <div class="dv-col" @click="emit('new-event', date)">
          <div v-for="h in HOURS" :key="h" class="dv-slot"
            @click.stop="emit('new-event', date, h)"></div>
          <div v-for="e in timedEvents" :key="e.id" class="dv-event"
            :style="{ ...getEventStyle(e), background: getCalColor(e.calendarId) }"
            @click.stop="emit('select-event', e)">
            <span class="dv-ev-title">{{ e.title }}</span>
            <span class="dv-ev-time">{{ e.start.slice(11,16) }} - {{ e.end.slice(11,16) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-view { display: flex; flex-direction: column; height: 100%; }
.dv-allday { padding: 4px 12px; display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 0.5px solid var(--separator); }
.dv-allday-tag { font-size: 11px; color: white; padding: 2px 8px; border-radius: 4px; cursor: pointer; }
.dv-grid-scroll { flex: 1; overflow-y: auto; }
.dv-grid { display: flex; }
.dv-time-col { width: 48px; flex-shrink: 0; display: flex; flex-direction: column; }
.dv-hour { height: 60px; font-size: 9px; color: var(--text-tertiary); text-align: right; padding-right: 6px; }
.dv-col { flex: 1; position: relative; }
.dv-slot { height: 60px; border-bottom: 0.5px solid var(--separator); cursor: pointer; }
.dv-event {
  position: absolute; left: 2px; right: 2px; border-radius: 4px;
  padding: 3px 6px; overflow: hidden; cursor: pointer; z-index: 1;
  display: flex; flex-direction: column; gap: 1px;
}
.dv-ev-title { font-size: 11px; color: white; font-weight: 600; }
.dv-ev-time { font-size: 9px; color: rgba(255,255,255,0.8); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/WeekView.vue src/components/calendar/DayView.vue
git commit -m "feat: add WeekView and DayView time-axis components"
```

---

### Task 5: Create EventSheet.vue

**Files:**
- Create: `src/components/calendar/EventSheet.vue`

**Interfaces:**
- Props: `visible` (Boolean), `event` (Object|null — null = create mode), `data` (Object)
- Emits: `close`, `save(event)`, `delete(eventId)`

- [ ] **Step 1: Create component**

```vue
<script setup>
import { computed, reactive, watch } from 'vue'
import { generateUID, CALENDAR_COLORS } from '../../services/calendarStorage'

const props = defineProps({
  visible: { type: Boolean, default: false },
  event: { type: Object, default: null },
  data: { type: Object, required: true },
})

const emit = defineEmits(['close', 'save', 'delete'])

const isEdit = computed(() => !!props.event)

const REPEAT_OPTIONS = [
  { label: '不重复', value: null },
  { label: '每天', value: { type: 'daily', interval: 1 } },
  { label: '每周', value: { type: 'weekly', interval: 1 } },
  { label: '每月', value: { type: 'monthly', interval: 1 } },
  { label: '每年', value: { type: 'yearly', interval: 1 } },
]

const ALERT_OPTIONS = [
  { label: '无', value: null },
  { label: '事件开始时', value: 0 },
  { label: '15 分钟前', value: 15 },
  { label: '1 小时前', value: 60 },
  { label: '1 天前', value: 1440 },
]

const form = reactive({
  title: '',
  allDay: false,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  calendarId: '',
  location: '',
  notes: '',
  invitees: [],
  alerts: [],
  attachments: [],
  recurrence: null,
})

let inviteeInput = ''
let attachmentInput = ''

watch(() => props.visible, (v) => {
  if (!v) return
  if (props.event) {
    const e = props.event
    form.title = e.title || ''
    form.allDay = e.allDay || false
    form.startDate = (e.start || '').slice(0, 10)
    form.startTime = form.allDay ? '' : (e.start || '').slice(11, 16)
    form.endDate = (e.end || '').slice(0, 10)
    form.endTime = form.allDay ? '' : (e.end || '').slice(11, 16)
    form.calendarId = e.calendarId || props.data.calendars[0]?.id
    form.location = e.location || ''
    form.notes = e.notes || ''
    form.invitees = [...(e.invitees || [])]
    form.alerts = [...(e.alerts || [])]
    form.attachments = [...(e.attachments || [])]
    form.recurrence = e.recurrence ? { ...e.recurrence } : null
  } else {
    const today = new Date().toISOString().slice(0, 10)
    form.title = ''
    form.allDay = false
    form.startDate = today
    form.startTime = '09:00'
    form.endDate = today
    form.endTime = '10:00'
    form.calendarId = props.data.settings?.defaultCalendarId || props.data.calendars[0]?.id
    form.location = ''
    form.notes = ''
    form.invitees = []
    form.alerts = []
    form.attachments = []
    form.recurrence = null
  }
})

function onSave() {
  if (!form.title.trim()) return
  const startISO = form.allDay
    ? form.startDate
    : `${form.startDate}T${form.startTime || '00:00'}:00`
  const endISO = form.allDay
    ? form.endDate
    : `${form.endDate}T${form.endTime || '00:00'}:00`

  emit('save', {
    id: props.event?.id || generateUID(),
    calendarId: form.calendarId,
    title: form.title.trim(),
    location: form.location.trim(),
    notes: form.notes.trim(),
    start: startISO,
    end: endISO,
    allDay: form.allDay,
    recurrence: form.recurrence,
    invitees: [...form.invitees],
    attachments: [...form.attachments],
    alerts: [...form.alerts.filter(a => a !== null)],
  })
}

function onDelete() {
  if (props.event?.id) emit('delete', props.event.id)
}

function addInvitee() {
  const v = inviteeInput?.trim()
  if (v && !form.invitees.includes(v)) form.invitees.push(v)
  inviteeInput = ''
}

function addAttachment() {
  const v = attachmentInput?.trim()
  if (v && !form.attachments.includes(v)) form.attachments.push(v)
  attachmentInput = ''
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="visible" class="event-sheet-overlay" @click.self="emit('close')">
      <div class="event-sheet">
        <div class="es-header">
          <button class="es-cancel" @click="emit('close')">取消</button>
          <span class="es-title">{{ isEdit ? '编辑事件' : '新建事件' }}</span>
          <button class="es-save" @click="onSave">保存</button>
        </div>
        <div class="es-body">
          <input v-model="form.title" class="es-title-input" placeholder="标题" />

          <!-- All-day toggle -->
          <label class="es-row"><span>全天</span><input type="checkbox" v-model="form.allDay" /></label>

          <!-- Date/Time -->
          <div class="es-row">
            <span>开始</span>
            <input type="date" v-model="form.startDate" class="es-dt" />
            <input v-if="!form.allDay" type="time" v-model="form.startTime" class="es-dt" />
          </div>
          <div class="es-row">
            <span>结束</span>
            <input type="date" v-model="form.endDate" class="es-dt" />
            <input v-if="!form.allDay" type="time" v-model="form.endTime" class="es-dt" />
          </div>

          <!-- Repeat -->
          <div class="es-row"><span>重复</span>
            <select v-model="form.recurrence" class="es-select">
              <option v-for="o in REPEAT_OPTIONS" :key="o.label" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <!-- Calendar -->
          <div class="es-row"><span>日历</span>
            <select v-model="form.calendarId" class="es-select">
              <option v-for="c in data.calendars" :key="c.id" :value="c.id">● {{ c.name }}</option>
            </select>
          </div>

          <!-- Location -->
          <input v-model="form.location" class="es-input" placeholder="地点" />

          <!-- Invitees -->
          <div class="es-chips">
            <span v-for="(inv, i) in form.invitees" :key="i" class="es-chip">
              {{ inv }} <button @click="form.invitees.splice(i,1)">×</button>
            </span>
          </div>
          <div class="es-row"><input v-model="inviteeInput" class="es-input" placeholder="添加邀请人" @keydown.enter="addInvitee" /><button @click="addInvitee">+</button></div>

          <!-- Alerts -->
          <div class="es-row"><span>提醒</span>
            <div class="es-alerts">
              <label v-for="o in ALERT_OPTIONS" :key="o.label" class="es-alert-opt">
                <input type="checkbox" :value="o.value" v-model="form.alerts" /> {{ o.label }}
              </label>
            </div>
          </div>

          <!-- Notes -->
          <textarea v-model="form.notes" class="es-textarea" placeholder="备注" rows="3"></textarea>

          <!-- Attachments -->
          <div v-for="(url, i) in form.attachments" :key="i" class="es-att">
            <a :href="url" target="_blank">{{ url }}</a>
            <button @click="form.attachments.splice(i,1)">×</button>
          </div>
          <div class="es-row"><input v-model="attachmentInput" class="es-input" placeholder="附件链接" @keydown.enter="addAttachment" /><button @click="addAttachment">+</button></div>

          <!-- Delete -->
          <button v-if="isEdit" class="es-delete" @click="onDelete">删除事件</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.event-sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: flex-end; justify-content: center;
}
.event-sheet {
  width: 100%; max-width: 430px; max-height: 85vh;
  background: var(--bg-card); border-radius: 16px 16px 0 0;
  display: flex; flex-direction: column; overflow: hidden;
}
.es-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 0.5px solid var(--separator);
}
.es-cancel { border: 0; background: none; color: var(--text-secondary); font-size: var(--text-body); cursor: pointer; }
.es-title { font-weight: 700; font-size: var(--text-headline); color: var(--text-primary); }
.es-save { border: 0; background: none; color: var(--accent); font-weight: 700; font-size: var(--text-body); cursor: pointer; }
.es-body { flex: 1; overflow-y: auto; padding: 12px 16px 30px; display: flex; flex-direction: column; gap: 10px; }
.es-title-input { font-size: var(--text-title); font-weight: 700; border: 0; background: none; color: var(--text-primary); padding: 4px 0; }
.es-title-input:focus { outline: none; }
.es-row { display: flex; align-items: center; gap: 8px; font-size: var(--text-body); color: var(--text-primary); }
.es-row > span:first-child { width: 50px; flex-shrink: 0; color: var(--text-secondary); }
.es-dt, .es-select { flex: 1; border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 6px 8px; font-size: var(--text-body); color: var(--text-primary); }
.es-input { border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 8px 10px; font-size: var(--text-body); color: var(--text-primary); flex: 1; }
.es-textarea { border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 8px 10px; font-size: var(--text-body); color: var(--text-primary); resize: vertical; }
.es-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.es-chip { display: flex; align-items: center; gap: 2px; background: var(--accent-dim); color: var(--accent); padding: 2px 8px; border-radius: 999px; font-size: var(--text-footnote); }
.es-chip button { border: 0; background: none; color: var(--accent); cursor: pointer; }
.es-alerts { display: flex; flex-wrap: wrap; gap: 6px; }
.es-alert-opt { font-size: var(--text-footnote); color: var(--text-secondary); display: flex; align-items: center; gap: 4px; }
.es-delete { border: 0; background: none; color: var(--accent); font-size: var(--text-body); text-align: center; padding: 12px 0; cursor: pointer; margin-top: 8px; }
.es-att { display: flex; gap: 4px; align-items: center; font-size: var(--text-footnote); }
.es-att a { color: var(--accent); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.es-att button { border: 0; background: none; color: var(--text-secondary); cursor: pointer; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-active .event-sheet { transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }
.sheet-enter-from .event-sheet { transform: translateY(100%); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/EventSheet.vue
git commit -m "feat: add EventSheet component for create/edit events"
```

---

### Task 6: Create CalendarList.vue

**Files:**
- Create: `src/components/calendar/CalendarList.vue`

- [ ] **Step 1: Create component**

```vue
<script setup>
import { ref } from 'vue'
import { CALENDAR_COLORS } from '../../services/calendarStorage'

const props = defineProps({
  calendars: { type: Array, required: true },
})

const emit = defineEmits(['update', 'delete', 'add', 'settings'])

const showAdd = ref(false)
const newName = ref('')
const newColor = ref(CALENDAR_COLORS[0])

function onAdd() {
  if (!newName.value.trim()) return
  emit('add', { name: newName.value.trim(), color: newColor.value })
  newName.value = ''
  showAdd.value = false
}
</script>

<template>
  <div class="cal-list">
    <h3>日历</h3>
    <div v-for="cal in calendars" :key="cal.id" class="cl-row">
      <span class="cl-dot" :style="{ background: cal.color }"></span>
      <span class="cl-name">{{ cal.name }}</span>
      <button class="cl-del" @click="emit('delete', cal.id)">🗑</button>
    </div>

    <div v-if="showAdd" class="cl-add-form">
      <input v-model="newName" placeholder="日历名称" class="cl-input" @keydown.enter="onAdd" />
      <div class="cl-colors">
        <button v-for="c in CALENDAR_COLORS" :key="c" class="cl-color-btn"
          :class="{ selected: newColor === c }"
          :style="{ background: c }" @click="newColor = c"></button>
      </div>
      <button class="cl-save" @click="onAdd">添加</button>
    </div>
    <button v-else class="cl-add" @click="showAdd = true">+ 添加日历</button>

    <div class="cl-settings">
      <h3>设置</h3>
      <label class="cl-setting-row">
        <span>周起始日</span>
        <select @change="emit('settings', { weekStartsOn: Number(($event.target).value) })">
          <option :value="0">周日</option>
          <option :value="1">周一</option>
        </select>
      </label>
      <button class="cl-export" @click="emit('export')">导出 .ics</button>
      <label class="cl-import">
        导入 .ics
        <input type="file" accept=".ics" @change="emit('import', $event)" hidden />
      </label>
    </div>
  </div>
</template>

<style scoped>
.cal-list { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
h3 { margin: 0; font-size: var(--text-headline); font-weight: 700; color: var(--text-primary); }
.cl-row { display: flex; align-items: center; gap: 10px; }
.cl-dot { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; }
.cl-name { flex: 1; font-size: var(--text-body); color: var(--text-primary); }
.cl-del { border: 0; background: none; cursor: pointer; font-size: 14px; opacity: 0.5; }
.cl-add { border: 0; background: var(--separator); border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); color: var(--accent); cursor: pointer; text-align: left; }
.cl-add-form { display: flex; flex-direction: column; gap: 8px; }
.cl-input { border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 8px; font-size: var(--text-body); color: var(--text-primary); }
.cl-colors { display: flex; gap: 6px; }
.cl-color-btn { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.cl-color-btn.selected { border-color: var(--text-primary); }
.cl-save { border: 0; background: var(--accent); color: white; border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); cursor: pointer; }
.cl-settings { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.cl-setting-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-body); color: var(--text-primary); }
.cl-export { border: 0; background: var(--separator); border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); color: var(--text-secondary); cursor: pointer; }
.cl-import { border: 0; background: var(--separator); border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); color: var(--text-secondary); cursor: pointer; display: block; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/CalendarList.vue
git commit -m "feat: add CalendarList component"
```

---

### Task 7: Create CalendarView.vue (Main Page)

**Files:**
- Create: `src/components/CalendarView.vue`

- [ ] **Step 1: Create component composing all views**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CalendarView.vue
git commit -m "feat: add CalendarView main page composing all views"
```

---

### Task 8: Modify App.vue and HomeView.vue

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/HomeView.vue`

- [ ] **Step 1: In App.vue**, add CalendarView import and conditional render

Add import:
```js
import CalendarView from './components/CalendarView.vue'
```

Add conditional render after other views:
```html
<CalendarView v-if="currentView === 'calendar'" @back="currentView = 'home'" />
```

Update `playerViews` to NOT include `'calendar'` (no mini player needed).

- [ ] **Step 2: In HomeView.vue**, add calendar to modules list

Add this entry to the `modules` computed:
```js
{
  id: 'calendar',
  icon: '📅',
  label: '日历管理',
  color: '#007AFF',
  bg: 'linear-gradient(135deg, #007AFF, #5AC8FA)',
  summary: '管理日程与事件',
},
```

- [ ] **Step 3: Verify build**

Run: `yarn build`

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/components/HomeView.vue
git commit -m "feat: wire CalendarView into navigation"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run dev server and check build**

```bash
yarn build 2>&1
```

Expected: builds with 0 errors, ~62+ modules transformed.

- [ ] **Step 2: Commit if any fixes made**

(No commit needed if build passes clean)
