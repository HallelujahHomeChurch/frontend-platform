'use client';

import {useEffect,useState} from 'react';
import {createPreviewCache} from './preview-cache.js';
import type {PreviewCue} from './preview-index.js';
import styles from './styles.js';

// Legacy preload props remain accepted; full-timeline warming is intentionally disabled.
export function PreviewSprite({playbackUrl,cue,neighbor,enabled=true,position}:{playbackUrl:string;cue?:PreviewCue;neighbor?:string;enabled?:boolean;position?:number;preload?:readonly string[];preloadEnabled?:boolean}) {
  const [cache,setCache]=useState<{scope:string;loader:ReturnType<typeof createPreviewCache>}|null>(null);
  const [image,setImage]=useState({source:'',url:''});
  const loader=cache?.scope===playbackUrl?cache.loader:undefined;
  useEffect(()=>{
    const loader=createPreviewCache(new URL('previews/',playbackUrl).href,(source,url)=>setImage({source,url}));
    setCache({scope:playbackUrl,loader});
    return ()=>loader.dispose();
  },[playbackUrl]);
  useEffect(()=>{
    if(!loader)return;
    loader.setPaused(!enabled);
    if(!enabled)return;
    const source=cue?.url??'';
    if(loader.has(source)){loader.request(source,neighbor);return;}
    // Coalesce network misses only; decoded cache hits have no artificial delay.
    const timer=window.setTimeout(()=>loader.request(source,neighbor),60);
    return ()=>window.clearTimeout(timer);
  },[cue?.url,neighbor,loader,enabled]);
  useEffect(()=>{
    if(enabled&&loader?.canRetry())loader.request(cue?.url??'',neighbor);
  },[position,cue?.url,neighbor,loader,enabled]);
  // Read decoded hits in this render; an effect round-trip would briefly remove the image.
  const url=loader?.peek(cue?.url??image.source);
    return <div className={styles.previewImage}>
    {/* Private in-memory object URL; never proxy through an image optimizer. */}
    {url&&<img hidden={!cue} src={url} alt="" width={960} height={90} style={{left:`${-(cue?.x??0)/160*100}%`}}/>}
  </div>;
}
