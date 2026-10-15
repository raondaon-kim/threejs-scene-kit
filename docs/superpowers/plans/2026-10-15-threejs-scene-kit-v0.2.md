# threejs-scene-kit v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** movie2 수준의 아이소메트릭 클레이 3D 영상을 만든다. 구성 요소는 클레이 룩 렌더 파이프라인, 절차적 물류 키트 10종, 경로 이동·파라미터 애니메이션·ortho/path 카메라, Codex 스토리보드 워크플로다.

**Architecture:**
- `buildWorld`는 렌더러와 무관한 순수 장면 평가기로 유지한다. 확장 항목은 follow, param 트랙, ortho 카메라, 그림자 대상 계산이다.
- 브라우저 전용 `pipeline.ts`가 그림자, IBL, GTAO, 블룸, OutputPass, SSAA를 담당한다.
- 물류 오브젝트는 `kit/parts`의 부품을 조합한 ElementType이다.
- 스크립트에 `storyboard.mjs`(codex exec)와 `still --compare`를 추가하고, render 기본값을 preview로 바꾼다.

**Tech Stack:** three 0.186.1 (addons: RoundedBoxGeometry, BufferGeometryUtils, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, RoomEnvironment), vitest 5, playwright 1.63, ffmpeg, codex-cli 0.162 (VS Code 확장 동봉)

**Spec:** `docs/superpowers/specs/2026-10-15-threejs-scene-kit-v0.2-design.md` (선행: v0.1 spec)

## Global Constraints
- v0.1의 모든 제약을 유지한다.
  - 결정성: kit에서 Math.random과 Date 사용 금지.
  - 상태는 t의 순수함수다.
  - 재질은 역할별 새 인스턴스로 만든다.
  - 스크립트 출력은 JSON 한 줄이다.
- TAA처럼 시간에 누적되는 후처리는 금지한다.
- 오브젝트 원점은 바닥 중심이고, 차량의 앞은 +Z다.
- render의 기본 quality는 preview다. final은 `--quality final`일 때만 쓴다.
- v0.1 장면(04-open-platform, 템플릿 샘플)은 수정 없이 check를 통과해야 한다.

## Review Focus
1. follow와 param 트랙이 있는 요소를 t 순서와 무관하게 seek해도 바퀴 회전, 포크 높이, 위치가 같아야 한다 → Task 3 seek 테스트에 포함한다.
2. ortho 카메라에서 aspect가 바뀌거나(세로 9:16) size·sizeTo로 줌할 때 프로젝션이 매 프레임 갱신돼야 한다 → Task 2와 3 테스트.
3. 경로 점이 2개뿐이거나 같은 점이 반복될 때 follow와 road가 NaN을 내지 않아야 한다 → Task 2와 5 테스트.
4. storyboard에서 codex가 이미지를 저장하지 않고 정상 종료하면 반드시 실패로 보고해야 한다 → Task 7 가짜 codex 테스트.
5. final SSAA에서 캡처 크기가 meta.width×height와 정확히 같아야 한다(ffmpeg 입력) → Task 9 E2E ffprobe.

---

### Task 1: 타입, 스타일 look, 역할 확장, 검증기 확장

**Files:**
- Modify: `kit/runtime/types.ts`, `kit/runtime/style.ts`, `kit/styles/{stylized,minimal,index}.ts`, `kit/runtime/validate.ts`, `kit/runtime/registry.ts`
- Create: `kit/styles/clay.ts`
- Test: `tests/unit/validate.test.ts`, `tests/unit/style.test.ts` (추가)

**Interfaces (Produces):**
- `Role`: v0.1 역할 + `'body'|'bodyLight'|'trim'|'dark'|'road'|'cargo'|'wood'`, `ALL_ROLES`, `ELEMENT_ROLES = ALL_ROLES`
- `StyleName`: + `'clay'`
- `TrackKey = TrackPath | \`param.${string}\``
- `FollowDef { path: Array<[number, number]>; t0: number; t1: number; ease?: EaseName }`
- `ElementDef.follow?`, `ElementDef.tracks?: Partial<Record<TrackKey, Array<[number,number]>>>`
- `CameraMove` 공통 필드: `size?`, `sizeTo?`
- 새 move: `{ move:'path'; points: Vec3[]; target?: Vec3; targets?: Vec3[]; ease? }`
- `SceneMeta.projection?: 'perspective'|'ortho'`
- `EnvironmentDef.ground?: { size?: number }`
- `ElementType.animatable?: string[]`, `ElementHandle.setParam?(name, v)`
- `KitContext.camera: THREE.Camera`
- `Look { shadows: boolean; ao: { intensity: number; radius: number } | null; bloom: { strength; radius; threshold } | null; toneMapping: 'none'|'neutral'; envIntensity: number }`
- `Style.look: Look`
- `TypeInfo { supportsGrow: boolean; animatable: string[] }`

