'use client';

import {BulletinDocumentRenderer as V1, requireBulletinRenderer as requireV1, type BulletinDocumentRendererProps, type BulletinLayoutManifest} from './BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V2, requireBulletinRenderer as requireV2} from './v2/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V3, requireBulletinRenderer as requireV3} from './v3/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V4, requireBulletinRenderer as requireV4} from './v4/BulletinDocumentRenderer.js';

import {BulletinDocumentRenderer as V5, requireBulletinRenderer as requireV5} from './v5/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V6, requireBulletinRenderer as requireV6} from './v6/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V7, requireBulletinRenderer as requireV7} from './v7/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V8, requireBulletinRenderer as requireV8} from './v8/BulletinDocumentRenderer.js';

export {BULLETIN_RENDERER_V5_DIGEST} from './v5/artifact.js';
export {BULLETIN_RENDERER_V6_DIGEST} from './v6/artifact.js';
export {BULLETIN_RENDERER_V7_DIGEST} from './v7/artifact.js';
export {BULLETIN_RENDERER_V8_DIGEST} from './v8/artifact.js';
export {BULLETIN_RENDERER_V2_DIGEST} from './v2/artifact.js';
export {BULLETIN_RENDERER_V3_DIGEST} from './v3/artifact.js';
export {BULLETIN_RENDERER_V4_DIGEST} from './v4/artifact.js';

export function requireBulletinRenderer(manifest: BulletinLayoutManifest) {
  if (manifest.rendererVersion === 'v8') requireV8(manifest);
  else if (manifest.rendererVersion === 'v7') requireV7(manifest);
  else if (manifest.rendererVersion === 'v6') requireV6(manifest);
  else if (manifest.rendererVersion === 'v5') requireV5(manifest);
  else if (manifest.rendererVersion === 'v4') requireV4(manifest);
  else if (manifest.rendererVersion === 'v3') requireV3(manifest);
  else if (manifest.rendererVersion === 'v2') requireV2(manifest);
  else requireV1(manifest);
}

export function BulletinDocumentRenderer(props: BulletinDocumentRendererProps) {
  const version=(props.manifest ?? props.document.layoutManifest).rendererVersion;
  const Renderer = version==='v8'?V8:version==='v7'?V7:version==='v6'?V6:version==='v5'?V5:version==='v4'?V4:version==='v3'?V3:version==='v2'?V2:V1;
  return <Renderer {...props} />;
}
