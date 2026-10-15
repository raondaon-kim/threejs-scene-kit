/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);

function frontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('frontmatter 없음');
  const keys: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([a-zA-Z-]+):/);
    if (k) keys[k[1]] = line.slice(k[0].length).trim();
  }
  return keys;
}

describe('skills', () => {
  const skills = readdirSync(join(ROOT, 'skills'));
  it('세 스킬 존재', () => {
    expect(skills.sort()).toEqual(['scene-custom', 'scene-direct', 'scene-modules']);
  });
  for (const s of ['scene-custom', 'scene-direct', 'scene-modules']) {
    it(`${s}: 허용 키만, name 일치, 200줄 이하`, () => {
      const md = readFileSync(join(ROOT, 'skills', s, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
      const fm = frontmatter(md);
      for (const k of Object.keys(fm)) expect(ALLOWED.has(k)).toBe(true);
      expect(fm.name).toBe(s);
      expect(fm.description.length).toBeGreaterThan(50);
      expect(fm.description.length).toBeLessThanOrEqual(1024);
      expect(md.split('\n').length).toBeLessThanOrEqual(200);
    });
  }
  it('모든 내장 요소의 reference 문서 존재', () => {
    for (const t of ['shape', 'label', 'arrow', 'bars', 'line', 'environment', 'logistics']) {
      expect(existsSync(join(ROOT, 'skills', 'scene-modules', 'references', `${t}.md`))).toBe(true);
    }
  });
  it('v0.2: storyboard 레퍼런스와 SKILL 명령', () => {
    expect(existsSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'))).toBe(true);
    const md = readFileSync(join(ROOT, 'skills', 'scene-direct', 'SKILL.md'), 'utf8');
    for (const k of ['storyboard.mjs', '--compare', '--quality final']) expect(md).toContain(k);
    const mods = readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8');
    for (const t of ['warehouse', 'truck', 'forklift', 'pallet', 'container', 'road', 'lot', 'tree', 'pin', 'building']) expect(mods).toContain(t);
  });
  it('앵커·스토리보드 제약 문서', () => {
    const lg = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'logistics.md'), 'utf8');
    for (const k of ['warehouseAnchors', '.dock(', '.truck(', '.backIn(', 'lane(', "from './kit/anchors'"]) expect(lg).toContain(k);
    const mods = readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8');
    expect(mods).toContain('kit/anchors');
    const direct = readFileSync(join(ROOT, 'skills', 'scene-direct', 'SKILL.md'), 'utf8');
    expect(direct).toContain('wh.backIn');
    expect(direct).toContain('lane(');
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    for (const k of ['"vocab"', '"camera"', '"free"', 'Objects:', 'Camera:']) expect(sb).toContain(k);
  });
  it('최종 리뷰: 앵커 예시는 그대로 붙여도 동작 (add 정의, WH 공유), 제약은 물류 장면 전용 명시, 버전 0.2.1', () => {
    const lg = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'logistics.md'), 'utf8');
    expect(lg).toContain('const add = (e: ElementDef) => els.push(e);');
    expect(lg).toContain('width: WH.width, depth: WH.depth, docks: WH.docks');
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    expect(sb).toMatch(/물류.*장면 전용|개념.*free/);
    expect(JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version).toBe('0.4.0');
  });
  it('최종 리뷰: 키트 추가 안내에 registry 연결, concept는 style의 no text 제거 안내', () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toMatch(/vocab\.json.*registry\.ts.*BUILTIN_ELEMENTS/);
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    expect(sb).toMatch(/concept.*style.*no text/);
  });
  it('kit 선택 문서·예제', () => {
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    for (const k of ['"kit"', '"concept"', '교집합', 'vocab.json']) expect(sb).toContain(k);
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain('vocab.json');
    expect(JSON.parse(readFileSync(join(ROOT, 'template', 'storyboard.example.json'), 'utf8')).kit).toBe('logistics');
  });
  it('v0.3: 동화 키트 문서', () => {
    const mods = readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8');
    for (const t of ['island', 'plateau', 'rock', 'river', 'waterfall', 'path', 'bridge', 'castle', 'cottage', 'mushroom', 'windmill', 'fairytree', 'flowers', 'field', 'fence', 'cloud', 'pastel']) expect(mods, t).toContain(t);
    const ft = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'fairytale.md'), 'utf8');
    for (const k of ['bridgeOn', 'waterfall', 'plateau', 'height']) expect(ft).toContain(k);
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    expect(sb).toContain('"diorama"');
    expect(sb).toContain('"fairytale"');
  });
  it('최종 리뷰: 동화 키트 문서 — variant 안내, diorama·fairytale·pastel 안내, islandEdge', () => {
    const mods = readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8');
    expect(mods).toMatch(/variant: i/);
    const ft = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'fairytale.md'), 'utf8');
    expect(ft).toContain('islandEdge');
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    expect(sb).not.toMatch(/perspective 장면은 `"camera": "free"`/);
    expect(sb).toMatch(/"kit".*"fairytale"/);
    const schema = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'scene-schema.md'), 'utf8');
    expect(schema).toContain('pastel');
    expect(readFileSync(join(ROOT, 'scripts', 'init.mjs'), 'utf8')).toMatch(/stylized\|minimal\|clay\|pastel/);
  });
  it('v0.4: 질감·배경·디테일 문서', () => {
    const tx = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'textures.md'), 'utf8');
    for (const k of ['grass-brush', 'rock-grain', 'roof-tiles', 'soil-pebbles', 'water-ripple', 'wood-grain', 'paper', 'look', 'surfaces', 'meshGradient', 'swatch.mjs']) expect(tx, k).toContain(k);
    const mods = readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8');
    for (const k of ['grass', 'scatter', 'textures.md', 'kit/layout']) expect(mods, k).toContain(k);
    const schema = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'scene-schema.md'), 'utf8');
    for (const k of ['look', 'background', 'customTextures']) expect(schema, k).toContain(k);
    const direct = readFileSync(join(ROOT, 'skills', 'scene-direct', 'SKILL.md'), 'utf8');
    expect(direct).toContain('swatch.mjs');
    const custom = readFileSync(join(ROOT, 'skills', 'scene-custom', 'SKILL.md'), 'utf8');
    for (const k of ['defineTexture', 'customTextures', 'randomSeed', 'frameCount']) expect(custom, k).toContain(k);
  });
  it('최종 리뷰 I-4: grass·scatter·tint 문서 (kit 소스를 읽지 않아도 되게)', () => {
    const d = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'detail.md'), 'utf8');
    for (const k of ['center', 'radius', 'count', 'height', 'avoid', 'avoidWidth', 'role', 'variant', '20000', '절대 좌표', 'idPrefix', 'rotate', 'minDist', 'seed']) expect(d, k).toContain(k);
    expect(readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8')).toContain('references/detail.md');
    expect(readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'fairytale.md'), 'utf8')).toContain('tint');
  });
});

