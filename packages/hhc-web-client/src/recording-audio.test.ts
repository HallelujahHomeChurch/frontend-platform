import {expectTypeOf,it} from 'vitest';
import type {MemberRecordingPlayback} from './client.js';
it('keeps audio optional and confines it to the immutable versioned playlist',()=>{
 expectTypeOf<MemberRecordingPlayback['audio']>().toEqualTypeOf<{version:'aac-hls-v1';playlistPath:'audio/aac-hls-v1/index.m3u8'}|undefined>();
});

it('keeps availability optional without treating absent metadata as pending',()=>{
 expectTypeOf<MemberRecordingPlayback['audioState']>().toEqualTypeOf<'pending'|'processing'|'ready'|'failed'|undefined>();
});
