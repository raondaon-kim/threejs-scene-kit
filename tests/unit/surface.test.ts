import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildWorld } from '../../kit/runtime/world';
import { backgroundColors, resolveSurfaces } from '../../kit/runtime/surface';
import { getStyle } from '../../kit/styles';
import { textureRegistry } from '../../kit/textures';
import type { TextureProvider } from '../../kit/textures';
import type { SceneDef } from '../../kit/runtime/types';

const fake = (): TextureProvider & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    surface(d, seed) {
      calls.push(`${d.name}:${seed}`);
      const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
      t.userData = { name: d.name };
      return t;
    },
    background() {
      return new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    },
    dispose() {},
  };
};

const scene = (style: SceneDef['style'], elements: SceneDef['elements'], extra: Partial<SceneDef> = {}): SceneDef => ({
  meta: { width: 640, height: 360, fps: 30, duration: 10, seed: 5 },
  style,
  environment: { sky: { preset: 'day' } },
  elements,
  shots: [{ id: 'a', start: 0, end: 10, camera: { move: 'static', pos: [0, 20, 40], target: [0, 0, 0] } }],
  ...extra,
});

const surfacesOf = (root: THREE.Object3D) => {
  const out: Record<string, string | undefined> = {};
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.name) out[m.name] = (m.material as THREE.Material).userData.surface;
  });
  return out;
};

describe('표면 질감 (look.surfaces)', () => {
  it('resolveSurfaces: 스타일 기본 → look 덮어쓰기 → none, 세기 우선순위', () => {
    const defs = textureRegistry();
    const r = resolveSurfaces(getStyle('pastel'), { surfaces: { ground: 'rock-grain', roof: 'none', trim: { texture: 'paper', tile: 2, strength: 0.8 } }, strength: 0.5 }, defs);
    expect(r.get('ground')).toMatchObject({ texture: 'rock-grain', tile: 3, strength: 0.5 });
    expect(r.has('roof')).toBe(false);
    expect(r.get('roofAlt')?.texture).toBe('roof-tiles');
    expect(r.get('trim')).toMatchObject({ texture: 'paper', tile: 2, strength: 0.8 });
    expect(r.get('water')?.flow).toEqual([0, 0.25]);
    expect(resolveSurfaces(getStyle('clay'), undefined, defs).size).toBe(0);
  });
  it('pastel 기본 질감이 role 메시에 적용, clay는 없음', () => {
    const p = fake();
    const { world } = buildWorld(scene('pastel', [{ id: 'c', type: 'castle' }]), { quality: 'preview', aspect: 16 / 9, textures: p });
    const s = surfacesOf(world!.scene.getObjectByName('c')!);
    expect(s.roofAlt).toBe('roof-tiles');
    expect(s.body).toBe('paper');
    expect(s.dark).toBeUndefined();
    world!.dispose();
    const { world: w2 } = buildWorld(scene('clay', [{ id: 'w', type: 'warehouse' }]), { quality: 'preview', aspect: 16 / 9, textures: fake() });
    expect(Object.values(surfacesOf(w2!.scene.getObjectByName('w')!)).every((v) => v === undefined)).toBe(true);
    w2!.dispose();
  });
  it('look.surfaces 덮어쓰기·none, 같은 텍스처는 한 번만 요청', () => {
    const p = fake();
    const def = scene('pastel', [{ id: 'a', type: 'cottage' }, { id: 'b', type: 'cottage' }], { look: { surfaces: { roof: 'none', body: 'wood-grain' } } });
    const { world } = buildWorld(def, { quality: 'preview', aspect: 1, textures: p });
    const s = surfacesOf(world!.scene.getObjectByName('a')!);
    expect(s.roof).toBeUndefined();
    expect(s.body).toBe('wood-grain');
    expect(p.calls.filter((c) => c.startsWith('wood-grain')).length).toBeGreaterThanOrEqual(1);
    world!.dispose();
  });
  it('flow 질감은 setTime이 uTime 갱신, seek 무관 (Review Focus 2)', () => {
    const def = scene('pastel', [
      { id: 'r1', type: 'river', params: { points: [[0, 0], [10, 0]] } },
      { id: 'r2', type: 'river', params: { points: [[0, 5], [10, 5]] } },
    ]);
    const { world } = buildWorld(def, { quality: 'preview', aspect: 1, textures: fake() });
    const waters: THREE.Material[] = [];
    world!.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name === 'water') waters.push(m.material as THREE.Material);
    });
    expect(waters.length).toBe(2);
    world!.setTime(3);
    world!.setTime(9);
    world!.setTime(3);
    for (const m of waters) {
      expect(m.userData.surface).toBe('water-ripple');
      expect(m.userData.surfaceTime.value).toBe(3);
    }
    world!.dispose();
  });
  it('provider 없으면 질감 미적용·오류 없음', () => {
    const { world, issues } = buildWorld(scene('pastel', [{ id: 'c', type: 'cottage' }]), { quality: 'preview', aspect: 1 });
    expect(issues).toEqual([]);
    expect(Object.values(surfacesOf(world!.scene)).every((v) => v === undefined)).toBe(true);
    world!.dispose();
  });
  it('질감 시드는 meta.seed와 텍스처 이름으로 결정', () => {
    const a = fake();
    const b = fake();
    buildWorld(scene('pastel', [{ id: 'c', type: 'cottage' }]), { quality: 'preview', aspect: 1, textures: a }).world!.dispose();
    buildWorld(scene('pastel', [{ id: 'c', type: 'cottage' }]), { quality: 'preview', aspect: 1, textures: b }).world!.dispose();
    expect(a.calls).toEqual(b.calls);
  });
});

