export type PreviewCue = {start: number; end: number; url: string; x: number};

function timestamp(value: string) {
  const match = /^(\d{2}):([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
  if (!match) throw new Error('Invalid preview time');
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

// Preview metadata may select only bounded sprites within the current playback scope.
export function parsePreviewIndex(text: string, indexURL: string): PreviewCue[] {
  if (text.length > 1_048_576 || !text.startsWith('WEBVTT\n')) throw new Error('Invalid preview index');
  const cues: PreviewCue[] = [];
  for (const block of text.trim().split(/\n\s*\n/).slice(1)) {
    const lines = block.trim().split('\n');
    if (lines.length === 3 && /^\d+$/.test(lines[0])) lines.shift();
    const range = lines[0]?.split(' --> ');
    const sprite = /^seg-\d{6}\.jpg#xywh=(0|160|320|480|640|800),0,160,90$/.exec(lines[1] ?? '');
    if (lines.length !== 2 || range?.length !== 2 || !sprite || cues.length >= 4320) throw new Error('Invalid preview cue');
    const start = timestamp(range[0]), end = timestamp(range[1]);
    if (end <= start || end - start > 5.1 || end > 21601 || start < (cues.at(-1)?.end ?? 0) - 0.002) throw new Error('Invalid preview timeline');
    cues.push({start, end, url: new URL(lines[1].split('#')[0], indexURL).href, x: Number(sprite[1])});
  }
  return cues;
}

export async function loadPreviewIndex(playbackURL: string, signal: AbortSignal): Promise<PreviewCue[]> {
  const url = new URL('previews/index.vtt', playbackURL).href;
  const response = await fetch(url, {credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal});
  if (!response.ok || !response.body) return [];
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_048_576) throw new Error('Preview index too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return parsePreviewIndex(new TextDecoder().decode(data).replace(/\r\n/g, '\n'), url);
}
