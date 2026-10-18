'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';

type Mode = 'inline' | 'container' | 'native' | 'viewport';
type NativeVideo = HTMLVideoElement & {
  webkitSupportsFullscreen?: boolean;
  webkitDisplayingFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

export function usePlayerFullscreen(containerRef: RefObject<HTMLDivElement | null>, videoRef: RefObject<HTMLVideoElement | null>, preferViewport = false) {
  const [mode, setMode] = useState<Mode>('inline');
  const [error, setError] = useState<string | null>(null);
  const current = useRef<Mode>('inline'), pending = useRef(false), mounted = useRef(false);
  const focusBefore = useRef<HTMLElement | null>(null);
  const viewportScroll = useRef({x:0, y:0});
  const change = (next: Mode) => {
    if (!mounted.current) return;
    if (next === 'viewport' && current.current !== 'viewport') viewportScroll.current = {x:window.scrollX, y:window.scrollY};
    current.current = next; setMode(next); setError(null);
    if (next === 'inline') focusBefore.current?.focus({preventScroll:true});
  };

  useEffect(() => {
    mounted.current = true;
    const video = videoRef.current as NativeVideo | null;
    const fullscreen = () => change(document.fullscreenElement === containerRef.current ? 'container' : 'inline');
    const began = () => change('native'), ended = () => change('inline');
    const restore = () => {
      if (document.visibilityState !== 'visible') return;
      if (current.current === 'container' && document.fullscreenElement !== containerRef.current) change('inline');
      if (current.current === 'native' && video?.webkitDisplayingFullscreen === false) change('inline');
    };
    document.addEventListener('fullscreenchange', fullscreen);
    document.addEventListener('visibilitychange', restore);
    video?.addEventListener('webkitbeginfullscreen', began);
    video?.addEventListener('webkitendfullscreen', ended);
    return () => {
      mounted.current = false;
      document.removeEventListener('fullscreenchange', fullscreen);
      document.removeEventListener('visibilitychange', restore);
      video?.removeEventListener('webkitbeginfullscreen', began);
      video?.removeEventListener('webkitendfullscreen', ended);
    };
  }, [containerRef, videoRef]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.dataset.fullscreen = mode;
    if (mode !== 'viewport') return () => {delete root.dataset.fullscreen;};
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const siblings: {element: Element; inert: boolean}[] = [];
    for (let node: Element | null = root; node?.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node) continue;
        siblings.push({element:sibling,inert:sibling.hasAttribute('inert')});
        sibling.setAttribute('inert','');
      }
      if (node.parentElement === document.body) break;
    }
    root.focus({preventScroll:true});
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {event.preventDefault();change('inline');}
      if (event.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(item => item.tabIndex >= 0 && !item.closest('[hidden],[inert]'));
      const first = items[0] ?? root, last = items.at(-1) ?? root;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      delete root.dataset.fullscreen;
      document.body.style.overflow = overflow;
      for (const {element,inert} of siblings) if (!inert) element.removeAttribute('inert');
      document.removeEventListener('keydown', keyboard);
      window.scrollTo(viewportScroll.current.x, viewportScroll.current.y);
      focusBefore.current?.focus({preventScroll:true});
    };
  }, [mode, containerRef]);

  const exit = async () => {
    try {
      if (current.current === 'container') await document.exitFullscreen();
      else if (current.current === 'native') {
        const video = videoRef.current as NativeVideo | null;
        if (!video?.webkitExitFullscreen) throw new Error('Native exit unavailable');
        video.webkitExitFullscreen();
      } else change('inline');
    } catch {if (mounted.current) setError('exit_failed');}
  };

  const toggle = async () => {
    if (pending.current) return;
    if (current.current !== 'inline') {await exit();return;}
    const root = containerRef.current, video = videoRef.current as NativeVideo | null;
    if (!root || !video) return;
    focusBefore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pending.current = true;
    try {
      if (typeof root.requestFullscreen === 'function') {
        try {await root.requestFullscreen();return;} catch { /* Try native, then same-DOM viewport expansion. */ }
      }
      if (!mounted.current) return;
      if (!preferViewport && typeof video.webkitEnterFullscreen === 'function' && video.webkitSupportsFullscreen !== false) {
        try {video.webkitEnterFullscreen();return;} catch { /* Unsupported media or expired activation: viewport works without it. */ }
      }
      change('viewport');
    } finally {pending.current = false;}
  };
  return {mode, toggle, exit, error};
}