- [ ] **Step 1: 실패 테스트 (validate.test.ts에 추가)**
```ts
describe('v0.2 검증', () => {
  const types2 = new Map<string, TypeInfo>([
    ['shape', { supportsGrow: false, animatable: [] }],
    ['forklift', { supportsGrow: false, animatable: ['lift', 'travel'] }],
  ]);
  const base = () => ({
    meta: { width: 1920, height: 1080, fps: 30, duration: 10, seed: 1, projection: 'ortho' },
    style: 'clay',
    environment: { ground: { size: 300 } },
    elements: [
      { id: 'f', type: 'forklift', params: { role: 'body' }, tracks: { 'param.lift': [[1, 0], [2, 1]] },
        follow: { path: [[0, 0], [10, 0], [10, 10]], t0: 0, t1: 5 } },
    ],
    shots: [
      { id: 'a', start: 0, end: 5, camera: { move: 'static', pos: [20, 20, 20], target: [0, 0, 0], size: 30, sizeTo: 20 } },
      { id: 'b', start: 5, end: 10, camera: { move: 'path', points: [[20, 20, 20], [0, 25, 30]], target: [0, 0, 0] } },
    ],
  });
  it('정상 v0.2 장면', () => expect(validateScene(base(), types2)).toEqual([]));
  it('param 트랙은 animatable만', () => {
    const s = base() as any;
    s.elements[0].tracks = { 'param.height': [[0, 1]] };
    expect(validateScene(s, types2).map((i) => i.path)).toContain("elements[0].tracks['param.height']");
  });
  it('follow 형식과 position 트랙 충돌', () => {
    const s = base() as any;
    s.elements[0].follow = { path: [[0, 0]], t0: 3, t1: 2 };
    s.elements[0].tracks = { 'position.x': [[0, 1]] };
    const p = validateScene(s, types2).map((i) => i.path);
    expect(p).toEqual(expect.arrayContaining(['elements[0].follow.path', 'elements[0].follow.t1', "elements[0].tracks['position.x']"]));
  });
  it('projection·size·path 카메라', () => {
    const s = base() as any;
    s.meta.projection = 'iso';
    s.shots[0].camera.size = -1;
    s.shots[1].camera = { move: 'path', points: [[0, 0, 0]] };
    const p = validateScene(s, types2).map((i) => i.path);
    expect(p).toEqual(expect.arrayContaining(['meta.projection', 'shots[0].camera.size', 'shots[1].camera.points', 'shots[1].camera.target']));
  });
});
```
style.test.ts에 추가:
```ts
it('clay 스타일: look과 새 역할', () => {
  const s = getStyle('clay');
  expect(s.look.ao).not.toBeNull();
  expect(s.look.toneMapping).toBe('neutral');
  for (const r of ['body', 'bodyLight', 'trim', 'dark', 'road', 'cargo', 'wood'] as const) expect(s.palette[r]).toMatch(/^#/);
  expect(getStyle('stylized').palette.body).toMatch(/^#/);
  expect(getStyle('minimal').look.toneMapping).toBe('none');
});
```
기존 validate 테스트의 `TypeInfo` 맵 리터럴에는 `animatable: []`를 추가한다.

- [ ] **Step 2: 실패 확인**: `npx vitest run tests/unit/validate.test.ts tests/unit/style.test.ts` → FAIL

- [ ] **Step 3: 구현**: Interfaces대로 types를 확장한다. 검증기 변경 사항은 다음과 같다.
  - KEYS:
    - meta에 `projection`을 추가한다.
    - environment에 `ground`를, ground 키로 `['size']`를 추가한다.
    - element에 `follow`를 추가한다.
    - follow 키는 `['path','t0','t1','ease']`다.
    - 카메라 3종에 `size`와 `sizeTo`를 추가한다.
    - path 키는 `['move','points','target','targets','ease','fov','size','sizeTo']`다.
  - `meta.projection` 값은 oneOf로 검사한다.
  - 트랙 키:
    - `param.<name>`은 name이 info.animatable에 있어야 한다.
    - 그 외 키는 TRACK_PATHS에 있어야 한다.
  - follow:
    - path는 [x,z] 숫자 쌍 2개 이상이어야 한다.
    - t0는 0 이상이고, t0 < t1 ≤ duration이어야 한다.
    - ease는 EASES 중 하나여야 한다.
    - follow가 있으면 `position.x`·`position.z` 트랙은 오류다.
  - 카메라: size·sizeTo는 0보다 커야 한다.
  - path 카메라:
    - points는 Vec3 2개 이상이어야 한다.
    - target(Vec3) 또는 targets(points와 같은 길이) 중 하나가 필수다.
  - `typeInfo`가 animatable도 포함해서 반환한다.
  - 스타일:
    - Style에 look을 추가한다.
    - clay 팔레트와 하늘은 spec §2.2를 따른다. clay 하늘은 프리셋과 무관하게 라벤더 그라데이션이고, dusk와 night만 약간 어둡게 한다.
    - stylized와 minimal에 새 역할 색을 추가한다.
      - stylized: body #e36f4f, bodyLight #f4a582, trim #fff8ec, dark #3d3a4b, road #c9b99a, cargo #d7a86e, wood #9c6b43
      - minimal: body #2f6df6, bodyLight #9cb8f7, trim #ffffff, dark #2a2d34, road #d5d2cb, cargo #cfa77a, wood #a88a6a
    - look 값:
      - stylized: `{shadows:true, ao:{intensity:0.6,radius:0.6}, bloom:null, toneMapping:'none', envIntensity:0}`
      - minimal: 위와 같다.
      - clay: `{shadows:true, ao:{intensity:1,radius:0.9}, bloom:{strength:0.25,radius:0.4,threshold:0.9}, toneMapping:'neutral', envIntensity:0.45}`
    - clay 재질은 `MeshStandardMaterial`에 roughness 0.62, metalness 0을 쓴다. 단 `dark`는 roughness 0.4, `trim`은 0.5다.

- [ ] **Step 4: 전체 테스트 + typecheck 통과** → **Step 5: Commit** `feat(kit): v0.2 types, clay style, validator for follow/param/ortho/path`

### Task 2: 카메라 ortho·size·path + follow 계산(순수)

**Files:** Modify `kit/runtime/camera.ts`. Create `kit/runtime/motion.ts`. Test: `tests/unit/camera.test.ts`(추가), `tests/unit/motion.test.ts`

**Interfaces (Produces):**
- `CameraPose.size: number` (기본 30)
- `motion.ts`: `followState(f: FollowDef, t): { x, z, yaw, travel }`, `curveFrom(points: Vec3[]): THREE.CatmullRomCurve3` (캐시됨)

