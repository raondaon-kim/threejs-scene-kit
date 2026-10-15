import { ScriptError } from './output.mjs';
import { importFromProject } from './project.mjs';
import { startServer } from './server.mjs';

const ATTEMPTS = [
  { name: 'gpu', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  { name: 'swiftshader', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
];
const READY_TIMEOUT_MS = 60000;

/** 알려진 브라우저 실행 오류를 사용자 안내로 바꾼다. 해당 없으면 null. */
export function explainLaunchError(e, dir) {
  const msg = String(e?.message ?? e);
  if (/Executable doesn't exist|browserType\.launch.*(not found|doesn't exist)/i.test(msg)) {
    return {
      path: 'browser',
      message: `Chromium이 설치되지 않음. 다음을 실행할 것: npm exec --prefix "${dir}" -- playwright install chromium`,
    };
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Vite 오류 응답(HTML 또는 텍스트)에서 "파일:줄:열 원인" 한 줄을 뽑는다. */
export function viteErrorSummary(body, fallbackFile) {
  const m = body.match(/const error = (\{[\s\S]*?\})\s*\n/);
  let obj = null;
  if (m) {
    try {
      obj = JSON.parse(m[1]);
    } catch {
      obj = null;
    }
  }
  const clean = String(obj?.message ?? body).replace(/\x1b\[[0-9;]*m/g, '');
  const lines = clean.split('\n').map((s) => s.trim()).filter(Boolean);
  const reason = lines.find((l) => /^\[[A-Z_]+\]/.test(l)) ?? lines.find((l) => !l.startsWith('<')) ?? '알 수 없는 변환 오류';
  const at = clean.match(/([\w./\\-]+\.(?:ts|js|mjs)):(\d+):(\d+)/);
  const file = (at ? at[1] : fallbackFile).replace(/\\/g, '/').split('/').slice(-2).join('/').replace(/^[^/]*\.e2e\//, '');
  const loc = at ? `${file}:${at[2]}:${at[3]}` : file;
  return `${loc} ${reason}`.slice(0, 300);
}

/** __KIT__가 생길 때까지 기다리되, 모듈 로드 오류(문법·import 오류)가 보이면 즉시 실패한다. */
async function waitForKit(page, logs, failed) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    if (await page.evaluate(() => !!window.__KIT__)) return;
    if (logs.length > 0 || failed.length > 0) {
      await sleep(300);
      const errors = [{ path: 'scene', message: '장면 모듈을 불러오지 못함 (scene.ts 또는 custom/ 문법·import 오류)' }];
      for (const url of failed) {
        const rel = decodeURIComponent(new URL(url).pathname).replace(/^\//, '');
        const res = await page.request.get(url).catch(() => null);
        const body = res ? await res.text().catch(() => '') : '';
        errors.push({ path: rel, message: viteErrorSummary(body, rel) });
      }
      for (const l of logs) if (!/Failed to load resource/.test(l)) errors.push({ path: 'console', message: l });
      throw new ScriptError(errors);
    }
    if (Date.now() > deadline) {
      throw new ScriptError([{ path: 'scene', message: `장면 페이지가 ${READY_TIMEOUT_MS / 1000}초 안에 준비되지 않음` }]);
    }
    await sleep(200);
  }
}

/** 캡처 모드로 장면 페이지를 연다. 렌더러(WebGL) 초기화가 실패할 때만 SwiftShader로 폴백. */
export async function openKit(dir, { quality, ss }) {
  const { chromium } = await importFromProject(dir, 'playwright');
  const srv = await startServer(dir);
  let lastError = null;
  for (const attempt of ATTEMPTS) {
    let browser;
    try {
      try {
        browser = await chromium.launch({ args: attempt.args });
      } catch (e) {
        const hint = explainLaunchError(e, dir);
        throw hint ? new ScriptError([hint]) : e;
      }
      const page = await browser.newPage();
      const logs = [];
      page.on('console', (m) => {
        if (m.type() === 'error') logs.push(m.text());
      });
      page.on('pageerror', (e) => logs.push(String(e?.message ?? e)));
      const failed = [];
      page.on('response', (r) => {
        if (r.status() >= 400) failed.push(r.url());
      });
      await page.goto(`${srv.url}?capture=1&quality=${quality}${ss ? `&ss=${ss}` : ''}`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
      await waitForKit(page, logs, failed);
      const status = await page.evaluate(() => window.__KIT__.ready);
      if (!status.ok && status.errors.some((e) => e.path === 'renderer')) {
        lastError = new ScriptError(status.errors);
        await browser.close();
        continue;
      }
      const gpu = status.ok ? await page.evaluate(() => window.__KIT__.gpu()) : 'none';
      return {
        page,
        status,
        logs,
        gpu: `${attempt.name}: ${gpu}`,
        close: async () => {
          await browser.close();
          await srv.close();
        },
      };
    } catch (e) {
      if (browser) await browser.close().catch(() => undefined);
      if (e instanceof ScriptError) {
        // 장면 오류·설치 오류는 다른 GPU 경로로 재시도해도 같으므로 즉시 보고
        await srv.close();
        throw e;
      }
      lastError = e;
    }
  }
  await srv.close();
  throw lastError ?? new Error('브라우저를 열 수 없음');
}

export async function captureFrame(page, t) {
  const url = await page.evaluate(async (time) => {
    await window.__KIT__.renderAt(time);
    return window.__KIT__.capture();
  }, t);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
