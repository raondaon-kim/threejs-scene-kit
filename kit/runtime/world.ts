import * as THREE from 'three';
import { createHeightField, TERRAIN_DEFAULTS } from '../modules/environment/heightfield';
import { createSky } from '../modules/environment/sky';
import { createTerrain } from '../modules/environment/terrain';
import { createTrees, placeTrees, TREES_DEFAULTS } from '../modules/environment/trees';
import { createWater } from '../modules/environment/water';
import { getStyle } from '../styles';
import { cameraPose, DEFAULT_FOV } from './camera';
import { elementRegistry } from './registry';
import { rngFor } from './rng';
import { createLights } from './style';
import { elementState, findShot, sampleTrack } from './timeline';
import type { ElementDef, ElementHandle, ElementType, KitContext, Quality, SceneDef, TrackPath } from './types';
import type { Issue } from './validate';

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 절대시간 t의 상태로 장면을 맞춘다. 호출 순서와 무관하게 같은 결과. */
  setTime(t: number): void;
  dispose(): void;
}

interface Item {
  el: ElementDef;
  h: ElementHandle;
  holder: THREE.Group;
  mats: Array<{ m: THREE.Material; base: number }>;
}

const DEG = Math.PI / 180;

function collectMaterials(obj: THREE.Object3D): THREE.Material[] {
  const set = new Set<THREE.Material>();
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (Array.isArray(m)) m.forEach((x) => set.add(x));
    else if (m) set.add(m);
  });
  return [...set];
}

export function buildWorld(def: SceneDef, opts: { quality: Quality; aspect: number }): { world: World | null; issues: Issue[] } {
  const disposables: Array<{ dispose(): void }> = [];
  const disposeAll = () => {
    for (const d of disposables) d.dispose();
  };
  const issues: Issue[] = [];
  let registry: Map<string, ElementType>;
  try {
    registry = elementRegistry(def.custom ?? []);
  } catch (e) {
    return { world: null, issues: [{ path: 'custom', message: (e as Error).message }] };
  }

  const style = getStyle(def.style);
  const env = def.environment ?? {};
  const sky = style.sky(env.sky?.preset ?? 'day');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sky.horizon);
  scene.fog = new THREE.FogExp2(sky.fog, style.fogDensity);
  const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, opts.aspect, 0.1, 2000);
  const updaters: Array<(t: number) => void> = [];
  const addEnv = (h: ElementHandle) => {
    scene.add(h.object3d);
    disposables.push(h);
    if (h.update) updaters.push((t) => h.update!(t));
  };

  addEnv(createSky(sky));
  for (const l of createLights(sky, style)) scene.add(l);
  let heightAt = (_x: number, _z: number) => 0;
  if (env.terrain) {
    const tp = { ...TERRAIN_DEFAULTS, ...env.terrain };
    const field = createHeightField(def.meta.seed, tp);
    heightAt = field.heightAt;
    addEnv(createTerrain({ style, quality: opts.quality }, field, tp.size));
  }
  if (env.trees) {
    addEnv(createTrees({ style }, placeTrees(def.meta.seed, { ...TREES_DEFAULTS, ...env.trees }, heightAt)));
  }
  if (env.water) {
    addEnv(createWater({ style }, { level: env.water.level ?? -1, size: env.water.size ?? env.terrain?.size ?? TERRAIN_DEFAULTS.size }));
  }

  const ctx: KitContext = {
    style,
    rng: (salt) => rngFor(def.meta.seed, `el:${salt}`),
    heightAt,
    quality: opts.quality,
    camera,
  };
  const items: Item[] = [];
  (def.elements ?? []).forEach((el, i) => {
    const type = registry.get(el.type);
    if (!type) {
      issues.push({ path: `elements[${i}].type`, message: `'${el.type}'은 알 수 없는 요소` });
      return;
    }
    try {
      const h = type.create(ctx, el.params ?? {});
      disposables.push(h);
      const holder = new THREE.Group();
      holder.name = el.id;
      holder.add(h.object3d);
      scene.add(holder);
      const mats = collectMaterials(h.object3d).map((m) => {
        m.transparent = true;
        return { m, base: m.opacity };
      });
      items.push({ el, h, holder, mats });
    } catch (e) {
      issues.push({ path: `elements[${i}].params`, message: (e as Error).message });
    }
  });
  if (issues.length > 0) {
    disposeAll();
    return { world: null, issues };
  }

  const setTime = (t: number) => {
    const { shot, u } = findShot(def.shots, t);
    const pose = cameraPose(shot.camera, u);
    camera.position.set(...pose.position);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    for (const f of updaters) f(t);
    for (const it of items) {
      const st = elementState(it.el, t);
      it.holder.visible = st.visible;
      if (!st.visible) continue;
      const at = it.el.at ?? [0, 0, 0];
      const rot = it.el.rotation ?? [0, 0, 0];
      const tracks = it.el.tracks ?? {};
      const val = (p: TrackPath, d: number) => {
        const keys = tracks[p];
        return keys ? sampleTrack(keys, t) : d;
      };
      it.holder.position.set(val('position.x', at[0]), val('position.y', at[1]) + st.dy, val('position.z', at[2]));
      it.holder.rotation.set(val('rotation.x', rot[0]) * DEG, val('rotation.y', rot[1]) * DEG, val('rotation.z', rot[2]) * DEG);
      it.holder.scale.setScalar(val('scale', it.el.scale ?? 1) * st.scale);
      const op = st.opacity * val('opacity', 1);
      if (it.h.setOpacity) it.h.setOpacity(op);
      else for (const { m, base } of it.mats) m.opacity = base * op;
      if (it.h.setProgress && st.progress !== null) it.h.setProgress(st.progress);
      it.h.update?.(t);
    }
  };

  return {
    world: {
      scene,
      camera,
      setTime,
      dispose() {
        disposeAll();
        scene.clear();
      },
    },
    issues: [],
  };
}
