<script setup>
import { computed, nextTick, ref, watch } from "vue"
import { formatTime } from "../utils/lyrics"
import IconButton from "./IconButton.vue"
import TrackArtwork from "./TrackArtwork.vue"

const props = defineProps({
  store: {
    type: Object,
    required: true,
  },
  tabBarVisible: {
    type: Boolean,
    default: false,
  },
  showMiniPlayer: {
    type: Boolean,
    default: true,
  },
})

const audioRef = ref(null)
const activeLineRef = ref(null)
const lyricsRef = ref(null)
const songLabelRef = ref(null)
const needsScroll = ref(false)

const miniBottom = computed(() =>
  props.tabBarVisible ? '90px' : '10px',
)

const state = props.store.state
const progress = computed(() =>
  state.duration
    ? Math.min(100, (state.currentTime / state.duration) * 100)
    : 0,
)
const playModeIcon = computed(
  () => ({ list: "↻", single: "①", shuffle: "↝" })[state.playMode] || "↻",
)
const labelText = computed(() => {
  const title = state.currentTrack?.title || '未在播放'
  const artist = state.currentTrack?.artist || '等待播放'
  return `${title} — ${artist}`
})

watch(
  () => state.currentTrack?.audioUrl,
  async (url) => {
    if (!audioRef.value || !url) return
    await nextTick()
    audioRef.value.src = url
    audioRef.value.volume = state.volume
    audioRef.value.muted = state.muted
    audioRef.value.play().catch(() => {
      state.isPlaying = false
    })
  },
)

watch(
  () => state.currentLyricIndex,
  async () => {
    await nextTick()
    activeLineRef.value?.scrollIntoView({ block: "center", behavior: "smooth" })
  },
)

watch(
  labelText,
  async () => {
    needsScroll.value = false
    await nextTick()
    if (songLabelRef.value) {
      needsScroll.value = songLabelRef.value.scrollWidth > songLabelRef.value.clientWidth
    }
  },
  { immediate: true }
)

function onPlay() {
  props.store.updateAudioState({ isPlaying: true, statusText: '正在播放' })
  props.store.resetSkipCounter()
}

function onPause() {
  props.store.updateAudioState({ isPlaying: false, statusText: '已暂停' })
}

function onAudioError() {
  const list = props.store.activeList.value
  state.consecutiveSkipCount++
  if (list.length > 0 && state.consecutiveSkipCount < list.length) {
    props.store.showToast('播放出错，已自动跳过')
    setTimeout(() => props.store.nextTrack(), 800)
  } else {
    props.store.showToast('当前列表所有歌曲都无法播放')
    state.isPlaying = false
    state.statusText = '播放失败'
    state.consecutiveSkipCount = 0
  }
}

function togglePlay() {
  if (!audioRef.value?.src) return
  if (audioRef.value.paused) audioRef.value.play()
  else audioRef.value.pause()
}

function seek(event) {
  if (!audioRef.value || !state.duration) return
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(
    1,
    Math.max(0, (event.clientX - rect.left) / rect.width),
  )
  audioRef.value.currentTime = state.duration * ratio
}

function setVolume(event) {
  const value = Number.parseFloat(event.target.value)
  state.volume = value
  if (audioRef.value) audioRef.value.volume = value
}

function cyclePlayMode() {
  const next =
    state.playMode === "list"
      ? "single"
      : state.playMode === "single"
        ? "shuffle"
        : "list"
  props.store.setPlayMode(next)
}

function onTimeUpdate() {
  const audio = audioRef.value
  props.store.updateAudioState({
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
  })
  props.store.updateLyricIndex(audio.currentTime || 0)
}

function onEnded() {
  props.store.nextTrack()
}
</script>

