import {validatePreviewJpeg} from './preview-jpeg.js';

// Private, mounted-player-only cache. HTTP responses remain no-store; no disk,
// service worker, shared account cache or public image optimizer is involved.
export function createPreviewCache(prefix:string,loaded:(source:string,url:string)=>void) {
  const cache=new Map<string,{url:string;bytes:number;release:()=>void}>(), active=new Map<string,AbortController>();
  let queue:string[]=[], backgroundQueue:string[]=[], target='', bytes=0, backgroundBytes=0, disposed=false, paused=false;
  const attempted=new Set<string>(), backgroundActive=new Set<AbortController>();
  const valid=(url:string)=>url.startsWith(prefix)&&/^seg-\d{6}\.jpg$/.test(url.slice(prefix.length));
  const notify=(source:string,url:string)=>queueMicrotask(()=>{if(!disposed&&source===target)loaded(source,url);});
  const dispose=()=>{
    disposed=true;queue=[];backgroundQueue=[];attempted.clear();
    for(const controller of active.values())controller.abort();
    for(const entry of cache.values())entry.release();
    cache.clear();bytes=0;
  };
  const pump=()=>{
    while(!disposed&&!paused&&active.size<2&&(queue.length||backgroundQueue.length&&backgroundActive.size===0&&backgroundBytes<8*1_048_576)) {
      const background=queue.length===0;
      const source=(background?backgroundQueue:queue).shift()!;
      attempted.add(source);
      if(cache.has(source)||active.has(source))continue;
      const controller=new AbortController();active.set(source,controller);
      if(background)backgroundActive.add(controller);
      void (async()=>{
        const response=await fetch(source,{credentials:'include',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
        if(disposed||controller.signal.aborted){await response.body?.cancel();return;}
        if(response.status===401||response.status===403){dispose();loaded('','');return;}
        if(!response.ok||!response.body||response.headers.get('Content-Type')?.split(';')[0]!=='image/jpeg'){await response.body?.cancel();return;}
        const reader=response.body.getReader(), chunks:Uint8Array<ArrayBuffer>[]=[];
        let size=0;
        try {
          for(;;){
            const {done,value}=await reader.read();if(done)break;
            if(backgroundActive.has(controller)){backgroundBytes+=value.byteLength;if(backgroundBytes>8*1_048_576)throw new Error('Preview preload budget exhausted');}
            size+=value.byteLength;if(size>1_048_576)throw new Error('Preview too large');
            chunks.push(new Uint8Array(value));
          }
        } finally {await reader.cancel();}
        if(disposed||controller.signal.aborted||!size)return;
        const blob=new Blob(chunks,{type:'image/jpeg'});
        validatePreviewJpeg(new Uint8Array(await blob.arrayBuffer()));
        if(disposed||controller.signal.aborted)return;
        const url=URL.createObjectURL(blob),image=new Image();
        let released=false;
        const release=()=>{if(released)return;released=true;image.src='';URL.revokeObjectURL(url);};
        controller.signal.addEventListener('abort',release,{once:true});
        try {
          image.decoding='async';image.src=url;
          if(typeof image.decode==='function')await image.decode();
          if(disposed||controller.signal.aborted){release();return;}
          if(image.naturalWidth!==960||image.naturalHeight!==90)throw new Error('Unexpected decoded preview dimensions');
        } catch(error){release();throw error;}
        finally {controller.signal.removeEventListener('abort',release);}
        const entry={url,bytes:size,release};
        cache.set(source,entry);bytes+=size;
        while(cache.size>16||bytes>8*1_048_576){
          const oldest=cache.keys().next().value!;
          // Never evict the image currently shown while loading a neighbor.
          if(oldest===target){const current=cache.get(oldest)!;cache.delete(oldest);cache.set(oldest,current);continue;}
          const old=cache.get(oldest)!;cache.delete(oldest);bytes-=old.bytes;old.release();
        }
        notify(source,entry.url);
      })().catch(()=>{/* Optional previews never interrupt video. */}).finally(()=>{active.delete(source);backgroundActive.delete(controller);pump();});
    }
  };
  return {
    peek(source:string){return !disposed&&valid(source)?cache.get(source)?.url:undefined;},
    has(source:string){return !disposed&&valid(source)&&cache.has(source);},
    request(url:string,neighbor?:string){
      if(disposed||paused)return;
      target=valid(url)?url:'';
      const foreground=active.get(target);if(foreground)backgroundActive.delete(foreground);
      queue=[target,neighbor??''].filter((item,index,all)=>valid(item)&&all.indexOf(item)===index);
      const entry=cache.get(target);
      if(entry){cache.delete(target);cache.set(target,entry);notify(target,entry.url);}
      pump();
    },
    preload(sources:readonly string[],enabled:boolean){
      backgroundQueue=enabled?Array.from(new Set(sources.slice(0,25920))).filter(source=>valid(source)&&!attempted.has(source)&&!cache.has(source)):[];
      if(!enabled)for(const controller of backgroundActive)controller.abort();
      pump();
    },
    setPaused(value:boolean){
      paused=value;
      if(paused){queue=[];backgroundQueue=[];for(const controller of active.values())controller.abort();}
    },
    dispose,
  };
}
