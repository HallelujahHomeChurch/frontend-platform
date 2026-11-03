export function verifyMediaRequest(playlist:string,target:string,audio=false) {
 const base=new URL(playlist),url=new URL(target,base),prefix=new URL('.',base).pathname;
 const path=url.pathname.slice(prefix.length);
 const allowed=audio?/^(index\.m3u8|seg-\d{6}\.ts)$/:/^(master\.m3u8|(480p|720p|1080p)\/(index\.m3u8|init\.mp4|seg-\d{6}\.m4s))$/;
 if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||!url.pathname.startsWith(prefix)||!allowed.test(path))throw new Error('Invalid media request');
}
