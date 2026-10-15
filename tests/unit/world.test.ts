import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildWorld } from '../../kit/runtime/world';
import type { SceneDef } from '../../kit/runtime/types';

const base = (): SceneDef => ({
  meta: { width: 1080, height: 1920, fps: 30, duration: 10, seed: 3 },
  style: 'stylized',
  environment: { sky: { preset: 'dusk' }, terrain: { size: 120 }, trees: { count: 30 }, water: { level: -1 } },
  elements: [
    { id: 'ball', type: 'shape', at: [0, 2, 0], params: { kind: 'sphere' }, enter: { t: 1, anim: 'fade', dur: 1 }, exit: { t: 6, anim: 'pop', dur: 1 } },
    { id: 'arr', type: 'arrow', at: [1, 0, 0], params: { to: [0, 3, 0] }, enter: { t: 2, anim: 'grow', dur: 2 },
      tracks: { 'position.x': [[2, 1], [4, 5]] } },
  ],
  shots: [
    { id: 'a', start: 0, end: 5, camera: { move: 'dolly', from: [0, 5, 30], to: [0, 5, 20], target: [0, 2, 0] } },
    { id: 'b', start: 5, end: 10, camera: { move: 'static', pos: [10, 4, 10], target: [0, 2, 0] } },
  ],
});

const holder = (w: { scene: THREE.Scene }, id: string) => w.scene.getObjectByName(id)!;

describe('buildWorld', () => {
  it('샷별 카메라', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1080 / 1920 });
    world!.setTime(0);
    expect(world!.camera.position.z).toBeCloseTo(30);
    world!.setTime(7);
    expect(world!.camera.position.toArray()).toEqual([10, 4, 10]);
    world!.dispose();
  });
  it('enter/exit 가시성과 opacity', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1 });
    const w = world!;
    w.setTime(0.5);
    expect(holder(w, 'ball').visible).toBe(false);
    w.setTime(1.5);
    const mat = ((holder(w, 'ball').children[0] as THREE.Mesh).material as THREE.Material);
    expect(holder(w, 'ball').visible).toBe(true);
    expect(mat.opacity).toBeGreaterThan(0);
    expect(mat.opacity).toBeLessThan(1);
    w.setTime(8);
    expect(holder(w, 'ball').visible).toBe(false);
    w.dispose();
  });
  it('grow progress와 tracks', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1 });
    const w = world!;
    w.setTime(3);
    expect(holder(w, 'arr').position.x).toBeCloseTo(3);
    const head = holder(w, 'arr').children[0].children[1];
    const mid = head.position.y;
    w.setTime(5);
    expect(head.position.y).toBeGreaterThan(mid);
    w.dispose();
  });
  it('시간 순서와 무관 (seekable)', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1 });
    const w = world!;
    const snap = () => JSON.stringify([w.camera.position.toArray(), holder(w, 'arr').position.toArray(), holder(w, 'ball').visible]);
    w.setTime(3.3);
    const a = snap();
    w.setTime(9);
    w.setTime(0.1);
    w.setTime(3.3);
    expect(snap()).toBe(a);
    w.dispose();
  });
  it('환경 없는 장면도 생성 (Review Focus 1)', () => {
    const def = base();
    delete def.environment;
    const { world, issues } = buildWorld(def, { quality: 'preview', aspect: 1 });
    expect(issues).toEqual([]);
    world!.setTime(2);
    world!.dispose();
  });
  it('모듈 생성 오류는 이슈로 보고', () => {
    const def = base();
    def.elements![0].params = { kind: 'star' };
    const { world, issues } = buildWorld(def, { quality: 'preview', aspect: 1 });
    expect(world).toBeNull();
    expect(issues[0].path).toBe('elements[0].params');
    expect(issues[0].message).toMatch(/star/);
  });
});
