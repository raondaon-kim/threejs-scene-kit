import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ScriptError } from './output.mjs';

const verKey = (name) => (name.match(/\d+/g) ?? []).map((n) => n.padStart(8, '0')).join('.');

/** npm 전역 설치의 셸 심(codex / codex.cmd) 옆에 있는 실제 JS 진입점 */
function shimToJs(p) {
  const js = join(dirname(p), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  return existsSync(js) ? js : null;
}

/** 실행 가능한 형태로 변환. Windows에서 .exe가 아니면 npm 심을 node+codex.js로 풀고, 안 되면 null (shell:true는 쓰지 않음) */
function resolveCandidate(p, source) {
  if (/\.m?js$/i.test(p)) return { cmd: process.execPath, pre: [p], source: `${source}(node)` };
  if (process.platform !== 'win32' || /\.exe$/i.test(p)) return { cmd: p, pre: [], source };
  const js = shimToJs(p);
  return js ? { cmd: process.execPath, pre: [js], source: `${source}(npm)` } : null;
}

/** codex 실행 파일 찾기: CODEX_EXE → PATH → VS Code/Cursor 확장 동봉본(최신 버전) */
export function findCodex() {
  const env = process.env.CODEX_EXE;
  if (env) {
    if (!existsSync(env)) throw new ScriptError([{ path: 'codex', message: `CODEX_EXE 경로가 없음: ${env}` }]);
    const c = resolveCandidate(env, 'CODEX_EXE');
    if (!c) throw new ScriptError([{ path: 'codex', message: `CODEX_EXE는 .exe 또는 codex.js를 가리켜야 함 (.cmd 심은 옆에 node_modules/@openai/codex가 있어야 함): ${env}` }]);
    return c;
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['codex'], { encoding: 'utf8' });
  if (which.status === 0) {
    for (const line of which.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      if (/\.ps1$/i.test(line)) continue;
      const c = resolveCandidate(line, 'PATH');
      if (c) return c;
    }
  }
  const bin = process.platform === 'win32' ? join('bin', 'windows-x86_64', 'codex.exe') : join('bin', 'linux-x86_64', 'codex');
  for (const base of [join(homedir(), '.vscode', 'extensions'), join(homedir(), '.cursor', 'extensions')]) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base).filter((n) => /^openai\.chatgpt-/.test(n)).sort((a, b) => (verKey(a) < verKey(b) ? 1 : -1));
    for (const d of dirs) {
      const exe = join(base, d, bin);
      if (existsSync(exe)) return { cmd: exe, pre: [], source: d };
    }
  }
  throw new ScriptError([{ path: 'codex', message: 'codex CLI를 찾을 수 없음. CODEX_EXE 환경변수에 codex 실행 파일 경로를 지정할 것' }]);
}

/** codex exec 비대화형 실행. 출력 끝부분과 종료 코드를 돌려준다. */
export function runCodex(codex, { cwd, prompt, timeoutMs = 600000 }) {
  return new Promise((resolve) => {
    const args = [...codex.pre, 'exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-C', cwd, prompt];
    const child = spawn(codex.cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const keep = (d) => {
      out = (out + d).slice(-4000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      out += `\n[timeout ${timeoutMs}ms]`;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, output: `${out}\n${String(e)}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output: out });
    });
  });
}