- [ ] **Step 1: 실패 테스트**
```ts
// motion.test.ts
import { describe, it, expect } from 'vitest';
import { followState } from '../../kit/runtime/motion';
describe('followState', () => {
  const f = { path: [[0, 0], [10, 0]] as Array<[number, number]>, t0: 2, t1: 4, ease: 'linear' as const };
  it('구간 전후 clamp, 중간 보간, 방향(+X 진행이면 yaw=π/2)', () => {
    expect(followState(f, 0)).toMatchObject({ x: 0, z: 0, travel: 0 });
    const m = followState(f, 3);
    expect(m.x).toBeCloseTo(5);
    expect(m.travel).toBeCloseTo(5);
    expect(m.yaw).toBeCloseTo(Math.PI / 2);
    expect(followState(f, 9).x).toBeCloseTo(10);
  });
  it('중복 점·짧은 경로에서 NaN 없음 (Review Focus 3)', () => {
    const s = followState({ path: [[1, 1], [1, 1], [1, 1]], t0: 0, t1: 1 }, 0.5);
    expect(Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.yaw) && Number.isFinite(s.travel)).toBe(true);
  });
  it('결정적', () => {
    const g = { path: [[0, 0], [5, 5], [10, 0]] as Array<[number, number]>, t0: 0, t1: 3 };
    expect(followState(g, 1.3)).toEqual(followState(g, 1.3));
  });
});
```
camera.test.ts에 추가:
```ts
it('size/sizeTo 보간과 기본값', () => {
  expect(cameraPose({ move: 'static', pos: [0, 0, 1], target: [0, 0, 0] }, 0).size).toBe(30);
  expect(cameraPose({ move: 'static', pos: [0, 0, 1], target: [0, 0, 0], size: 40, sizeTo: 20 }, 1).size).toBeCloseTo(20);
});
it('path: 시작·끝 점과 타깃', () => {
  const c = { move: 'path' as const, points: [[0, 10, 30], [30, 10, 0]] as [number, number, number][], target: [0, 0, 0] as [number, number, number], ease: 'linear' as const };
  expect(cameraPose(c, 0).position[2]).toBeCloseTo(30);
  expect(cameraPose(c, 1).position[0]).toBeCloseTo(30);
  expect(cameraPose(c, 0.5).target).toEqual([0, 0, 0]);
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**
`motion.ts`:
```ts
import * as THREE from 'three';
import { clamp01, ease } from './easing';
import type { FollowDef, Vec3 } from './types';

const cache = new Map<string, THREE.CatmullRomCurve3>();
export function curveFrom(points: Vec3[]): THREE.CatmullRomCurve3 {
  const key = JSON.stringify(points);
  let c = cache.get(key);
  if (!c) {
    // 같은 점이 연속되면 곡선 길이가 0이 되므로 제거한다
    const vs: THREE.Vector3[] = [];
    for (const p of points) {
      const v = new THREE.Vector3(p[0], p[1], p[2]);
      if (!vs.length || vs[vs.length - 1].distanceToSquared(v) > 1e-10) vs.push(v);
    }
    if (vs.length === 1) vs.push(vs[0].clone().add(new THREE.Vector3(0, 0, 1e-4)));
    c = new THREE.CatmullRomCurve3(vs, false, 'centripetal');
    cache.set(key, c);
  }
  return c;
}

