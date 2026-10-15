import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAMERA_ISO, kitTypes, loadKits, vocabSentence } from '../../scripts/lib/kit-vocab.mjs';

const KIT_INDEXES = import.meta.glob('../../kit/modules/*/index.ts', { eager: true });
const fakeRoot = (kits) => {
  const root = mkdtempSync(join(tmpdir(), 'kv-'));
  for (const [name, v] of Object.entries(kits)) {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, 'vocab.json'), typeof v === 'string' ? v : JSON.stringify(v));
  }
  return root;
};

describe('kit-vocab', () => {
  it('*_ELEMENTS를 내보내는 모든 키트는 vocab.json이 있고 objects = element type (양방향)', () => {
    const kits = loadKits();
    const seen = [];
    for (const [path, mod] of Object.entries(KIT_INDEXES)) {
      const name = path.split('/').at(-2);
      const arr = Object.entries(mod).find(([k]) => k.endsWith('_ELEMENTS'))?.[1];
      if (!arr) continue;
      seen.push(name);
      expect(kits.has(name), `${name}/vocab.json`).toBe(true);
      expect(Object.keys(kits.get(name).objects).sort()).toEqual(arr.map((e) => e.type).sort());
    }
    expect(seen.sort()).toEqual(['concept', 'logistics']);
    expect([...kits.keys()].sort()).toEqual(['concept', 'logistics']);
  });
  it("vocabSentence(['logistics'])는 이전 문장과 완전히 같음 (기본값도)", () => {
    const s = 'Only depict objects from this list: a warehouse with loading docks, box trucks and vans, yellow forklifts, pallets with cardboard boxes or blue crates, shipping containers, roads with a dashed center line, paved lots, round lollipop trees and cone trees, blue map pins, simple office buildings. Do not include: cars, people, text, logos, distant towns, water, bridges.';
    expect(vocabSentence(['logistics'])).toBe(s);
    expect(vocabSentence()).toBe(s);
  });
  it('여러 키트: objects 합집합(중복 1회), avoid 교집합(첫 키트 순서) (Review Focus 1, 3)', () => {
    const root = fakeRoot({ a: { label: 'A', objects: { x: 'cats', y: 'dogs' }, avoid: ['text', 'people', 'cars'] }, b: { label: 'B', objects: { z: 'dogs', w: 'birds' }, avoid: ['cars', 'people'] } });
    expect(vocabSentence(['a', 'b'], root)).toBe('Only depict objects from this list: cats, dogs, birds. Do not include: people, cars.');
  });
  it('avoid 교집합이 비면 Do not include 구절 없음 (Review Focus 2)', () => {
    const root = fakeRoot({ a: { label: 'A', objects: { x: 'cats' }, avoid: ['text'] }, b: { label: 'B', objects: { y: 'dogs' }, avoid: [] } });
    expect(vocabSentence(['a', 'b'], root)).toBe('Only depict objects from this list: cats, dogs.');
  });
  it('kitTypes는 선택 키트의 type', () => {
    expect(kitTypes(['concept']).sort()).toEqual(['arrow', 'bars', 'label', 'line', 'shape']);
    expect(kitTypes(['concept', 'logistics'])).toContain('warehouse');
  });
  it('vocab.json 형식 오류는 파일을 밝힌 오류 (Review Focus 4)', () => {
    expect(() => loadKits(fakeRoot({ bad: { label: 'B', objects: {}, avoid: [] } }))).toThrow(/bad\/vocab\.json.*objects/);
    expect(() => loadKits(fakeRoot({ bad: { label: 'B', objects: { a: 'x' }, avoid: 'text' } }))).toThrow(/bad\/vocab\.json.*avoid/);
    expect(() => loadKits(fakeRoot({ bad: '{oops' }))).toThrow(/bad\/vocab\.json/);
  });
  it('CAMERA_ISO 불변', () => {
    expect(CAMERA_ISO).toBe('Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.');
  });
});
