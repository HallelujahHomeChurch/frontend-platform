'use client';

import {useEffect, useState, type RefObject} from 'react';
import {containedVideoRect, displayWatermarkCode, watermarkLayout} from './recording-watermark.js';
import styles from './styles.js';

export function RecordingWatermark({container, videoRef, code}: {container: RefObject<HTMLDivElement | null>; videoRef: RefObject<HTMLVideoElement | null>; code: string}) {
  const [rect, setRect] = useState<ReturnType<typeof containedVideoRect>>(null);
  useEffect(() => {
    const root = container.current, video = videoRef.current;
    if (!root || !video) return;
    const measure = () => setRect(containedVideoRect(root.clientWidth, root.clientHeight, video.videoWidth, video.videoHeight));
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(root);
    window.addEventListener('resize', measure);
    video.addEventListener('loadedmetadata', measure);
    video.addEventListener('resize', measure);
    measure();
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); video.removeEventListener('loadedmetadata', measure); video.removeEventListener('resize', measure); };
  }, [container, videoRef]);
  if (!rect || !code) return null;
  const {count, fontSize} = watermarkLayout(rect.width, rect.height);
  return <div aria-hidden="true" className={styles.watermark} style={{...rect, gridTemplateColumns:`repeat(${count / 2}, 1fr)`, fontSize}}>
    {Array.from({length:count}, (_, index) => <span key={index}>{displayWatermarkCode(code)}</span>)}
  </div>;
}
