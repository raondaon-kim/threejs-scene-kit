import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FAKE = join(ROOT, 'tests', 'fixtures', 'fake-codex.mjs');
const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'storyboard.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, CODEX_EXE: FAKE, ...env } });
  return { code: r.status, out: JSON.parse(r.stdout.trim().split('\n').pop()) };
};

describe('storyboard.mjs (가짜 codex)', () => {
  let dir;
  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'sb-')), 'p');
    spawnSync(process.execPath, [join(ROOT, 'scripts', 'init.mjs'), dir], { encoding: 'utf8' });
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', shots: [{ id: 's1', at: 1, prompt: 'warehouse' }, { id: 's2', at: 2, prompt: 'trucks' }] }));
  });
  it('샷별 이미지, 로그, 시트', () => {
    const { code, out } = run(['--project', dir]);
    expect(code).toBe(0);
    expect(out.shots.map((s) => s.id)).toEqual(['s1', 's2']);
    for (const id of ['s1', 's2']) expect(existsSync(join(dir, 'storyboard', `${id}.png`))).toBe(true);
    expect(existsSync(join(dir, 'storyboard', 'sheet.png'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'storyboard', 'log.json'), 'utf8')).length).toBe(2);
  });
  it('--shot 하나만', () => {
    expect(run(['--project', dir, '--shot', 's2']).out.shots.map((s) => s.id)).toEqual(['s2']);
  });
  it('codex가 파일을 안 만들고 정상 종료하면 실패 (Review Focus 4)', () => {
    const { code, out } = run(['--project', dir], { FAKE_CODEX_MODE: 'nofile' });
    expect(code).toBe(1);
    expect(out.errors[0].path).toMatch(/s1|s2/);
  });
  it('storyboard.json 형식 오류', () => {
    writeFileSync(join(dir, 'storyboard.json'), '{"shots":[]}');
    expect(run(['--project', dir]).out.ok).toBe(false);
  });
});
