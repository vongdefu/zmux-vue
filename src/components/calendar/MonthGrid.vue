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