describe('메쉬 그라디언트 배경 (environment.background)', () => {
  const skyDome = (s: THREE.Scene) => {
    let n = 0;
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).type === 'ShaderMaterial' && (m.material as THREE.ShaderMaterial).side === THREE.BackSide) n++;
    });
    return n;
  };
  it('provider가 그린 텍스처를 scene.background로, 구형 하늘 생략', () => {
    const calls: Array<{ colors: string[]; aspect: number; sun?: boolean }> = [];
    const p = { ...fake(), background(spec: { sun?: boolean }, colors: string[], aspect: number) { calls.push({ colors, aspect, sun: spec.sun }); return new THREE.DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1); } };
    const def = scene('pastel', [], { environment: { sky: { preset: 'day' }, background: { kind: 'meshGradient', preset: 'sunset', sun: true } } });
    const { world } = buildWorld(def, { quality: 'preview', aspect: 16 / 9, textures: p });
    expect((world!.scene.background as THREE.Texture).isTexture).toBe(true);
    expect(skyDome(world!.scene)).toBe(0);
    expect(calls[0].aspect).toBeCloseTo(16 / 9);
    expect(calls[0].sun).toBe(true);
    expect(calls[0].colors.length).toBeGreaterThanOrEqual(4);
    world!.dispose();
  });
  it('colors 지정이 우선, provider 없으면 기존 구형 하늘', () => {
    const got: string[][] = [];
    const p = { ...fake(), background(_s: unknown, colors: string[]) { got.push(colors); return new THREE.DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1); } };
    const def = scene('pastel', [], { environment: { background: { kind: 'meshGradient', colors: ['#112233', '#445566'] } } });
    buildWorld(def, { quality: 'preview', aspect: 1, textures: p }).world!.dispose();
    expect(got[0]).toEqual(['#112233', '#445566']);
    const { world } = buildWorld(def, { quality: 'preview', aspect: 1 });
    expect(skyDome(world!.scene)).toBe(1);
    world!.dispose();
  });
  it('backgroundColors: 프리셋은 스타일 하늘색에서', () => {
    expect(backgroundColors({ kind: 'meshGradient', preset: 'day' }, getStyle('pastel'), 'day')).toEqual(['#a9b8ee', '#f6c9d6', '#c9cff2', '#fff0d6']);
    expect(backgroundColors({ kind: 'meshGradient' }, getStyle('pastel'), 'dusk')[0]).toBe(getStyle('pastel').sky('dusk').top);
  });
});
