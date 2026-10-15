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

describe('v0.2 world', () => {
  const v2 = (): SceneDef => ({
    meta: { width: 1920, height: 1080, fps: 30, duration: 10, seed: 2, projection: 'ortho' },
    style: 'clay',
    environment: { ground: { size: 200 } },
    elements: [
      { id: 'mover', type: 'arrow', at: [0, 1, 0], params: { to: [0, 2, 0] }, follow: { path: [[0, 0], [20, 0]], t0: 0, t1: 10, ease: 'linear' } },
    ],
    shots: [{ id: 'a', start: 0, end: 10, camera: { move: 'static', pos: [30, 30, 30], target: [0, 0, 0], size: 40, sizeTo: 20 } }],
  });
  it('ortho 카메라 프로젝션이 size와 aspect를 따름 (Review Focus 2)', () => {
    const { world } = buildWorld(v2(), { quality: 'preview', aspect: 16 / 9 });
    const cam = world!.camera as THREE.OrthographicCamera;
    expect(cam.isOrthographicCamera).toBe(true);
    world!.setTime(0);
    expect(cam.top - cam.bottom).toBeCloseTo(40);
    expect((cam.right - cam.left) / (cam.top - cam.bottom)).toBeCloseTo(16 / 9);
    world!.setTime(10);
    expect(cam.top - cam.bottom).toBeCloseTo(20);
    world!.dispose();
  });
  it('follow: 위치·방향, at.y 유지', () => {
    const { world } = buildWorld(v2(), { quality: 'preview', aspect: 1 });
    world!.setTime(5);
    const h = world!.scene.getObjectByName('mover')!;
    expect(h.position.x).toBeCloseTo(10);
    expect(h.position.y).toBeCloseTo(1);
    expect(h.rotation.y).toBeCloseTo(Math.PI / 2);
    world!.dispose();
  });
  it('그림자 플래그, ground, focus, sun', () => {
    const { world } = buildWorld(v2(), { quality: 'preview', aspect: 1 });
    let casters = 0;
    world!.scene.getObjectByName('mover')!.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.castShadow) casters++; });
    expect(casters).toBeGreaterThan(0);
    expect(world!.scene.getObjectByName('ground')!.receiveShadow).toBe(true);
    expect(world!.focus.radius).toBeGreaterThanOrEqual(20);
    expect(world!.sun.isDirectionalLight).toBe(true);
    expect(world!.look.toneMapping).toBe('neutral');
    world!.dispose();
  });
});
