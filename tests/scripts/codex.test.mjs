import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findCodex } from '../../scripts/lib/codex.mjs';

describe('findCodex (리뷰 I1)', () => {
  const saved = { PATH: process.env.PATH, Path: process.env.Path, CODEX_EXE: process.env.CODEX_EXE };
  afterEach(() => {
    process.env.PATH = saved.PATH;
    if (saved.Path !== undefined) process.env.Path = saved.Path;
    if (saved.CODEX_EXE === undefined) delete process.env.CODEX_EXE;
    else process.env.CODEX_EXE = saved.CODEX_EXE;
  });
  it.runIf(process.platform === 'win32')('npm 전역 설치(.cmd 심)는 node + codex.js로 실행', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cx-'));
    writeFileSync(join(dir, 'codex'), '#!/bin/sh\n');
    writeFileSync(join(dir, 'codex.cmd'), '@echo off\n');
    const js = join(dir, 'node_modules', '@openai', 'codex', 'bin');
    mkdirSync(js, { recursive: true });
    writeFileSync(join(js, 'codex.js'), '');
    delete process.env.CODEX_EXE;
    process.env.PATH = [dir, join(process.env.SystemRoot ?? 'C:/Windows', 'System32')].join(';');
    process.env.Path = process.env.PATH;
    const c = findCodex();
    expect(c.cmd).toBe(process.execPath);
    expect(c.pre[0]).toBe(join(js, 'codex.js'));
  });
  it('CODEX_EXE가 .cmd면 node 경로로 변환하거나 명확히 거부', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cx-'));
    writeFileSync(join(dir, 'codex.cmd'), '@echo off\n');
    process.env.CODEX_EXE = join(dir, 'codex.cmd');
    expect(() => findCodex()).toThrow(/\.cmd|\.exe/);
  });
});
