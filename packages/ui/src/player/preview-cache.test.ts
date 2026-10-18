import {afterEach, expect, it, vi} from 'vitest';
import {createPreviewCache} from './preview-cache';

afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});
const root='https://media.example/videos/r/packages/p/sessions/s/previews/';
const url=(n:number)=>`${root}seg-${String(n).padStart(6,'0')}.jpg`;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup() {
  let n=0;
  vi.stubGlobal('URL',class extends URL {
    static createObjectURL(){return `blob:${++n}`;}
    static revokeObjectURL=vi.fn();
  });
  const jobs:{url:string;signal:AbortSignal;resolve:(r:Response)=>void}[]=[];
  vi.stubGlobal('fetch',vi.fn((url:string,options:RequestInit)=>new Promise<Response>(resolve=>jobs.push({url,signal:options.signal!,resolve}))));
  const loaded=vi.fn();
  const cache=createPreviewCache(root,loaded);
  return {cache,jobs,loaded};
}
const jpg=()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
it('deduplicates active sprites, bounds concurrency and replaces obsolete queued targets',async()=>{
  const {cache,jobs,loaded}=setup();
  cache.request(url(0)); cache.request(url(0)); cache.request(url(1));
  for(let n=2;n<20;n++)cache.request(url(n));
  expect(jobs.map(j=>j.url)).toEqual([url(0),url(1)]);
  expect(jobs.every(j=>!j.signal.aborted)).toBe(true);
  jobs[0].resolve(jpg()); await tick();
  expect(jobs.map(j=>j.url)).toEqual([url(0),url(1),url(19)]);
  cache.request(url(0)); await tick();
  expect(jobs).toHaveLength(3);
  expect(loaded).toHaveBeenLastCalledWith(url(0),'blob:1');
  cache.dispose();
  expect(jobs[1].signal.aborted).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
});
it('purges private images on authorization loss and never serves a cached image afterward',async()=>{
  const {cache,jobs,loaded}=setup();
  cache.request(url(0));jobs[0].resolve(jpg());await tick();
  cache.request(url(1));jobs[1].resolve(new Response(null,{status:403}));await tick();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  expect(loaded).toHaveBeenLastCalledWith('','');
  loaded.mockClear();cache.request(url(0));await tick();
  expect(loaded).not.toHaveBeenCalled();expect(jobs).toHaveLength(2);
});
it('bounds image bytes and refuses destinations outside this playback session',async()=>{
  const {cache,jobs,loaded}=setup();
  cache.request('https://evil.example/seg-000000.jpg');expect(jobs).toHaveLength(0);
  cache.request(url(0));jobs[0].resolve(new Response(new Uint8Array(1_048_577),{headers:{'Content-Type':'image/jpeg'}}));await tick();
  expect(loaded).not.toHaveBeenCalled();cache.dispose();
});
it('evicts old object URLs and ignores responses after disposal',async()=>{
  const {cache,jobs,loaded}=setup();
  for(let n=0;n<18;n++){cache.request(url(n));jobs[n].resolve(jpg());await tick();}
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  cache.request(url(19));cache.dispose();loaded.mockClear();jobs.at(-1)!.resolve(jpg());await tick();
  expect(loaded).not.toHaveBeenCalled();
});
it('ignores authorization responses from a disposed playback session',async()=>{
  const {cache,jobs,loaded}=setup();
  cache.request(url(0));cache.dispose();jobs[0].resolve(new Response(null,{status:403}));await tick();
  expect(loaded).not.toHaveBeenCalled();
});
