import { join } from 'node:path';
import { openKit } from './lib/browser.mjs';
import { diffManifest, readManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { pluginVersion } from './lib/paths.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node check.mjs [--project <폴더>]
  scene.ts를 브라우저에서 로드해 검증한다 (데이터 검증 + 모듈 생성 + 콘솔 오류).
  kit 로컬 수정 여부와 플러그인 버전 차이도 보고한다.
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  const kitDir = join(dir, 'kit');
  const manifest = readManifest(kitDir);
  const diff = diffManifest(kitDir, manifest);
  const kitInfo = { version: manifest.version, plugin: pluginVersion(), ...diff };
  const warnings = [];
  if (diff.modified.length) warnings.push(`kit 파일이 로컬에서 수정됨: ${diff.modified.join(', ')}`);
  if (manifest.version !== kitInfo.plugin) warnings.push(`kit ${manifest.version} < 플러그인 ${kitInfo.plugin}. update.mjs로 갱신 가능`);
  const kit = await openKit(dir, { quality: 'preview' });
  try {
    const errors = [...kit.status.errors];
    if (kit.status.ok) {
      await kit.page.evaluate(async () => {
        const info = window.__KIT__.info();
        for (const s of info.shots) await window.__KIT__.renderAt((s.start + s.end) / 2);
      });
    }
    for (const l of kit.logs) errors.push({ path: 'console', message: l });
    if (errors.length) throw new ScriptError(errors, { warnings, kit: kitInfo });
    const info = await kit.page.evaluate(() => window.__KIT__.info());
    return { project: dir, info, warnings, kit: kitInfo, gpu: kit.gpu };
  } finally {
    await kit.close();
  }
}, HELP);
