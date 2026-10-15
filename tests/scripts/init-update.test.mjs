import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const runScript = (name, args) => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', name), ...args], { encoding: 'utf8' });
  const lines = r.stdout.trim().split('\n');
  return { code: r.status, out: JSON.parse(lines[lines.length - 1]) };
};

describe('init / update', () => {
  let dir;
  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'tsk-')), 'proj');
  });

  it('init: 구조, style 치환, manifest, 이름', () => {
    const { code, out } = runScript('init.mjs', [dir, '--style', 'minimal']);
    expect(code).toBe(0);
    expect(out.ok).toBe(true);
    for (const f of ['scene.ts', 'index.html', 'package.json', 'vite.config.ts', '.gitignore', 'kit/runtime/world.ts', 'kit/manifest.json']) {
      expect(existsSync(join(dir, f))).toBe(true);
    }
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toContain("style: 'minimal'");
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name).toBe('proj');
    const m = JSON.parse(readFileSync(join(dir, 'kit', 'manifest.json'), 'utf8'));
    expect(m.version).toBe(JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version);
    expect(Object.keys(m.files)).toContain('runtime/world.ts');
  });

  it('init: 다음 단계에 npm install과 Chromium 설치를 단독 명령으로 안내', () => {
    const { out } = runScript('init.mjs', [dir]);
    const next = out.next.join('\n');
    expect(next).toContain(`npm install --prefix "${dir}"`);
    expect(next).toContain('npx playwright install chromium');
  });

  it('init: 비어 있지 않으면 거부, --force는 scene.ts 보존', () => {
    runScript('init.mjs', [dir]);
    writeFileSync(join(dir, 'scene.ts'), '// my scene');
    const again = runScript('init.mjs', [dir]);
    expect(again.code).toBe(1);
    expect(again.out.ok).toBe(false);
    const forced = runScript('init.mjs', [dir, '--force']);
    expect(forced.out.ok).toBe(true);
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toBe('// my scene');
    expect(forced.out.skipped).toContain('scene.ts');
  });

  it('init: clay 스타일', () => {
    const { out } = runScript('init.mjs', [dir, '--style', 'clay']);
    expect(out.ok).toBe(true);
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toContain("style: 'clay'");
  });
  it('init: pastel 스타일', () => {
    const { out } = runScript('init.mjs', [dir, '--style', 'pastel']);
    expect(out.ok).toBe(true);
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toContain("style: 'pastel'");
  });

  it('init: 잘못된 style, 인자 없음', () => {
    expect(runScript('init.mjs', [dir, '--style', 'anime']).out.ok).toBe(false);
    expect(runScript('init.mjs', []).out.ok).toBe(false);
  });

  it('update: 수정된 kit 파일이 있으면 거부, --force면 갱신', () => {
    runScript('init.mjs', [dir]);
    const f = join(dir, 'kit', 'runtime', 'easing.ts');
    writeFileSync(f, readFileSync(f, 'utf8') + '\n// local edit\n');
    const refused = runScript('update.mjs', ['--project', dir]);
    expect(refused.out.ok).toBe(false);
    expect(JSON.stringify(refused.out)).toContain('runtime/easing.ts');
    const forced = runScript('update.mjs', ['--project', dir, '--force']);
    expect(forced.out.ok).toBe(true);
    expect(readFileSync(f, 'utf8')).not.toContain('local edit');
  });

  it('update: 수정 없으면 그대로 갱신', () => {
    runScript('init.mjs', [dir]);
    const r = runScript('update.mjs', ['--project', dir]);
    expect(r.out.ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('update: vite.config.ts 같은 인프라 파일도 갱신, scene.ts는 보존', () => {
    runScript('init.mjs', [dir]);
    writeFileSync(join(dir, 'vite.config.ts'), '// old');
    writeFileSync(join(dir, 'scene.ts'), '// mine');
    const r = runScript('update.mjs', ['--project', dir]);
    expect(r.out.ok).toBe(true);
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain('optimizeDeps');
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toBe('// mine');
  });

  it('update: 템플릿 의존성 중 없는 것(p5)을 package.json에 추가하고 install 안내 (v0.4)', () => {
    runScript('init.mjs', [dir]);
    const pkgFile = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
    delete pkg.dependencies.p5;
    delete pkg.devDependencies['@types/p5'];
    pkg.dependencies.lodash = '1.0.0';
    writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
    const r = runScript('update.mjs', ['--project', dir]);
    expect(r.out.ok).toBe(true);
    expect(r.out.install).toBe(true);
    expect(r.out.addedDeps).toEqual(expect.arrayContaining(['p5', '@types/p5']));
    expect(r.out.next.join(' ')).toMatch(/npm install/);
    const after = JSON.parse(readFileSync(pkgFile, 'utf8'));
    expect(after.dependencies.p5).toBe('1.11.13');
    expect(after.dependencies.lodash).toBe('1.0.0');
    const again = runScript('update.mjs', ['--project', dir]);
    expect(again.out.install).toBe(false);
  });

  it('--help는 사용법 출력 후 exit 0', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'init.mjs'), '--help'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('init.mjs');
  });
});
