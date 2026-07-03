<script setup>
import { ref } from 'vue'
import MiniCalendar from './MiniCalendar.vue'
import WidgetStack from './WidgetStack.vue'

defineProps({
  track: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
  pomodoroCount: { type: Number, default: 0 },
  tasks: { type: Array, default: () => [] },
  habits: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'skip-next', 'skip-prev', 'toggle-favorite', 'navigate',
  'toggle-task', 'toggle-habit',
])

const calendarExpanded = ref(false)
const activeWidgetIndex = ref(0)

function onCalendarToggle() {
  calendarExpanded.value = !calendarExpanded.value
}

function onActiveIndexChanged(idx) {
  activeWidgetIndex.value = idx
}
</script>

<template>
  <div
    class="liquid-glass-widget"
    :class="`lgw-widget-${activeWidgetIndex}`"
  >
    <!-- Liquid glass caustic blobs -->
    <div class="lgw-caustics">
      <span class="lgw-blob lgw-blob-1"></span>
      <span class="lgw-blob lgw-blob-2"></span>
      <span class="lgw-blob lgw-blob-3"></span>
    </div>

    <!-- Content layer -->
    <div class="lgw-content">
      <MiniCalendar
        :expanded="calendarExpanded"
        @toggle-expand="onCalendarToggle"
        @select-date="calendarExpanded = false"
      />
      <Transition name="lgw-stack">
        <WidgetStack
          v-if="!calendarExpanded"
          :track="track"
          :isFavorite="isFavorite"
          :pomodoroCount="pomodoroCount"
          :tasks="tasks"
          :habits="habits"
          @skip-next="emit('skip-next')"
          @skip-prev="emit('skip-prev')"
          @toggle-favorite="emit('toggle-favorite')"
          @navigate="emit('navigate', $event)"
          @toggle-task="emit('toggle-task', $event)"
          @toggle-habit="emit('toggle-habit', $event)"
          @active-index-changed="onActiveIndexChanged"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* ===== Liquid Glass Shell ===== */
.liquid-glass-widget {
  position: relative;
  height: 300px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-lg);
  /* Glass base */
  background: var(--glass-bg-light);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid var(--glass-border-light);
  /* Edge glow */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 4px 20px rgba(0, 0, 0, 0.06);
  transition: background-color 0.8s ease;
}

/* ===== Color Bleed by Widget ===== */
.lgw-widget-0 { --bleed-color: rgba(236, 65, 65, 0.08); }    /* Now Playing — warm red */
.lgw-widget-1 { --bleed-color: rgba(255, 159, 10, 0.08); }   /* Pomodoro — orange */
.lgw-widget-2 { --bleed-color: rgba(255, 159, 10, 0.06); }   /* Schedule — light orange */
.lgw-widget-3 { --bleed-color: rgba(49, 194, 124, 0.08); }   /* Habits — green */

/* ===== Light Caustics ===== */
.lgw-caustics {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.lgw-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}

.lgw-blob-1 {
  width: 160px;
  height: 160px;
  background: #ec4141;
  top: -40px;
  left: -30px;
  animation: blobDrift1 22s ease-in-out infinite;
}

.lgw-blob-2 {
  width: 120px;
  height: 120px;
  background: #ff9f0a;
  bottom: -30px;
  right: -20px;
  animation: blobDrift2 26s ease-in-out infinite;
}

.lgw-blob-3 {
  width: 100px;
  height: 100px;
  background: #31c27c;
  top: 50%;
  left: 40%;
  animation: blobDrift3 30s ease-in-out infinite;
}

@keyframes blobDrift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, 20px) scale(1.1); }
  50% { transform: translate(10px, 40px) scale(0.9); }
  75% { transform: translate(-20px, 10px) scale(1.05); }
}

@keyframes blobDrift2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-25px, -20px) scale(1.15); }
  66% { transform: translate(15px, -30px) scale(0.9); }
}

@keyframes blobDrift3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -15px) scale(1.2); }
}

/* ===== Content Layer ===== */
.lgw-content {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  /* Subtle tint overlay from color bleed */
  background: var(--bleed-color);
  transition: background-color 0.8s ease;
  border-radius: var(--radius-lg);
}

/* WidgetStack enter/leave transition */
.lgw-stack-enter-active,
.lgw-stack-leave-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.lgw-stack-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.lgw-stack-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* ===== Dark Mode ===== */
@media (prefers-color-scheme: dark) {
  .liquid-glass-widget {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 4px 20px rgba(0, 0, 0, 0.3);
  }
  .lgw-blob {
    opacity: 0.18;
  }
  .lgw-widget-0 { --bleed-color: rgba(236, 65, 65, 0.05); }
  .lgw-widget-1 { --bleed-color: rgba(255, 159, 10, 0.05); }
  .lgw-widget-2 { --bleed-color: rgba(255, 159, 10, 0.04); }
  .lgw-widget-3 { --bleed-color: rgba(49, 194, 124, 0.05); }
}
</style>
