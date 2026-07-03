<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import WidgetNowPlaying from './WidgetNowPlaying.vue'
import WidgetPomodoro from './WidgetPomodoro.vue'
import WidgetSchedule from './WidgetSchedule.vue'
import WidgetHabit from './WidgetHabit.vue'

defineProps({
  track: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
  pomodoroCount: { type: Number, default: 0 },
  tasks: { type: Array, default: () => [] },
  habits: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'skip-next', 'skip-prev', 'toggle-favorite', 'navigate',
  'toggle-task', 'toggle-habit', 'active-index-changed',
])

const activeIndex = ref(0)
const stackRef = ref(null)
let observer = null

onMounted(() => {
  if (!stackRef.value) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.dataset.widgetIndex)
          if (!isNaN(idx)) {
            activeIndex.value = idx
            emit('active-index-changed', idx)
          }
        }
      }
    },
    { root: stackRef.value, threshold: 0.6 }
  )
  const slides = stackRef.value.querySelectorAll('[data-widget-index]')
  slides.forEach((el) => observer.observe(el))
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="widget-stack">
    <div ref="stackRef" class="ws-scroll">
      <div class="ws-slide" data-widget-index="0">
        <WidgetNowPlaying
          :track="track"
          :isFavorite="isFavorite"
          @skip-next="emit('skip-next')"
          @skip-prev="emit('skip-prev')"
          @toggle-favorite="emit('toggle-favorite')"
          @navigate="emit('navigate', $event)"
        />
      </div>
      <div class="ws-slide" data-widget-index="1">
        <WidgetPomodoro
          :count="pomodoroCount"
          @navigate="emit('navigate', $event)"
        />
      </div>
      <div class="ws-slide" data-widget-index="2">
        <WidgetSchedule
          :tasks="tasks"
          @toggle-task="emit('toggle-task', $event)"
          @navigate="emit('navigate', $event)"
        />
      </div>
      <div class="ws-slide" data-widget-index="3">
        <WidgetHabit
          :habits="habits"
          @toggle-habit="emit('toggle-habit', $event)"
          @navigate="emit('navigate', $event)"
        />
      </div>
    </div>

    <!-- Page indicator dots -->
    <div class="ws-dots">
      <span
        v-for="i in 4"
        :key="i"
        class="ws-dot"
        :class="{ 'ws-dot-active': activeIndex === i - 1 }"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.widget-stack {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.ws-scroll {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scroll-snap-stop: always;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.ws-scroll::-webkit-scrollbar {
  display: none;
}

.ws-slide {
  height: 100%;
  scroll-snap-align: start;
}

/* Page indicator */
.ws-dots {
  position: absolute;
  right: var(--space-xs);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  z-index: 2;
}
.ws-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  opacity: 0.3;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ws-dot-active {
  opacity: 0.9;
  transform: scale(1.4);
}
</style>
