<script setup>
import { computed } from 'vue'
import { getEventsForDate } from './calendarStorage'

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
