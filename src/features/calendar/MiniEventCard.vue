<script setup>
const props = defineProps({
  event: { type: Object, required: true },
  calendars: { type: Array, default: () => [] },
})

const emit = defineEmits(['click'])

const cal = props.calendars.length
  ? props.calendars.find(c => c.id === props.event.calendarId)
  : null

const dotColor = cal?.color || '#007AFF'
</script>

<template>
  <button class="mini-event" :style="{ '--dot': dotColor }" @click.stop="emit('click', props.event)">
    <span class="me-dot"></span>
    <span class="me-title">{{ props.event.title }}</span>
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
