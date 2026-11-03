import type {MemberRecording, MemberLiveRecording, RecordingWatchView} from '../src/client.js'

const recording = {publicId: 'FA0AoBO02uU'} satisfies Pick<MemberRecording, 'publicId'>
const live = {publicId: recording.publicId, coverMode: 'custom'} satisfies Pick<MemberLiveRecording, 'publicId' | 'coverMode'>
const watch = {publicId: live.publicId, coverMode: 'auto'} satisfies Pick<RecordingWatchView, 'publicId' | 'coverMode'>
const older = {} satisfies Pick<RecordingWatchView, 'publicId' | 'coverMode'>
// @ts-expect-error unknown live cover modes must not be accepted
const invalid = {coverMode: 'dynamic'} satisfies Pick<RecordingWatchView, 'coverMode'>
void [recording, live, watch, older, invalid]
