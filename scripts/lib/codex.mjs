import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ScriptError } from './output.mjs';

const verKey = (name) => (name.match(/\d+/g) ?? []).map((n) => n.padStart(8, '0')).join('.');

/** codex 실행 파일 찾기: CODEX_EXE → PATH → VS Code/Cursor 확장 동봉본(최신 버전) */
export function findCodex() {
  const env = process.env.CODEX_EXE;
  if (env) {
    if (!existsSync(env)) throw new ScriptError([{ path: 'codex', message: `CODEX_EXE 경로가 없음: ${env}` }]);
    return /\.m?js$/i.test(env) ? { cmd: process.execPath, pre: [env], source: 'CODEX_EXE(node)' } : { cmd: env, pre: [], source: 'CODEX_EXE' };
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['codex'], { encoding: 'utf8' });
  if (which.status === 0) {
    const exe = which.stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !/\.(cmd|bat|ps1)$/i.test(s));
    if (exe) return { cmd: exe, pre: [], source: 'PATH' };
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
