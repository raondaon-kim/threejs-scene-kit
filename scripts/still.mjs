import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureFrame, openKit } from './lib/browser.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node still.mjs [--project <폴더>] --at 0,3.5,8 [--sheet] [--cols 4] [--quality preview|final]
  지정 시점의 스틸 PNG를 out/stills/에 저장한다.
  --sheet  여러 시점을 콘택트 시트 한 장(out/stills/sheet.png)으로 저장 (확인용으로 권장)
  --quality 기본 preview(절반 해상도). final은 원본 해상도.
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  const times = String(opts.at ?? '0').split(',').map((s) => Number(s.trim()));
  if (times.some((t) => !Number.isFinite(t))) throw new ScriptError([{ path: 'args.at', message: '쉼표로 구분한 초 단위 숫자여야 함 (예: 0,2.5,8)' }]);
  const quality = opts.quality === 'final' ? 'final' : 'preview';
  const kit = await openKit(dir, { quality });
  try {
    if (!kit.status.ok) throw new ScriptError(kit.status.errors);
    const info = await kit.page.evaluate(() => window.__KIT__.info());
    const bad = times.filter((t) => t < 0 || t > info.duration);
    if (bad.length) throw new ScriptError([{ path: 'args.at', message: `0 ~ ${info.duration}초 범위 밖: ${bad.join(', ')}` }]);
    const outDir = join(dir, 'out', 'stills');
    mkdirSync(outDir, { recursive: true });
    if (opts.sheet) {
      const cols = Number(opts.cols ?? Math.min(times.length, 4));
      const url = await kit.page.evaluate(([ts, c]) => window.__KIT__.sheet(ts, c), [times, cols]);
      const file = join(outDir, 'sheet.png');
      writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      return { sheet: file, times, quality, warnings: kit.logs };
    }
    const files = [];
    for (const t of times) {
      const file = join(outDir, `t${t.toFixed(2).replace('.', '_')}.png`);
      writeFileSync(file, await captureFrame(kit.page, t));
      files.push(file);
    }
    return { files, quality, warnings: kit.logs };
  } finally {
    await kit.close();
  }
}, HELP);
