<script setup>
defineProps({
  track: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
})

const emit = defineEmits(['skip-next', 'skip-prev', 'toggle-favorite', 'navigate'])
</script>

<template>
  <div class="widget-now-playing">
    <!-- Empty state -->
    <div v-if="!track" class="wnp-empty" @click="emit('navigate', 'music')">
      <span class="wnp-empty-icon">🎵</span>
      <span class="wnp-empty-text">暂未播放</span>
      <span class="wnp-empty-hint">点击前往音乐</span>
    </div>

    <!-- Playing state -->
    <div v-else class="wnp-content">
      <div class="wnp-header">
        <span class="wnp-label">正在播放</span>
      </div>
      <div class="wnp-track">
        <div class="wnp-artwork">
          <span class="wnp-artwork-fallback">🎵</span>
        </div>
        <div class="wnp-info">
          <span class="wnp-title">{{ track.title || '未知歌曲' }}</span>
          <span class="wnp-artist">{{ track.artist || '未知歌手' }}</span>
        </div>
      </div>
      <div class="wnp-actions">
        <button class="wnp-btn" @click.stop="emit('skip-prev')">
          <span>⏮</span>
        </button>
        <button
          class="wnp-btn"
          :class="{ 'wnp-btn-active': isFavorite }"
          @click.stop="emit('toggle-favorite')"
        >
          <span>{{ isFavorite ? '❤️' : '🤍' }}</span>
        </button>
        <button class="wnp-btn" @click.stop="emit('skip-next')">
          <span>⏭</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-now-playing {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px 14px;
}

/* Empty state */
.wnp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 20px 0;
}
.wnp-empty-icon { font-size: 32px; }
.wnp-empty-text {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
}
.wnp-empty-hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

/* Playing state */
.wnp-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wnp-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wnp-label {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.wnp-track {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wnp-artwork {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: var(--separator);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.wnp-artwork-fallback {
  font-size: 22px;
}
.wnp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wnp-title {
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wnp-artist {
  font-size: var(--text-footnote);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wnp-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding-top: 4px;
}
.wnp-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: 0;
  background: var(--separator);
  display: grid;
  place-items: center;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.wnp-btn:active {
  transform: scale(0.9);
  opacity: 0.7;
}
.wnp-btn-active {
  background: var(--accent-dim);
}
</style>
