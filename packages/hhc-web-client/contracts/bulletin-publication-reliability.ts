import type {BulletinPublishOptions,OnlineBulletinState,OnlineBulletinProduction,OnlineBulletinRecoveryInput,OnlineBulletinRecoveryResult,OnlineBulletinRecoveryBlocker,HhcWebApiError,createHhcWebClient} from '../src/client.js'

export const legacyOptions:BulletinPublishOptions={notifySubscribers:false}
export const pdfOnly:BulletinPublishOptions={notifySubscribers:false,onlinePublication:'pdf_only',onlineVersion:0}
// @ts-expect-error PDF-only cancellation requires the current Online version, including zero.
export const missingOnlineVersion:BulletinPublishOptions={notifySubscribers:false,onlinePublication:'pdf_only'}
// @ts-expect-error Preservation cannot take a cancellation CAS value.
export const continueWithOnlineVersion:BulletinPublishOptions={notifySubscribers:false,onlinePublication:'continue_automatic',onlineVersion:1}
// @ts-expect-error An omitted intent choice cannot take a cancellation CAS value.
export const omittedWithOnlineVersion:BulletinPublishOptions={notifySubscribers:false,onlineVersion:1}
export const knownBlocker:OnlineBulletinRecoveryBlocker='layout_not_ready'
// @ts-expect-error Unreviewed server metadata is not a qualified recovery blocker.
export const unknownBlocker:OnlineBulletinRecoveryBlocker='arbitrary_text'
export function readBlockers(error:HhcWebApiError):readonly OnlineBulletinRecoveryBlocker[]|undefined{return error.blockers}

export function acceptLegacyState(value:Omit<OnlineBulletinState,'capabilities'|'production'>):OnlineBulletinState{return value}
export function acceptLegacyAutomation(value:Omit<NonNullable<OnlineBulletinState['automation']>,'disposition'>):NonNullable<OnlineBulletinState['automation']>{return value}
export function readOptionalProgress(value:OnlineBulletinState):OnlineBulletinProduction|undefined{return value.production}

export async function verifyRecoveryTypes(client:ReturnType<typeof createHhcWebClient>,input:OnlineBulletinRecoveryInput,signal:AbortSignal):Promise<OnlineBulletinRecoveryResult>{
  return client.recoverOnlineBulletinPublication({issueId:'issue',series:'general',contentLocale:'zh-Hant'},1,input,'caller-owned-key',signal)
}
