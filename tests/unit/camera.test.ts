import { describe, it, expect } from 'vitest';
import { cameraPose } from '../../kit/runtime/camera';

describe('cameraPose', () => {
  it('static', () => {
    expect(cameraPose({ move: 'static', pos: [1, 2, 3], target: [0, 0, 0] }, 0.7)).toEqual({ position: [1, 2, 3], target: [0, 0, 0], fov: 40 });
  });
  it('dolly는 시작·끝 위치', () => {
    const c = { move: 'dolly' as const, from: [0, 0, 10] as [number, number, number], to: [0, 0, 0] as [number, number, number], target: [0, 0, -5] as [number, number, number] };
    expect(cameraPose(c, 0).position).toEqual([0, 0, 10]);
    expect(cameraPose(c, 1).position).toEqual([0, 0, 0]);
    expect(cameraPose({ ...c, ease: 'linear' }, 0.5).position[2]).toBeCloseTo(5);
  });
  it('orbit은 각도 기준 원 위', () => {
    const p = cameraPose({ move: 'orbit', center: [0, 1, 0], radius: 10, height: 2, fromDeg: 0, toDeg: 90, ease: 'linear' }, 1);
    expect(p.position[0]).toBeCloseTo(10);
    expect(p.position[1]).toBeCloseTo(3);
    expect(p.position[2]).toBeCloseTo(0);
    expect(p.target).toEqual([0, 1, 0]);
  });
  it('fov 지정', () => {
    expect(cameraPose({ move: 'static', pos: [0, 0, 1], target: [0, 0, 0], fov: 60 }, 0).fov).toBe(60);
  });
});
