'use client';

import {useEffect,useRef,useState} from 'react';
import {createPreviewCache} from './preview-cache.js';
import type {PreviewCue} from './preview-index.js';
import styles from './styles.js';

export function PreviewSprite({playbackUrl,cue,neighbor}:{playbackUrl:string;cue?:PreviewCue;neighbor?:string}) {
  const cache=useRef<ReturnType<typeof createPreviewCache>|null>(null);
  const [image,setImage]=useState({source:'',url:''});
  useEffect(()=>{
    const loader=createPreviewCache(new URL('previews/',playbackUrl).href,(source,url)=>setImage({source,url}));
    cache.current=loader;
    return ()=>{loader.dispose();cache.current=null;};
  },[playbackUrl]);
  useEffect(()=>{
    const loader=cache.current,source=cue?.url??'';
    if(loader?.has(source)){loader.request(source,neighbor);return;}
    // Coalesce network misses only; decoded cache hits have no artificial delay.
    const timer=window.setTimeout(()=>loader?.request(source,neighbor),60);
    return ()=>window.clearTimeout(timer);
  },[cue?.url,neighbor,playbackUrl]);
  if(!cue||image.source!==cue.url||!image.url)return null;
  return <div className={styles.previewImage}>
    {/* Private in-memory object URL; never proxy through an image optimizer. */}
    <img src={image.url} alt="" width={960} height={90} style={{left:-cue.x}}/>
  </div>;
}
