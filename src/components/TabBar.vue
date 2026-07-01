<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentView: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['navigate'])

const tabs = [
  { id: 'music', icon: '🎵', label: '音乐' },
  { id: 'schedule', icon: '📅', label: '日程' },
  { id: 'pomodoro', icon: '🍅', label: '番茄' },
  { id: 'habit', icon: '✅', label: '习惯' },
]
</script>

<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-bar-btn"
      :class="{ active: currentView === tab.id }"
      @click="emit('navigate', tab.id)"
    >
      <span class="tab-bar-icon">{{ tab.icon }}</span>
      <span class="tab-bar-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  z-index: 30;
  height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-radius: var(--radius-lg);
  padding: 6px 8px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 0.5px solid var(--separator);
}

.tab-bar-btn {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.2s ease,
    background 0.2s ease;
}

.tab-bar-btn:active {
  transform: scale(0.92);
}

.tab-bar-btn.active {
  color: var(--accent);
  transform: translateY(-2px) scale(1.08);
}

.tab-bar-btn.active:active {
  transform: translateY(-2px) scale(1.0);
}

.tab-bar-icon {
  font-size: 22px;
  line-height: 1;
}

.tab-bar-label {
  font-size: var(--text-caption);
  font-weight: 700;
  line-height: 1;
}
</style>
