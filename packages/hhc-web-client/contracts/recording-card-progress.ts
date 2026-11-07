import type {MemberRecordingCard, createHhcWebClient} from '../src/client.js'
const omitted = {} satisfies Pick<MemberRecordingCard, 'playbackProgress'>
const missing = {playbackProgress: null} satisfies Pick<MemberRecordingCard, 'playbackProgress'>
const active = {playbackProgress: {mediaVersion:'vod:package',positionSeconds:42,completed:false}} satisfies Pick<MemberRecordingCard,'playbackProgress'>
const complete = {playbackProgress: {mediaVersion:'vod:package',positionSeconds:100,completed:true}} satisfies Pick<MemberRecordingCard,'playbackProgress'>
// @ts-expect-error completed is a persisted boolean, not a string
const invalid = {playbackProgress: {mediaVersion:'vod:package',positionSeconds:42,completed:'true'}} satisfies Pick<MemberRecordingCard,'playbackProgress'>
async function read(client:ReturnType<typeof createHhcWebClient>){
 const page=await client.listMemberRecordingsPage()
 const progress:MemberRecordingCard['playbackProgress']=page.items[0]?.playbackProgress
 return progress
}
void [omitted,missing,active,complete,invalid,read]
