import * as THREE from 'three';
import { rngFor } from '../../runtime/rng';
import type { Style } from '../../runtime/style';
import type { ElementHandle } from '../../runtime/types';
import { poissonDisk } from './poisson';

export interface TreesParams {
  count: number;
  area: number;
  avoidCenter: number;
}
export const TREES_DEFAULTS: TreesParams = { count: 250, area: 160, avoidCenter: 18 };

export interface TreePlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  phase: number;
}

export function placeTrees(seed: number, p: TreesParams, heightAt: (x: number, z: number) => number): TreePlacement[] {
  const rng = rngFor(seed, 'trees');
  const half = p.area / 2;
  const radius = Math.max(1.5, Math.sqrt((p.area * p.area) / (Math.max(1, p.count) * 1.6)));
  const raw = poissonDisk(rng, half, radius, Math.max(0, p.count) * 3);
  const out: TreePlacement[] = [];
  for (const [x, z] of raw) {
    if (out.length >= p.count) break;
    if (Math.hypot(x, z) < p.avoidCenter) continue;
    out.push({ x, z, y: heightAt(x, z), scale: 0.7 + rng() * 0.7, rot: rng() * Math.PI * 2, phase: rng() * Math.PI * 2 });
  }
  return out;
}

export function createTrees(ctx: { style: Style }, placements: TreePlacement[]): ElementHandle {
  const n = placements.length;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
  trunkGeo.translate(0, 0.8, 0);
  const lowGeo = new THREE.ConeGeometry(1.3, 2.4, 7);
  lowGeo.translate(0, 2.4, 0);
  const highGeo = new THREE.ConeGeometry(0.95, 1.9, 7);
  highGeo.translate(0, 3.4, 0);
  const trunkMat = ctx.style.material('trunk');
  const leafMat = ctx.style.material('foliage');
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const lows = new THREE.InstancedMesh(lowGeo, leafMat, n);
  const highs = new THREE.InstancedMesh(highGeo, leafMat, n);
  const group = new THREE.Group();
  for (const m of [trunks, lows, highs]) {
    m.frustumCulled = false;
    group.add(m);
  }
  const rng = rngFor(n, 'tree-colors');
  const base = new THREE.Color(ctx.style.palette.foliage);
  const tint = new THREE.Color();
  for (let i = 0; i < n; i++) {
    tint.copy(base).multiplyScalar(0.85 + rng() * 0.3);
    lows.setColorAt(i, tint);
    highs.setColorAt(i, tint);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const update = (t: number) => {
    for (let i = 0; i < n; i++) {
      const p = placements[i];
      const sway = 0.035 * Math.sin(t * 1.4 + p.phase);
      e.set(sway, p.rot, sway * 0.6);
      q.setFromEuler(e);
      pos.set(p.x, p.y, p.z);
      scl.setScalar(p.scale);
      m4.compose(pos, q, scl);
      trunks.setMatrixAt(i, m4);
      lows.setMatrixAt(i, m4);
      highs.setMatrixAt(i, m4);
    }
    trunks.instanceMatrix.needsUpdate = true;
    lows.instanceMatrix.needsUpdate = true;
    highs.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return {
    object3d: group,
    update,
    dispose() {
      trunkGeo.dispose();
      lowGeo.dispose();
      highGeo.dispose();
      trunkMat.dispose();
      leafMat.dispose();
      trunks.dispose();
      lows.dispose();
      highs.dispose();
    },
  };
}
