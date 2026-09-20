import type {components} from '../src/generated.js'

type Text = components['schemas']['RichTextNode']
type Assert<T extends true> = T
type _LegacyTextStillWorks = Assert<{type: 'text'; text: string} extends Text ? true : false>
type _IndependentColorsWork = Assert<{type: 'text'; text: string; color: string; highlight: string} extends Text ? true : false>
type _NoArbitraryProperties = Assert<'style' extends keyof Text ? false : true>
