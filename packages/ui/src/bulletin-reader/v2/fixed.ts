import type {components} from '../generated.js';
import assets from './template-assets.json' with {type: 'json'};

export type BulletinCanonicalMetadata = components['schemas']['OnlineBulletinCanonicalMetadata'];
export type BulletinFixedSlot = components['schemas']['OnlineBulletinFixedSlot'];

// Church-owned fixed template text, not extracted sermon/member content.
const labels = {
  masthead: '哈利路亚家教会 周报',
  vision: '异象使命：华人遍地兴起、福音传到地极\n团契行动：共同生活、爱与成全、恩膏传承\n坚持理想：宣教主导、灵恩神学、团队事奉、门徒训练',
  visionMission: '异象使命：华人遍地兴起、福音传到地极',
  visionFellowship: '团契行动：共同生活、爱与成全、恩膏传承',
  visionCommitment: '坚持理想：宣教主导、灵恩神学、团队事奉、门徒训练',
  pastor: '主任牧师：曾英钦 牧师',
  contact: '教会地址：台北市仁爱路三段 29 号 B1\nAddress:No.29,B1,Sec3,Ren-Ai.Rd,Taipei,Taiwan\n电子邮件 (E-mail)：home.church@msa.hinet.net\n教会网址 (Website)：www.alive.org.tw\n电话 (Phone)：(02) 2776-1157 / 8773-1972\n传真 (Fax)：(02) 2781-4980',
  scanHint: '欢迎使用您的手机扫描\n左方的 QRCODE 图样\n可以立即加入家教会官网\n直播/下载周报/福音餐会',
  websiteQRLabel: '家教会官网', youtubeQRLabel: '家教会\nYOUTUBE', streamQRLabel: '神国大乐\n京成兄妹',
  welcomeLabel: '一、Welcome：', worshipLabel: '二、Worship：', workLabel: '三、Work：', wordLabel: '四、Word：',
  verseLabel: '本周金句', hymnLabel: '小组诗歌', summaryLabel: '信息摘要', announcementsLabel: '家教会公布栏', prayersLabel: '得胜与代求',
  titleLabel: '本周灵粮主题', speakerLabel: '讲员：', speakerSeparator: '～', transcriberLabel: '誊修：', editorLabel: '完稿：', authorLabel: '作者：',
  lectureDateMarker: '‧', bodySpeakerLabel: '‧讲员：',
  summarySidebarTitle: '家教会周报', summarySidebarTagline: '一看再看、百看不厌的',
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

export function bulletinFixedText(element: BulletinFixedSlot['element'], metadata: BulletinCanonicalMetadata | undefined, pageNumber: number, sourcePageCount?: number) {
  if (bulletinFixedGraphic(element) || bulletinFixedDecoration(element)) return {text: '', fontRole: 'body' as const, annotatable: false};
  if (element === 'pageNumber') return {text: String(pageNumber), fontRole: 'body' as const, annotatable: false};
  if (element in labels) {
    const body = ['masthead', 'welcomeLabel', 'worshipLabel', 'workLabel', 'wordLabel'].includes(element);
    const scripture = ['speakerSeparator', 'contact', 'websiteQRLabel', 'youtubeQRLabel', 'streamQRLabel'].includes(element);
    return {text: labels[element as keyof typeof labels], fontRole: body ? 'body' as const : scripture ? 'scripture' as const : 'emphasis' as const, annotatable: false};
  }
  if (!metadata) throw new Error('missing_canonical_metadata');
  if (element === 'bodyIssueSummary') {
    if (typeof sourcePageCount !== 'number' || !Number.isInteger(sourcePageCount) || sourcePageCount < 4 || sourcePageCount > 40) throw new Error('invalid_source_page_count');
    return {text: `(${metadata.issueNumber}共${sourcePageCount - 2}页)`, fontRole: 'emphasis' as const, annotatable: false};
  }
  let text: string;
  switch (element) {
    case 'title': text = metadata.title; break;
    case 'subtitle': text = metadata.subtitle; break;
    case 'issueNumber': text = `第${metadata.issueNumber}期`; break;
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
