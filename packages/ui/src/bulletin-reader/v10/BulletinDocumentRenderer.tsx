'use client';

import {BulletinDocumentRenderer as V9} from '../v9/BulletinDocumentRenderer.js';
import {BULLETIN_RENDERER_V9_DIGEST} from '../v9/artifact.js';
import {BULLETIN_RENDERER_V10_DIGEST} from './artifact.js';
import type {BulletinLayoutManifest, BulletinDocumentRendererProps} from '../BulletinDocumentRenderer.js';

export function requireBulletinRenderer(manifest: BulletinLayoutManifest): void {
  if (!['v1', 'v2'].includes(manifest.templateVersion) || manifest.rendererVersion !== 'v10' || manifest.rendererArtifactSha256 !== BULLETIN_RENDERER_V10_DIGEST) throw new Error('update_required');
}

// V10 changes saved cover composition only; paper rendering remains frozen V9.
export function BulletinDocumentRenderer(props: BulletinDocumentRendererProps) {
  const manifest = props.manifest ?? props.document.layoutManifest;
  requireBulletinRenderer(manifest);
  const inherited = {...manifest, rendererVersion: 'v9' as const, rendererArtifactSha256: BULLETIN_RENDERER_V9_DIGEST};
  return <V9 {...props} document={{...props.document, layoutManifest: inherited}} manifest={inherited}/>;
}
