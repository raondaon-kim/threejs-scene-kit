import { copyFileSync, cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffManifest, readManifest, writeManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { KIT_DIR, pluginVersion, TEMPLATE_DIR } from './lib/paths.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node update.mjs [--project <폴더>] [--force]
  프로젝트의 kit/을 플러그인 최신 버전으로 교체하고, 인프라 파일(vite.config.ts, index.html, tsconfig.json)도 갱신한다.
  scene.ts, custom/, storyboard/는 건드리지 않는다. package.json은 템플릿 의존성 중 없는 것만 추가한다
  (추가되면 출력 install: true → 프로젝트에서 npm install).
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
  // 템플릿 의존성 중 프로젝트에 없는 것만 추가 (기존 버전·사용자 의존성은 그대로)
  const pkgFile = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  const tpl = JSON.parse(readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf8'));
  const addedDeps = [];
  for (const sec of ['dependencies', 'devDependencies']) {
    for (const [name, ver] of Object.entries(tpl[sec] ?? {})) {
      pkg[sec] ??= {};
      if (pkg[sec][name] === undefined && pkg.dependencies?.[name] === undefined && pkg.devDependencies?.[name] === undefined) {
        pkg[sec][name] = ver;
        addedDeps.push(name);
      }
    }
  }
  if (addedDeps.length) writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}
`);
  const install = addedDeps.length > 0;
  const next2 = install ? [`npm install --prefix "${dir}"  (새 의존성: ${addedDeps.join(', ')})`] : [];
  return { project: dir, from: manifest.version, to: next.version, overwritten: touched, infra, install, addedDeps, next: next2 };
}, HELP);
