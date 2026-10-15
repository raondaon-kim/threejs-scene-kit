import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { captureFrame, openKit } from './lib/browser.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node render.mjs [--project <폴더>] [--from 초] [--to 초] [--out out/video.mp4]
  원본 해상도로 프레임(t = i/fps)을 캡처해 ffmpeg(H.264, yuv420p, crf 18)로 인코딩한다.
  프레임 수 = round((to - from) * fps). 시스템 PATH에 ffmpeg 필요.
  실패하면 만들다 만 파일은 지운다.
`;

function assertFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new ScriptError([{ path: 'ffmpeg', message: 'ffmpeg를 실행할 수 없음. ffmpeg를 설치하고 PATH에 추가할 것' }]);
  }
}

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  assertFfmpeg();
  const kit = await openKit(dir, { quality: 'final' });
  let ff = null;
  let file = null;
  try {
    if (!kit.status.ok) throw new ScriptError(kit.status.errors);
    const info = await kit.page.evaluate(() => window.__KIT__.info());
    const from = opts.from !== undefined ? Number(opts.from) : 0;
    const to = opts.to !== undefined ? Number(opts.to) : info.duration;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > info.duration || to <= from) {
      throw new ScriptError([{ path: 'args', message: `0 ≤ from < to ≤ ${info.duration} 이어야 함` }]);
    }
    const f0 = Math.round(from * info.fps);
    const f1 = Math.round(to * info.fps);
    file = typeof opts.out === 'string' ? resolve(dir, opts.out) : join(dir, 'out', 'video.mp4');
    mkdirSync(dirname(file), { recursive: true });
    ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', file,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', (d) => (ffErr += d));
    ff.stdin.on('error', () => undefined);
    const exited = new Promise((r) => {
      ff.on('close', r);
      ff.on('error', (e) => {
        ffErr += String(e);
        r(-1);
      });
    });
    let ffDone = false;
    void exited.then(() => (ffDone = true));
    const started = Date.now();
    for (let i = f0; i < f1; i++) {
      let buf;
      try {
        buf = await captureFrame(kit.page, i / info.fps);
      } catch (e) {
        throw new ScriptError([{ path: 'render', message: `t=${(i / info.fps).toFixed(3)}s 프레임 렌더 실패: ${String(e?.message ?? e).split('\n')[0]}` }]);
      }
      if (ffDone) throw new ScriptError([{ path: 'ffmpeg', message: `ffmpeg가 중간에 종료됨: ${ffErr.trim()}` }]);
      if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), exited]);
    }
    ff.stdin.end();
    const code = await exited;
    if (code !== 0) throw new ScriptError([{ path: 'ffmpeg', message: `ffmpeg 실패(code ${code}): ${ffErr.trim()}` }]);
    ff = null;
    const seconds = (Date.now() - started) / 1000;
    return { file, frames: f1 - f0, fps: info.fps, seconds, perFrameMs: Math.round((seconds * 1000) / (f1 - f0)), gpu: kit.gpu, warnings: kit.logs };
  } catch (e) {
    if (ff) {
      ff.stdin.destroy();
      ff.kill('SIGKILL');
      await once(ff, 'close').catch(() => undefined);
    }
    if (file) rmSync(file, { force: true });
    throw e;
  } finally {
    await kit.close();
  }
}, HELP);
