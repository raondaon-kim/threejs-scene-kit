import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { rngFor } from '../../kit/runtime/rng';
import type { KitContext } from '../../kit/runtime/types';
import { grass } from '../../kit/modules/detail/grass';
import { distToPolyline } from '../../kit/layout';

const ctx: KitContext = { style: getStyle('pastel'), rng: (s) => rngFor(9, s), heightAt: () => 0, quality: 'preview', camera: new THREE.PerspectiveCamera() };
const inst = (o: THREE.Object3D) => {
  let m: THREE.InstancedMesh | null = null;
  o.traverse((x) => {
    if ((x as THREE.InstancedMesh).isInstancedMesh) m = x as THREE.InstancedMesh;
  });
  return m! as THREE.InstancedMesh;
};
const positions = (m: THREE.InstancedMesh) => {
  const out: Array<[number, number]> = [];
  const mat = new THREE.Matrix4();
  const p = new THREE.Vector3();
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, mat);
    p.setFromMatrixPosition(mat);
    out.push([p.x, p.z]);
  }
  return out;
};

describe('grass (detail 키트)', () => {
  it('인스턴싱, 원 안, 개수 이하, 정점 색, noShadow', () => {
    const h = grass.create(ctx, { center: [3, 4], radius: 6, count: 400 });
    const m = inst(h.object3d);
    expect(m.count).toBeGreaterThan(300);
    expect(m.count).toBeLessThanOrEqual(400);
    for (const [x, z] of positions(m)) expect(Math.hypot(x - 3, z - 4)).toBeLessThanOrEqual(6 + 1e-6);
    expect(m.geometry.attributes.color).toBeTruthy();
    expect(h.object3d.userData.noShadow).toBe(true);
    h.dispose();
  });
  it('개수 상한 20000 (Review Focus 5)', () => {
    const m = inst(grass.create(ctx, { radius: 60, count: 50000 }).object3d);
    expect(m.count).toBeLessThanOrEqual(20000);
  });
  it('avoid 선 근처(avoidWidth/2)에 잎 없음 (Review Focus 5)', () => {
    const line: Array<[number, number]> = [[-10, 0], [10, 0]];
    const m = inst(grass.create(ctx, { radius: 8, count: 800, avoid: [line], avoidWidth: 3 }).object3d);
    for (const p of positions(m)) expect(distToPolyline(p, line)).toBeGreaterThanOrEqual(1.5);
  });
  it('같은 variant 같은 배치, 다른 variant 다름', () => {
    const a = positions(inst(grass.create(ctx, { count: 100, variant: 1 }).object3d));
    const b = positions(inst(grass.create(ctx, { count: 100, variant: 1 }).object3d));
    const c = positions(inst(grass.create(ctx, { count: 100, variant: 2 }).object3d));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('잘못된 center·avoid 오류', () => {
    expect(() => grass.create(ctx, { center: [1] })).toThrow(/center/);
    expect(() => grass.create(ctx, { avoid: [[[0, 0]], 5] })).toThrow(/avoid/);
  });
});