<template>
  <audio
    ref="audioRef"
    preload="metadata"
    @timeupdate="onTimeUpdate"
    @loadedmetadata="onTimeUpdate"
    @play="onPlay"
    @pause="onPause"
    @ended="onEnded"
    @error="onAudioError"
  />

  <div
    v-if="showMiniPlayer && state.currentTrack && !state.playerOpen"
    class="mini-player"
    :style="{ bottom: miniBottom }"
  >
    <div
      class="mini-cover"
      role="button"
      tabindex="0"
      @click="state.playerOpen = true"
      @keydown.enter="state.playerOpen = true"
    >
      <TrackArtwork :track="state.currentTrack" size="small" />
    </div>

    <div class="mini-info" @click="state.playerOpen = true">
      <span class="mini-title">{{ state.currentTrack?.title || '未在播放' }}</span>
      <span class="mini-artist">{{ state.currentTrack?.artist || '等待播放' }}</span>
    </div>

    <div class="mini-controls-row">
      <button class="mini-play" @click.stop="togglePlay">{{ state.isPlaying ? 'Ⅱ' : '▶' }}</button>
      <button class="mini-next" title="下一首" @click.stop="props.store.nextTrack">›</button>
    </div>
  </div>

  <Transition name="sheet">
    <section v-if="state.playerOpen" class="player-sheet">
      <button class="collapse-pill" @click="state.playerOpen = false"></button>

      <div class="player-body">
        <TrackArtwork :track="state.currentTrack" size="large" />
        <div class="song-title-block">
          <h2>{{ state.currentTrack?.title || "尚未播放" }}</h2>
          <p>{{ state.currentTrack?.artist || "搜索一首歌开始播放" }}</p>
        </div>

        <section class="lyrics-card">
          <!-- <h3>歌词</h3> -->
          <div ref="lyricsRef" class="lyrics-scroll">
            <p v-if="!props.store.activeLyrics.value.length" class="muted">
              暂无歌词
            </p>
            <p
              v-for="line in props.store.activeLyrics.value"
              :key="`${line.time}-${line.text}`"
              :ref="line.active ? (el) => (activeLineRef = el) : undefined"
              :class="{ active: line.active }"
            >
              {{ line.text }}
            </p>
          </div>
        </section>

        <section class="compact-player">
          <div class="progress" @click="seek">
            <span class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <div class="time-row">
            <span>{{ formatTime(state.currentTime) }}</span>
            <span>{{ formatTime(state.duration) }}</span>
          </div>

          <div class="controls">
            <IconButton label="播放模式" @click="cyclePlayMode">{{
              playModeIcon
            }}</IconButton>
            <IconButton label="上一首" @click="props.store.previousTrack"
              >‹‹</IconButton
            >
            <IconButton label="播放或暂停" tone="primary" @click="togglePlay">{{
              state.isPlaying ? "Ⅱ" : "▶"
            }}</IconButton>
            <IconButton label="下一首" @click="props.store.nextTrack"
              >››</IconButton
            >
            <IconButton
              label="收藏"
              :active="props.store.isFavorite(state.currentTrack)"
              @click="props.store.toggleFavorite()"
            >
              {{ props.store.isFavorite(state.currentTrack) ? "♥" : "♡" }}
            </IconButton>
          </div>

          <label class="volume">
            <span></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="state.volume"
              @input="setVolume"
            />
            <span></span>
          </label>
        </section>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.mini-player {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  transition: bottom 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  border-radius: 16px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(22px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.mini-cover {
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.16s ease;
}
.mini-cover:active { transform: scale(0.94); }

.mini-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
}

.mini-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mini-artist {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mini-controls-row {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.mini-play {
  width: 36px; height: 36px;
  border: 0; border-radius: 999px;
  background: var(--text-primary);
  color: white;
  font-size: 14px; font-weight: 800;
  cursor: pointer;
  display: grid; place-items: center;
  transition: transform 0.12s ease;
}
.mini-play:active { transform: scale(0.92); }

.mini-next {
  width: 36px; height: 36px;
  border: 0; border-radius: 999px;
  background: transparent;
  color: var(--text-primary);
  font-size: 20px; font-weight: 700;
  cursor: pointer;
  display: grid; place-items: center;
  transition: opacity 0.12s ease;
}
.mini-next:active { opacity: 0.5; }
  height: 34px;
  font-size: 14px;
}

.player-sheet {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  background:
    radial-gradient(circle at 30% 0%, rgba(236, 65, 65, 0.18), transparent 34%),
    linear-gradient(180deg, #fbfbfd, #f5f5f7);
}

.collapse-pill {
  align-self: center;
  min-width: 10%;
  margin-top: 50px;
  height: 10px;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(118, 118, 128, 0.12);
  /* color: var(--text-secondary); */

  cursor: pointer;
}

.player-body {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 14px;
}

.song-title-block {
  width: 100%;
  text-align: center;
}

.song-title-block h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.16;
}

.song-title-block p {
  margin: 5px 0 0;
  color: var(--accent);
  font-size: 16px;
  font-weight: 700;
}

.compact-player {
  width: 100%;
  display: grid;
  gap: 10px;
}

.progress {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: rgba(60, 60, 67, 0.14);
  overflow: hidden;
  cursor: pointer;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.time-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-top: -10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.controls {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.controls :deep(.tone-primary) {
  width: 54px;
  height: 54px;
  font-size: 22px;
}

.volume {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  /* gap: 12px; */
  align-items: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.volume input {
  width: 100%;
  accent-color: var(--accent);
}

.lyrics-card {
  width: 100%;
  min-height: 210px;
  flex: 1;
  border-radius: 22px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.7);
}

.lyrics-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.lyrics-scroll {
  height: 90%;
  overflow-y: auto;
  overflow-x: hidden;
  text-align: center;
  color: var(--text-tertiary);
  mask-image: linear-gradient(transparent, black 16%, black 84%, transparent);
}

.lyrics-scroll p {
  margin: 10px 0;
  font-size: 16px;
  line-height: 1.45;
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.lyrics-scroll .active {
  color: var(--text-primary);
  font-weight: 800;
  transform: scale(1.04);
}

.muted {
  color: var(--text-secondary);
}

.sheet-enter-active,
.sheet-leave-active {
  transition:
    transform 0.28s ease,
    opacity 0.28s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
  opacity: 0.4;
}
</style>
