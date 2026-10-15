# 앵커 헬퍼 + 스토리보드 제약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** scene.ts에서 도크·트럭·차선 좌표를 손으로 계산하지 않게 하는 순수 앵커 헬퍼와, 스토리보드 프롬프트에 키트 목록·고정 아이소 카메라를 자동 주입하는 제약을 추가한다.

**Architecture:** `kit/anchors.ts`는 three.js에 의존하지 않는 순수 함수(숫자 배열 반환)라 scene 스키마·validate·world는 그대로다. 도크 공식은 `kit/modules/logistics/layout.ts` 하나로 모아 warehouse 메시와 앵커가 공유한다. 스토리보드 제약은 `scripts/lib/kit-vocab.mjs`의 문구를 `storyboard.mjs`의 `promptFor`가 조건부로 넣는다.

**Tech Stack:** TypeScript 5.9 (kit), Node 22 ESM (scripts), vitest 5, three 0.186 (테스트의 기준 변환에만 사용).

**Spec:** `docs/superpowers/specs/2026-10-15-anchors-storyboard-constraints-design.md`

## Global Constraints

- scene 스키마(`kit/runtime/types.ts`), `validate.ts`, `world.ts`는 바꾸지 않는다.
- `kit/anchors.ts`와 `kit/modules/logistics/layout.ts`는 three.js를 import하지 않는다.
- 회전 규약: three.js Y축 회전. x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ (θ = yaw 라디안).
- 오른쪽 법선: 진행 방향 (fx, fz) → (−fz, fx). 양수 offset = 진행 방향 오른쪽.
- 트럭 정차 z(로컬) = depth/2 + length/2 + 0.7. 기본값 width 24, depth 14, docks 4, length 9, from 13.
- 스토리보드 필드: `vocab: 'kit'|'free'` (기본 kit), `camera: 'iso'|'free'` (기본 iso), 샷 값이 전역 값보다 우선.
- CAMERA_ISO 문장: `Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.`
- 금지 문장 목록: `cars, people, text, logos, distant towns, water, bridges`
- 오류 경로 형식은 기존과 같게: `storyboard.vocab`, `storyboard.shots[i].camera`.
- git commit은 다른 명령과 같은 Bash 호출에 묶지 않는다(훅 오탐). 파일 수정은 Edit/Write 도구로.

## Review Focus

1. lane에 U턴(180° 꺾임) 점이 있으면 → NaN 없이 앞 구간 법선 기준으로 오프셋 (Task 2 테스트).
2. 90°의 배수가 아닌 회전(30°, −135°)의 창고 → 앵커가 three.js holder 변환과 일치 (Task 1 테스트).
3. 도로 요소 params와 lane이 같은 점 배열 상수를 공유 → lane(reverse 포함)이 입력 배열을 변경하지 않음 (Task 2 테스트).
4. 전역 `free` + 샷 단위 `iso`/`kit` 덮어쓰기(그 반대도) → 샷 값이 우선 (Task 3 테스트).
5. docks 1 → dock(0)은 중앙, docks 0 → 어떤 인덱스든 명확한 오류 (Task 1 테스트).

---

### Task 1: 도크 공식 분리 + warehouseAnchors

