import { normalizeTrack } from './musicApi';

const PAGE_SIZE = 10;
const FALLBACK_PLAYLISTS = [
  { id: '3778678', name: '云音乐热歌榜', cover: null },
  { id: '3779629', name: '云音乐新歌榜', cover: null },
  { id: '2884035', name: '云音乐飙升榜', cover: null },
  { id: '19723756', name: '云音乐说唱榜', cover: null },
  { id: '2250013', name: '抖音排行榜', cover: null },
  { id: '7459562', name: '电竞音乐榜', cover: null },
  { id: '108550346', name: '华语金曲', cover: null },
  { id: '71385702', name: '怀旧经典', cover: null },
  { id: '99160243', name: '独立小众', cover: null },
];

function getIdFromUrl(url) {
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : '';
}

/** Fisher-Yates 洗牌 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 缓存：预加载的全量歌单池
let playlistPool = null;

/**
 * 加载全量歌单池（dev 模式走代理，生产环境读本地 JSON）。
 */
async function loadPool() {
  if (import.meta.env.DEV) {
    // dev: 通过 Vite 代理获取实时歌单
    const resp = await fetch(`/api/proxy/netease/api/personalized/playlist?limit=100`);
    const data = await resp.json();
    if (data.code === 200 && Array.isArray(data.result)) {
      return data.result.map((item) => ({
        id: String(item.id),
        name: item.name || '',
        cover: item.picUrl || null,
      }));
    }
  }

  // 生产环境：读本地预生成的 JSON
  try {
    const resp = await fetch('/playlists.json');
    if (resp.ok) {
      const list = await resp.json();
      if (Array.isArray(list) && list.length) return list;
    }
  } catch (e) {
    console.warn('加载本地歌单 JSON 失败:', e.message);
  }

  // 兜底
  return FALLBACK_PLAYLISTS;
}

/**
 * 获取推荐歌单（首次调用时加载全量池，随机返回 PAGE_SIZE 个）。
 */
export async function fetchDiscoverPlaylists() {
  if (!playlistPool) {
    try {
      playlistPool = await loadPool();
    } catch (e) {
      console.warn('加载歌单池失败，使用内置歌单:', e.message);
      playlistPool = FALLBACK_PLAYLISTS;
    }
  }
  return shuffle(playlistPool).slice(0, PAGE_SIZE);
}

/**
 * 换一换：重新从池中随机抽 PAGE_SIZE 个，不重新加载池。
 */
export async function refreshPlaylists() {
  if (!playlistPool) {
    return fetchDiscoverPlaylists();
  }
  return shuffle(playlistPool).slice(0, PAGE_SIZE);
}

/**
 * 通过 Meting API 获取歌单内的歌曲列表。
 */
export async function fetchPlaylistTracks(playlistId) {
  const apiUrl = `https://api.qijieya.cn/meting/?type=playlist&id=${encodeURIComponent(playlistId)}`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    console.error(`歌单 ID ${playlistId} API 请求失败: ${response.status}`);
    return [];
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    console.error(`歌单 ID ${playlistId} 返回的数据格式不是数组`, data);
    return [];
  }

  return data
    .map((song, index) => {
      const songId = getIdFromUrl(song.url) || `${playlistId}-${index}`;
      return normalizeTrack({
        uid: `netease-${songId}`,
        source: 'netease',
        displayIndex: index + 1,
        keyword: song.name,
        songid: songId,
        title: song.name || '',
        artist: song.artist || '',
        cover: song.pic || null,
        audioUrl: null,
        lrc: null,
        lrcUrl: song.lrc || null,
      });
    })
    .filter((track) => track.songid);
}
