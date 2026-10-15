import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MANIFEST = 'manifest.json';

export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.filter((f) => f !== MANIFEST).sort();
}

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function buildManifest(kitDir, version) {
  const files = {};
  for (const rel of listFiles(kitDir)) files[rel] = sha256(join(kitDir, rel));
  return { version, files };
}

export function writeManifest(kitDir, version) {
  const m = buildManifest(kitDir, version);
  writeFileSync(join(kitDir, MANIFEST), `${JSON.stringify(m, null, 2)}\n`);
  return m;
}

export function readManifest(kitDir) {
  const p = join(kitDir, MANIFEST);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function diffManifest(kitDir, manifest) {
  const modified = [];
  const missing = [];
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const p = join(kitDir, rel);
    if (!existsSync(p)) missing.push(rel);
    else if (sha256(p) !== hash) modified.push(rel);
  }
  const extra = listFiles(kitDir).filter((rel) => !(rel in manifest.files));
  return { modified, missing, extra };
}
