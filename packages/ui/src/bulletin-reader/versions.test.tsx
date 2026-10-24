import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it} from 'vitest';
import * as UI from '../index.js';
import * as V1 from './BulletinDocumentRenderer.js';
import * as V2 from './v2/BulletinDocumentRenderer.js';
import * as V3 from './v3/BulletinDocumentRenderer.js';
import * as V4 from './v4/BulletinDocumentRenderer.js';
import * as V5 from './v5/BulletinDocumentRenderer.js';
import * as V6 from './v6/BulletinDocumentRenderer.js';
import * as V7 from './v7/BulletinDocumentRenderer.js';
import * as V8 from './v8/BulletinDocumentRenderer.js';
import * as V9 from './v9/BulletinDocumentRenderer.js';
import * as V10 from './v10/BulletinDocumentRenderer.js';

import * as V11 from './v11/BulletinDocumentRenderer.js';

const versions = [
  ['v1', V1, UI.BULLETIN_RENDERER_V1_DIGEST, false, 'legacy', 'legacy', false],
  ['v2', V2, UI.BULLETIN_RENDERER_V2_DIGEST, false, 'legacy', 'legacy', false],
  ['v3', V3, UI.BULLETIN_RENDERER_V3_DIGEST, false, 'legacy', 'legacy', false],
  ['v4', V4, UI.BULLETIN_RENDERER_V4_DIGEST, false, 'legacy', 'legacy', false],
  ['v5', V5, UI.BULLETIN_RENDERER_V5_DIGEST, false, 'legacy', 'legacy', false],
  ['v6', V6, UI.BULLETIN_RENDERER_V6_DIGEST, false, 'legacy', 'historical', false],
  ['v7', V7, UI.BULLETIN_RENDERER_V7_DIGEST, false, 'v7', 'historical', false],
  ['v8', V8, UI.BULLETIN_RENDERER_V8_DIGEST, false, 'v7', 'historical', true],
  ['v9', V9, UI.BULLETIN_RENDERER_V9_DIGEST, true, 'v7', 'snapshot', true],
  ['v11', V11, UI.BULLETIN_RENDERER_V11_DIGEST, true, 'v7', 'snapshot', true],
  ['v10', V10, UI.BULLETIN_RENDERER_V10_DIGEST, true, 'v7', 'snapshot', true],
] as const;

it.each(versions)('%s retains its existing capabilities and immutable validators', (version, frozen, digest, usesTemplateSnapshot, fontFamily, fixedTextFamily, composerOwnsCoverSpacing) => {
  const capabilities = UI.getBulletinRendererCapabilities(version);
  expect(capabilities).toEqual({usesTemplateSnapshot, fontFamily, fixedTextFamily, composerOwnsCoverSpacing});
  expect(Object.isFrozen(capabilities)).toBe(true);
  for (const templateVersion of ['v1', 'v2'] as const) {
    const manifest: UI.BulletinLayoutManifest = {templateVersion, rendererVersion: version, rendererArtifactSha256: digest, assets: [], pages: []};
    if ((version === 'v1' && templateVersion === 'v2') || (version === 'v2' && templateVersion === 'v1')) {
      expect(() => UI.requireBulletinRenderer(manifest)).toThrow('update_required');
      continue;
    }
    expect(() => UI.requireBulletinRenderer(manifest)).not.toThrow();
    expect(() => UI.requireBulletinRenderer({...manifest, rendererArtifactSha256: '0'.repeat(64)})).toThrow('update_required');
    expect(() => UI.requireBulletinRenderer({...manifest, templateVersion: 'unsupported' as 'v1'})).toThrow('update_required');
    const document: UI.BulletinRenderableDocument = {schemaVersion: '1', templateVersion, contentLocale: templateVersion === 'v2' ? 'zh-Hans' : 'zh-Hant', sourcePageCount: 1, pages: [{id: 'p', width: 595, height: 842}], layoutManifest: {...manifest, pages: [{pageId: 'p', slots: []}]}, components: [], ...(usesTemplateSnapshot ? {templateSnapshot: {version: 1, visionMission: '福音', visionFellowship: '同行', visionCommitment: '愛'}} : {})};
    const Frozen = frozen.BulletinDocumentRenderer;
    expect(renderToStaticMarkup(<UI.BulletinDocumentRenderer document={document}/>)).toBe(renderToStaticMarkup(<Frozen document={document}/>));
    expect(() => renderToStaticMarkup(<UI.BulletinDocumentRenderer document={document} manifest={{...manifest, rendererArtifactSha256: '0'.repeat(64)}}/>)).toThrow('update_required');
  }
});

it.each(['unknown', '', 'constructor', '__proto__'])('rejects unknown version %s for metadata and dispatch', rendererVersion => {
  expect(() => UI.getBulletinRendererCapabilities(rendererVersion)).toThrow('update_required');
  expect(() => UI.requireBulletinRenderer({rendererVersion} as UI.BulletinLayoutManifest)).toThrow('update_required');
  expect(() => UI.BulletinDocumentRenderer({document: {layoutManifest: {rendererVersion}} as UI.BulletinRenderableDocument})).toThrow('update_required');
});
