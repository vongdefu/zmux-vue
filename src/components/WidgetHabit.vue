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
