import type { contentLocales } from '../../preferences/src/index.js'
import type { components } from '../src/generated.js'

type Assert<T extends true> = T
type GeneratedLocale = components['schemas']['Locale']
type SharedLocale = (typeof contentLocales)[number]

type _GeneratedAcceptsEverySharedLocale = Assert<SharedLocale extends GeneratedLocale ? true : false>
type _SharedLocalesAcceptEveryGeneratedLocale = Assert<GeneratedLocale extends SharedLocale ? true : false>