export function followState(f: FollowDef, t: number): { x: number; z: number; yaw: number; travel: number } {
  const curve = curveFrom(f.path.map(([x, z]) => [x, 0, z] as Vec3));
  const u = ease(f.ease ?? 'inOut', clamp01((t - f.t0) / (f.t1 - f.t0)));
  const p = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  const len = curve.getLength();
  const yaw = Math.atan2(tan.x, tan.z);
  return { x: p.x, z: p.z, yaw: Number.isFinite(yaw) ? yaw : 0, travel: Number.isFinite(len) ? u * len : 0 };
}
```
`camera.ts`:
- `CameraPose.size`를 추가한다.
- 각 분기에서 `size = lerp(cam.size ?? 30, cam.sizeTo ?? cam.size ?? 30, e)`를 계산한다. static은 `e = ease('inOut', u)`를 쓴다.
- path 분기:
  - `e = ease(cam.ease ?? 'inOut', u)`
  - position은 `curveFrom(cam.points).getPointAt(e)`다.
  - target은 `cam.targets ? curveFrom(cam.targets).getPointAt(e) : cam.target!`이다.

- [ ] **Step 4: 통과** → **Step 5: Commit** `feat(kit): ortho size zoom, path camera, follow motion`

### Task 3: 월드 통합 (ortho 카메라, ground, follow, param 트랙, 그림자 플래그, 그림자 대상)

**Files:** Modify `kit/runtime/world.ts`, Create `kit/modules/environment/ground.ts`, Test `tests/unit/world.test.ts`(추가)

**Interfaces (Produces):**
- `World.camera: THREE.PerspectiveCamera | THREE.OrthographicCamera`
- `World.sun: THREE.DirectionalLight`
- `World.focus: { center: Vec3; radius: number }`
- `World.look: Look`

- [ ] **Step 1: 실패 테스트**
```ts
describe('v0.2 world', () => {
  const v2 = (): SceneDef => ({
    meta: { width: 1920, height: 1080, fps: 30, duration: 10, seed: 2, projection: 'ortho' },
    style: 'clay',
    environment: { ground: { size: 200 } },
    elements: [
      { id: 'mover', type: 'arrow', at: [0, 1, 0], params: { to: [0, 2, 0] }, follow: { path: [[0, 0], [20, 0]], t0: 0, t1: 10, ease: 'linear' } },
    ],
    custom: [],
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
  });
  it('follow: 위치·방향, at.y 유지', () => {
    const { world } = buildWorld(v2(), { quality: 'preview', aspect: 1 });
    world!.setTime(5);
    const h = world!.scene.getObjectByName('mover')!;
    expect(h.position.x).toBeCloseTo(10);
    expect(h.position.y).toBeCloseTo(1);
    expect(h.rotation.y).toBeCloseTo(Math.PI / 2);
  });
  it('그림자 플래그와 focus', () => {
    const { world } = buildWorld(v2(), { quality: 'preview', aspect: 1 });
    let casters = 0;
    world!.scene.getObjectByName('mover')!.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.castShadow) casters++; });
    expect(casters).toBeGreaterThan(0);
    expect(world!.focus.radius).toBeGreaterThanOrEqual(20);
    expect(world!.sun.isDirectionalLight).toBe(true);
  });
});
```
param 트랙과 seek 결정성(Review Focus 1)은 Task 5에서 forklift로 다시 확인한다.

- [ ] **Step 3: 구현**
- **카메라**: `meta.projection === 'ortho'`이면 `new THREE.OrthographicCamera(-1,1,1,-1,0.1,4000)`, 아니면 기존 perspective를 쓴다.
- **setTime에서 카메라 갱신**
  - perspective는 fov를 쓴다.
  - ortho는 `h = pose.size/2; w = h*aspect`로 left, right, top, bottom을 정하고, far = `distance(pos,target)+500`으로 둔다.
  - 공통으로 `updateProjectionMatrix`를 호출한다.
- **ground** (`ground.ts`)
  - `createGround(ctx, size)`: `PlaneGeometry(size,size)`를 `rotateX(-π/2)`하고, role ground 재질을 쓴다. 원점은 y=0이다.
  - `receiveShadow = true`로 둔다.
- **그림자 플래그**
  - 요소 메시 중 `MeshBasicMaterial`이 아닌 것은 `castShadow`와 `receiveShadow`를 true로 한다.
  - 지형과 물은 receive만 켠다. 나무는 cast와 receive를 모두 켠다.
- **focus 계산**
  - 각 요소의 at과 follow 경로 점을 모은다.
  - center는 그 평균이고, radius는 `clamp(최대거리 + 8, 20, 140)`이다.
- **setTime에서 follow 적용**
  - `followState`로 position의 x·z를 덮어쓰고, `rotation.y = yaw + rot[1]*DEG`로 한다.
  - `h.setParam?.('travel', travel)`을 호출한다.
- **param 트랙**: 키가 `param.`으로 시작하면 `h.setParam?.(name, sampleTrack(keys,t))`를 호출한다.
- **World 확장**: `World`에 `sun`(createLights의 방향광), `focus`, `look`을 추가한다.

- [ ] **Step 4: 통과 (기존 v0.1 world 테스트 포함)** → **Step 5: Commit** `feat(kit): world supports ortho camera, ground, follow, param tracks, shadow flags`

### Task 4: 부품 라이브러리

**Files:** Create `kit/parts/index.ts`, Test `tests/unit/parts.test.ts`

**Interfaces (Produces):**
- `roundedBox(w,h,d,r?)`, `cyl(rTop,rBottom,h,seg?)`, `wheelGeo(radius,width)`, `sphere(r)`, `cone(r,h)`: 원점은 바닥 중심. wheelGeo만 중심 원점이고 축은 X다.
- `place(geo, x,y,z, ry?)`
- `type Part = { role: Role; geo: THREE.BufferGeometry }`
- `buildByRole(style, parts): { group: THREE.Group; dispose(): void }`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { roundedBox, place, buildByRole, wheelGeo } from '../../kit/parts';
import { getStyle } from '../../kit/styles';
describe('parts', () => {
  it('roundedBox 원점은 바닥 중심', () => {
    const g = roundedBox(2, 3, 4, 0.3);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0);
    expect(g.boundingBox!.max.y).toBeCloseTo(3);
    expect(g.boundingBox!.max.x).toBeCloseTo(1);
  });
  it('반경이 너무 커도 안전', () => {
    expect(() => roundedBox(0.2, 0.2, 0.2, 5)).not.toThrow();
  });
  it('buildByRole: 역할당 메시 1개, 위치 반영', () => {
    const b = buildByRole(getStyle('clay'), [
      { role: 'body', geo: place(roundedBox(1, 1, 1), 5, 0, 0) },
      { role: 'body', geo: roundedBox(1, 1, 1) },
      { role: 'trim', geo: wheelGeo(0.5, 0.3) },
    ]);
    expect(b.group.children.length).toBe(2);
    const box = new THREE.Box3().setFromObject(b.group);
    expect(box.max.x).toBeCloseTo(5.5);
    b.dispose();
  });
});
```

- [ ] **Step 3: 구현**
```ts
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
export function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}
function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2));
  return n;
}
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
    const mat = style.material(role);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = role;
    group.add(mesh);
    owned.push(merged, mat);
  }
  for (const p of parts) p.geo.dispose();
  return { group, dispose: () => owned.forEach((o) => o.dispose()) };
}
```
- three addons 타입은 `@types/three`의 `three/addons/*` 경로로 해결된다.

- [ ] **Step 4: 통과** → **Step 5: Commit** `feat(kit): parts library (rounded boxes, wheels, merge by role)`

### Task 5: 물류 키트 10종

