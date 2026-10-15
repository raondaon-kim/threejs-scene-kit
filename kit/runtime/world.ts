import * as THREE from 'three';
import { createGround } from '../modules/environment/ground';
import { createHeightField, TERRAIN_DEFAULTS } from '../modules/environment/heightfield';
import { createSky } from '../modules/environment/sky';
import { createTerrain } from '../modules/environment/terrain';
import { createTrees, placeTrees, TREES_DEFAULTS } from '../modules/environment/trees';
import { createWater } from '../modules/environment/water';
import { getStyle } from '../styles';
import { cameraPose, DEFAULT_FOV } from './camera';
import { followState } from './motion';
import { elementRegistry } from './registry';
import { rngFor } from './rng';
import { createLights, type Look } from './style';
import { elementState, findShot, sampleTrack } from './timeline';
import type { ElementDef, ElementHandle, ElementType, KitContext, Quality, SceneDef, TrackKey, TrackPath, Vec3 } from './types';
import type { Issue } from './validate';

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /** 그림자를 드리우는 태양광 (pipeline이 그림자 범위를 맞춘다) */
  sun: THREE.DirectionalLight;
  /** 그림자·초점 영역: 요소 위치와 follow 경로를 감싸는 원 */
  focus: { center: Vec3; radius: number };
  look: Look;
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

function setShadows(obj: THREE.Object3D, cast: boolean, receive: boolean) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.Material;
    if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial || (m as THREE.ShaderMaterial).isShaderMaterial) return;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
}

function computeFocus(def: SceneDef): { center: Vec3; radius: number } {
  const pts: Array<[number, number, number]> = [];
  for (const el of def.elements ?? []) {
    const at = el.at ?? [0, 0, 0];
    pts.push([at[0], at[1], at[2]]);
    for (const [x, z] of el.follow?.path ?? []) pts.push([x, at[1], z]);
  }
  if (!pts.length) return { center: [0, 0, 0], radius: 20 };
  const c: Vec3 = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) c[i] += p[i] / pts.length;
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p[0] - c[0], p[2] - c[2]));
  return { center: c, radius: Math.min(140, Math.max(20, r + 8)) };
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
  const ortho = def.meta.projection === 'ortho';
  const camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = ortho
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000)
    : new THREE.PerspectiveCamera(DEFAULT_FOV, opts.aspect, 0.1, 2000);
  const updaters: Array<(t: number) => void> = [];
  const addEnv = (h: ElementHandle, cast: boolean, receive: boolean) => {
    scene.add(h.object3d);
    disposables.push(h);
    setShadows(h.object3d, cast, receive);
    if (h.update) updaters.push((t) => h.update!(t));
  };

  addEnv(createSky(sky), false, false);
  const lights = createLights(sky, style);
  for (const l of lights) scene.add(l);
  const sun = lights.find((l) => (l as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
  let heightAt = (_x: number, _z: number) => 0;
  if (env.ground) addEnv(createGround({ style }, env.ground.size ?? 400), false, true);
  if (env.terrain) {
    const tp = { ...TERRAIN_DEFAULTS, ...env.terrain };
    const field = createHeightField(def.meta.seed, tp);
    heightAt = field.heightAt;
    addEnv(createTerrain({ style, quality: opts.quality }, field, tp.size), false, true);
  }
  if (env.trees) {
    addEnv(createTrees({ style }, placeTrees(def.meta.seed, { ...TREES_DEFAULTS, ...env.trees }, heightAt)), true, true);
  }
  if (env.water) {
    addEnv(createWater({ style }, { level: env.water.level ?? -1, size: env.water.size ?? env.terrain?.size ?? TERRAIN_DEFAULTS.size }), false, true);
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
      setShadows(h.object3d, true, true);
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
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      const hh = pose.size / 2;
      const hw = hh * opts.aspect;
      oc.left = -hw;
      oc.right = hw;
      oc.top = hh;
      oc.bottom = -hh;
      const [px, py, pz] = pose.position;
      const [tx, ty, tz] = pose.target;
      oc.far = Math.hypot(px - tx, py - ty, pz - tz) + 500;
    } else {
      (camera as THREE.PerspectiveCamera).fov = pose.fov;
    }
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
      let x = val('position.x', at[0]);
      let z = val('position.z', at[2]);
      let yaw = val('rotation.y', rot[1]) * DEG;
      if (it.el.follow) {
        const f = followState(it.el.follow, t);
        x = f.x;
        z = f.z;
        yaw += f.yaw;
        it.h.setParam?.('travel', f.travel);
      }
      it.holder.position.set(x, val('position.y', at[1]) + st.dy, z);
      it.holder.rotation.set(val('rotation.x', rot[0]) * DEG, yaw, val('rotation.z', rot[2]) * DEG);
      it.holder.scale.setScalar(val('scale', it.el.scale ?? 1) * st.scale);
      const op = st.opacity * val('opacity', 1);
      if (it.h.setOpacity) it.h.setOpacity(op);
      else for (const { m, base } of it.mats) m.opacity = base * op;
      if (it.h.setProgress && st.progress !== null) it.h.setProgress(st.progress);
      if (it.h.setParam) {
        for (const [k, keys] of Object.entries(tracks) as Array<[TrackKey, Array<[number, number]>]>) {
          if (k.startsWith('param.')) it.h.setParam(k.slice(6), sampleTrack(keys, t));
        }
      }
      it.h.update?.(t);
    }
  };

  return {
    world: {
      scene,
      camera,
      sun,
      focus: computeFocus(def),
      look: style.look,
      setTime,
      dispose() {
        disposeAll();
        scene.clear();
      },
    },
    issues: [],
  };
}
