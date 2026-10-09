import * as traditional from '../fixed.js';
import * as simplified from '../v2/fixed.js';

export type {BulletinCanonicalMetadata, BulletinFixedSlot} from '../fixed.js';
type Locale = 'zh-Hant' | 'zh-Hans';
const labels = {
  historicalVision: ['一個異象：合一與宣教', '一个异象：合一与宣教'],
  historicalGoals: ['兩個目標：宣教為中國、中國為宣教', '两个目标：宣教为中国、中国为宣教'],
  historicalGospelGoals: ['兩個目標：福音為華人、華人為福音', '两个目标：福音为华人、华人为福音'],
  historicalActions: ['三個行動：共同生活、愛與成全、恩膏傳承', '三个行动：共同生活、爱与成全、恩膏传承'],
  historicalCommitment: ['四個堅持：宣教主導、靈恩神學、團隊事奉、門徒訓練', '四个坚持：宣教主导、灵恩神学、团队事奉、门徒训练'],
} as const;

export function bulletinFixedText(element: traditional.BulletinFixedSlot['element'], metadata: traditional.BulletinCanonicalMetadata | undefined, pageNumber: number, sourcePageCount?: number, locale: Locale = 'zh-Hant') {
  if (element in labels) return {text: labels[element as keyof typeof labels][locale === 'zh-Hans' ? 1 : 0], fontRole: 'body' as const, annotatable: false};
  return (locale === 'zh-Hans' ? simplified : traditional).bulletinFixedText(element, metadata, pageNumber, sourcePageCount);
}

export function bulletinFixedGraphic(element: traditional.BulletinFixedSlot['element'], locale: Locale = 'zh-Hant') {
  return (locale === 'zh-Hans' ? simplified : traditional).bulletinFixedGraphic(element);
}
export {bulletinFixedDecoration} from '../fixed.js';
