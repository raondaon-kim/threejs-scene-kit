import { ScriptError } from './output.mjs';
import { importFromProject } from './project.mjs';
import { startServer } from './server.mjs';

const ATTEMPTS = [
  { name: 'gpu', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  { name: 'swiftshader', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
];

/** 캡처 모드로 장면 페이지를 연다. GPU 경로가 실패하면 SwiftShader로 폴백. */
export async function openKit(dir, { quality }) {
  const { chromium } = await importFromProject(dir, 'playwright');
  const srv = await startServer(dir);
  let lastError = null;
  for (const attempt of ATTEMPTS) {
    let browser;
    try {
      browser = await chromium.launch({ args: attempt.args });
      const page = await browser.newPage();
      const logs = [];
      page.on('console', (m) => {
        if (m.type() === 'error') logs.push(m.text());
      });
      page.on('pageerror', (e) => logs.push(String(e?.message ?? e)));
      await page.goto(`${srv.url}?capture=1&quality=${quality}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => !!window.__KIT__, null, { timeout: 120000 });
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
      lastError = e;
      if (browser) await browser.close().catch(() => undefined);
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
