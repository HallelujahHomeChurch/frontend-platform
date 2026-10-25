import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync, readlinkSync} from 'node:fs';
import {join} from 'node:path';

// Ignore Docker-injected mounts and installation logs; executable files and native caches remain inputs.
const excluded = new Set(['/proc', '/sys', '/dev', '/tmp', '/run', '/var/log', '/etc/hosts', '/etc/hostname', '/etc/resolv.conf', '/.dockerenv']);
const hash = createHash('sha256');
function visit(path) {
  if (excluded.has(path)) return;
  const stat = lstatSync(path);
  hash.update(JSON.stringify([path, stat.mode & 0o7777, stat.uid, stat.gid]));
  if (stat.isSymbolicLink()) hash.update(readlinkSync(path));
  else if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
  else if (stat.isFile()) hash.update(createHash('sha256').update(readFileSync(path)).digest());
  else throw new Error(`unsupported image entry: ${path}`);
}
visit('/');
console.log(hash.digest('hex'));
