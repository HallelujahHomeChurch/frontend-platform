import type {components} from './generated.js';
import assets from './template-assets.json' with {type: 'json'};

export type BulletinCanonicalMetadata = components['schemas']['OnlineBulletinCanonicalMetadata'];
export type BulletinFixedSlot = components['schemas']['OnlineBulletinFixedSlot'];

// Church-owned fixed template text, not extracted sermon/member content.
const labels = {
  masthead: '哈利路亞家教會 週報',
  vision: '異象使命：華人遍地興起、福音傳到地極\n團契行動：共同生活、愛與成全、恩膏傳承\n堅持理念：宣教史詩、靈恩神學、團隊事奉、門徒訓練',
  pastor: '主任牧師：曾英欽 牧師',
  contact: '教會地址：臺北市仁愛路三段 29 號 B1\nAddress: No.29,B1,Sec3,Ren-Ai.Rd,Taipei,Taiwan\n電子郵件（E-mail）：home.church@msa.hinet.net\n教會網址（Website）：www.alive.org.tw\n電話（Phone）：(02) 2776-1157 / 8773-1972\n傳真（Fax）：(02) 2781-4980',
  scanHint: '歡迎使用您的手機掃描\n左方的 QRCODE 圖樣\n可以立即加入家教會官網\n直播／下載週報／福音餐會',
  websiteQRLabel: '家教會官網', youtubeQRLabel: '家教會\nYOUTUBE', streamQRLabel: '神國大業\n京成兄妹',
  welcomeLabel: '一、Welcome：', worshipLabel: '二、Worship：', workLabel: '三、Work：', wordLabel: '四、Word：',
  verseLabel: '本週金句', hymnLabel: '詩歌敬拜', summaryLabel: '信息摘要', announcementsLabel: '教會公布欄', prayersLabel: '得勝與代求',
  titleLabel: '本週靈糧主題', speakerLabel: '講員：', transcriberLabel: '謄稿：', editorLabel: '完稿：', authorLabel: '作者：',
} as const;

export function bulletinFixedGraphic(element: BulletinFixedSlot['element']) {
  const prefix = {logo: 'logo-', backgroundLogo: 'logo-', websiteQR: 'qr-website-', youtubeQR: 'qr-youtube-', streamQR: 'qr-stream-'}[element as 'logo' | 'backgroundLogo' | 'websiteQR' | 'youtubeQR' | 'streamQR'];
  if (prefix) {
    const asset = assets.find(asset => asset.kind === 'decoration' && asset.url.split('/').at(-1)?.startsWith(prefix));
    if (!asset) throw new Error('missing_template_asset');
    return asset;
  }
  return undefined;
}

export function bulletinFixedDecoration(element: BulletinFixedSlot['element']) {
  return ['topRule', 'footerRule', 'summaryFrame', 'announcementsFrame', 'prayersFrame'].includes(element);
}

export function bulletinFixedText(element: BulletinFixedSlot['element'], metadata: BulletinCanonicalMetadata | undefined, pageNumber: number) {
  if (bulletinFixedGraphic(element) || bulletinFixedDecoration(element)) return {text: '', fontRole: 'body' as const, annotatable: false};
  if (element === 'pageNumber') return {text: String(pageNumber), fontRole: 'body' as const, annotatable: false};
  if (element in labels) return {text: labels[element as keyof typeof labels], fontRole: element === 'masthead' ? 'body' as const : 'emphasis' as const, annotatable: false};
  if (!metadata) throw new Error('missing_canonical_metadata');
  let text: string;
  switch (element) {
    case 'title': text = metadata.title; break;
    case 'subtitle': text = metadata.subtitle; break;
    case 'issueNumber': text = `第 ${metadata.issueNumber} 期`; break;
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) throw new Error('invalid_canonical_metadata');
      const date = new Date(`${metadata.date}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== metadata.date) throw new Error('invalid_canonical_metadata');
      const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
      if (!month) throw new Error('invalid_canonical_metadata');
      text = `${month}.${date.getUTCDate()}.${date.getUTCFullYear()}`;
      break;
    }
    default: throw new Error('invalid_fixed_element');
  }
  return {text, fontRole: 'emphasis' as const, annotatable: true};
}
