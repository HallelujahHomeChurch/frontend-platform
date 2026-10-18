// Keep segment-update tolerance aligned between live status and forward recovery.
export const LIVE_EDGE_TOLERANCE_SECONDS = 20;
export const LIVE_HOLDBACK_SECONDS = 90;

export type PlaybackIntent = 'followLive' | 'dvr';
export type PlayerBookmark = {mediaOriginSeconds?: number; time: number; paused: boolean; rate: number; quality: 'auto' | '480p' | '720p' | '1080p'; intent: PlaybackIntent};
export type LivePlayerState = {verifiedEnd: number; ended?: boolean; canFollow: boolean; label: string; backToLive: string; liveLabel?: string};

export function estimatedLiveDelay(createdAt:string,serverNow:string,elapsedSeconds:number,position:number,stoppedAt?:string|null) {
  const start=Date.parse(createdAt),now=Date.parse(serverNow)+elapsedSeconds*1000;
  const end=stoppedAt?Math.min(now,Date.parse(stoppedAt)):now;
  if(![start,end,position].every(Number.isFinite)||elapsedSeconds<0||position<0)return null;
  return Math.max(0,Math.round((end-start)/1000-position));
}

// seekable describes the EVENT timeline; buffered only describes cached bytes.
export function liveWindow(seekable: TimeRanges, verifiedEnd: number) {
  if (!seekable.length || !Number.isFinite(verifiedEnd) || verifiedEnd <= 0) return null;
  const start = seekable.start(0), end = Math.min(seekable.end(seekable.length - 1), verifiedEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {start, end, edge: Math.max(start, end - LIVE_HOLDBACK_SECONDS)};
}
