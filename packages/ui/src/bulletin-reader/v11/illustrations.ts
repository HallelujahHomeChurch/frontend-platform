import type {components} from '../generated.js';

export function bulletinIllustrationURL(picture: components['schemas']['OnlineBulletinIllustration']): string | undefined {
  if (!picture.png || picture.png.length > 2796204 || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(picture.png)) return undefined;
  return `data:image/png;base64,${picture.png}`;
}
