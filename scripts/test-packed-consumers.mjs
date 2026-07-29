import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const temp = mkdtempSync(resolve(tmpdir(), 'hhc-package-smoke-'));
const {version} = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const tarballs = Object.fromEntries(
  readdirSync(artifacts)
    .filter((file) => file.endsWith('.tgz'))
    .map((file) => [file.match(new RegExp(`hallelujahhomechurch-(.+)-${version.replaceAll('.', '\\.')}.tgz$`))?.[1], resolve(artifacts, file)])
);

for (const name of ['preferences', 'account-client', 'hhc-web-client', 'ui']) {
  if (!tarballs[name]) throw new Error(`Missing package tarball: ${name}`);
}

const packageDependencies = Object.fromEntries(
  Object.entries(tarballs).map(([name, path]) => [
    `@hallelujahhomechurch/${name}`,
    `file:${path}`
  ])
);

function write(path, contents) {
  mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, contents);
}

function run(directory, ...args) {
  const result = spawnSync('corepack', ['pnpm', ...args], {
    cwd: directory,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const vite = resolve(temp, 'vite');
  write(resolve(vite, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    packageManager: 'pnpm@10.12.1',
    scripts: {build: 'vite build'},
    dependencies: {
      ...packageDependencies,
      '@vitejs/plugin-react': '6.0.3',
      react: '19.2.7',
      'react-dom': '19.2.7',
      vite: '8.1.4'
    },
    devDependencies: {}
  }, null, 2));
  write(resolve(vite, 'index.html'), '<main id="root"></main><script type="module" src="/src/main.tsx"></script>');
  write(resolve(vite, 'vite.config.ts'), "import react from '@vitejs/plugin-react';\nimport {defineConfig} from 'vite';\nexport default defineConfig({plugins: [react()]});\n");
  write(resolve(vite, 'src/main.tsx'), `import React from 'react';
import {createRoot} from 'react-dom/client';
import {createAccountSessionClient} from '@hallelujahhomechurch/account-client';
import {createHhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getInitialTheme} from '@hallelujahhomechurch/preferences';
import {Button} from '@hallelujahhomechurch/ui';
import '@hallelujahhomechurch/ui/styles.css';

void createAccountSessionClient;
void createHhcWebClient;
void getInitialTheme;
createRoot(document.getElementById('root')!).render(<Button>Smoke</Button>);
`);
  run(vite, 'install', '--ignore-workspace');
  run(vite, 'exec', 'node', '--input-type=module', '--eval', `
    await import('@hallelujahhomechurch/account-client');
    await import('@hallelujahhomechurch/hhc-web-client');
    await import('@hallelujahhomechurch/preferences');
    await import('@hallelujahhomechurch/ui');
  `);
  run(vite, 'build');

  const next = resolve(temp, 'next');
  write(resolve(next, 'package.json'), JSON.stringify({
    private: true,
    packageManager: 'pnpm@10.12.1',
    scripts: {build: 'next build'},
    dependencies: {
      ...packageDependencies,
      next: '16.2.9',
      react: '19.2.7',
      'react-dom': '19.2.7'
    },
    devDependencies: {
      '@types/node': '24.10.13',
      '@types/react': '19.2.17',
      '@types/react-dom': '19.2.3',
      typescript: '6.0.3'
    },
    pnpm: {onlyBuiltDependencies: ['sharp']}
  }, null, 2));
  write(resolve(next, 'app/layout.tsx'), `import '@hallelujahhomechurch/ui/styles.css';
export default function Layout({children}: {children: React.ReactNode}) {
  return <html><body>{children}</body></html>;
}
`);
  write(resolve(next, 'app/page.tsx'), `'use client';
import {createAccountSessionClient} from '@hallelujahhomechurch/account-client';
import {createHhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getInitialTheme} from '@hallelujahhomechurch/preferences';
import {Button} from '@hallelujahhomechurch/ui';

void createAccountSessionClient;
void createHhcWebClient;
void getInitialTheme;
export default function Page() { return <Button>Smoke</Button>; }
`);
  run(next, 'install', '--ignore-workspace');
  run(next, 'build');
} finally {
  rmSync(temp, {recursive: true, force: true});
}

console.log(`Packed consumer builds pass (${basename(artifacts)}).`);
