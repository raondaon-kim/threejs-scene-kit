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
    for (const t of ['shape', 'label', 'arrow', 'bars', 'line', 'environment']) {
      expect(existsSync(join(ROOT, 'skills', 'scene-modules', 'references', `${t}.md`))).toBe(true);
    }
  });
});
