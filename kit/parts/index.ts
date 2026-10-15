/**
 * 부품 라이브러리: 오브젝트 모듈 내부에서 쓰는 형태와 병합 도우미.
 * 관례: 원점은 바닥 중심(wheelGeo만 중심 원점, 축은 X), 단위 m, 차량은 +Z가 앞.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Style } from '../runtime/style';
import type { Role } from '../runtime/types';

export type Part = { role: Role; geo: THREE.BufferGeometry };

export function roundedBox(w: number, h: number, d: number, r = 0.1): THREE.BufferGeometry {
  const rr = Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const g = new RoundedBoxGeometry(w, h, d, 3, rr);
  g.translate(0, h / 2, 0);
  return g;
}

export function cyl(rTop: number, rBottom: number, h: number, seg = 24): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
  g.translate(0, h / 2, 0);
  return g;
}

/** 바퀴: 중심 원점, 회전축 X */
export function wheelGeo(radius: number, width: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, width, 28);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function sphere(r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 32, 20);
  g.translate(0, r, 0);
  return g;
}

export function cone(r: number, h: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 28);
  g.translate(0, h / 2, 0);
  return g;
}

/** 지오메트리를 제자리에서 회전(Y)·이동하고 그대로 반환 */
export function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}

function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return n;
}

/** 같은 역할의 부품을 하나의 메시로 병합한다(draw call 절감). 원본 지오메트리는 해제된다. */
export function buildByRole(style: Style, parts: Part[]): { group: THREE.Group; dispose(): void } {
  const byRole = new Map<Role, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const list = byRole.get(p.role) ?? [];
    list.push(normalize(p.geo));
    byRole.set(p.role, list);
  }
  const group = new THREE.Group();
  const owned: Array<{ dispose(): void }> = [];
  for (const [role, geos] of byRole) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) throw new Error(`부품 병합 실패 (role ${role})`);
    if (merged !== geos[0] || geos.length > 1) for (const g of geos) if (g !== merged) g.dispose();
    const mat = style.material(role);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = role;
    group.add(mesh);
    owned.push(merged, mat);
  }
  for (const p of parts) p.geo.dispose();
  return { group, dispose: () => owned.forEach((o) => o.dispose()) };
}
