// Private, mounted-player-only cache. HTTP responses remain no-store; no disk,
// service worker, shared account cache or public image optimizer is involved.
export function createPreviewCache(prefix:string,loaded:(source:string,url:string)=>void) {
  const cache=new Map<string,{url:string;bytes:number}>(), active=new Map<string,AbortController>();
  let queue:string[]=[], target='', bytes=0, disposed=false;
  const valid=(url:string)=>url.startsWith(prefix)&&/^seg-\d{6}\.jpg$/.test(url.slice(prefix.length));
  const notify=(source:string,url:string)=>queueMicrotask(()=>{if(!disposed&&source===target)loaded(source,url);});
  const dispose=()=>{
    disposed=true;queue=[];
    for(const controller of active.values())controller.abort();
    for(const entry of cache.values())URL.revokeObjectURL(entry.url);
    cache.clear();bytes=0;
  };
  const pump=()=>{
    while(!disposed&&active.size<2&&queue.length) {
      const source=queue.shift()!;
      if(cache.has(source)||active.has(source))continue;
      const controller=new AbortController();active.set(source,controller);
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
            size+=value.byteLength;if(size>1_048_576)throw new Error('Preview too large');
            chunks.push(new Uint8Array(value));
          }
        } finally {await reader.cancel();}
        if(disposed||controller.signal.aborted||!size)return;
        const entry={url:URL.createObjectURL(new Blob(chunks,{type:'image/jpeg'})),bytes:size};
        cache.set(source,entry);bytes+=size;
        while(cache.size>16||bytes>8*1_048_576){
          const oldest=cache.keys().next().value!;
          // Never evict the image currently shown while loading a neighbor.
          if(oldest===target){const current=cache.get(oldest)!;cache.delete(oldest);cache.set(oldest,current);continue;}
          const old=cache.get(oldest)!;cache.delete(oldest);bytes-=old.bytes;URL.revokeObjectURL(old.url);
        }
        notify(source,entry.url);
      })().catch(()=>{/* Optional previews never interrupt video. */}).finally(()=>{active.delete(source);pump();});
    }
  };
  return {
    request(url:string,neighbor?:string){
      if(disposed)return;
      target=valid(url)?url:'';
      queue=[target,neighbor??''].filter((item,index,all)=>valid(item)&&all.indexOf(item)===index);
      const entry=cache.get(target);
      if(entry){cache.delete(target);cache.set(target,entry);notify(target,entry.url);}
      pump();
    },
    dispose,
  };
}
