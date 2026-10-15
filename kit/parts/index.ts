/**
 * 부품 라이브러리: 오브젝트 모듈 내부에서 쓰는 형태와 병합 도우미.
 * 관례: 원점은 바닥 중심(wheelGeo만 중심 원점, 축은 X), 단위 m, 차량은 +Z가 앞.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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

/** 곡선 위의 평평한 리본(법선 +Y). offset 범위 [a, b]는 중심선 기준 좌우 거리. */
export function ribbon(curve: THREE.Curve<THREE.Vector3>, u0: number, u1: number, steps: number, a: number, b: number, y: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    let nx = -t.z;
    let nz = t.x;
    const l = Math.hypot(nx, nz);
    if (l < 1e-8 || !Number.isFinite(l)) {
      nx = 1;
      nz = 0;
    } else {
      nx /= l;
      nz /= l;
    }
    pos.push(p.x + nx * a, y, p.z + nz * a, p.x + nx * b, y, p.z + nz * b);
    nor.push(0, 1, 0, 0, 1, 0);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  // 리본의 감김 방향과 관계없이 위에서 보이도록 양면 재질을 쓴다.
  return g;
}

/**
 * 시드로 표면을 살짝 울퉁불퉁하게 만든 구 덩어리(바위·구름·나무 덩어리). 바닥 원점, 결정적.
 * amp: 반지름 변형 비율, detail: 아이코스피어 세분 단계.
 */
export function blob(r: number, rng: () => number, amp = 0.18, detail = 2): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(r, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  ico.dispose();
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + amp * (rng() * 2 - 1));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, 0);
  return g;
}

/** 박공지붕용 삼각 기둥: 바닥 폭 w, 높이 h, 용마루는 Z축 방향(길이 d). 바닥 원점 */
export function prism(w: number, h: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

/** 아치: 폭 span·높이 rise의 반타원 구멍을 낸 벽(두께 thick)을 Z로 depth만큼 압출. 바닥 원점, X 방향으로 걸침 */
export function arch(span: number, rise: number, thick: number, depth: number, seg = 24): THREE.BufferGeometry {
  const W = span / 2 + thick;
  const s = new THREE.Shape();
  s.moveTo(-W, 0);
  s.lineTo(-W, rise + thick);
  s.lineTo(W, rise + thick);
  s.lineTo(W, 0);
  for (let i = 0; i <= seg; i++) {
    const a = (Math.PI * i) / seg;
    s.lineTo((Math.cos(a) * span) / 2, Math.sin(a) * rise);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -depth / 2);
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
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return n;
}

type RGB = number | [number, number, number];
const rgb = (v: RGB): [number, number, number] => (typeof v === 'number' ? [v, v, v] : v);

/**
 * 정점 색 음영: 높이 비율(y0~y1, 기본은 형상 bbox)로 bottom→top RGB 배율을 넣는다.
 * buildByRole이 팔레트 색에 곱한다(keepColor). 같은 지오메트리를 반환.
 */
export function shade(geo: THREE.BufferGeometry, o: { top: RGB; bottom: RGB; y0?: number; y1?: number }): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const y0 = o.y0 ?? geo.boundingBox!.min.y;
  const y1 = o.y1 ?? geo.boundingBox!.max.y;
  const span = Math.max(1e-6, y1 - y0);
  const top = rgb(o.top);
  const bot = rgb(o.bottom);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const f = Math.min(1, Math.max(0, (p.getY(i) - y0) / span));
    for (let k = 0; k < 3; k++) col[i * 3 + k] = bot[k] + (top[k] - bot[k]) * f;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/** 이미 넣은 정점 색에 RGB 배율을 곱한다 (나무마다 색 흔들림 등) */
export function tintColors(geo: THREE.BufferGeometry, m: [number, number, number]): THREE.BufferGeometry {
  const c = geo.attributes.color;
  if (!c) return geo;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * m[0], c.getY(i) * m[1], c.getZ(i) * m[2]);
  c.needsUpdate = true;
  return geo;
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
    // 정점 색이 있는 부품이 하나라도 있으면 나머지는 흰색(배율 1)으로 채워 병합
    const colored = geos.some((g) => g.attributes.color);
    if (colored) {
      for (const g of geos) {
        if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      }
    }
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) throw new Error(`부품 병합 실패 (role ${role})`);
    if (merged !== geos[0] || geos.length > 1) for (const g of geos) if (g !== merged) g.dispose();
    const mat = colored ? style.material(role, { vertexColors: true, keepColor: true }) : style.material(role);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = role;
    group.add(mesh);
    owned.push(merged, mat);
  }
  for (const p of parts) p.geo.dispose();
  return { group, dispose: () => owned.forEach((o) => o.dispose()) };
}