**Files:**
- Create: `kit/modules/logistics/layout.ts`
- Create: `kit/anchors.ts`
- Modify: `kit/modules/logistics/warehouse.ts` (로컬 dockPositions 제거, layout에서 import·re-export)
- Test: `tests/unit/anchors.test.ts` (신규), `tests/unit/logistics.test.ts` (메시 일치 테스트 추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `dockPositions(w: number, docks: number): number[]` (layout.ts, warehouse.ts에서 re-export 유지)
  - `type XZ = [number, number]`, `interface Placement { at: Vec3; rotation: Vec3 }`, `interface BackIn extends Placement { path: XZ[] }`
  - `warehouseAnchors(o?: { at?: Vec3; rotation?: number; width?: number; depth?: number; docks?: number }): { dock(i: number): Vec3; truck(i: number, o?: { length?: number }): Placement; backIn(i: number, o?: { length?: number; from?: number }): BackIn }`

- [ ] **Step 1: 실패 테스트 작성** — `tests/unit/anchors.test.ts`

```ts
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { warehouseAnchors } from '../../kit/anchors';
import { dockPositions } from '../../kit/modules/logistics/warehouse';

type V3 = [number, number, number];
const close = (a: readonly number[], b: readonly number[], p = 6) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], p));
};
/** 기준: three.js holder(at, yaw)에 붙은 로컬 점의 월드 좌표 */
const world = (at: V3, yaw: number, local: V3) => {
  const g = new THREE.Object3D();
  g.position.set(...at);
  g.rotation.set(0, (yaw * Math.PI) / 180, 0);
  g.updateMatrixWorld();
  return g.localToWorld(new THREE.Vector3(...local)).toArray();
};

describe('warehouseAnchors', () => {
  it('dock = dockPositions 공식, 앞면 z = depth/2', () => {
    const wh = warehouseAnchors({ width: 30, depth: 16, docks: 4 });
    dockPositions(30, 4).forEach((x, i) => close(wh.dock(i), [x, 0, 8]));
  });
  it('기본값은 warehouse 요소와 같음 (24×14, docks 4)', () => {
    close(warehouseAnchors().dock(0), [dockPositions(24, 4)[0], 0, 7]);
  });
  it('truck: z = d/2 + L/2 + 0.7, rotation = 창고 yaw', () => {
    const p = warehouseAnchors({ width: 30, depth: 16, docks: 4 }).truck(2, { length: 9 });
    close(p.at, [3.6, 0, 13.2]);
    close(p.rotation, [0, 0, 0]);
  });
  it.each([90, 30, -135])('회전 %s°: three.js holder 변환과 일치 (Review Focus 2)', (yaw) => {
    const at: V3 = [5, 0.5, -3];
    const wh = warehouseAnchors({ at, rotation: yaw, width: 30, depth: 16, docks: 4 });
    close(wh.dock(1), world(at, yaw, [-3.6, 0, 8]));
    const t = wh.truck(3, { length: 7 });
    close(t.at, world(at, yaw, [10.8, 0, 8 + 3.5 + 0.7]));
    close(t.rotation, [0, yaw, 0]);
  });
  it('backIn: 앞쪽 from m 지점 → 정차 위치, rotation 180', () => {
    const b = warehouseAnchors({ width: 30, depth: 16, docks: 4 }).backIn(2, { length: 9, from: 13 });
    close(b.at, [3.6, 0, 13.2]);
    close(b.rotation, [0, 180, 0]);
    close(b.path.flat(), [3.6, 26.2, 3.6, 13.2]);
  });
  it('backIn: follow yaw + rotation 180 = 창고 yaw (회전 창고에서도 트럭 앞이 바깥)', () => {
    const yaw = 30;
    const b = warehouseAnchors({ rotation: yaw, width: 30, depth: 16 }).backIn(0);
    const [[x0, z0], [x1, z1]] = b.path;
    const followYaw = (Math.atan2(x1 - x0, z1 - z0) * 180) / Math.PI;
    const total = (((followYaw + b.rotation[1]) % 360) + 360) % 360;
    expect(total).toBeCloseTo(yaw, 6);
  });
  it('docks 1 → 중앙, docks 0 → 오류 (Review Focus 5)', () => {
    close(warehouseAnchors({ docks: 1 }).dock(0), [0, 0, 7]);
    expect(() => warehouseAnchors({ docks: 0 }).dock(0)).toThrow(/도크가 없음/);
  });
  it('잘못된 인덱스·파라미터는 허용 범위를 담은 오류', () => {
    const wh = warehouseAnchors({ docks: 4 });
    for (const i of [-1, 4, 1.5, NaN]) expect(() => wh.dock(i)).toThrow(/0\.\.3/);
    expect(() => warehouseAnchors({ width: NaN })).toThrow(/width/);
    expect(() => wh.truck(0, { length: Infinity })).toThrow(/length/);
    expect(() => warehouseAnchors({ at: [0, NaN, 0] as unknown as V3 })).toThrow(/at/);
  });
});
```

`tests/unit/logistics.test.ts`의 `'warehouse 도크는 중심 대칭 (리뷰 I2)'` 테스트 뒤에 추가 (같은 파일의 `byType`, `ctx` 사용):

```ts
  it('앵커 dock x = 실제 메시의 범퍼 기둥 사이 중앙 (accent 기둥 x±1.9)', () => {
    const h = byType.warehouse.create(ctx, { width: 30, depth: 16, docks: 3 });
    const accent = h.object3d.getObjectByName('accent') as THREE.Mesh;
    const pos = accent.geometry.attributes.position;
    const xs: number[] = [];
    for (let i = 0; i < pos.count; i++) xs.push(pos.getX(i));
    const wh = warehouseAnchors({ width: 30, depth: 16, docks: 3 });
    for (let i = 0; i < 3; i++) {
      const x = wh.dock(i)[0];
      for (const s of [-1, 1]) expect(xs.some((v) => Math.abs(v - (x + s * 1.9)) < 0.11)).toBe(true);
    }
    h.dispose();
  });
```
(파일 상단 import에 `import { warehouseAnchors } from '../../kit/anchors';` 추가.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchors.test.ts tests/unit/logistics.test.ts`
Expected: FAIL — `kit/anchors` 모듈 없음 (import 해석 실패)

- [ ] **Step 3: 구현**

`kit/modules/logistics/layout.ts`:
```ts
/** 도크 x 위치(로컬): 중심 대칭, 양 끝 ±0.36w. warehouse 메시와 anchors가 공유한다 */
export function dockPositions(w: number, docks: number): number[] {
  if (docks <= 0) return [];
  if (docks === 1) return [0];
  return Array.from({ length: docks }, (_, i) => -w * 0.36 + (i * w * 0.72) / (docks - 1));
}
```

`kit/modules/logistics/warehouse.ts`: 파일 안의 `export function dockPositions … }` 블록과 그 위 주석을 지우고, import 아래에 추가:
```ts
import { dockPositions } from './layout';

export { dockPositions };
```

`kit/anchors.ts`:
```ts
import { dockPositions } from './modules/logistics/layout';
import type { Vec3 } from './runtime/types';

/** scene.ts 작성용 순수 헬퍼: 손계산 좌표를 대신한다. 결과는 숫자 배열이라 scene 데이터에 그대로 넣는다 */
export type XZ = [number, number];
export interface Placement {
  at: Vec3;
  rotation: Vec3;
}
export interface BackIn extends Placement {
  path: XZ[];
}
export interface WarehouseAnchorOpts {
  at?: Vec3;
  /** yaw(도). warehouse 요소의 rotation[1]과 같은 값 */
  rotation?: number;
  width?: number;
  depth?: number;
  docks?: number;
}

const DEG = Math.PI / 180;

function fin(name: string, v: unknown, d: number): number {
  if (v === undefined) return d;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`warehouseAnchors: ${name}는 유한한 숫자여야 함 (받은 값 ${String(v)})`);
  return v;
}

