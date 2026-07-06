const LIBRARY_STORAGE_KEY = "zmux-music-v1"

const TRACK_KEYS = [
  "uid",
  "source",
  "displayIndex",
  "keyword",
  "songid",
  "songMid",
  "qqId",
  "qqSearchKey",
  "qqIndex",
  "jooxIndex",
  "jooxSongId",
  "jooxSongMid",
  "title",
  "artist",
  "album",
  "cover",
  "pageUrl",
  "quality",
  "qualityLabel",
  "qqQualityText",
  "jooxQualityText",
  "pay",
]

export function serializeTrack(track) {
  if (!track) return null
  const next = {}
  TRACK_KEYS.forEach((key) => {
    if (track[key] !== undefined && track[key] !== null && track[key] !== "")
      next[key] = track[key]
  })
  next.detailsLoaded = false
  next.audioUrl = null
  next.lrc = null
  next.lrcUrl = null
  return next.uid ? next : null
}

export function deserializeTrack(raw) {
  if (!raw || raw.source === "migu") return null
  return serializeTrack(raw)
}

export function createSnapshot(favorites, playlists) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    favorites: favorites.map(serializeTrack).filter(Boolean),
    playlists: playlists.map((playlist) => {
      const data = {
        id: playlist.id,
        name: playlist.name,
        tracks: [],
      };
      // 引用型歌单只存 sourcePlaylistId，歌曲按需加载
      if (playlist.sourcePlaylistId) {
        data.sourcePlaylistId = playlist.sourcePlaylistId;
      } else {
        data.tracks = (playlist.tracks || []).map(serializeTrack).filter(Boolean);
      }
      return data;
    }),
  }
}

export function createLibrarySnapshot(favorites, playlists, playHistory = []) {
  return {
    ...createSnapshot(favorites, playlists),
    playHistory: playHistory.map(serializeTrack).filter(Boolean),
  }
}

export function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY).trim()
    if (!raw) return { favorites: [], playlists: [] }
    const data = JSON.parse(raw)
    return {
      favorites: Array.isArray(data.favorites)
        ? data.favorites.map(deserializeTrack).filter(Boolean)
        : [],
      playlists: Array.isArray(data.playlists)
        ? data.playlists.map((playlist, index) => ({
            id: playlist.id || `pl-cached-${index}-${Date.now()}`,
            name: playlist.name || "未命名歌单",
            sourcePlaylistId: playlist.sourcePlaylistId || null,
            tracks: Array.isArray(playlist.tracks)
              ? playlist.tracks.map(deserializeTrack).filter(Boolean)
              : [],
          }))
        : [],
      playHistory: Array.isArray(data.playHistory)
        ? data.playHistory.map(deserializeTrack).filter(Boolean)
        : [],
    }
  } catch {
    return { favorites: [], playlists: [], playHistory: [] }
  }
}

export function saveLibrary(favorites, playlists, playHistory = []) {
  localStorage.setItem(
    LIBRARY_STORAGE_KEY,
    JSON.stringify(createLibrarySnapshot(favorites, playlists, playHistory)),
  )
}
