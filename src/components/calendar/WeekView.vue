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
