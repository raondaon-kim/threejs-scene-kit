import { createServer as netServer } from 'node:net';
import { importFromProject } from './project.mjs';

function freePort() {
  return new Promise((res, rej) => {
    const s = netServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

/** 프로젝트의 vite로 임시 개발 서버를 띄운다 */
export async function startServer(dir) {
  const vite = await importFromProject(dir, 'vite');
  const port = await freePort();
  const server = await vite.createServer({
    root: dir,
    // stdout/stderr를 깨끗하게 유지 (오류는 브라우저 응답에서 수집해 JSON으로 보고)
    logLevel: 'silent',
    clearScreen: false,
    server: { port, strictPort: true, host: '127.0.0.1', open: false },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}
