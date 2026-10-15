import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { createSky } from '../../kit/modules/environment/sky';
import { createHeightField, TERRAIN_DEFAULTS } from '../../kit/modules/environment/heightfield';
import { createTerrain } from '../../kit/modules/environment/terrain';
import { poissonDisk } from '../../kit/modules/environment/poisson';
import { placeTrees, createTrees, TREES_DEFAULTS } from '../../kit/modules/environment/trees';
import { createWater } from '../../kit/modules/environment/water';
import { mulberry32 } from '../../kit/runtime/rng';

const style = getStyle('stylized');

describe('heightfield', () => {
  it('결정적이고 중앙은 평평(0)', () => {
    const a = createHeightField(3, TERRAIN_DEFAULTS);
    const b = createHeightField(3, TERRAIN_DEFAULTS);
    expect(a.heightAt(37, -12)).toBe(b.heightAt(37, -12));
    expect(a.heightAt(0, 0)).toBe(0);
    expect(a.heightAt(5, 5)).toBe(0);
  });
  it('seed마다 다름, 높이 범위', () => {
    const a = createHeightField(1, TERRAIN_DEFAULTS);
    const b = createHeightField(2, TERRAIN_DEFAULTS);
    expect(a.heightAt(60, 40)).not.toBe(b.heightAt(60, 40));
    for (let i = 0; i < 40; i++) expect(Math.abs(a.heightAt(i * 4 - 80, 70))).toBeLessThanOrEqual(TERRAIN_DEFAULTS.height);
  });
});

describe('poissonDisk', () => {
  it('최소 거리와 경계, 결정성', () => {
    const pts = poissonDisk(mulberry32(5), 50, 6, 400);
    const again = poissonDisk(mulberry32(5), 50, 6, 400);
    expect(again).toEqual(pts);
    expect(pts.length).toBeGreaterThan(30);
    for (const [x, z] of pts) expect(Math.abs(x) <= 50 && Math.abs(z) <= 50).toBe(true);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThanOrEqual(6 - 1e-9);
      }
    }
  });
});

describe('trees', () => {
  it('개수 상한, 중앙 회피, 지형 높이', () => {
    const field = createHeightField(9, TERRAIN_DEFAULTS);
    const p = { ...TREES_DEFAULTS, count: 120 };
    const pl = placeTrees(9, p, field.heightAt);
    expect(pl.length).toBeLessThanOrEqual(120);
    expect(pl.length).toBeGreaterThan(60);
    for (const t of pl) {
      expect(Math.hypot(t.x, t.z)).toBeGreaterThanOrEqual(p.avoidCenter);
      expect(t.y).toBe(field.heightAt(t.x, t.z));
    }
    expect(placeTrees(9, p, field.heightAt)).toEqual(pl);
  });
  it('InstancedMesh 생성, update(t) 결정적, dispose', () => {
    const pl = placeTrees(1, { ...TREES_DEFAULTS, count: 20 }, () => 0);
    const h = createTrees({ style }, pl);
    const meshes: THREE.InstancedMesh[] = [];
    h.object3d.traverse((o) => { if (o instanceof THREE.InstancedMesh) meshes.push(o); });
    expect(meshes.length).toBe(3);
    expect(meshes[0].count).toBe(pl.length);
    h.update!(1.25);
    const m1 = Array.from(meshes[1].instanceMatrix.array);
    h.update!(3);
    h.update!(1.25);
    expect(Array.from(meshes[1].instanceMatrix.array)).toEqual(m1);
    h.dispose();
  });
});

describe('sky/terrain/water', () => {
  it('sky는 BackSide 셰이더 구', () => {
    const h = createSky(style.sky('dawn'));
    const mesh = h.object3d as THREE.Mesh;
    expect((mesh.material as THREE.ShaderMaterial).side).toBe(THREE.BackSide);
    h.dispose();
  });
  it('terrain 정점 높이가 heightAt과 일치', () => {
    const field = createHeightField(4, TERRAIN_DEFAULTS);
    const h = createTerrain({ style, quality: 'preview' }, field, 200);
    const geo = (h.object3d as THREE.Mesh).geometry;
    const pos = geo.attributes.position;
    for (const i of [0, 77, pos.count - 1]) expect(pos.getY(i)).toBeCloseTo(field.heightAt(pos.getX(i), pos.getZ(i)));
    expect(geo.attributes.color).toBeDefined();
    h.dispose();
  });
  it('water update(t)는 시간 순수함수', () => {
    const h = createWater({ style }, { level: -1, size: 100 });
    const pos = (h.object3d as THREE.Mesh).geometry.attributes.position;
    h.update!(2);
    const y = pos.getY(10);
    h.update!(5);
    h.update!(2);
    expect(pos.getY(10)).toBe(y);
    expect(h.object3d.position.y).toBe(-1);
    h.dispose();
  });
});
