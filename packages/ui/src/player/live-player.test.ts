import {expect,it} from 'vitest';
import {estimatedLiveDelay,liveWindow} from './live-player.js';
const ranges=(start:number,end:number):TimeRanges=>({length:1,start:()=>start,end:()=>end});
it('keeps full DVR after ninety minutes and a closed-fragment safety distance',()=>{
 expect(liveWindow(ranges(0,5400),5370)).toEqual({start:0,end:5370,edge:5310});
});
it('estimates delay from actual playback position and server time, including stalled and stopped captures',()=>{
 expect(estimatedLiveDelay('2026-10-09T05:00:00Z','2026-10-09T05:30:00Z',10,1430)).toBe(380);
 expect(estimatedLiveDelay('2026-10-09T05:00:00Z','2026-10-09T05:30:00Z',10,1680)).toBe(130);
 expect(estimatedLiveDelay('2026-10-09T05:00:00Z','2026-10-09T05:30:00Z',500,1680,'2026-10-09T05:29:00Z')).toBe(60);
 expect(estimatedLiveDelay('invalid','2026-10-09T05:30:00Z',10,1430)).toBeNull();
 expect(estimatedLiveDelay('2026-10-09T05:00:00Z','2026-10-09T05:30:00Z',10,Infinity)).toBeNull();
});
it('waits for valid native seekable and never uses Infinity as a duration',()=>{
 expect(liveWindow({length:0,start:()=>0,end:()=>0},90)).toBeNull();
 expect(liveWindow(ranges(0,Infinity),90)).toEqual({start:0,end:90,edge:30});
 expect(liveWindow(ranges(0,90),Infinity)).toBeNull();
});
