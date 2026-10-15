import { copyFileSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { diffManifest, readManifest, writeManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { KIT_DIR, pluginVersion, TEMPLATE_DIR } from './lib/paths.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node update.mjs [--project <폴더>] [--force]
  프로젝트의 kit/을 플러그인 최신 버전으로 교체하고, 인프라 파일(vite.config.ts, index.html, tsconfig.json)도 갱신한다.
  scene.ts, package.json, custom/, storyboard/는 건드리지 않는다.
  kit 파일을 로컬에서 수정했다면 목록을 보여주고 거부한다 (--force로 덮어쓰기).
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project, { needModules: false });
  const kitDir = join(dir, 'kit');
  const manifest = readManifest(kitDir);
  const diff = diffManifest(kitDir, manifest);
  const touched = [...diff.modified, ...diff.extra];
  if (touched.length > 0 && !opts.force) {
    throw new ScriptError(
      [{ path: 'kit', message: `로컬에서 수정·추가된 kit 파일이 있음: ${touched.join(', ')}. 커스텀 코드는 custom/으로 옮긴 뒤 --force` }],
      { modified: diff.modified, extra: diff.extra },
    );
  }
  rmSync(kitDir, { recursive: true, force: true });
  cpSync(KIT_DIR, kitDir, { recursive: true });
  const next = writeManifest(kitDir, pluginVersion());
  const infra = ['vite.config.ts', 'index.html', 'tsconfig.json'];
  for (const f of infra) copyFileSync(join(TEMPLATE_DIR, f), join(dir, f));
  return { project: dir, from: manifest.version, to: next.version, overwritten: touched, infra };
}, HELP);
