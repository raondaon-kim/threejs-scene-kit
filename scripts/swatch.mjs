import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openKit } from './lib/browser.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node swatch.mjs [--project <폴더>]
  표면 질감(내장 + 커스텀)과 배경 프리셋을 견본 시트 한 장(out/swatch.png)으로 그린다.
  질감은 2×2로 이어 붙여 이음선이 보이는지 함께 확인한다. 장면의 style 하늘색으로 배경 프리셋을 그린다.
  --probe  질감마다 결정성(같은 시드 2회 해시)·다른 시드 해시·가장자리 이어짐 지표(가장자리 차이 vs 내부 인접 차이 99백분위)를 JSON으로 함께 출력 (테스트용)
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  const kit = await openKit(dir, { quality: 'preview' });
  try {
    if (!kit.status.ok) throw new ScriptError(kit.status.errors);
    const r = await kit.page.evaluate(() => window.__KIT__.swatch());
    const outDir = join(dir, 'out');
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, 'swatch.png');
    writeFileSync(file, Buffer.from(r.png.slice(r.png.indexOf(',') + 1), 'base64'));
    let probes;
    if (opts.probe) {
      probes = await kit.page.evaluate((names) => {
        const out = {};
        for (const n of names) {
          const a = window.__KIT__.textureProbe(n, 7);
          const b = window.__KIT__.textureProbe(n, 7);
          const c = window.__KIT__.textureProbe(n, 8);
          out[n] = { same: a.hash === b.hash, differs: a.hash !== c.hash, seamX: a.seamX, seamY: a.seamY, innerX: a.innerX, innerY: a.innerY };
        }
        return out;
      }, r.textures);
    }
    return { file, textures: r.textures, backgrounds: r.backgrounds, probes, warnings: kit.logs };
  } finally {
    await kit.close();
  }
}, HELP);
