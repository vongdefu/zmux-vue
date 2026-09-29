const AUDIO_EXTS = new Set([
  'mp3', 'flac', 'wav', 'ape', 'alac', 'aiff',
  'm4a', 'aac', 'ogg', 'opus', 'wma'
]);

function detectExtension(url) {
  if (!url) return 'mp3';
  const base = String(url).split('?')[0].split('#')[0].toLowerCase();
  const ext = (base.match(/\.([a-z0-9]+)$/) || [])[1] || '';
  return AUDIO_EXTS.has(ext) ? ext : 'mp3';
}

const ILLEGAL_CHARS = /[/\\:*?"<>|]/;

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

export async function downloadTrack(track) {
  const response = await fetch(track.audioUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const filename = buildDownloadFilename(track);

  // Chrome/Edge：弹系统「另存为」对话框，用户选位置
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }

  // 其他浏览器：落到默认下载目录
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
