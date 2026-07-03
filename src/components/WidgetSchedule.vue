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
