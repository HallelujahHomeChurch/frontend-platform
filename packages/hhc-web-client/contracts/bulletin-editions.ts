import type { bulletinEditions } from '../../preferences/src/index.js'
import type { BulletinTranslationTargetEdition, HhcWebClient } from '../src/client.js'
import type { components } from '../src/generated.js'

type Assert<T extends true> = T
type GeneratedEdition = components['schemas']['BulletinEdition']
type SharedEdition = (typeof bulletinEditions)[number]

type _GeneratedAcceptsEverySharedEdition = Assert<SharedEdition extends GeneratedEdition ? true : false>
type _SharedAcceptsEveryGeneratedEdition = Assert<GeneratedEdition extends SharedEdition ? true : false>
type _BulletinsRejectJapanese = Assert<'ja' extends GeneratedEdition ? false : true>
type _BulletinsRejectKorean = Assert<'ko' extends GeneratedEdition ? false : true>

type ClientEdition = Parameters<HhcWebClient['updateBulletinVersion']>[1]
type _ClientUsesEverySharedEdition = Assert<SharedEdition extends ClientEdition ? true : false>
type _ClientRejectsNonEditions = Assert<ClientEdition extends SharedEdition ? true : false>

type ExpectedTranslationTarget = 'zh-Hans' | 'en'
type _TranslationTargetsAreEditions = Assert<BulletinTranslationTargetEdition extends ExpectedTranslationTarget ? true : false>
type _EveryBulletinTargetIsAvailable = Assert<ExpectedTranslationTarget extends BulletinTranslationTargetEdition ? true : false>
