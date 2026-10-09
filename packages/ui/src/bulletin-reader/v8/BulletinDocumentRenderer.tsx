'use client';

import {BulletinDocumentRenderer as V7, BULLETIN_RENDERER_V7_DIGEST} from '../v7/BulletinDocumentRenderer.js';
import type {BulletinDocumentRendererProps, BulletinLayoutManifest} from '../BulletinDocumentRenderer.js';
import {BULLETIN_RENDERER_V8_DIGEST} from './artifact.js';

export {bulletinBlocks} from '../BulletinDocumentRenderer.js';
export function requireBulletinRenderer(manifest: BulletinLayoutManifest) {
  if (!['v1', 'v2'].includes(manifest.templateVersion) || manifest.rendererVersion !== 'v8' || manifest.rendererArtifactSha256 !== BULLETIN_RENDERER_V8_DIGEST) throw new Error('update_required');
}

// V8 changes saved geometry only; keep the exact V7 fonts and paper renderer.
export function BulletinDocumentRenderer(props: BulletinDocumentRendererProps) {
  const manifest = props.manifest ?? props.document.layoutManifest;
  requireBulletinRenderer(manifest);
  return <V7 {...props} manifest={{...manifest, rendererVersion: 'v7', rendererArtifactSha256: BULLETIN_RENDERER_V7_DIGEST}} />;
}
