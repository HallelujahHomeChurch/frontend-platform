'use client';

import {BulletinDocumentRenderer as V1, requireBulletinRenderer as requireV1, type BulletinDocumentRendererProps, type BulletinLayoutManifest} from './BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V2, requireBulletinRenderer as requireV2} from './v2/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V3, requireBulletinRenderer as requireV3} from './v3/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V4, requireBulletinRenderer as requireV4} from './v4/BulletinDocumentRenderer.js';

import {BulletinDocumentRenderer as V5, requireBulletinRenderer as requireV5} from './v5/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V6, requireBulletinRenderer as requireV6} from './v6/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V7, requireBulletinRenderer as requireV7} from './v7/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V8, requireBulletinRenderer as requireV8} from './v8/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V9, requireBulletinRenderer as requireV9} from './v9/BulletinDocumentRenderer.js';
import {BulletinDocumentRenderer as V10, requireBulletinRenderer as requireV10} from './v10/BulletinDocumentRenderer.js';

import {BulletinDocumentRenderer as V11, requireBulletinRenderer as requireV11} from './v11/BulletinDocumentRenderer.js';

export {BULLETIN_RENDERER_V11_DIGEST} from './v11/artifact.js';
export {BULLETIN_RENDERER_V5_DIGEST} from './v5/artifact.js';
export {BULLETIN_RENDERER_V6_DIGEST} from './v6/artifact.js';
export {BULLETIN_RENDERER_V7_DIGEST} from './v7/artifact.js';
export {BULLETIN_RENDERER_V8_DIGEST} from './v8/artifact.js';
export {BULLETIN_RENDERER_V9_DIGEST} from './v9/artifact.js';
export {BULLETIN_RENDERER_V10_DIGEST} from './v10/artifact.js';
export {BULLETIN_RENDERER_V2_DIGEST} from './v2/artifact.js';
export {BULLETIN_RENDERER_V3_DIGEST} from './v3/artifact.js';
export {BULLETIN_RENDERER_V4_DIGEST} from './v4/artifact.js';

export interface BulletinRendererCapabilities {
  usesTemplateSnapshot: boolean;
  fontFamily: 'legacy' | 'v7';
  fixedTextFamily: 'legacy' | 'historical' | 'snapshot';
  composerOwnsCoverSpacing: boolean;
}

type RendererEntry = {
  Renderer: typeof V1;
  require: typeof requireV1;
  capabilities: Readonly<BulletinRendererCapabilities>;
};

const renderers: Record<string, RendererEntry> = {
  v1: {Renderer: V1, require: requireV1, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'legacy', fixedTextFamily: 'legacy', composerOwnsCoverSpacing: false})},
  v2: {Renderer: V2, require: requireV2, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'legacy', fixedTextFamily: 'legacy', composerOwnsCoverSpacing: false})},
  v3: {Renderer: V3, require: requireV3, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'legacy', fixedTextFamily: 'legacy', composerOwnsCoverSpacing: false})},
  v4: {Renderer: V4, require: requireV4, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'legacy', fixedTextFamily: 'legacy', composerOwnsCoverSpacing: false})},
  v5: {Renderer: V5, require: requireV5, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'legacy', fixedTextFamily: 'legacy', composerOwnsCoverSpacing: false})},
  v6: {Renderer: V6, require: requireV6, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'legacy', fixedTextFamily: 'historical', composerOwnsCoverSpacing: false})},
  v7: {Renderer: V7, require: requireV7, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'v7', fixedTextFamily: 'historical', composerOwnsCoverSpacing: false})},
  v8: {Renderer: V8, require: requireV8, capabilities: Object.freeze({usesTemplateSnapshot: false, fontFamily: 'v7', fixedTextFamily: 'historical', composerOwnsCoverSpacing: true})},
  v9: {Renderer: V9, require: requireV9, capabilities: Object.freeze({usesTemplateSnapshot: true, fontFamily: 'v7', fixedTextFamily: 'snapshot', composerOwnsCoverSpacing: true})},
  v11: {Renderer: V11, require: requireV11, capabilities: Object.freeze({usesTemplateSnapshot: true, fontFamily: 'v7', fixedTextFamily: 'snapshot', composerOwnsCoverSpacing: true})},
  v10: {Renderer: V10, require: requireV10, capabilities: Object.freeze({usesTemplateSnapshot: true, fontFamily: 'v7', fixedTextFamily: 'snapshot', composerOwnsCoverSpacing: true})},
};

function rendererEntry(version: string): RendererEntry {
  if (!Object.hasOwn(renderers, version)) throw new Error('update_required');
  return renderers[version];
}

export function getBulletinRendererCapabilities(version: string): Readonly<BulletinRendererCapabilities> {
  return rendererEntry(version).capabilities;
}

export function requireBulletinRenderer(manifest: BulletinLayoutManifest) {
  rendererEntry(manifest.rendererVersion).require(manifest);
}

export function BulletinDocumentRenderer(props: BulletinDocumentRendererProps) {
  const {Renderer} = rendererEntry((props.manifest ?? props.document.layoutManifest).rendererVersion);
  return <Renderer {...props} />;
}
