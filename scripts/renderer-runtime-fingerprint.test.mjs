import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {test} from 'node:test';

test('native fingerprints ignore regenerated cache metadata but retain runtime changes and reject corrupt font caches', () => {
  const images = [];
  const build = (parent, command) => {
    const image = `hhc-fingerprint-test:${randomUUID()}`;
    images.push(image);
    execFileSync('docker', ['build', '-t', image, '-'], {input: `FROM ${parent}\nUSER 0\nRUN ${command}\nUSER 65532:65532\n`, stdio: ['pipe', 'pipe', 'pipe']});
    return image;
  };
  const fingerprint = image => execFileSync('docker', ['run', '--rm', '--network', 'none', '--read-only', '--user', '0',
    '--mount', `type=bind,src=${resolve('scripts/renderer-runtime-fingerprint.mjs')},dst=/tmp/fingerprint.mjs,readonly`,
    '--entrypoint', 'node', image, '/tmp/fingerprint.mjs'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const cacheBytes = image => execFileSync('docker', ['run', '--rm', '--network', 'none', '--read-only', '--entrypoint', 'sh', image,
    '-c', 'sha256sum /var/cache/fontconfig/*.cache-*'], {encoding: 'utf8'});
  try {
    const original = 'hhc-bulletin-renderer:verify';
    const rebuilt = build(original, 'test -d /usr/share/fonts && touch /usr/share/fonts && fc-cache -f');
    assert.notEqual(cacheBytes(original), cacheBytes(rebuilt), 'fixture must change actual binary caches');
    const expected = fingerprint(original);
    assert.equal(fingerprint(rebuilt), expected);
    const changed = build(rebuilt, "printf '\\n' >> /etc/fonts/fonts.conf");
    assert.notEqual(fingerprint(changed), expected, 'font configuration remains a runtime input');
    const changedCache = build(original, `node -e 'const fs=require("fs");const p="/var/cache/fontconfig/"+fs.readdirSync("/var/cache/fontconfig").find(x=>x.endsWith(".cache-9"));const b=fs.readFileSync(p);b[b.length-1]^=1;fs.writeFileSync(p,b)'`);
    assert.notEqual(fingerprint(changedCache), expected, 'cache payload remains an input');
    const corrupt = build(original, 'printf invalid > "$(find /var/cache/fontconfig -name \'*.cache-*\' | head -n 1)"');
    assert.throws(() => fingerprint(corrupt), 'invalid cache must not become reusable evidence');
  } finally {
    for (const image of images) execFileSync('docker', ['image', 'rm', '-f', image], {stdio: 'ignore'});
  }
});
