<script setup>
import { computed, ref } from "vue"
import TrackList from "./TrackList.vue"

const props = defineProps({
  store: {
    type: Object,
    required: true,
  },
})

const newName = ref("")
const selectedId = ref(props.store.state.playlists[0]?.id || "")
const fileInput = ref(null)
const loadingSavedTracks = ref(false)
const loadingMoreSaved = ref(false)

function create() {
  const playlist = props.store.createPlaylist(newName.value)
  selectedId.value = playlist.id
  newName.value = ""
}

async function selectPlaylist(id) {
  selectedId.value = id
  const playlist = props.store.state.playlists.find(p => p.id === id)
  // 引用型歌单（来自推荐歌单收藏）且未加载过 → 按需加载
  if (playlist && playlist.sourcePlaylistId && !playlist._tracksBuffer) {
    loadingSavedTracks.value = true
    try {
      await props.store.loadInitialSavedPlaylistTracks(id)
    } catch {
      // error toast already shown by store
    } finally {
      loadingSavedTracks.value = false
    }
  }
}

function backToList() {
  selectedId.value = ""
}

function onDeletePlaylist(id) {
  props.store.deletePlaylist(id)
  if (selectedId.value === id) selectedId.value = ""
}

const selectedPlaylist = computed(() =>
  props.store.state.playlists.find(p => p.id === selectedId.value) || null
)

const hasMoreSaved = computed(() => {
  const playlist = selectedPlaylist.value
  if (!playlist || !playlist._tracksBuffer) return false
  return playlist._tracksBuffer.length > (playlist.tracks || []).length
})

async function loadMoreSaved() {
  loadingMoreSaved.value = true
  await props.store.loadMoreSavedPlaylistTracks(selectedId.value)
  loadingMoreSaved.value = false
}

function downloadJson() {
  const payload = props.store.exportLibrary()
  if (!payload.favorites.length && !payload.playlists.length) {
    props.store.showToast("暂无可导出的内容")
    return
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zmusic-library-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function importJson(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    props.store.importLibrary(JSON.parse(reader.result))
    selectedId.value = props.store.state.playlists[0]?.id || selectedId.value
  }
  reader.readAsText(file, "utf-8")
  event.target.value = ""
}

// 为歌单生成渐变色（基于名称 hash）
function coverGradient(name) {
  const hues = [0, 25, 50, 170, 200, 260, 290, 330]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = hues[Math.abs(hash) % hues.length]
  return `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue + 30},70%,40%))`
}
</script>

<template>
  <section class="playlists-view">

    <!-- ===== 歌单详情视图 ===== -->
    <template v-if="selectedId">
      <button class="back-btn" @click="backToList">← 歌单列表</button>
      <div class="detail-header">
        <h2>{{ selectedPlaylist?.name || '' }}</h2>
        <span class="detail-count">{{ selectedPlaylist?.tracks.length || 0 }} 首</span>
        <button class="del-btn" @click="onDeletePlaylist(selectedId)">删除歌单</button>
      </div>

      <div v-if="loadingSavedTracks" class="empty-state">
        正在加载歌曲…
      </div>
      <template v-else>
        <TrackList
          :tracks="selectedPlaylist?.tracks || []"
          :current-track="store.state.currentTrack"
          :is-favorite="store.isFavorite"
          empty-text="歌单暂无歌曲"
          :removable="true"
          @play="(_, index) => store.playFromList('playlist', index, selectedId)"
          @favorite="store.toggleFavorite"
          @remove="(track) => store.removeFromPlaylist(selectedId, track)"
        />
        <button
          v-if="hasMoreSaved"
          class="load-more-btn"
          :disabled="loadingMoreSaved"
          @click="loadMoreSaved"
        >
          {{ loadingMoreSaved ? '加载中...' : `加载更多 (${selectedPlaylist?.tracks.length || 0}/${selectedPlaylist?._tracksBuffer?.length || 0})` }}
        </button>
      </template>
    </template>

    <!-- ===== 歌单网格视图 ===== -->
    <template v-else>
      <!-- 创建歌单 -->
      <form class="create-row" @submit.prevent="create">
        <input v-model="newName" placeholder="新歌单名称" />
        <button>创建</button>
      </form>

      <!-- 工具栏 -->
      <div class="tool-row">
        <button @click="fileInput?.click()">导入</button>
        <button @click="downloadJson">导出</button>
        <input
          ref="fileInput"
          hidden
          type="file"
          accept="application/json,.json"
          @change="importJson"
        />
      </div>

      <!-- 歌单网格 -->
      <div v-if="store.state.playlists.length" class="playlist-grid">
        <button
          v-for="playlist in store.state.playlists"
          :key="playlist.id"
          class="playlist-card"
          @click="selectPlaylist(playlist.id)"
        >
          <div
            class="playlist-card-cover"
            :style="{ background: coverGradient(playlist.name) }"
          >
            <span class="cover-letter">{{ playlist.name.slice(0, 1) }}</span>
          </div>
          <strong>{{ playlist.name }}</strong>
          <span class="card-count">{{ playlist.tracks.length }} 首</span>
        </button>
      </div>

      <div v-else class="empty-state">
        <span>🎵</span>
        <p>暂无歌单，快去创建或收藏吧</p>
      </div>
    </template>

  </section>
</template>

<style scoped>
.playlists-view {
  display: flex; flex-direction: column; gap: 10px;
}

/* ===== 创建行 ===== */
.create-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}
.create-row input {
  min-width: 0; border: 0; border-radius: 12px;
  outline: 0; padding: 10px 12px; font-size: 14px;
  background: white; color: var(--text-primary);
}
.create-row button {
  border: 0; border-radius: 12px;
  background: var(--accent); color: white;
  padding: 10px 18px; font-weight: 800; cursor: pointer;
}

