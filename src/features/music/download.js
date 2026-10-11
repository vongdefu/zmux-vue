import { fetchTrackDetails } from './musicApi';

const AUDIO_EXTS = new Set([
  'mp3', 'flac', 'wav', 'ape', 'alac', 'aiff',
  'm4a', 'aac', 'ogg', 'opus', 'wma'
]);

const ILLEGAL_CHARS = /[/\\:*?"<>|]/;

// 批量下载：串行 + 每首间隔，规避接口风控
const BATCH_DELAY_MS = 400;

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

// 目录名额外约束：不能为空、不能是 . / ..、不能以点或空格开头结尾（跨平台兼容）
function sanitizeDirName(name) {
  let dir = sanitizeFilename(name).replace(/^[. ]+|[. ]+$/g, '');
  if (!dir || dir === '.' || dir === '..') dir = '歌单';
  return dir.slice(0, 80);
}

// 音频与歌词共享同一「基名」：歌手存在时为「歌名-歌手」，否则仅歌名。
// 业界通用约定：同名 .lrc 与音频放同一目录，播放器导入时可自动读取歌词。
export function buildDownloadBase(track) {
  const title = sanitizeFilename(track?.title);
  const artist = sanitizeFilename(track?.artist);
  return artist ? `${title}-${artist}` : title || '未命名歌曲';
}

export function buildDownloadFilename(track, baseOverride) {
  const base = baseOverride || buildDownloadBase(track);
  const ext = detectExtension(track?.audioUrl);
  return `${base}.${ext}`;
}

export function buildLrcFilename(track, baseOverride) {
  return `${baseOverride || buildDownloadBase(track)}.lrc`;
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
  triggerDownload(blob, filename);
  return 'saved';
}

function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 判断目录里是否已存在某首歌的音频文件（按基名匹配任一已知音频扩展名）
function hasAudioFile(existing, base) {
  for (const ext of AUDIO_EXTS) {
    if (existing.has(`${base}.${ext}`)) return true;
  }
  return false;
}

async function collectExistingFiles(dirHandle) {
  const existing = new Set();
  for await (const [name] of dirHandle.entries()) {
    existing.add(name);
  }
  return existing;
}

async function writeFile(dirHandle, name, blob) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

// 解析出可用的音源与歌词。已有缓存则直接复用，避免重复请求。
async function resolveForBatch(track) {
  if (track.audioUrl && track.detailsLoaded && (track.lrc || !track.lrcUrl)) {
    return { audioUrl: toHttps(track.audioUrl), lrc: track.lrc || null };
  }
  await fetchTrackDetails(track, { force: true });
  return { audioUrl: toHttps(track.audioUrl), lrc: track.lrc || null };
}

async function fetchAudioBlob(track, audioUrl) {
  try {
    return await fetchBlob(audioUrl);
  } catch (error) {
    console.warn('音频下载失败，尝试重新解析音源', error);
    await fetchTrackDetails(track, { force: true });
    const url = toHttps(track.audioUrl);
    if (!url) throw new Error('no audio url');
    return fetchBlob(url);
  }
}

function trackMeta(track) {
  return { title: track?.title || '', artist: track?.artist || '', uid: track?.uid || '' };
}

// 同名不同曲时，用稳定 id 追加后缀，保证每首都落独立文件
function disambiguateBase(base, track) {
  const id = track?.songid || (track?.uid ? track.uid.split('-').pop() : '');
  const suffix = String(id).replace(/[^\w-]/g, '');
  return suffix ? `${base}-${suffix}` : `${base}-${track?.uid || ''}`;
}

/**
 * 批量下载歌单。串行 + 间隔，逐首解析音源与歌词，缺啥补啥（幂等）。
 *
 * - Chromium（支持 showDirectoryPicker）：选择目录后建歌单子文件夹，
 *   枚举已有文件，只补缺失的音频/歌词；同名不同曲自动重命名避免互相覆盖。
 * - 其他浏览器：无法读取下载目录，逐首触发 <a download>，无法去重。
 *
 * 返回 { audio, lrc, skipped, failed[], noAudio[], noLyrics[], collisions[], cancelled }。
 */
export async function downloadTracks(
  tracks,
  { onProgress = () => {}, isCancelled = () => false, playlistName = '歌单' } = {}
) {
  const summary = {
    audio: 0,
    lrc: 0,
    skipped: 0,
    failed: [],
    noAudio: [],
    noLyrics: [],
    collisions: [],
    cancelled: false
  };
  const list = (tracks || []).filter(Boolean);
  if (!list.length) return summary;

  const total = list.length;

  if (typeof window.showDirectoryPicker === 'function') {
    let rootDir;
    try {
      rootDir = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
      if (error?.name === 'AbortError') return summary; // 用户取消选目录
      throw error;
    }

    const targetDir = await rootDir.getDirectoryHandle(sanitizeDirName(playlistName), { create: true });
    const existing = await collectExistingFiles(targetDir);
    const baseOwners = new Map(); // rawBase -> uid，检测同名不同曲

    for (let i = 0; i < total; i++) {
      if (isCancelled()) break;

      const track = list[i];
      const rawBase = buildDownloadBase(track);
      let base = rawBase;

      const owner = baseOwners.get(rawBase);
      if (owner !== undefined && owner !== track.uid) {
        base = disambiguateBase(rawBase, track);
        summary.collisions.push(trackMeta(track));
      }
      baseOwners.set(rawBase, track.uid);

      const needAudio = !hasAudioFile(existing, base);
      const needLrc = !existing.has(`${base}.lrc`);

      if (!needAudio && !needLrc) {
        summary.skipped += 1;
        onProgress({ done: i + 1, total, summary });
        if (i < total - 1) await sleep(BATCH_DELAY_MS);
        continue;
      }

      try {
        const { audioUrl, lrc } = await resolveForBatch(track);

        if (needAudio && audioUrl) {
          const name = buildDownloadFilename(track, base);
          const blob = await fetchAudioBlob(track, audioUrl);
          await writeFile(targetDir, name, blob);
          existing.add(name);
          summary.audio += 1;
        } else if (needAudio && !audioUrl) {
          summary.noAudio.push(trackMeta(track));
        }

        if (needLrc && lrc) {
          const lrcName = `${base}.lrc`;
          await writeFile(targetDir, lrcName, new Blob([lrc], { type: 'text/plain;charset=utf-8' }));
          existing.add(lrcName);
          summary.lrc += 1;
        } else if (needLrc && !lrc) {
          summary.noLyrics.push(trackMeta(track));
        }
      } catch (error) {
        console.warn('下载失败', track?.title, error);
        summary.failed.push({ ...trackMeta(track), error: error?.message || String(error) });
      }

      onProgress({ done: i + 1, total, summary });
      if (i < total - 1) await sleep(BATCH_DELAY_MS);
    }

    summary.cancelled = isCancelled();
    return summary;
  }

  // 降级路径：无目录 API，逐个触发浏览器下载
  for (let i = 0; i < total; i++) {
    if (isCancelled()) break;

    const track = list[i];
    try {
      const { audioUrl, lrc } = await resolveForBatch(track);

      if (audioUrl) {
        const blob = await fetchAudioBlob(track, audioUrl);
        triggerDownload(blob, buildDownloadFilename(track));
        summary.audio += 1;
      } else {
        summary.noAudio.push(trackMeta(track));
      }

      if (lrc) {
        triggerDownload(new Blob([lrc], { type: 'text/plain;charset=utf-8' }), buildLrcFilename(track));
        summary.lrc += 1;
      } else {
        summary.noLyrics.push(trackMeta(track));
      }
    } catch (error) {
      console.warn('下载失败', track?.title, error);
      summary.failed.push({ ...trackMeta(track), error: error?.message || String(error) });
    }

    onProgress({ done: i + 1, total, summary });
    if (i < total - 1) await sleep(BATCH_DELAY_MS);
  }

  summary.cancelled = isCancelled();
  return summary;
}
