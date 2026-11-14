import type {createHhcWebClient,HhcWebApiError,OnlineBulletinState,OnlineBulletinCapabilities,OnlineBulletinRecoveryBlocker,OnlineBulletinSimplifiedRecoveryInput,OnlineBulletinSimplifiedRecoveryResult,OnlineBulletinSimplifiedRecoveryReceipt,OnlineBulletinSimplifiedRecoverySource,OnlineBulletinSimplifiedRecoveryBlocker,OnlineBulletinDerivedPublication,OnlineBulletinSimplifiedPublicationSource,OnlineBulletinSimplifiedPublicationFailure,OnlineBulletinSimplifiedPublicationErrorCode,OnlineBulletinSimplifiedPublicationRecovery,OnlineBulletinInitialNotification} from '../src/index.js'

export const legacyCapabilities:OnlineBulletinCapabilities={explicitOnlinePublication:false,qualifiedDraftRecovery:false}
export const intentBlocker:OnlineBulletinSimplifiedRecoveryBlocker='publication_intent_missing'
export const mappingBlocker:OnlineBulletinSimplifiedRecoveryBlocker='mapping_review_required'
// @ts-expect-error Traditional blockers retain their original public union.
export const traditionalBlocker:OnlineBulletinRecoveryBlocker='mapping_review_required'
// @ts-expect-error Hans recovery cannot accept unrelated PDF blockers.
export const pdfBlocker:OnlineBulletinSimplifiedRecoveryBlocker='pdf_not_published'
// @ts-expect-error Unknown producer error text is never part of the typed contract.
export const rawBlocker:OnlineBulletinSimplifiedRecoveryBlocker='private_raw_error'
export function readBlockers(error:HhcWebApiError):readonly OnlineBulletinSimplifiedRecoveryBlocker[]|undefined{return error.simplifiedRecoveryBlockers}
export function readState(state:OnlineBulletinState):[OnlineBulletinDerivedPublication|undefined,OnlineBulletinInitialNotification|undefined]{return [state.derivedPublication,state.notification]}
export const source:OnlineBulletinSimplifiedRecoverySource={documentId:'11111111-1111-4111-8111-111111111111',revision:6,contentHash:'a'.repeat(64),onlineVersion:8}
export const input:OnlineBulletinSimplifiedRecoveryInput={targetDocumentId:'33333333-3333-4333-8333-333333333333',source,canonicalVersion:12,publicationOperationId:'22222222-2222-4222-8222-222222222222',revision:4,layoutValidationHash:'b'.repeat(64)}
// @ts-expect-error Fresh source CAS is mandatory; immutable revision alone is insufficient.
export const missingSourceCAS:OnlineBulletinSimplifiedRecoverySource={documentId:'document',revision:6,contentHash:'a'.repeat(64)}
// @ts-expect-error Recovery requires the exact target identity.
export const missingTarget:OnlineBulletinSimplifiedRecoveryInput={source,canonicalVersion:12,publicationOperationId:'operation',revision:4,layoutValidationHash:'b'.repeat(64)}
export async function verify(client:ReturnType<typeof createHhcWebClient>,signal:AbortSignal):Promise<OnlineBulletinSimplifiedRecoveryResult>{return client.recoverSimplifiedOnlineBulletinPublication({issueId:'issue',series:'general',contentLocale:'zh-Hans'},9,input,'exact-key',signal)}
export function receiptSource(receipt:OnlineBulletinSimplifiedRecoveryReceipt):OnlineBulletinSimplifiedRecoverySource{return receipt.source}
export const unknownSource:OnlineBulletinSimplifiedPublicationSource={documentId:'document',revision:6,contentHash:null,metadataHash:null}
export const failure:OnlineBulletinSimplifiedPublicationFailure={code:'simplified_layout_failed',kind:'failure',phase:'layout',attempts:2,at:'2026-11-14T00:00:00Z'}
// @ts-expect-error Failure records cannot carry an empty failure code.
export const emptyFailure:OnlineBulletinSimplifiedPublicationFailure={code:'',kind:'failure',phase:'layout',attempts:2,at:'2026-11-14T00:00:00Z'}
export const noCurrentError:OnlineBulletinSimplifiedPublicationErrorCode=''
export const recovery:OnlineBulletinSimplifiedPublicationRecovery={authorizationId:'new-authorization',receiptId:'receipt',revision:4,createdAt:'2026-11-14T00:00:00Z'}
export const notification:OnlineBulletinInitialNotification={id:'initial-command',generation:0,status:'accepted',attempts:null,errorCode:'',canonicalVersion:null,createdAt:null,updatedAt:null,nextAttemptAt:null}
// @ts-expect-error Command acceptance does not prove end-recipient delivery.
export const delivered:OnlineBulletinInitialNotification={...notification,status:'delivered'}
// @ts-expect-error Later manual notifications are a different identity.
export const manual:OnlineBulletinInitialNotification={...notification,generation:1}
