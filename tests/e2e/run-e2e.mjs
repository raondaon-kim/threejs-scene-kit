/** 실제 브라우저 E2E: init → npm install → check → still → render → 결정성 → 골든 비교 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
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
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
