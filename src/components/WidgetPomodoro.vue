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
