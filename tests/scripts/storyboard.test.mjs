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
  const prompts = () => Object.fromEntries(JSON.parse(readFileSync(join(dir, 'storyboard', 'log.json'), 'utf8')).map((e) => [e.id, e.prompt]));
  it('기본: Camera·Objects 줄을 Style 뒤, Content 앞에 주입 (A-1)', () => {
    expect(run(['--project', dir, '--shot', 's1']).code).toBe(0);
    const p = prompts().s1;
    expect(p).toMatch(/^Camera: Orthographic isometric view/m);
    expect(p).toMatch(/^Objects: Only depict objects from this list: .*yellow forklifts/m);
    expect(p.indexOf('Style:')).toBeLessThan(p.indexOf('Camera:'));
    expect(p.indexOf('Camera:')).toBeLessThan(p.indexOf('Objects:'));
    expect(p.indexOf('Objects:')).toBeLessThan(p.indexOf('Content:'));
  });
  it('전역 free + 샷 단위 덮어쓰기 (Review Focus 4)', () => {
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', vocab: 'free', camera: 'free', shots: [{ id: 's1', prompt: 'a', camera: 'iso' }, { id: 's2', prompt: 'b', vocab: 'kit' }] }));
    expect(run(['--project', dir]).code).toBe(0);
    const p = prompts();
    expect(p.s1).toMatch(/^Camera:/m);
    expect(p.s1).not.toMatch(/^Objects:/m);
    expect(p.s2).not.toMatch(/^Camera:/m);
    expect(p.s2).toMatch(/^Objects:/m);
  });
  it('물류 요소가 없거나 ortho가 아닌 장면에 기본 제약 → 경고 (최종 리뷰 I1)', () => {
    // init 기본 템플릿 = 광합성 강의 장면 (perspective, 물류 요소 없음)
    const { code, out } = run(['--project', dir, '--shot', 's1']);
    expect(code).toBe(0);
    expect(out.warnings.join('\n')).toMatch(/vocab.*free/);
    expect(out.warnings.join('\n')).toMatch(/camera.*free/);
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', vocab: 'free', camera: 'free', shots: [{ id: 's1', prompt: 'a' }] }));
    expect(run(['--project', dir]).out.warnings).toEqual([]);
  });
  it('물류 + ortho 장면은 경고 없음', () => {
    writeFileSync(join(dir, 'scene.ts'), "export default { meta: { projection: 'ortho' }, elements: [{ id: 'w', type: 'warehouse' }] };\n");
    expect(run(['--project', dir, '--shot', 's1']).out.warnings).toEqual([]);
  });
  const sbWith = (extra, shots = [{ id: 's1', prompt: 'a' }]) => writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', ...extra, shots }));
  it('kit: concept → 개념 요소 목록, text 허용, 템플릿 장면에 vocab 경고 없음', () => {
    sbWith({ kit: 'concept' });
    const { code, out } = run(['--project', dir]);
    expect(code).toBe(0);
    const p = prompts().s1;
    expect(p).toMatch(/^Objects: .*3D bar charts/m);
    expect(p).not.toMatch(/warehouse/);
    expect(p).not.toMatch(/Do not include:.*\btext\b/);
    expect(out.warnings.join('\n')).not.toMatch(/vocab/);
  });
  it('kit 배열: 합집합 + 금지 교집합 (Review Focus 1)', () => {
    sbWith({ kit: ['logistics', 'concept'] });
    run(['--project', dir]);
    const p = prompts().s1;
    expect(p).toMatch(/warehouse.*3D bar charts/);
    expect(p).toMatch(/Do not include: people, logos\.$/m);
  });
  it.each([[[]], [3], [['logistics', 'nope']], ['nope']])('잘못된 kit %j → storyboard.kit 오류 + 사용 가능 목록 (Review Focus 5)', (kit) => {
    sbWith({ kit });
    const { code, out } = run(['--project', dir]);
    expect(code).toBe(1);
    const e = out.errors.find((x) => x.path === 'storyboard.kit');
    expect(e.message).toMatch(/concept, logistics/);
  });
  it('잘못된 vocab/camera 값 거부', () => {
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', vocab: 'all', shots: [{ id: 's1', prompt: 'a', camera: 'top' }] }));
    const { code, out } = run(['--project', dir]);
    expect(code).toBe(1);
    expect(out.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['storyboard.vocab', 'storyboard.shots[0].camera']));
  });
});