export function warehouseAnchors(o: WarehouseAnchorOpts = {}) {
  const at = o.at ?? [0, 0, 0];
  if (!Array.isArray(at) || at.length !== 3 || at.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    throw new Error(`warehouseAnchors: at은 유한한 숫자 3개 [x, y, z]여야 함`);
  }
  const yaw = fin('rotation', o.rotation, 0);
  const w = fin('width', o.width, 24);
  const d = fin('depth', o.depth, 14);
  const docks = Math.max(0, Math.round(fin('docks', o.docks, 4)));
  const xs = dockPositions(w, docks);
  const c = Math.cos(yaw * DEG);
  const s = Math.sin(yaw * DEG);
  const toWorld = (x: number, z: number): XZ => [at[0] + x * c + z * s, at[2] - x * s + z * c];
  const dockX = (i: number) => {
    if (docks === 0) throw new Error('warehouseAnchors: 도크가 없음 (docks 0)');
    if (!Number.isInteger(i) || i < 0 || i >= docks) throw new Error(`warehouseAnchors: dock 인덱스는 0..${docks - 1} 정수 (받은 값 ${i})`);
    return xs[i];
  };
  const truckZ = (len: number) => d / 2 + len / 2 + 0.7;
  return {
    /** 도크 문 중앙 바닥 (월드) */
    dock(i: number): Vec3 {
      const [x, z] = toWorld(dockX(i), d / 2);
      return [x, at[1], z];
    },
    /** 도크 앞 정차 트럭: 뒷면이 노란 범퍼 바로 앞, 앞이 바깥 */
    truck(i: number, t: { length?: number } = {}): Placement {
      const [x, z] = toWorld(dockX(i), truckZ(fin('length', t.length, 9)));
      return { at: [x, at[1], z], rotation: [0, yaw, 0] };
    },
    /** 후진 진입: follow.path로 쓰고 rotation [0,180,0] (follow가 진행 방향 yaw를 더함) */
    backIn(i: number, t: { length?: number; from?: number } = {}): BackIn {
      const lx = dockX(i);
      const zt = truckZ(fin('length', t.length, 9));
      const from = fin('from', t.from, 13);
      const [x, z] = toWorld(lx, zt);
      return { at: [x, at[1], z], rotation: [0, 180, 0], path: [toWorld(lx, zt + from), [x, z]] };
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchors.test.ts tests/unit/logistics.test.ts`
Expected: PASS (전부)

- [ ] **Step 5: 전체 + 타입 체크 후 커밋**

Run: `npx vitest run` → 전부 PASS, `npx tsc --noEmit -p .` → 출력 없음
```bash
git add kit/anchors.ts kit/modules/logistics/layout.ts kit/modules/logistics/warehouse.ts tests/unit/anchors.test.ts tests/unit/logistics.test.ts
git commit -m "feat(anchors): warehouseAnchors (dock/truck/backIn), 도크 공식 layout.ts로 단일화"
```

---

### Task 2: lane (차선 오프셋)

**Files:**
- Modify: `kit/anchors.ts` (lane 추가)
- Test: `tests/unit/anchors.test.ts` (describe 추가)

**Interfaces:**
- Consumes: `XZ` (Task 1)
- Produces: `lane(points: XZ[], offset: number, opts?: { reverse?: boolean }): XZ[]`

- [ ] **Step 1: 실패 테스트 작성** — anchors.test.ts 끝에 추가, import를 `import { lane, warehouseAnchors } from '../../kit/anchors';`로

```ts
describe('lane', () => {
  it('직선: +X 진행의 오른쪽은 +Z', () => {
    close(lane([[0, 0], [10, 0]], 1.6).flat(), [0, 1.6, 10, 1.6]);
  });
  it('90° 꺾임: 두 구간 모두에서 거리 유지 (미터 꼭짓점)', () => {
    const r = lane([[0, 0], [10, 0], [10, 10]], 1);
    close(r.flat(), [0, 1, 9, 1, 9, 10]);
  });
  it('음수 offset = 왼쪽', () => {
    close(lane([[0, 0], [10, 0]], -2).flat(), [0, -2, 10, -2]);
  });
  it('reverse: 뒤집어 진행, 오른쪽은 반대편', () => {
    close(lane([[0, 0], [10, 0]], 1.6, { reverse: true }).flat(), [10, -1.6, 0, -1.6]);
  });
  it('입력 배열을 바꾸지 않음 (Review Focus 3)', () => {
    const pts: XZ[] = [[0, 0], [10, 0], [10, 10]];
    const copy = JSON.stringify(pts);
    lane(pts, 1, { reverse: true });
    lane(pts, -1);
    expect(JSON.stringify(pts)).toBe(copy);
  });
  it('U턴(180°)에서도 NaN 없음 (Review Focus 1)', () => {
    const r = lane([[0, 0], [10, 0], [0, 0.0001]], 1);
    expect(r.flat().every(Number.isFinite)).toBe(true);
    close(r[1], [10, 1], 3);
  });
  it('예각은 배율 상한 2', () => {
    const r = lane([[0, 0], [10, 0], [0, 1]], 1);
    expect(Math.hypot(r[1][0] - 10, r[1][1])).toBeLessThanOrEqual(2 + 1e-9);
  });
  it('연속 중복점 제거, 서로 다른 점 2개 미만이면 오류', () => {
    expect(lane([[0, 0], [0, 0], [10, 0]], 1)).toHaveLength(2);
    expect(() => lane([[1, 1], [1, 1]], 1)).toThrow(/2개/);
    expect(() => lane([[0, 0], [NaN, 1]], 1)).toThrow(/숫자/);
    expect(() => lane([[0, 0], [1, 0]], NaN)).toThrow(/offset/);
  });
});
```
(`XZ` 타입 import: `import { lane, warehouseAnchors, type XZ } from '../../kit/anchors';`)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchors.test.ts`
Expected: FAIL — `lane`이 export되지 않음 (`lane is not a function`)

- [ ] **Step 3: 구현** — `kit/anchors.ts` 끝에 추가

```ts
/**
 * 도로 중심선 points를 진행 방향 오른쪽으로 offset(m)만큼 평행 이동한 경로 (음수 = 왼쪽).
 * 꺾이는 점은 이등분 법선으로 밀고 배율은 최대 2. U턴은 앞 구간 법선을 쓴다. 입력은 바꾸지 않는다.
 */
export function lane(points: XZ[], offset: number, opts: { reverse?: boolean } = {}): XZ[] {
  if (typeof offset !== 'number' || !Number.isFinite(offset)) throw new Error('lane: offset은 유한한 숫자여야 함');
  const src = opts.reverse ? [...points].reverse() : points;
  const pts: XZ[] = [];
  for (const p of src) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('lane: 점은 [x, z] 유한한 숫자 쌍이어야 함');
    }
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) pts.push([p[0], p[1]]);
  }
  if (pts.length < 2) throw new Error('lane: 서로 다른 점이 2개 이상 필요함');
  const right = (a: XZ, b: XZ): XZ => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz);
    return [-dz / l, dx / l];
  };
  return pts.map((p, i): XZ => {
    let n: XZ;
    let k = 1;
    if (i === 0) n = right(pts[0], pts[1]);
    else if (i === pts.length - 1) n = right(pts[i - 1], p);
    else {
      const n1 = right(pts[i - 1], p);
      const n2 = right(p, pts[i + 1]);
      const sx = n1[0] + n2[0];
      const sz = n1[1] + n2[1];
      const l = Math.hypot(sx, sz);
      if (l < 1e-3) n = n1; // U턴(거의 180°): 이등분 법선이 불안정하므로 앞 구간 법선
      else {
        n = [sx / l, sz / l];
        k = Math.min(2, 1 / Math.max(1e-6, n[0] * n1[0] + n[1] * n1[1]));
      }
    }
    return [p[0] + n[0] * offset * k, p[1] + n[1] * offset * k];
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchors.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 + 타입 체크 후 커밋**

Run: `npx vitest run`, `npx tsc --noEmit -p .`
```bash
git add kit/anchors.ts tests/unit/anchors.test.ts
git commit -m "feat(anchors): lane — 도로 중심선 차선 오프셋 (미터 꼭짓점, U턴 안전)"
```

---

### Task 3: 스토리보드 제약 (vocab / camera)

**Files:**
- Create: `scripts/lib/kit-vocab.mjs`
- Modify: `scripts/storyboard.mjs` (HELP, loadStoryboard 검증, promptFor)
- Test: `tests/scripts/kit-vocab.test.mjs` (신규), `tests/scripts/storyboard.test.mjs` (테스트 추가)

**Interfaces:**
- Consumes: `LOGISTICS_ELEMENTS` (`kit/modules/logistics/index.ts`, 기존; 각 항목 `.type`)
- Produces: `KIT_VOCAB: Record<string,string>`, `FORBIDDEN: string`, `CAMERA_ISO: string`, `vocabSentence(): string`

- [ ] **Step 1: 실패 테스트 작성**

`tests/scripts/kit-vocab.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { LOGISTICS_ELEMENTS } from '../../kit/modules/logistics/index.ts';
import { KIT_VOCAB, vocabSentence, CAMERA_ISO } from '../../scripts/lib/kit-vocab.mjs';

describe('kit-vocab', () => {
  it('물류 키트의 모든 type에 문구가 있음 (키트가 늘면 실패로 알림)', () => {
    for (const { type } of LOGISTICS_ELEMENTS) expect(KIT_VOCAB[type], type).toBeTruthy();
  });
  it('vocabSentence는 모든 문구와 금지 목록을 포함', () => {
    const s = vocabSentence();
    for (const v of Object.values(KIT_VOCAB)) expect(s).toContain(v);
    expect(s).toMatch(/^Only depict objects from this list: .+\. Do not include: cars, people, text, logos, distant towns, water, bridges\.$/);
  });
  it('CAMERA_ISO는 스펙 문장 그대로', () => {
    expect(CAMERA_ISO).toBe('Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.');
  });
});
```

`tests/scripts/storyboard.test.mjs`의 describe 끝(`'storyboard.json 형식 오류'` 뒤)에 추가:
```js
  const prompts = () => Object.fromEntries(JSON.parse(readFileSync(join(dir, 'storyboard', 'log.json'), 'utf8')).map((e) => [e.id, e.prompt]));
  it('기본: Camera·Objects 줄을 Style 뒤, Content 앞에 주입 (A-1)', () => {
    expect(run(['--project', dir, '--shot', 's1']).code).toBe(0);
    const p = prompts().s1;
    expect(p).toMatch(/^Camera: Orthographic isometric view/m);
    expect(p).toMatch(/^Objects: Only depict objects from this list: .*yellow forklifts/m);
    expect(p.indexOf('Style:')).toBeLessThan(p.indexOf('Camera:'));
    expect(p.indexOf('Camera:')).toBeLessThan(p.indexOf('Objects:'));
    expect(p.indexOf('Objects:')).toBeLessThan(p.indexOf('Content:'));
  });
  it('전역 free + 샷 단위 덮어쓰기 (Review Focus 4)', () => {
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', vocab: 'free', camera: 'free', shots: [{ id: 's1', prompt: 'a', camera: 'iso' }, { id: 's2', prompt: 'b', vocab: 'kit' }] }));
    expect(run(['--project', dir]).code).toBe(0);
    const p = prompts();
    expect(p.s1).toMatch(/^Camera:/m);
    expect(p.s1).not.toMatch(/^Objects:/m);
    expect(p.s2).not.toMatch(/^Camera:/m);
    expect(p.s2).toMatch(/^Objects:/m);
  });
  it('잘못된 vocab/camera 값 거부', () => {
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', vocab: 'all', shots: [{ id: 's1', prompt: 'a', camera: 'top' }] }));
    const { code, out } = run(['--project', dir]);
    expect(code).toBe(1);
    expect(out.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['storyboard.vocab', 'storyboard.shots[0].camera']));
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/scripts/kit-vocab.test.mjs tests/scripts/storyboard.test.mjs`
Expected: FAIL — kit-vocab.mjs 없음, storyboard 새 테스트 3개 실패 (Camera 줄 없음, 잘못된 값이 통과)

- [ ] **Step 3: 구현**

`scripts/lib/kit-vocab.mjs`:
```js
/** 스토리보드 프롬프트 제약: 키트로 만들 수 있는 것만, 렌더와 같은 아이소 카메라로 */
export const KIT_VOCAB = {
  warehouse: 'a warehouse with loading docks',
  truck: 'box trucks and vans',
  forklift: 'yellow forklifts',
  pallet: 'pallets with cardboard boxes or blue crates',
  container: 'shipping containers',
  road: 'roads with a dashed center line',
  lot: 'paved lots',
  tree: 'round lollipop trees and cone trees',
  pin: 'blue map pins',
  building: 'simple office buildings',
};
export const FORBIDDEN = 'cars, people, text, logos, distant towns, water, bridges';
/** scene의 아이소 방향 target + [45, 67, 78]: 방위 30°, 고도 약 37° */
export const CAMERA_ISO = 'Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.';
export function vocabSentence() {
  return `Only depict objects from this list: ${Object.values(KIT_VOCAB).join(', ')}. Do not include: ${FORBIDDEN}.`;
}
```

`scripts/storyboard.mjs`:
1. import 추가: `import { CAMERA_ISO, vocabSentence } from './lib/kit-vocab.mjs';`
2. `function loadStoryboard` 위에:
```js
const MODES = { vocab: ['kit', 'free'], camera: ['iso', 'free'] };
const modeError = (obj, path, errors) => {
  for (const [k, allowed] of Object.entries(MODES)) {
    if (obj?.[k] !== undefined && !allowed.includes(obj[k])) errors.push({ path: `${path}.${k}`, message: `${allowed.map((a) => `'${a}'`).join(' 또는 ')}이어야 함` });
  }
};
```
3. loadStoryboard: `if (!Array.isArray(sb.shots) …` 줄 다음에 `modeError(sb, 'storyboard', errors);`, forEach 안 `at` 검사 다음에 `modeError(s, \`storyboard.shots[${i}]\`, errors);`
4. promptFor 교체:
```js
function promptFor(sb, shot) {
  const orient = sb.aspect === '16:9' ? 'landscape 16:9' : 'portrait 9:16';
  const camera = shot.camera ?? sb.camera ?? 'iso';
  const vocab = shot.vocab ?? sb.vocab ?? 'kit';
  return [
    `Generate exactly ONE image with your image generation tool, then save it as storyboard/${shot.id}.png inside the current directory (create the folder if needed). The saved PNG must be ${orient}. Do not write any other files.`,
    `Style: ${sb.style}`,
    ...(camera === 'iso' ? [`Camera: ${CAMERA_ISO}`] : []),
    ...(vocab === 'kit' ? [`Objects: ${vocabSentence()}`] : []),
    `Content: ${shot.prompt}`,
    'When finished, reply with only the saved file path.',
  ].join('\n');
}
```
5. HELP의 storyboard.json 설명 줄 뒤에 추가:
```
  기본으로 프롬프트에 키트 목록(vocab)과 고정 아이소 카메라(camera)를 넣는다.
  끄기: "vocab": "free", "camera": "free" (전역 또는 shots[] 단위, 샷 값 우선)
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/scripts/kit-vocab.test.mjs tests/scripts/storyboard.test.mjs`
Expected: PASS

- [ ] **Step 5: 전체 후 커밋**

Run: `npx vitest run`
```bash
git add scripts/lib/kit-vocab.mjs scripts/storyboard.mjs tests/scripts/kit-vocab.test.mjs tests/scripts/storyboard.test.mjs
git commit -m "feat(storyboard): 키트 목록·고정 아이소 카메라 자동 주입 (vocab/camera, free로 끄기)"
```

---

### Task 4: 문서

**Files:**
- Modify: `skills/scene-modules/references/logistics.md` (앵커 섹션 + 예시 교체)
- Modify: `skills/scene-modules/SKILL.md` (앵커 한 줄)
- Modify: `skills/scene-direct/SKILL.md` (연출표 2행)
- Modify: `skills/scene-direct/references/storyboard.md` (제약 섹션)
- Test: `tests/unit/skills.test.ts`

**Interfaces:**
- Consumes: Task 1~3의 공개 이름(`warehouseAnchors`, `dock`, `truck`, `backIn`, `lane`, `vocab`, `camera`)
- Produces: 없음

- [ ] **Step 1: 실패 테스트 작성** — skills.test.ts의 `'v0.2: storyboard 레퍼런스와 SKILL 명령'` 다음에:

```ts
  it('앵커·스토리보드 제약 문서', () => {
    const lg = readFileSync(join(ROOT, 'skills', 'scene-modules', 'references', 'logistics.md'), 'utf8');
    for (const k of ['warehouseAnchors', '.dock(', '.truck(', '.backIn(', 'lane(', "from './kit/anchors'"]) expect(lg).toContain(k);
    const mods = readFileSync(join(ROOT, 'skills', 'scene-modules', 'SKILL.md'), 'utf8');
    expect(mods).toContain('kit/anchors');
    const direct = readFileSync(join(ROOT, 'skills', 'scene-direct', 'SKILL.md'), 'utf8');
    expect(direct).toContain('wh.backIn');
    expect(direct).toContain('lane(');
    const sb = readFileSync(join(ROOT, 'skills', 'scene-direct', 'references', 'storyboard.md'), 'utf8');
    for (const k of ['"vocab"', '"camera"', '"free"', 'Objects:', 'Camera:']) expect(sb).toContain(k);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/skills.test.ts`
Expected: FAIL — logistics.md에 'warehouseAnchors' 없음

- [ ] **Step 3: 문서 수정**

logistics.md — `## 예시 (창고 30×16, 도크 3번으로 후진 + 지게차 리프트)` 섹션 전체를 아래로 교체:
````md
## 앵커 (좌표 손계산 금지)

도크·트럭·차선 좌표는 직접 계산하지 말고 `kit/anchors`의 헬퍼로 얻는다. 결과는 숫자 배열이라 scene 데이터에 그대로 넣는다.

```ts
import { warehouseAnchors, lane, type XZ } from './kit/anchors';

const WH = { at: [0, 0, 0] as [number, number, number], rotation: 0, width: 30, depth: 16, docks: 4 };
const wh = warehouseAnchors(WH);
add({ id: 'wh', type: 'warehouse', at: WH.at, rotation: [0, WH.rotation, 0], params: { width: 30, depth: 16, docks: 4 } });
add({ id: 'truck-a', type: 'truck', ...wh.truck(1, { length: 9 }), params: { length: 9 } });  // 도크 1 정차
const b = wh.backIn(2, { length: 9, from: 13 });                                              // 도크 2 후진 진입
add({ id: 'truck-in', type: 'truck', at: b.at, rotation: b.rotation, params: { length: 9 },
  follow: { path: b.path, t0: 5, t1: 9 } });

const FRONT: XZ[] = [[-60, 28], [10, 28], [38, 26], [46, 14], [47, -40]];
add({ id: 'road', type: 'road', params: { points: FRONT, width: 7 } });
add({ id: 'truck-go', type: 'truck', follow: { path: lane(FRONT, 1.6), t0: 0, t1: 20 } });                    // 진행 방향 오른쪽 차선
add({ id: 'truck-back', type: 'truck', follow: { path: lane(FRONT, 1.6, { reverse: true }), t0: 0, t1: 20 } }); // 반대 방향
```

| 헬퍼 | 결과 |
|---|---|
| `wh.dock(i)` | 도크 i 문 중앙 바닥 [x, y, z] |
| `wh.truck(i, { length })` | `{ at, rotation }` 도크 앞 정차(뒷면이 노란 범퍼 바로 앞, 앞이 바깥) |
| `wh.backIn(i, { length, from })` | `{ at, rotation: [0,180,0], path }` 앞쪽 from m(기본 13)에서 정차 위치까지 |
| `lane(points, offset, { reverse })` | 진행 방향 오른쪽으로 offset m 평행 이동한 경로 (음수 = 왼쪽) |

- `warehouseAnchors`에는 warehouse 요소와 **같은** at·rotation(yaw, 도)·width·depth·docks를 넘긴다(상수 하나로 공유).
- 도크 인덱스는 0..docks−1. 범위를 벗어나면 check에서 오류로 보인다.

## 예시 (지게차 리프트)

```ts
{ id: 'fork', type: 'forklift', params: { load: true },
  follow: { path: [[-14, 22], [-10, 20], [-7.6, 16.6]], t0: 6, t1: 10.6 },
  tracks: { 'param.lift': [[10.6, 0], [12.2, 0.75]] } },
```
````
또 warehouse 표 아래의 `도크 앞에 트럭을 대려면 …`과 `예: width 30 …` 두 줄을 아래 한 줄로 교체:
```md
도크 위치·트럭 정차·후진 경로는 아래 **앵커** 헬퍼로 얻는다 (공식: 도크 x = −0.36w + i·0.72w/(docks−1), 트럭 z = depth/2 + length/2 + 0.7).
```
road 표 아래 `도로 위 차량은 같은 점에서 차선만큼(±1.6m) 옮긴 \`follow.path\`를 쓴다.`를 교체:
```md
도로 위 차량 경로는 `lane(같은 points, 1.6)` (앵커 섹션).
```

scene-modules SKILL.md — `- 원점은 바닥 중심, …` 줄 다음에:
```md
- 좌표 손계산 금지: 도크·트럭 정차·후진 경로·차선은 `import { warehouseAnchors, lane } from './kit/anchors'` (logistics.md 앵커 섹션).
```

scene-direct SKILL.md 연출표 두 행 교체:
```md
| "트럭이 도로를 따라 달리게" | 도로 points를 상수로 두고 `follow: { path: lane(ROAD, 1.6), t0, t1 }` (진행 방향을 자동으로 향함) |
| "도크로 후진" | `const b = wh.backIn(i)` → `at: b.at, rotation: b.rotation, follow: { path: b.path, t0, t1 }` |
```

storyboard.md — `## 작성 요령` 앞에 섹션 추가:
````md
## 자동 제약 (기본 켜짐)

모든 샷 프롬프트에 두 줄이 자동으로 들어간다 (Style 뒤, Content 앞).

- `Camera:` 렌더와 같은 고정 아이소 카메라 (ortho, 정면 오른쪽 30°, 고도 약 37° = `target + [45, 67, 78]`)
- `Objects:` 키트에 있는 물체만 허용 + 승용차·사람·글자·원경 마을·물·다리 금지

끄기 (전역 또는 샷 단위, 샷 값 우선):

```json
{ "vocab": "free", "camera": "free", "shots": [{ "id": "s3", "prompt": "...", "camera": "iso" }] }
```

| 필드 | 값 | 기본 |
|---|---|---|
| vocab | `"kit"` \| `"free"` | `"kit"` |
| camera | `"iso"` \| `"free"` | `"iso"` |

실제로 들어간 프롬프트는 `storyboard/log.json`에서 확인한다.
````
그리고 `## 작성 요령`의 첫 줄(`- **키트에 있는 것만 등장시킨다** …`)을 `- 키트 목록은 자동으로 들어가므로 prompt에는 배치·카메라 거리(wide establishing / closer / close-up)만 구체적으로 쓴다.`로 교체.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/skills.test.ts`
Expected: PASS (SKILL.md 200줄 이하 포함)

- [ ] **Step 5: 커밋**

```bash
git add skills tests/unit/skills.test.ts
git commit -m "docs: 앵커 헬퍼와 스토리보드 자동 제약 문서화"
```

---

### Task 5: 벤치마크 회귀 + e2e

**Files:**
- Modify: `D:/omnivoice/scenes/05-logistics-hub/scene.ts` (repo 밖, 커밋 없음)

**Interfaces:**
- Consumes: `warehouseAnchors`, `lane`, `XZ` (Task 1~2)
- Produces: 갱신된 `out/video-preview.mp4`, `out/video.mp4`, `out/stills/compare.png`

- [ ] **Step 1: 기준 스틸 저장**

Run: `node scripts/still.mjs --project D:/omnivoice/scenes/05-logistics-hub --at 2.5,7.5,12.5,17.5` → 결과 PNG들을 scratchpad `baseline/`에 복사
Expected: ok:true, 파일 4개

- [ ] **Step 2: kit 동기화 + scene.ts를 앵커로 재작성**

Run: `node scripts/update.mjs --project D:/omnivoice/scenes/05-logistics-hub --force` → ok:true

scene.ts 변경:
- import: `import { warehouseAnchors, lane, type XZ } from './kit/anchors';`
- `const dockX = …`, `truck-dock-1`, `truck-dock-2` 3줄 → 
```ts
const WH = { at: [0, 0, 0] as Vec3, width: 30, depth: 16, docks: 4 };
const wh = warehouseAnchors(WH);
add({ id: 'truck-dock-1', type: 'truck', ...wh.truck(1, { length: 9 }), params: { length: 9 } });
const back = wh.backIn(2, { length: 9, from: 12.8 });
add({ id: 'truck-dock-2', type: 'truck', at: back.at, rotation: back.rotation, params: { length: 9 },
  // 도크로 후진 진입 (앞이 +Z를 향한 채 -Z로 이동)
  follow: { path: back.path, t0: 5.2, t1: 9.0 } });
```
(기존 경로 [[3.6, 26], [3.6, 13.2]] → from = 26 − 13.2 = 12.8로 동일 경로.) warehouse 요소의 at/width/depth/docks는 WH와 같은 값 유지.
- 도로: `const FRONT: XZ[] = [[-75, 28], [-30, 28], [10, 28], [38, 26], [46, 14], [47, -20], [46, -60]];` 상수로 빼서 road-front params와 공유. 주행 트럭 경로 → `lane(FRONT, -1.6)` (truck-road-1), `lane(FRONT, -1.6, { reverse: true })` (truck-road-2). (기존 손값은 두 트럭 모두 진행 방향 왼쪽 차선 → 승인된 화면 유지를 위해 -1.6.)

- [ ] **Step 3: check + 회귀 비교**

Run: `node scripts/check.mjs --project D:/omnivoice/scenes/05-logistics-hub` → ok:true, warnings []
Run: still 4장 다시 → 기준과 `ffmpeg -i base.png -i new.png -lavfi psnr -f null -` 비교
Expected: t=12.5(도크 클로즈업)와 t=7.5의 도크 트럭 영역 동일(PSNR inf 또는 > 40dB). 주행 트럭은 차선 꼭짓점이 손값과 달라 차이가 날 수 있음 → `still --compare` 시트를 Read로 육안 확인 (차선 이탈 없음).

- [ ] **Step 4: 재렌더**

Run: `node scripts/render.mjs --project D:/omnivoice/scenes/05-logistics-hub` → ok:true, 600 frames
Run: `node scripts/render.mjs --project D:/omnivoice/scenes/05-logistics-hub --quality final` → ok:true, 1920×1080 600 frames
4컷 시트(n=75,225,375,525) 추출해 Read로 확인.

- [ ] **Step 5: e2e**

Run: `node tests/e2e/run-e2e.mjs` → ALL PASSED (kit 런타임 동작 불변이므로 골든 재생성 불필요)