**Files:** Create `kit/modules/logistics/{warehouse,truck,forklift,pallet,container,road,lot,tree,pin,building}.ts`, `kit/modules/logistics/index.ts`. Modify `kit/runtime/registry.ts`(등록). Test `tests/unit/logistics.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { LOGISTICS_ELEMENTS } from '../../kit/modules/logistics';
import { elementRegistry } from '../../kit/runtime/registry';
import type { KitContext } from '../../kit/runtime/types';
const ctx: KitContext = { style: getStyle('clay'), rng: () => () => 0.5, heightAt: () => 0, quality: 'preview', camera: new THREE.PerspectiveCamera() };
const byType = Object.fromEntries(LOGISTICS_ELEMENTS.map((e) => [e.type, e]));
describe('logistics kit', () => {
  it('10종 등록', () => {
    expect(Object.keys(byType).sort()).toEqual(['building', 'container', 'forklift', 'lot', 'pallet', 'pin', 'road', 'tree', 'truck', 'warehouse']);
    for (const t of Object.keys(byType)) expect(elementRegistry().has(t)).toBe(true);
  });
  for (const type of ['warehouse', 'truck', 'forklift', 'pallet', 'container', 'lot', 'tree', 'pin', 'building']) {
    it(`${type}: 기본 생성, 바닥 원점, dispose`, () => {
      const h = byType[type].create(ctx, {});
      const box = new THREE.Box3().setFromObject(h.object3d);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(box.min.y).toBeLessThan(0.6);
      expect(box.getSize(new THREE.Vector3()).length()).toBeGreaterThan(0.5);
      h.update?.(1.5);
      h.dispose();
    });
  }
  it('road: 점 2개·중복 점에서도 유한 (Review Focus 3)', () => {
    const h = byType.road.create(ctx, { points: [[0, 0], [0, 0], [20, 0]] });
    const pos = ((h.object3d.children[0] as THREE.Mesh).geometry.attributes.position.array as Float32Array);
    expect(Array.from(pos).every(Number.isFinite)).toBe(true);
    expect(() => byType.road.create(ctx, { points: [[0, 0]] })).toThrow();
    h.dispose();
  });
  it('truck travel → 바퀴 회전, 결정적', () => {
    const h = byType.truck.create(ctx, {});
    expect(byType.truck.animatable).toContain('travel');
    h.setParam!('travel', 3.14);
    const wheel = h.object3d.getObjectByName('wheel')!;
    const a = wheel.rotation.x;
    h.setParam!('travel', 0);
    h.setParam!('travel', 3.14);
    expect(wheel.rotation.x).toBe(a);
    expect(a).not.toBe(0);
    h.dispose();
  });
  it('forklift lift → 캐리지 높이 (Review Focus 1)', () => {
    const h = byType.forklift.create(ctx, {});
    const c = h.object3d.getObjectByName('carriage')!;
    h.setParam!('lift', 0);
    const y0 = c.position.y;
    h.setParam!('lift', 1);
    expect(c.position.y).toBeGreaterThan(y0 + 1);
    h.dispose();
  });
  it('잘못된 params', () => {
    expect(() => byType.pallet.create(ctx, { cargo: 'gold' })).toThrow(/boxes/);
    expect(() => byType.container.create(ctx, { length: 7 })).toThrow();
    expect(() => byType.truck.create(ctx, { kind: 'bus' })).toThrow();
  });
});
```

- [ ] **Step 3: 구현**: 공통 규칙은 `buildByRole`로 정적 몸체를 만들고, 움직이는 부분(바퀴, 캐리지)은 이름 붙인 개별 메시나 그룹으로 둔다는 것이다. 숫자는 m 단위다.
  - **warehouse**
    - 몸체: body `roundedBox(w,h,d,0.8)`
    - 지붕: 스카이라이트 trim `roundedBox(w*0.12,0.35,d*0.3,0.12)`를 skylights개만큼 x 등간격으로, y=h에 놓는다. HVAC trim `roundedBox(1.4,0.9,1.2,0.15)` 2개.
    - 앞면(+Z) 도크(docks개, x는 [-w*0.4, w*0.4] 등간격):
      - 프레임 dark `roundedBox(3.4,3.7,0.3,0.08)`, z=d/2
      - 셔터 trim `roundedBox(2.8,3.2,0.22,0.05)`, z=d/2+0.06
      - 상단등 trim `roundedBox(1,0.15,0.18)`, y=4.1
      - 범퍼 accent `cyl(0.1,0.1,1)`을 도크 양옆에, z=d/2+0.8
    - 좌측면(-X): dark 창문 띠 `roundedBox(0.15,0.9,d*0.7,0.05)`, y=h*0.62
    - 사무실 문: trim `roundedBox(1,2.1,0.15)`, x=-w*0.47, z=d/2+0.05
  - **truck** (kind box|van, length L=9, 폭 2.5, +Z가 앞)
    - 섀시 dark `roundedBox(2.3,0.5,L-0.4,0.1)`, y=0.5
    - 캡 trim `roundedBox(2.5,2.3,2.2,0.35)`, y=0.8, z=L/2-1.1
    - 앞유리 dark `roundedBox(2.2,0.85,0.1,0.04)`, y=2.05, z=L/2+0.02
    - 옆창 dark `roundedBox(0.08,0.7,0.9)` ×2
    - 범퍼 dark `roundedBox(2.4,0.35,0.15)`, y=0.7, z=L/2+0.05
    - 화물칸 trim `roundedBox(2.55, kind==='van'?2.2:3.0, L-2.6, 0.25)`, y=0.85, z = -L/2+(L-2.6)/2
    - 측면 줄무늬 body `roundedBox(2.6,0.35,L-3,0.08)`, y=1.7, z는 화물칸과 같음
    - 바퀴: dark `wheelGeo(0.5,0.4)` + trim 허브 `wheelGeo(0.22,0.42)`를 묶은 Group(name 'wheel'). x=±1.05, y=0.5, z ∈ {L/2-1.3, -L/2+1.2, -L/2+2.3}
    - `setParam('travel', d)` → 모든 바퀴 `rotation.x = d/0.5`
    - kind가 box|van이 아니면 오류
  - **forklift** (+Z가 앞)
    - 몸체 accent `roundedBox(1.3,0.9,2.0,0.2)`, y=0.3, z=-0.2. 카운터웨이트 accent `roundedBox(1.3,0.7,0.5,0.15)`, y=0.3, z=-1.15
    - 기둥 dark `cyl(0.05,0.05,1.2)` ×4, (±0.55, 1.2, {0.45,-0.75}). 지붕 dark `roundedBox(1.25,0.08,1.35,0.03)`, y=2.4, z=-0.15
    - 좌석 dark `roundedBox(0.6,0.5,0.5,0.1)`, y=1.2, z=-0.45
    - 마스트 dark `roundedBox(0.12,2.6,0.12,0.03)` ×2, x=±0.4, z=0.95, y=0.15
    - 캐리지 Group(name 'carriage', 몸체와 별도 buildByRole)
      - 포크 dark `roundedBox(0.15,0.08,1.1,0.03)`, x=±0.3, z=1.6
      - 백플레이트 dark `roundedBox(1.0,0.6,0.08)`, z=1.05
      - load가 true면: wood `roundedBox(1.0,0.15,1.0,0.03)`, z=1.6, y=0.08 / cargo 상자 `roundedBox(0.46,0.42,0.46,0.06)` 2×2, y=0.23, z=1.6±0.24, x=±0.24
      - y = 0.12 + lift*1.8
    - 바퀴 'wheel' Group: dark `wheelGeo(0.32,0.25)`, (±0.62, 0.32, {0.6,-0.9})
    - setParam: lift → 캐리지 y, travel → 바퀴
    - animatable: ['lift','travel']
  - **pallet**
    - 팔레트판 wood `roundedBox(1.2,0.15,1.0,0.03)`
    - cargo 칸:
      - boxes: cargo `roundedBox(1.2/cols*0.92, 0.42, 1.0/rows*0.92, 0.05)`를 layers층
      - crates: body `roundedBox(…, 0.5, …, 0.08)`
      - none: 없음
    - cargo가 boxes|crates|none이 아니면 오류
  - **container**: length는 6|12만 허용
    - 몸체 bodyLight `roundedBox(2.44,2.6,L,0.08)`
    - 측면 리브 bodyLight `roundedBox(2.56,2.3,0.12,0.03)`를 0.7m 간격으로, y=0.15
    - 뒷문 dark `roundedBox(2.2,2.3,0.06)`, z=-L/2-0.02, y=0.15
  - **road**
    - points [[x,z]…] 2개 이상(아니면 오류), width 6, dashes true
    - `curveFrom`으로 곡선(y=0)을 만들고 0.5m 간격으로 샘플한다(N ≥ 2)
    - 리본 지오메트리: 좌우 offset = 접선의 XZ 수직 × w/2, y=0.02, 법선 +Y
    - 연석 trim 리본 폭 0.25 ×2, 가장자리, y=0.06
    - 점선 trim: 1.5m 길이를 3m마다, 중앙, y=0.035
    - 역할별 메시는 road, trim이다. 원점은 절대 좌표(at 무시 권장)
  - **lot**
    - 바닥판 road `roundedBox(w,0.06,d,0.03)`
    - stalls>0이면 trim 선 `roundedBox(0.12,0.02,d*0.35)`를 x 등간격으로, z=-d*0.3, y=0.06
  - **tree** (kind round|cone, height H=3, pad true)
    - 줄기 trunk `cyl(0.12,0.16,H*0.45)`
    - 수관: round면 foliage `sphere(H*0.3)`, y=H*0.38 / cone이면 foliage `cone(H*0.28,H*0.7)`, y=H*0.3
    - pad가 true면 accent3 `cyl(0.85,0.85,0.1,32)`
  - **pin** (size S=1.6, bob true)
    - 몸체 body: `cone(S*0.26,S*0.62)`를 뒤집어 꼭짓점이 아래(y=0)로 오게 하고 + `sphere(S*0.3)`, y=S*0.42
    - 흰 원 trim `wheelGeo(S*0.13,0.05)`를 Z축으로 돌려 앞면에 붙임, y=S*0.72, z=S*0.28
    - `update(t)`:
      - bob이면 `inner.position.y = 0.18*sin(t*2.2+phase)` (phase는 ctx.rng('pin')())
      - 그룹 yaw = 카메라 방향(atan2(cam.x-x, cam.z-z), 부모 월드 위치 기준)
  - **building** (width 10, depth 10, floors 4)
    - 몸체 bodyLight `roundedBox(w,floors*3.2,d,0.4)`
    - 층마다 dark 창 띠 `roundedBox(w*0.86,0.9,0.1,0.04)`를 +Z면에, `roundedBox(0.1,0.9,d*0.86,0.04)`를 +X면에, y=i*3.2+1.4
    - 지붕 캡 trim `roundedBox(w-0.5,0.3,d-0.5,0.1)`, y=top
  - `index.ts`: `export const LOGISTICS_ELEMENTS = [warehouse, truck, forklift, pallet, container, road, lot, tree, pin, building]`
  - `registry.ts`: BUILTIN_ELEMENTS에 이 10종을 추가한다.

