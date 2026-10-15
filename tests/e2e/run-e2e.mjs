/** 실제 브라우저 E2E: init → npm install → check → still → render → 결정성 → 골든 비교 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const PROJ = join(ROOT, 'tests', '.e2e', 'proj');
const GOLDEN = join(ROOT, 'tests', 'golden', 't6_preview.png');
let failed = 0;

function step(name, fn) {
  try {
    const detail = fn();
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message}`);
  }
}
function script(name, args) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', name), ...args], { encoding: 'utf8', timeout: 900000 });
  const last = r.stdout.trim().split('\n').pop();
  let out;
  try {
    out = JSON.parse(last);
  } catch {
    throw new Error(`JSON 아님: ${r.stdout}\n${r.stderr}`);
  }
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out;
}
function meanDiff(a, b) {
  const A = PNG.sync.read(readFileSync(a));
  const B = PNG.sync.read(readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) return Infinity;
  let s = 0;
  for (let i = 0; i < A.data.length; i++) s += Math.abs(A.data[i] - B.data[i]);
  return s / A.data.length;
}

rmSync(join(PROJ, 'scene.ts'), { force: true });
step('init', () => script('init.mjs', [PROJ, '--force']).project);
step('npm install', () => {
  if (existsSync(join(PROJ, 'node_modules', 'playwright'))) return 'cached';
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: PROJ, shell: true, encoding: 'utf8', timeout: 900000 });
  if (r.status !== 0) throw new Error(r.stderr);
  return 'installed';
});
step('check', () => script('check.mjs', ['--project', PROJ]).gpu);
step('still sheet', () => {
  const out = script('still.mjs', ['--project', PROJ, '--at', '1,5,6,9.5,11.9', '--sheet', '--cols', '5']);
  if (statSync(out.sheet).size < 20000) throw new Error('시트가 너무 작음');
  return out.sheet;
});
step('still determinism', () => {
  const a = script('still.mjs', ['--project', PROJ, '--at', '6']).files[0];
  copyFileSync(a, `${a}.first.png`);
  const b = script('still.mjs', ['--project', PROJ, '--at', '6']).files[0];
  const d = meanDiff(`${a}.first.png`, b);
  if (d > 0.5) throw new Error(`두 번 캡처 차이 ${d}`);
  return `meanDiff=${d.toFixed(4)}`;
});
step('golden', () => {
  const cur = join(PROJ, 'out', 'stills', 't6_00.png');
  if (!existsSync(GOLDEN)) {
    mkdirSync(join(ROOT, 'tests', 'golden'), { recursive: true });
    copyFileSync(cur, GOLDEN);
    return '기준 이미지 생성 (눈으로 검수 후 커밋)';
  }
  const d = meanDiff(GOLDEN, cur);
  if (d > 2) throw new Error(`골든 대비 평균 차이 ${d.toFixed(3)} > 2`);
  return `meanDiff=${d.toFixed(3)}`;
});
step('render 1s', () => {
  const out = script('render.mjs', ['--project', PROJ, '--from', '5', '--to', '6', '--out', 'out/e2e.mp4']);
  const p = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'csv=p=0', out.file], { encoding: 'utf8' });
  const [w, h, n] = p.stdout.trim().split(',').map(Number);
  if (w !== 1080 || h !== 1920 || n !== 30) throw new Error(`ffprobe: ${p.stdout.trim()}`);
  return `${n} frames, ${out.perFrameMs}ms/frame, ${out.gpu}`;
});
// ── 실패 경로: 스크립트는 빨리, 반드시 끝나고, 원인을 JSON으로 알려야 한다 ──
const BROKEN = join(ROOT, 'tests', '.e2e', 'broken');
function scriptRaw(name, args, { timeout = 90000, env = process.env } = {}) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', name), ...args], { encoding: 'utf8', timeout, env });
  const last = (r.stdout ?? '').trim().split('\n').pop();
  let out = null;
  try {
    out = JSON.parse(last);
  } catch {
    out = null;
  }
  return { out, status: r.status, stderr: r.stderr ?? '', ms: Date.now() - t0, timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM' };
}
function prepareBroken(sceneSrc, customSrc) {
  rmSync(join(BROKEN, 'scene.ts'), { force: true });
  script('init.mjs', [BROKEN, '--force']);
  if (!existsSync(join(BROKEN, 'node_modules'))) symlinkSync(join(PROJ, 'node_modules'), join(BROKEN, 'node_modules'), 'junction');
  writeFileSync(join(BROKEN, 'scene.ts'), sceneSrc);
  if (customSrc) writeFileSync(join(BROKEN, 'custom', 'boom.ts'), customSrc);
}
const TINY = (extra) => `import { defineScene } from './kit/runtime/scene';
${extra.imports ?? ''}
export default defineScene({
  meta: { width: 320, height: 568, fps: 30, duration: 2, seed: 1 },
  style: 'minimal',
  ${extra.body ?? ''}
  shots: [{ id: 'a', start: 0, end: 2, camera: { move: 'static', pos: [0, 2, 10], target: [0, 0, 0] } }],
});
`;
step('fail-fast: scene.ts 문법 오류는 check가 즉시 보고', () => {
  prepareBroken(TINY({ body: 'elements: [{ id: "a" type: "shape" }],' }));
  const r = scriptRaw('check.mjs', ['--project', BROKEN]);
  if (r.timedOut || !r.out) throw new Error(`종료되지 않거나 JSON 없음 (${r.ms}ms)`);
  if (r.out.ok !== false || !r.out.errors.some((e) => e.path === 'scene' || e.path === 'scene.ts')) throw new Error(JSON.stringify(r.out));
  if (r.ms > 45000) throw new Error(`너무 느림: ${r.ms}ms`);
  const loc = r.out.errors.find((e) => e.path === 'scene.ts');
  if (!loc || !/scene\.ts:\d+:\d+/.test(loc.message) || /<html|\x1b\[/i.test(loc.message)) throw new Error(`위치가 담긴 깨끗한 메시지 아님: ${loc?.message}`);
  if (r.stderr.length > 2000) throw new Error(`stderr 노이즈 ${r.stderr.length}자`);
  return `${r.ms}ms, ${loc.message.slice(0, 80)}`;
});
step('fail-fast: 렌더 중 런타임 오류에도 render가 종료', () => {
  prepareBroken(
    TINY({ imports: "import boom from './custom/boom';", body: "custom: [boom], elements: [{ id: 'b', type: 'boom' }]," }),
    `import * as THREE from 'three';
import { defineElement } from '../kit/runtime/element';
export default defineElement({ type: 'boom', create() {
  return { object3d: new THREE.Group(), update(t: number) { if (t > 0.3) throw new Error('boom at ' + t); }, dispose() {} };
} });
`,
  );
  const r = scriptRaw('render.mjs', ['--project', BROKEN, '--to', '1']);
  if (r.timedOut || !r.out) throw new Error(`종료되지 않거나 JSON 없음 (${r.ms}ms)`);
  if (r.out.ok !== false || r.status === 0) throw new Error(JSON.stringify(r.out));
  return `${r.ms}ms: ${r.out.errors[0].message.slice(0, 60)}`;
});
step('fail-fast: ffmpeg가 없으면 render가 즉시 보고', () => {
  prepareBroken(TINY({}));
  const PATH = (process.env.PATH ?? process.env.Path ?? '').split(';').filter((p) => !/ffmpeg/i.test(p)).join(';');
  const env = { ...process.env, PATH, Path: PATH };
  const r = scriptRaw('render.mjs', ['--project', BROKEN, '--to', '1'], { env });
  if (r.timedOut || !r.out) throw new Error(`종료되지 않거나 JSON 없음 (${r.ms}ms)`);
  if (r.out.ok !== false || !r.out.errors.some((e) => e.path === 'ffmpeg')) throw new Error(JSON.stringify(r.out));
  return `${r.ms}ms`;
});

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
