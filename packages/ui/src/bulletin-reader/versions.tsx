'use client';

import {BulletinDocumentRenderer as V1, requireBulletinRenderer as requireV1, type BulletinDocumentRendererProps, type BulletinLayoutManifest} from './BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V2, requireBulletinRenderer as requireV2} from './v2/BulletinDocumentRenderer.js';

export {BULLETIN_RENDERER_V2_DIGEST} from './v2/artifact.js';

export function requireBulletinRenderer(manifest: BulletinLayoutManifest) {
  if (manifest.rendererVersion === 'v2') requireV2(manifest);
  else requireV1(manifest);
}

export function BulletinDocumentRenderer(props: BulletinDocumentRendererProps) {
  const Renderer = (props.manifest ?? props.document.layoutManifest).rendererVersion === 'v2' ? V2 : V1;
  return <Renderer {...props} />;
}
