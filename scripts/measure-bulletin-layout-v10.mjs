import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {measureBulletinLayout as measureV9, composeBulletinLayout as composeV9, composeBulletinBodyLayout as bodyV9} from './measure-bulletin-layout-v9.mjs';
import {composeDenseCover} from './compose-dense-cover-v10.mjs';
import {BULLETIN_RENDERER_V9_DIGEST} from '../packages/ui/dist/bulletin-reader/v9/artifact.js';
import {BULLETIN_RENDERER_V10_DIGEST} from '../packages/ui/dist/bulletin-reader/v10/artifact.js';
import {requireBulletinRenderer} from '../packages/ui/dist/bulletin-reader/v10/BulletinDocumentRenderer.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const encode = (input, submission) => {
  const submissionJSON = JSON.stringify(submission);
  return {...input, submissionJSON, expectedContentHash: hash(submissionJSON)};
};
function inherited(input) {
  if (typeof input.submissionJSON !== 'string' || Buffer.byteLength(input.submissionJSON) > 8 * 1024 * 1024 || hash(input.submissionJSON) !== input.expectedContentHash) throw new Error('stale_content');
  const submission = JSON.parse(input.submissionJSON);
  requireBulletinRenderer(submission.document.layoutManifest);
  Object.assign(submission.document.layoutManifest, {rendererVersion: 'v9', rendererArtifactSha256: BULLETIN_RENDERER_V9_DIGEST});
  return encode(input, submission);
}
export async function measureBulletinLayout(input) {
  const {layoutValidationHash: _, ...measured} = await measureV9(inherited(input));
  const result = {...measured, contentHash: input.expectedContentHash, rendererArtifactSha256: BULLETIN_RENDERER_V10_DIGEST};
  return {...result, layoutValidationHash: hash(JSON.stringify(result))};
}
async function restore(input, composed) {
  const submission = JSON.parse(composed.submissionJSON);
  Object.assign(submission.document.layoutManifest, {rendererVersion: 'v10', rendererArtifactSha256: BULLETIN_RENDERER_V10_DIGEST});
  const next = encode(input, submission), measurement = await measureBulletinLayout(next);
  if (measurement.overflow.length) throw new Error('page_requires_edit');
  return {submissionJSON: next.submissionJSON, expectedContentHash: next.expectedContentHash, measurement};
}
export const composeBulletinBodyLayout = async input => restore(input, await bodyV9(inherited(input)));
export async function composeBulletinLayout(input) {
  const original = inherited(input);
  try {return await restore(input, await composeV9(original));}
  catch (error) {
    if (error.message !== 'cover_requires_edit') throw error;
    return composeDenseCover(input, measureBulletinLayout, composeBulletinBodyLayout);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), compose = args[0] === '--compose';
    if (compose) args.shift();
    if (args.length !== 2) throw new Error('invalid_arguments');
    const [inputPath, assetsDirectory] = args;
    const file = await open(inputPath, 'r');
    let input;
    try {
      if (!(await file.stat()).isFile()) throw new Error('invalid_input');
      const bytes = Buffer.alloc(16 * 1024 * 1024 + 1);
      const {bytesRead} = await file.read(bytes, 0, bytes.length, 0);
      if (bytesRead === bytes.length) throw new Error('input_too_large');
      input = JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'));
    } finally {await file.close();}
    process.stdout.write(JSON.stringify(await (compose ? composeBulletinLayout : measureBulletinLayout)({...input, assetsDirectory})) + '\n');
  } catch {process.stderr.write('layout_runner_failed\n'); process.exitCode = 1;}
}
