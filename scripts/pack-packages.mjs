import {rmSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const packages = ['preferences', 'account-client', 'hhc-web-client', 'ui'];

rmSync(artifacts, {recursive: true, force: true});
mkdirSync(artifacts);

for (const name of packages) {
  const result = spawnSync(
    'corepack',
    ['pnpm', '--dir', resolve(root, 'packages', name), 'pack', '--pack-destination', artifacts],
    {stdio: 'inherit'}
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
