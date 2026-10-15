import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { writeManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { KIT_DIR, pluginVersion, TEMPLATE_DIR } from './lib/paths.mjs';

const STYLES = ['stylized', 'minimal', 'clay'];
const HELP = `
사용법: node init.mjs <폴더> [--style stylized|minimal|clay] [--force]
  새 영상 프로젝트를 만든다 (template + kit 복사, kit/manifest.json 생성).
  --force  비어 있지 않은 폴더에도 진행. 기존 scene.ts와 custom/은 보존한다.
  npm install은 하지 않는다 (출력의 next 참고).
`;

run(async ({ pos, opts }) => {
  if (!pos[0]) throw new ScriptError([{ path: 'args', message: '대상 폴더를 지정할 것: init.mjs <폴더>' }]);
  const dir = resolve(pos[0]);
  const style = typeof opts.style === 'string' ? opts.style : 'stylized';
  if (!STYLES.includes(style)) {
    throw new ScriptError([{ path: 'args.style', message: `'${style}'은 지원하지 않음. 가능: ${STYLES.join('|')}` }]);
  }
  if (existsSync(dir) && readdirSync(dir).length > 0 && !opts.force) {
    throw new ScriptError([{ path: 'args', message: `${dir}이 비어 있지 않음. 덮어쓰려면 --force (scene.ts와 custom/은 보존)` }]);
  }
  mkdirSync(dir, { recursive: true });
  const skipped = [];
  for (const name of readdirSync(TEMPLATE_DIR)) {
    const target = name === 'gitignore' ? '.gitignore' : name;
    const dst = join(dir, target);
    if (target === 'scene.ts' && existsSync(dst)) {
      skipped.push('scene.ts');
      continue;
    }
    let text = readFileSync(join(TEMPLATE_DIR, name), 'utf8');
    if (target === 'scene.ts') text = text.replace("style: 'stylized'", `style: '${style}'`);
    if (target === 'package.json') {
      const name2 = basename(dir).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'scene-project';
      text = text.replace('__NAME__', name2);
    }
    writeFileSync(dst, text);
  }
  mkdirSync(join(dir, 'custom'), { recursive: true });
  const kitDst = join(dir, 'kit');
  rmSync(kitDst, { recursive: true, force: true });
  cpSync(KIT_DIR, kitDst, { recursive: true });
  const manifest = writeManifest(kitDst, pluginVersion());
  return {
    project: dir,
    style,
    kitVersion: manifest.version,
    skipped,
    next: [
      `npm install --prefix "${dir}"`,
      `npm exec --prefix "${dir}" -- playwright install chromium   (프로젝트 폴더의 npx playwright install chromium과 같음, 최초 1회)`,
      `(선택) storyboard.example.json을 storyboard.json으로 복사·수정 후 storyboard.mjs --project "${dir}"`,
      `check.mjs --project "${dir}"`,
    ],
  };
}, HELP);
