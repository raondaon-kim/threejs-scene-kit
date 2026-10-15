import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCodex, runCodex } from './lib/codex.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node storyboard.mjs [--project <폴더>] [--shot <id>] [--concurrency 2]
  storyboard.json의 샷마다 Codex(codex exec)로 이미지를 만들어 storyboard/<id>.png에 저장하고
  storyboard/sheet.png(전체 시트)와 storyboard/log.json을 남긴다.
  storyboard.json: { "aspect": "16:9"|"9:16", "style": "공통 스타일(영문)",
                     "shots": [{ "id": "s1", "at": 2.5, "prompt": "샷 내용(영문)" }] }
  codex 위치: CODEX_EXE → PATH → VS Code/Cursor 확장 동봉본.  샷 하나에 보통 1~2분.
`;

function loadStoryboard(dir) {
  const file = join(dir, 'storyboard.json');
  if (!existsSync(file)) throw new ScriptError([{ path: 'storyboard.json', message: '파일이 없음. storyboard.example.json을 참고해 작성할 것' }]);
  let sb;
  try {
    sb = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ScriptError([{ path: 'storyboard.json', message: `JSON 형식 오류: ${e.message}` }]);
  }
  const errors = [];
  if (!['16:9', '9:16'].includes(sb.aspect)) errors.push({ path: 'storyboard.aspect', message: "'16:9' 또는 '9:16'이어야 함" });
  if (typeof sb.style !== 'string' || !sb.style) errors.push({ path: 'storyboard.style', message: '공통 스타일 문자열이 필요함' });
  if (!Array.isArray(sb.shots) || sb.shots.length === 0) errors.push({ path: 'storyboard.shots', message: '샷이 1개 이상 필요함' });
  const ids = new Set();
  (Array.isArray(sb.shots) ? sb.shots : []).forEach((s, i) => {
    if (typeof s?.id !== 'string' || !/^[A-Za-z0-9-]+$/.test(s.id)) errors.push({ path: `storyboard.shots[${i}].id`, message: '영문·숫자·대시로 된 id가 필요함' });
    else if (ids.has(s.id)) errors.push({ path: `storyboard.shots[${i}].id`, message: `'${s.id}' 중복` });
    else ids.add(s.id);
    if (typeof s?.prompt !== 'string' || !s.prompt) errors.push({ path: `storyboard.shots[${i}].prompt`, message: '샷 설명이 필요함' });
    if (s?.at !== undefined && (typeof s.at !== 'number' || !Number.isFinite(s.at))) errors.push({ path: `storyboard.shots[${i}].at`, message: '숫자(초)여야 함' });
  });
  if (errors.length) throw new ScriptError(errors);
  return sb;
}

function promptFor(sb, shot) {
  const orient = sb.aspect === '16:9' ? 'landscape 16:9' : 'portrait 9:16';
  return [
    `Generate exactly ONE image with your image generation tool, then save it as storyboard/${shot.id}.png inside the current directory (create the folder if needed). The saved PNG must be ${orient}. Do not write any other files.`,
    `Style: ${sb.style}`,
    `Content: ${shot.prompt}`,
    'When finished, reply with only the saved file path.',
  ].join('\n');
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return results;
}

function makeSheet(dir, sb) {
  const files = sb.shots.map((s) => join(dir, 'storyboard', `${s.id}.png`)).filter((f) => existsSync(f));
  if (!files.length) return null;
  const [cw, ch] = sb.aspect === '16:9' ? [640, 360] : [360, 640];
  const out = join(dir, 'storyboard', 'sheet.png');
  const cols = Math.min(2, files.length);
  const inputs = files.flatMap((f) => ['-i', f]);
  const scaled = files.map((_, i) => `[${i}]scale=${cw}:${ch}:force_original_aspect_ratio=decrease,pad=${cw}:${ch}:(ow-iw)/2:(oh-ih)/2:color=0x111111[v${i}]`);
  const layout = files.map((_, i) => `${(i % cols) * cw}_${Math.floor(i / cols) * ch}`).join('|');
  const tail = files.length === 1 ? '[v0]copy[out]' : `${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=0x111111[out]`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${scaled.join(';')};${tail}`, '-map', '[out]', '-frames:v', '1', out], { encoding: 'utf8' });
  return r.status === 0 ? out : null;
}

run(async ({ opts }) => {
  const dir = resolveProject(opts.project, { needModules: false });
  const sb = loadStoryboard(dir);
  const shots = typeof opts.shot === 'string' ? sb.shots.filter((s) => s.id === opts.shot) : sb.shots;
  if (!shots.length) throw new ScriptError([{ path: 'args.shot', message: `'${opts.shot}' 샷이 storyboard.json에 없음` }]);
  const codex = findCodex();
  mkdirSync(join(dir, 'storyboard'), { recursive: true });
  const results = await pool(shots, Number(opts.concurrency ?? 2), async (shot) => {
    const file = join(dir, 'storyboard', `${shot.id}.png`);
    rmSync(file, { force: true });
    const prompt = promptFor(sb, shot);
    const t0 = Date.now();
    const r = await runCodex(codex, { cwd: dir, prompt });
    const seconds = Math.round((Date.now() - t0) / 100) / 10;
    const ok = existsSync(file) && statSync(file).size > 200;
    return { id: shot.id, file, ok, seconds, prompt, code: r.code, tail: r.output.slice(-300) };
  });
  const logFile = join(dir, 'storyboard', 'log.json');
  const prev = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : [];
  writeFileSync(logFile, `${JSON.stringify([...prev, ...results.map(({ id, ok, seconds, prompt, code }) => ({ id, ok, seconds, code, prompt }))], null, 2)}\n`);
  const sheet = makeSheet(dir, sb);
  const failed = results.filter((r) => !r.ok);
  const summary = results.map(({ id, file, seconds, ok }) => ({ id, file, seconds, ok }));
  if (failed.length) {
    throw new ScriptError(
      failed.map((f) => ({ path: f.id, message: `codex가 이미지를 저장하지 않음 (code ${f.code}): ${f.tail.replace(/\s+/g, ' ').trim()}` })),
      { shots: summary, sheet },
    );
  }
  return { shots: summary, sheet, codex: codex.source, warnings: sheet ? [] : ['시트를 만들지 못함 (ffmpeg 확인)'] };
}, HELP);
