import { normalizeTrack } from './musicApi';

const API_LIMIT = 15;
const API_PATH = `/api/personalized/playlist?limit=${API_LIMIT}`;
const API_URL = `https://music.163.com${API_PATH}`;

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

/**
 * 解析个性化推荐 API 的 JSON 响应，提取歌单列表。
 */
function parsePlaylistResponse(data) {
  if (!data || data.code !== 200 || !Array.isArray(data.result)) {
    throw new Error('API 返回数据格式异常');
  }

  const playlists = data.result.map((item) => ({
    id: String(item.id),
    name: item.name || '',
    cover: item.picUrl || null,
  }));

  if (!playlists.length) {
    throw new Error('API 未返回任何歌单');
  }

  return playlists;
}

/**
 * 通过指定 URL 请求歌单 API 并解析。
 */
async function tryFetchPlaylists(fetchUrl) {
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return parsePlaylistResponse(data);
}

/**
 * 获取推荐歌单列表。
 *
 * 三层降级策略：
 * 1. Vite dev proxy（yarn dev 时可用）
 * 2. 公共 CORS 代理（GitHub Pages 等静态托管环境）
 * 3. 内置静态歌单列表（兜底）
 */
export async function fetchDiscoverPlaylists() {
  // 1) Vite 开发代理
  try {
    return await tryFetchPlaylists(`/api/proxy/netease${API_PATH}`);
  } catch (e) {
    console.warn('Vite dev proxy 失败，尝试 CORS 代理...', e.message);
  }

  // 2) 公共 CORS 代理
  try {
    const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;
    return await tryFetchPlaylists(corsProxyUrl);
  } catch (e) {
    console.warn('CORS 代理失败，使用静态歌单兜底...', e.message);
  }

  // 3) 静态兜底歌单
  return FALLBACK_PLAYLISTS;
}

/**
 * 通过 Meting API 获取歌单内的歌曲列表。
 * 返回的歌曲格式与音乐搜索 API 完全一致，可被 TrackList 和 PlayerDock 直接使用。
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
