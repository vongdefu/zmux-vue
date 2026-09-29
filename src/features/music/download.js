import { fetchTrackDetails } from './musicApi';

const AUDIO_EXTS = new Set([
  'mp3', 'flac', 'wav', 'ape', 'alac', 'aiff',
  'm4a', 'aac', 'ogg', 'opus', 'wma'
]);

const ILLEGAL_CHARS = /[/\\:*?"<>|]/;

function detectExtension(url) {
  if (!url) return 'mp3';
  const base = String(url).split('?')[0].split('#')[0].toLowerCase();
  const ext = (base.match(/\.([a-z0-9]+)$/) || [])[1] || '';
  return AUDIO_EXTS.has(ext) ? ext : 'mp3';
}

function sanitizeFilename(name) {
  return String(name || '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32 && !ILLEGAL_CHARS.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildDownloadFilename(track) {
  const title = sanitizeFilename(track?.title);
  const artist = sanitizeFilename(track?.artist);
  const ext = detectExtension(track?.audioUrl);
  const base = artist ? `${title}-${artist}` : title || '未命名歌曲';
  return `${base}.${ext}`;
}

// 部分音源（如 QQ）返回 http:// 链接，https 页面下会被混合内容策略拦截，统一升级为 https
function toHttps(url) {
  return typeof url === 'string' && url.startsWith('http://')
    ? 'https://' + url.slice('http://'.length)
    : url;
}

async function fetchBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

// 先试已有音源链接，失败再强制重新解析一次（应对 QQ/JOOX 签名过期）
async function resolveAndFetch(track) {
  if (track.audioUrl) {
    try {
      return await fetchBlob(toHttps(track.audioUrl));
    } catch (error) {
      console.warn('首次下载失败，尝试重新解析音源', error);
    }
  }

  await fetchTrackDetails(track, { force: true });
  const url = toHttps(track.audioUrl);
  if (!url) throw new Error('no audio url');
  return fetchBlob(url);
}

export async function downloadTrack(track) {
  const filename = buildDownloadFilename(track);

  // Chrome/Edge：先弹「另存为」对话框。showSaveFilePicker 必须在用户手势内调用，
  // 否则会抛 SecurityError；所以这里先拿句柄，之后再去解析和下载。
  if (typeof window.showSaveFilePicker === 'function') {
    let handle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: filename });
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      throw error;
    }

    const blob = await resolveAndFetch(track);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  }

  // 其他浏览器：落到默认下载目录
  const blob = await resolveAndFetch(track);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return 'saved';
}