/* ===== 工具栏 ===== */
.tool-row {
  display: flex; gap: 8px;
}
.tool-row button {
  border: 0; border-radius: 8px;
  padding: 6px 14px;
  background: rgba(236, 65, 65, 0.08);
  color: var(--accent);
  font-size: 13px; font-weight: 700; cursor: pointer;
}

/* ===== 歌单网格（与推荐歌单一致） ===== */
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.playlist-card {
  border: 0; border-radius: 14px;
  padding: 0; background: white;
  cursor: pointer; text-align: left;
  overflow: hidden;
  transition: transform 0.16s ease;
}
.playlist-card:active { transform: scale(0.96); }

.playlist-card-cover {
  width: 100%; aspect-ratio: 1;
  display: grid; place-items: center;
  overflow: hidden;
}
.cover-letter {
  font-size: 28px; font-weight: 800;
  color: rgba(255,255,255,0.85);
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.playlist-card strong {
  display: -webkit-box;
  -webkit-line-clamp: 1; line-clamp: 1;
  -webkit-box-orient: vertical; overflow: hidden;
  margin: 8px 10px 0;
  font-size: 13px; line-height: 1.3;
  color: var(--text-primary);
}

.card-count {
  display: block;
  margin: 2px 10px 10px;
  font-size: 11px; color: var(--text-tertiary);
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 32px 0; gap: 4px;
  color: var(--text-tertiary);
}
.empty-state span { font-size: 32px; }
.empty-state p { margin: 0; font-size: 13px; }

/* ===== 歌单详情 ===== */
.back-btn {
  border: 0; border-radius: 999px; align-self: flex-start;
  padding: 6px 14px;
  background: rgba(236,65,65,0.08);
  color: var(--accent); font-size: 13px; font-weight: 700; cursor: pointer;
}

.detail-header {
  display: flex; align-items: center; gap: 12px;
}
.detail-header h2 {
  margin: 0; font-size: 20px; flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.detail-count {
  font-size: 13px; color: var(--text-tertiary); flex-shrink: 0;
}
.del-btn {
  border: 0; border-radius: 8px; padding: 6px 14px;
  background: rgba(236,65,65,0.08); color: var(--accent);
  font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0;
}

.load-more-btn {
  width: 100%; border: 0;
  border-radius: var(--radius-md);
  padding: 12px;
  background: rgba(236, 65, 65, 0.08);
  color: var(--accent);
  font-size: var(--text-footnote);
  font-weight: 700; cursor: pointer;
  transition: background 0.15s;
}
.load-more-btn:active { background: rgba(236, 65, 65, 0.16); }
.load-more-btn:disabled { opacity: 0.5; cursor: default; }
</style>
