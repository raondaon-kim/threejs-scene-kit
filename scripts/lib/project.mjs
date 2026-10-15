import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ScriptError } from './output.mjs';

export function resolveProject(dirArg, { needModules = true } = {}) {
  const dir = resolve(typeof dirArg === 'string' ? dirArg : process.cwd());
  if (!existsSync(join(dir, 'scene.ts'))) {
    throw new ScriptError([{ path: 'project', message: `${dir}에 scene.ts가 없음. init.mjs로 프로젝트를 먼저 만들 것` }]);
  }
  if (!existsSync(join(dir, 'kit', 'manifest.json'))) {
    throw new ScriptError([{ path: 'project', message: `${dir}/kit/manifest.json 없음. init.mjs로 만든 프로젝트가 아님` }]);
  }
  if (needModules && !existsSync(join(dir, 'node_modules'))) {
    throw new ScriptError([{ path: 'project', message: `${dir}/node_modules 없음. 프로젝트 폴더에서 npm install을 먼저 실행할 것` }]);
  }
  return dir;
}

function pickEntry(e) {
  if (!e) return null;
  if (typeof e === 'string') return e;
  if (Array.isArray(e)) return pickEntry(e[0]);
  for (const k of ['import', 'node', 'default']) {
    if (e[k]) {
      const r = pickEntry(e[k]);
      if (r) return r;
    }
  }
  return null;
}

/** 프로젝트 node_modules의 패키지를 ESM으로 import (플러그인 자체는 의존성 없음) */
export async function importFromProject(dir, pkg) {
  const pkgDir = join(dir, 'node_modules', ...pkg.split('/'));
  const pjPath = join(pkgDir, 'package.json');
  if (!existsSync(pjPath)) {
    throw new ScriptError([{ path: 'project', message: `${pkg}가 설치되지 않음. 프로젝트 폴더에서 npm install 실행 필요` }]);
  }
  const meta = JSON.parse(readFileSync(pjPath, 'utf8'));
  const exp = meta.exports && (meta.exports['.'] ?? meta.exports);
  const entry = pickEntry(exp) ?? meta.module ?? meta.main ?? 'index.js';
  return import(pathToFileURL(join(pkgDir, entry)).href);
}
