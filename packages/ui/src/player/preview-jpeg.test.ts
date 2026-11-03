import {expect,it} from 'vitest';
import {validatePreviewJpeg} from './preview-jpeg.js';
const frame=(width=960,height=90)=>new Uint8Array([255,216,255,192,0,11,8,height>>8,height&255,width>>8,width&255,1,1,17,0,255,217]);
it('accepts legacy sprite dimensions before decoding',()=>{expect(()=>validatePreviewJpeg(frame())).not.toThrow();});
it.each([[961,90],[960,91],[65535,65535],[0,0]])('rejects unbounded or unsupported dimensions %s×%s',(w,h)=>{expect(()=>validatePreviewJpeg(frame(w,h))).toThrow();});
it('rejects missing and truncated JPEG headers',()=>{for(const data of [new Uint8Array(),new Uint8Array([255,216,255,217]),frame().slice(0,10)])expect(()=>validatePreviewJpeg(data)).toThrow();});
