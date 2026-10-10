import {readFile, writeFile} from 'node:fs/promises';
import openapiTS, {astToString} from 'openapi-typescript';
import {parse} from 'yaml';

// Uses the endpoint client's generator, without a UI runtime dependency on it.
const contract = new URL('../../ui/openapi/online-bulletin.json', import.meta.url);
const output = new URL('../../ui/src/bulletin-reader/generated.ts', import.meta.url);
const sourceIndex = process.argv.indexOf('--source');
if (sourceIndex !== -1) {
  const api = parse(await readFile(process.argv[sourceIndex + 1], 'utf8'));
  const schemas = Object.fromEntries(Object.entries(api.components.schemas).filter(([name]) => name.startsWith('OnlineBulletin') || name === 'BulletinTemplateSettings'));
  // Include referenced shared enums/models so the standalone domain is valid.
  const pending = Object.keys(schemas);
  for (const name of pending) {
    for (const [, dependency] of JSON.stringify(schemas[name]).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g)) {
      if (dependency in schemas) continue;
      if (!(dependency in api.components.schemas)) throw new Error(`Missing schema: ${dependency}`);
      schemas[dependency] = api.components.schemas[dependency];
      pending.push(dependency);
    }
  }
  await writeFile(contract, JSON.stringify({openapi: api.openapi, info: {title: 'Weekly bulletin domain', version: '1'}, paths: {}, components: {schemas}}, null, 2) + '\n');
}
const generated = '// Generated from hhc-web-api OpenAPI components. Do not edit.\n' + astToString(await openapiTS(contract));
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== generated) throw new Error('Bulletin domain types are stale; regenerate them.');
} else {
  await writeFile(output, generated);
}