- [ ] **Step 4: 통과 + typecheck** → **Step 5: Commit** `feat(kit): procedural logistics kit (10 objects)`

### Task 6: 브라우저 파이프라인 + 미리보기 통합 + compare 합성

**Files:** Create `kit/runtime/pipeline.ts`, Modify `kit/preview/main.ts`, `kit/preview/sheet.ts`(compare 추가), `template/vite.config.ts`

**Interfaces (Produces):**
- `createPipeline({ world, look, quality, width, height, ss }): { canvas: HTMLCanvasElement (캡처 대상, width×height); render(): void; gpu(): string; dispose() }`
- `__KIT__.compare(pairs: {t:number; src:string; label:string}[]): Promise<string>`
- URL 파라미터 `ss` (기본: final 2, preview 1)

- [ ] **Step 1: 구현** (브라우저 전용, 검증은 Task 9 E2E)

`pipeline.ts`:
```ts
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Look } from './style';
import type { Quality } from './types';
import type { World } from './world';

export function createPipeline(o: { world: World; look: Look; quality: Quality; width: number; height: number; ss: number }) {
  const W = Math.round(o.width * o.ss), H = Math.round(o.height * o.ss);
  const glCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = o.look.toneMapping === 'neutral' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
  renderer.shadowMap.enabled = o.look.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene, sun, focus } = o.world;
  let envTex: THREE.Texture | null = null;
  if (o.look.envIntensity > 0) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = o.look.envIntensity;
    pmrem.dispose();
  }
  if (o.look.shadows) {
    const [cx, cy, cz] = focus.center;
    const dir = sun.position.clone().normalize();
    sun.position.set(cx, cy, cz).addScaledVector(dir, 150);
    sun.target.position.set(cx, cy, cz);
    scene.add(sun.target);
    sun.castShadow = true;
    const ms = o.quality === 'final' ? 4096 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    const r = focus.radius;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 400 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
  }
  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: o.ss > 1 ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const renderPass = new RenderPass(scene, o.world.camera);
  composer.addPass(renderPass);
  if (o.look.ao) {
    const ao = new GTAOPass(scene, o.world.camera, W, H);
    ao.updateGtaoMaterial({ radius: o.look.ao.radius, distanceExponent: 1, thickness: 1, scale: 1, samples: o.quality === 'final' ? 16 : 8, distanceFallOff: 1, screenSpaceRadius: false });
    ao.blendIntensity = o.look.ao.intensity;
    composer.addPass(ao);
  }
  if (o.look.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), o.look.bloom.strength, o.look.bloom.radius, o.look.bloom.threshold));
  composer.addPass(new OutputPass());
  let out = glCanvas;
  let g2: CanvasRenderingContext2D | null = null;
  if (o.ss !== 1) {
    out = document.createElement('canvas');
    out.width = o.width;
    out.height = o.height;
    g2 = out.getContext('2d')!;
    g2.imageSmoothingEnabled = true;
    g2.imageSmoothingQuality = 'high';
  }
  return {
    canvas: out,
    render() {
      composer.render();
      if (g2) {
        g2.clearRect(0, 0, o.width, o.height);
        g2.drawImage(glCanvas, 0, 0, o.width, o.height);
      }
    },
    gpu() {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    },
    dispose() {
      composer.dispose();
      target.dispose();
      envTex?.dispose();
      renderer.dispose();
    },
  };
}
```

