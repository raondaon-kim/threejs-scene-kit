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
  if (existsSync(join(PROJ, 'node_modules', 'playwright')) && existsSync(join(PROJ, 'node_modules', 'p5'))) return 'cached';
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
step('render final 1s', () => {
  const out = script('render.mjs', ['--project', PROJ, '--quality', 'final', '--from', '5', '--to', '6', '--out', 'out/e2e.mp4']);
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

// ── v0.2: clay 물류 미니 장면 (ortho, follow, param 트랙, 그림자·AO 파이프라인) ──
const CLAY = join(ROOT, 'tests', '.e2e', 'clay');
const CLAY_GOLDEN = join(ROOT, 'tests', 'golden', 'clay_preview.png');
const CLAY_SCENE = `import { defineScene } from './kit/runtime/scene';
export default defineScene({
  meta: { width: 1920, height: 1080, fps: 30, duration: 4, seed: 3, projection: 'ortho' },
  style: 'clay',
  environment: { ground: { size: 200 } },
  elements: [
    { id: 'lot', type: 'lot', at: [0, 0, 8], params: { width: 26, depth: 10, role: 'neutral' } },
    { id: 'road', type: 'road', params: { points: [[-40, 16], [0, 16], [30, 10]], width: 6 } },
    { id: 'wh', type: 'warehouse', params: { width: 18, depth: 10, height: 6, docks: 3, skylights: 2 } },
    { id: 'truck', type: 'truck', params: { length: 8 }, follow: { path: [[-40, 15], [0, 15], [30, 9.4]], t0: 0, t1: 4, ease: 'linear' } },
    { id: 'fork', type: 'forklift', at: [-6, 0, 9], params: { load: true }, tracks: { 'param.lift': [[0.5, 0], [2.5, 1]] } },
    { id: 'pal', type: 'pallet', at: [-9, 0, 8], params: { cargo: 'crates' } },
    { id: 'cont', type: 'container', at: [11, 0, 6], params: { length: 6 } },
    { id: 'tree', type: 'tree', at: [-12, 0, 12] },
    { id: 'bld', type: 'building', at: [0, 0, -14], params: { floors: 3 } },
    { id: 'pin', type: 'pin', at: [0, 7, 0], params: { size: 2.4 } },
  ],
  shots: [{ id: 'a', start: 0, end: 4, camera: { move: 'static', pos: [45, 67, 78], target: [0, 0, 4], size: 34, sizeTo: 30 } }],
});
`;
step('clay: 프로젝트 준비 + check', () => {
  rmSync(join(CLAY, 'scene.ts'), { force: true });
  script('init.mjs', [CLAY, '--style', 'clay', '--force']);
  if (!existsSync(join(CLAY, 'node_modules'))) symlinkSync(join(PROJ, 'node_modules'), join(CLAY, 'node_modules'), 'junction');
  writeFileSync(join(CLAY, 'scene.ts'), CLAY_SCENE);
  return script('check.mjs', ['--project', CLAY]).gpu;
});
step('clay: still + golden', () => {
  const cur = script('still.mjs', ['--project', CLAY, '--at', '2']).files[0];
  if (!existsSync(CLAY_GOLDEN)) {
    copyFileSync(cur, CLAY_GOLDEN);
    return '기준 이미지 생성 (눈으로 검수 후 커밋)';
  }
  const d = meanDiff(CLAY_GOLDEN, cur);
  if (d > 2) throw new Error(`clay 골든 대비 평균 차이 ${d.toFixed(3)} > 2`);
  return `meanDiff=${d.toFixed(3)}`;
});
step('clay: seek 순서와 무관 (Review Focus 1)', () => {
  const a = script('still.mjs', ['--project', CLAY, '--at', '3']).files[0];
  copyFileSync(a, `${a}.direct.png`);
  const files = script('still.mjs', ['--project', CLAY, '--at', '1,0.2,3']).files;
  const d = meanDiff(`${a}.direct.png`, files[2]);
  if (d > 0.5) throw new Error(`t=3 직접 vs 다른 시점 후 t=3 차이 ${d}`);
  return `meanDiff=${d.toFixed(4)}`;
});
const probe = (file) => spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim().split(',').map(Number);
step('clay: render preview 1초 = 960×540×30', () => {
  const out = script('render.mjs', ['--project', CLAY, '--from', '0', '--to', '1']);
  const [w, h, n] = probe(out.file);
  if (out.quality !== 'preview' || w !== 960 || h !== 540 || n !== 30) throw new Error(`${out.quality} ${w}x${h} ${n}`);
  return `${out.perFrameMs}ms/frame`;
});
step('clay: render final 0.5초 = 1920×1080×15 (Review Focus 5)', () => {
  const out = script('render.mjs', ['--project', CLAY, '--quality', 'final', '--from', '1', '--to', '1.5', '--out', 'out/final-e2e.mp4']);
  const [w, h, n] = probe(out.file);
  if (out.quality !== 'final' || w !== 1920 || h !== 1080 || n !== 15) throw new Error(`${out.quality} ${w}x${h} ${n}`);
  return `${out.perFrameMs}ms/frame`;
});

// ── v0.3: 동화 디오라마 미니 장면 (pastel, 원근, 섬·폭포·성·다리·구름) ──
const FT = join(ROOT, 'tests', '.e2e', 'fairytale');
const FT_GOLDEN = join(ROOT, 'tests', 'golden', 'fairytale_preview.png');
const FT_SCENE = `import { defineScene } from './kit/runtime/scene';
import { bridgeOn, islandEdge, type XZ } from './kit/anchors';
const FALL = islandEdge(16, 90);
const RIVER: XZ[] = [[0, -8], [-1, 0], [1, 8], [FALL.at[0], FALL.at[2]]];
export default defineScene({
  meta: { width: 1920, height: 1080, fps: 30, duration: 4, seed: 4 },
  style: 'pastel',
  environment: { sky: { preset: 'day' } },
  elements: [
    { id: 'island', type: 'island', params: { radius: 16, depth: 12, floaters: 4 } },
    { id: 'plateau', type: 'plateau', at: [0, 0, -10], params: { radius: 5, height: 4 } },
    { id: 'castle', type: 'castle', at: [0, 4, -11], params: { size: 7 } },
    { id: 'river', type: 'river', params: { points: RIVER, width: 2.4 } },
    { id: 'fall', type: 'waterfall', ...FALL, params: { height: 10, width: 2.6 } },
    { id: 'bridge', type: 'bridge', ...bridgeOn(RIVER, 1), params: { span: 4 } },
    { id: 'cottage', type: 'cottage', at: [-8, 0, 2], rotation: [0, 20, 0] },
    { id: 'mush', type: 'mushroom', at: [-6, 0, 8] },
    { id: 'mill', type: 'windmill', at: [8, 0, -2] },
    { id: 'tree', type: 'fairytree', at: [7, 0, 7], params: { height: 4 } },
    { id: 'flowers', type: 'flowers', at: [-3, 0, 11] },
    { id: 'cloud', type: 'cloud', at: [-24, 6, 0], params: { size: 7 } },
  ],
  shots: [{ id: 'a', start: 0, end: 4, camera: { move: 'path', fov: 36, points: [[-8, 22, 46], [8, 21, 46]], target: [0, -3, 0] } }],
});
`;
step('fairytale: 프로젝트 준비 + check', () => {
  rmSync(join(FT, 'scene.ts'), { force: true });
  script('init.mjs', [FT, '--style', 'pastel', '--force']);
  if (!existsSync(join(FT, 'node_modules'))) symlinkSync(join(PROJ, 'node_modules'), join(FT, 'node_modules'), 'junction');
  writeFileSync(join(FT, 'scene.ts'), FT_SCENE);
  return script('check.mjs', ['--project', FT]).gpu;
});
step('fairytale: still + golden', () => {
  const cur = script('still.mjs', ['--project', FT, '--at', '2']).files[0];
  if (!existsSync(FT_GOLDEN)) {
    copyFileSync(cur, FT_GOLDEN);
    return '기준 이미지 생성 (눈으로 검수 후 커밋)';
  }
  const d = meanDiff(FT_GOLDEN, cur);
  if (d > 2) throw new Error(`fairytale 골든 대비 평균 차이 ${d.toFixed(3)} > 2`);
  return `meanDiff=${d.toFixed(3)}`;
});

// ── v0.4: p5 표면 질감 — 결정성·이어짐·견본 시트 (Review Focus 1) ──
step('textures: 결정성·이어짐·swatch', () => {
  const out = script('swatch.mjs', ['--project', PROJ, '--probe']);
  if (statSync(out.file).size < 20000) throw new Error('견본 시트가 너무 작음');
  const bad = [];
  for (const [n, p] of Object.entries(out.probes)) {
    if (!p.same) bad.push(`${n}: 같은 시드 다른 결과`);
    if (!p.differs) bad.push(`${n}: 시드가 달라도 같음`);
    // 가장자리 차이가 내부에서 가장 큰 인접 차이보다 크면 이음선 (무늬 경계가 있는 기와도 공정하게)
    if (p.seamX > p.innerX + 8 || p.seamY > p.innerY + 8) bad.push(`${n}: 이음선 ${p.seamX.toFixed(1)}/${p.seamY.toFixed(1)} > 내부 ${p.innerX.toFixed(1)}/${p.innerY.toFixed(1)}`);
  }
  if (bad.length) throw new Error(bad.join('; '));
  return `${out.textures.length}종, 이음/내부 최대 ${Object.entries(out.probes).map(([n, p]) => `${n} ${Math.max(p.seamX, p.seamY).toFixed(0)}/${Math.max(p.innerX, p.innerY).toFixed(0)}`).join(', ')}`;
});

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
