import { describe, it, expect } from 'vitest';
import { elementState, sampleTrack, findShot, animMods } from '../../kit/runtime/timeline';
import type { ShotDef } from '../../kit/runtime/types';

describe('elementState', () => {
  it('enter 없으면 처음부터 완전히 보임', () => {
    expect(elementState({}, 0)).toMatchObject({ visible: true, opacity: 1, scale: 1, dy: 0, progress: null });
  });
  it('enter 전에는 숨김, 진행 중에는 부분값', () => {
    const el = { enter: { t: 2, anim: 'fade' as const, dur: 1 } };
    expect(elementState(el, 1.9).visible).toBe(false);
    const mid = elementState(el, 2.5);
    expect(mid.visible).toBe(true);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(elementState(el, 3).opacity).toBeCloseTo(1);
  });
  it('exit 완료 후 숨김, anim none은 즉시', () => {
    expect(elementState({ exit: { t: 5, anim: 'fade', dur: 1 } }, 6).visible).toBe(false);
    expect(elementState({ exit: { t: 5, anim: 'none' } }, 5).visible).toBe(false);
    expect(elementState({ exit: { t: 5, anim: 'none' } }, 4.99).visible).toBe(true);
  });
  it('grow는 progress, exit grow는 줄어듦', () => {
    const el = { enter: { t: 0, anim: 'grow' as const, dur: 1 }, exit: { t: 3, anim: 'grow' as const, dur: 1 } };
    expect(elementState(el, 0).progress).toBeCloseTo(0);
    expect(elementState(el, 2).progress).toBeCloseTo(1);
    expect(elementState(el, 3.5).progress!).toBeLessThan(1);
  });
  it('pop/rise 수식', () => {
    expect(animMods('rise', 0).dy).toBeCloseTo(-1.5);
    expect(animMods('rise', 1).dy).toBeCloseTo(0);
    expect(animMods('pop', 0).scale).toBeGreaterThan(0);
  });
});

describe('sampleTrack', () => {
  const keys: Array<[number, number]> = [[1, 0], [3, 10]];
  it('구간 밖은 끝값 유지', () => {
    expect(sampleTrack(keys, 0)).toBe(0);
    expect(sampleTrack(keys, 9)).toBe(10);
  });
  it('중간은 smoothstep 보간', () => {
    expect(sampleTrack(keys, 2)).toBeCloseTo(5);
  });
});

describe('findShot', () => {
  const cam = { move: 'static' as const, pos: [0, 0, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  const shots: ShotDef[] = [
    { id: 'a', start: 0, end: 4, camera: cam },
    { id: 'b', start: 4, end: 10, camera: cam },
  ];
  it('구간 탐색과 u', () => {
    expect(findShot(shots, 2)).toMatchObject({ u: 0.5 });
    expect(findShot(shots, 2).shot.id).toBe('a');
    expect(findShot(shots, 4).shot.id).toBe('b');
  });
  it('범위 밖은 clamp (Review Focus 2)', () => {
    expect(findShot(shots, -3).shot.id).toBe('a');
    expect(findShot(shots, -3).u).toBe(0);
    expect(findShot(shots, 99).shot.id).toBe('b');
    expect(findShot(shots, 99).u).toBe(1);
  });
});