`main.ts` 변경:
- `ss = Number(qs.get('ss') ?? (quality==='final'?2:1))`
- 크기는 `k = quality==='final'?1:0.5`를 곱한 뒤 짝수로 맞춘다.
- `buildWorld` 다음에 `createPipeline({world, look: getStyle(def.style).look, quality, width:w, height:h, ss})`를 만든다.
- `renderAt`: `world.setTime(tc); pipeline.render()`
- stage에는 `pipeline.canvas`를 붙인다.
- `capture` → `pipeline.canvas.toDataURL`
- `gpu` → `pipeline.gpu()`
- WebGL 생성 오류는 기존처럼 path 'renderer'로 보고한다.
- `compare(pairs)`를 노출한다.

`sheet.ts`에 `composeCompare` 추가:
- 각 쌍마다 `new Image(); img.src = src; await img.decode()`
- 왼쪽에는 스토리보드를, 오른쪽에는 renderAt(t) 결과를 높이 360으로 맞춰 나란히 그린다.
- 행마다 라벨을 단다.
- 결과는 data URL이다.

`template/vite.config.ts`의 optimizeDeps.include에 `three`와 위 addons 8개 경로를 넣는다(RoundedBoxGeometry, BufferGeometryUtils, RoomEnvironment, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass). tsconfig 대상은 kit이며 typecheck로 검증한다.

- [ ] **Step 2: typecheck + vitest(기존) 통과** → **Step 3: Commit** `feat(kit): render pipeline (shadows, IBL, GTAO, bloom, SSAA) and compare sheet`

### Task 7: 스크립트 — render 기본 preview, still --compare, storyboard.mjs, update 인프라 동기화

**Files:** Modify `scripts/render.mjs`, `scripts/still.mjs`, `scripts/lib/browser.mjs`(ss 전달), `scripts/update.mjs`, `scripts/init.mjs`(next에 storyboard 안내). Create `scripts/storyboard.mjs`, `scripts/lib/codex.mjs`, `tests/fixtures/fake-codex.mjs`. Test `tests/scripts/storyboard.test.mjs`, `tests/scripts/init-update.test.mjs`(추가)

- [ ] **Step 1: 실패 테스트**
```js
// storyboard.test.mjs
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FAKE = join(ROOT, 'tests', 'fixtures', 'fake-codex.mjs');
const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'storyboard.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, CODEX_EXE: FAKE, ...env } });
  return { code: r.status, out: JSON.parse(r.stdout.trim().split('\n').pop()) };
};
describe('storyboard.mjs (가짜 codex)', () => {
  let dir;
  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'sb-')), 'p');
    spawnSync(process.execPath, [join(ROOT, 'scripts', 'init.mjs'), dir], { encoding: 'utf8' });
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ aspect: '16:9', style: 'clay', shots: [{ id: 's1', at: 1, prompt: 'warehouse' }, { id: 's2', at: 2, prompt: 'trucks' }] }));
  });
  it('샷별 이미지, 로그, 시트', () => {
    const { code, out } = run(['--project', dir]);
    expect(code).toBe(0);
    expect(out.shots.map((s) => s.id)).toEqual(['s1', 's2']);
    for (const id of ['s1', 's2']) expect(existsSync(join(dir, 'storyboard', `${id}.png`))).toBe(true);
    expect(existsSync(join(dir, 'storyboard', 'sheet.png'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'storyboard', 'log.json'), 'utf8')).length).toBe(2);
  });
  it('--shot 하나만', () => {
    expect(run(['--project', dir, '--shot', 's2']).out.shots.map((s) => s.id)).toEqual(['s2']);
  });
  it('codex가 파일을 안 만들고 정상 종료하면 실패 (Review Focus 4)', () => {
    const { code, out } = run(['--project', dir], { FAKE_CODEX_MODE: 'nofile' });
    expect(code).toBe(1);
    expect(out.errors[0].path).toMatch(/s1|s2/);
  });
  it('storyboard.json 없음/형식 오류', () => {
    writeFileSync(join(dir, 'storyboard.json'), '{"shots":[]}');
    expect(run(['--project', dir]).out.ok).toBe(false);
  });
});
```
`fake-codex.mjs`:
```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const args = process.argv.slice(2);
const cwd = args[args.indexOf('-C') + 1];
const prompt = args[args.length - 1];
const m = prompt.match(/save it as (\S+\.png)/);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAEklEQVR4nGNgGAWjYBSMgkEJAAZJAAGVuwcuAAAAAElFTkSuQmCC', 'base64');
if (process.env.FAKE_CODEX_MODE !== 'nofile' && m) {
  const f = join(cwd, m[1]);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, PNG);
}
console.log(m ? m[1] : 'no path');
```
init-update.test.mjs에 추가:
```js
it('update: vite.config.ts 같은 인프라 파일도 갱신, scene.ts는 보존', () => {
  runScript('init.mjs', [dir]);
  writeFileSync(join(dir, 'vite.config.ts'), '// old');
  writeFileSync(join(dir, 'scene.ts'), '// mine');
  const r = runScript('update.mjs', ['--project', dir]);
  expect(r.out.ok).toBe(true);
  expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain('optimizeDeps');
  expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toBe('// mine');
});
```

