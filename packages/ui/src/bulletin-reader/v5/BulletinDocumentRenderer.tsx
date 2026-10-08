'use client';

import {BulletinDocumentRenderer as Traditional,BULLETIN_RENDERER_V1_DIGEST,type BulletinDocumentRendererProps,type BulletinLayoutManifest} from '../BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as Simplified,BULLETIN_RENDERER_V2_DIGEST} from '../v2/BulletinDocumentRenderer.js';
import {BULLETIN_RENDERER_V5_DIGEST} from './artifact.js';

export {bulletinBlocks} from '../BulletinDocumentRenderer.js';
export function requireBulletinRenderer(manifest:BulletinLayoutManifest) {
  if(!['v1','v2'].includes(manifest.templateVersion)||manifest.rendererVersion!=='v5'||manifest.rendererArtifactSha256!==BULLETIN_RENDERER_V5_DIGEST)throw new Error('update_required');
}

// V5 changes composition/measurement only. Render through the frozen paper
// templates, without mutating the stored manifest or reinterpreting old issues.
export function BulletinDocumentRenderer(props:BulletinDocumentRendererProps) {
  const manifest=props.manifest??props.document.layoutManifest;
  requireBulletinRenderer(manifest);
  const simplified=manifest.templateVersion==='v2';
  const Renderer=simplified?Simplified:Traditional;
  return <Renderer {...props} manifest={{...manifest,rendererVersion:simplified?'v2':'v1',rendererArtifactSha256:simplified?BULLETIN_RENDERER_V2_DIGEST:BULLETIN_RENDERER_V1_DIGEST}}/>;
}