- [ ] **Step 3: 구현**
- **`lib/codex.mjs`**
  - `findCodex()`: CODEX_EXE → PATH의 `codex`/`codex.exe`(`where`/`which`) → VS Code와 Cursor 확장 폴더의 `openai.chatgpt-*`. 확장은 폴더명 기준 최신 버전을 쓴다. 반환값은 `{ cmd, args: [] }`다.
  - `.mjs`/`.js`면 `{ cmd: process.execPath, args: [file] }`로 실행한다.
  - `runCodex(codex, { cwd, prompt, timeoutMs=600000 })` → `{ code, output }`
- **`storyboard.mjs`**
  - storyboard.json을 검증한다.
    - aspect는 '16:9' 또는 '9:16'이다.
    - shots는 1개 이상이고, 각 샷은 id(영문·숫자·대시)와 prompt를 가진다. at은 선택(숫자)이다.
  - 대상 샷을 정한다(`--shot`이면 하나만).
  - 동시 실행 수는 `--concurrency`(기본 2)다.
  - 프롬프트 구성:
    `Generate exactly ONE image with your image generation tool, then save it as storyboard/<id>.png inside the current directory (create the folder if needed). The saved PNG must be <landscape 16:9|portrait 9:16>. Do not write any other files.\nStyle: <style>\nContent: <prompt>\nWhen finished, reply with only the saved file path.`
  - 실행 전에 기존 `<id>.png`를 지운다. 실행 후 파일이 없거나 200바이트 이하면 `{path: id, message: 'codex가 이미지를 저장하지 않음: <출력 끝 300자>'}` 오류로 처리한다.
  - `log.json`에 `{ id, ok, seconds, prompt }` 배열을 누적한다.
  - 시트: ffmpeg로 이미지마다 `scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=0x111111` 처리한다(9:16은 360:640). 이어서 `xstack`으로 2열 격자(1장이면 그대로)를 만들어 `storyboard/sheet.png`로 저장한다.
  - 하나라도 실패하면 ScriptError(errors, { shots })를 던진다.
  - 출력은 `{ shots:[{id,file,seconds}], sheet }`다.
- **`still.mjs --compare`**
  - storyboard.json의 shots 중 at이 있는 것과 존재하는 png만 사용해 pairs `{t: at, src: '/storyboard/<id>.png', label: id}`를 만든다.
  - `__KIT__.compare(pairs)`의 결과를 `out/stills/compare.png`에 저장한다.
- **`render.mjs`**
  - quality 기본값은 preview다. `--quality final`, `--ss`(final 기본 2)를 받는다.
  - 기본 출력은 `out/video-preview.mp4` 또는 `out/video.mp4`다.
  - `openKit(dir, { quality, ss })`
- **`browser.mjs`**: URL에 `&ss=`를 전달한다.
- **`update.mjs`**: kit을 교체한 뒤 `template/`의 `vite.config.ts`, `index.html`, `tsconfig.json`도 덮어쓴다.
- **`init.mjs`**: next에 `storyboard.mjs --project …`(storyboard.json 작성 후)를 추가한다.
- **template**: `storyboard.example.json`을 추가하고, init이 복사한다.

- [ ] **Step 4: 통과** → **Step 5: Commit** `feat(scripts): storyboard via codex exec, still --compare, preview-first render, update syncs infra`

### Task 8: 스킬 문서
**Files:** Modify `skills/scene-direct/SKILL.md`(흐름: storyboard → compare → preview → final, ortho/path/follow 예시), `skills/scene-direct/references/scene-schema.md`(v0.2 필드), `skills/scene-modules/SKILL.md`(물류 키트 표, clay 역할 색), Create `skills/scene-modules/references/logistics.md`, `skills/scene-direct/references/storyboard.md`. Modify `README.md`. allowed-tools에 storyboard.mjs를 추가한다.
- [ ] skills.test.ts에 'logistics' 참조 문서 존재와 SKILL.md 200줄 이하 조건을 추가 → 실패 → 작성 → 통과 → Commit `docs(skills): v0.2 workflow, logistics kit, storyboard`

### Task 9: E2E 확장
**Files:** Modify `tests/e2e/run-e2e.mjs`
- 단계 추가:
  1. **clay 물류 미니 장면**(1920×1080 ortho, warehouse·truck(follow)·forklift(param.lift)·pallet·pin·road·tree): check, still preview, 골든 `tests/golden/clay_preview.png`
  2. **seek 결정성**: t=3 → t=8 → t=3 캡처가 같음
  3. **render preview 1초**: ffprobe 960×540, 30프레임
  4. **render final 0.5초**: ffprobe 1920×1080, 15프레임 (Review Focus 5)
- 기존 골든(t6_preview)은 그림자와 AO 추가로 새로 만든다(ledger 기록).
- [ ] 실행 → 눈으로 검수 → 커밋 `test(e2e): clay logistics scene, preview/final render sizes`

### Task 10: 벤치마크 제작 (물류 허브)
**Files:** `D:\omnivoice\scenes\05-logistics-hub\` (플러그인 저장소 밖)
- [ ] init --force(스토리보드 보존) → npm install --prefix
- [ ] 생성해 둔 4컷과 맞는 storyboard.json 작성. `storyboard.mjs --shot s1`로 실제 codex 1회 재생성 검증(스크립트 실사용 증명)
- [ ] scene.ts 작성: 1920×1080, 20초, ortho, clay, ground, 4샷이 스토리보드 s1~s4에 대응. 트럭 follow, 지게차 lift, 핀 bob
- [ ] check → still --compare → 시트를 보고 조정(최대 5회)
- [ ] render(preview) → 확인 → render --quality final → ffprobe
- [ ] 결과 경로·시간 기록

### Task 11: 최종 리뷰 + 수정
- [ ] 리뷰 패키지 → 새 리뷰어(opus) → Critical/Important 수정(RED→GREEN) → Minor 기록 → 브랜치 유지(병합은 사용자 결정)
