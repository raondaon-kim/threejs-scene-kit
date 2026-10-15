# 동화 키트 (pastel clay 디오라마) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스토리보드(06-fairytale-tour s1~s5)와 같은 파스텔 클레이 동화 디오라마를 만드는 키트(스타일·부품·16개 요소·앵커·vocab)를 추가하고 25초 투어 영상을 렌더한다.

**Architecture:** 물류 키트와 같은 구조. `kit/modules/fairytale/<type>.ts` 각 요소는 parts로 형상을 만들고 `buildByRole`로 병합. 스타일 `pastel`은 clay LOOK을 공유. 앵커 `bridgeOn`은 순수 함수. vocab.json과 storyboard `diorama` 카메라 모드로 스토리보드 제약.

**Tech Stack:** three 0.186 (IcosahedronGeometry, ExtrudeGeometry, Shape), TypeScript 5.9, vitest 5, Playwright/ffmpeg 렌더.

**Spec:** `docs/superpowers/specs/2026-10-15-fairytale-kit-design.md`

## Global Constraints

- 원점 바닥 중심, 단위 m, 섬 윗면 y=0. `waterfall`만 원점 = 위 가장자리(아래로 늘어짐). `island`는 윗면 y=0, 바위가 아래로.
- 결정성: `Math.random` 금지. 시드는 `ctx.rng(<type>:<variant>)`. update(t)는 t만의 함수.
- 모든 요소: 잘못된 enum params → `pick` 오류, 숫자는 `num` 기본값 처리. 점 배열 params(river/path/fence)는 road와 같은 검사·오류 문구 형식.
- 새 role 3개(rock, roof, roofAlt)는 모든 스타일 팔레트에 존재.
- 요소 형상 코드는 실행 중 스토리보드와 비교하며 작성한다(이 계획은 요소별 params·규약·테스트를 고정). 
- git commit은 단독 Bash 호출(같은 명령에 `-n` 금지), 파일 수정은 Edit/Write.
- 버전 0.3.0.

## Review Focus

1. island/plateau/fairytree/flowers/rock를 같은 variant로 두 번 만들면 정점이 완전히 같다(결정성) (Task 3, 5 테스트).
2. river/path/fence 점이 중복되거나 1개뿐 → NaN 없음 또는 명확한 오류 (Task 3, 5 테스트).
3. windmill/castle/waterfall/cloud/island update(t)는 같은 t에 같은 상태(seek 순서 무관) (Task 4, 5 테스트).
4. bridgeOn 양 끝 인덱스(0, n-1)·정수 아님 → 오류, 내부 점에서 로컬 X가 강 법선과 평행 (Task 6 테스트).
5. cloud는 그림자를 드리우지 않는다(castShadow false) — world.setShadows가 요소 생성 후 덮어쓰지 않는지 (Task 5 테스트 + world 확인).

---

### Task 1: role 3개 + pastel 스타일

**Files:** Modify `kit/runtime/types.ts` (Role, ALL_ROLES, StyleName, STYLE_NAMES), `kit/styles/{clay,stylized,minimal,index}.ts`, `scripts/init.mjs` (STYLES); Create `kit/styles/pastel.ts`; Test `tests/unit/style.test.ts`, `tests/scripts/init-update.test.mjs`

- [ ] Step 1 테스트 추가 (style.test.ts):
```ts
  it('v0.3: 모든 스타일에 rock/roof/roofAlt, pastel 팔레트·하늘', () => {
    for (const n of ['stylized', 'minimal', 'clay', 'pastel'] as const) {
      const s = getStyle(n);
      for (const r of ['rock', 'roof', 'roofAlt'] as const) expect(s.palette[r], `${n}.${r}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    const p = getStyle('pastel');
    expect(p.palette.ground).toBe('#9cc97a');
    expect(p.palette.roofAlt).toBe('#a98ae0');
    expect(p.look.shadows).toBe(true);
    for (const pr of SKY_PRESETS) expect(p.sky(pr).horizon).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.sky('day').horizon).toBe('#f6c9d6');
  });
```
init-update.test.mjs: init `--style pastel` 성공 테스트 1개(기존 clay 테스트와 같은 형식).
- [ ] Step 2 실패 확인: `npx vitest run tests/unit/style.test.ts tests/scripts/init-update.test.mjs` → FAIL (pastel 없음)
- [ ] Step 3 구현: spec §1·§2 값 그대로. pastel.ts는 clay.ts 구조 복제(material 거칠기 규칙 동일, rock 0.8).
- [ ] Step 4 통과 확인 → PASS. Step 5 전체+tsc, 커밋 `feat(style): pastel 스타일 + rock/roof/roofAlt 역할`

### Task 2: parts — ribbon 공유, blob, prism, arch

**Files:** Modify `kit/parts/index.ts`, `kit/modules/logistics/road.ts` (ribbon import); Test `tests/unit/parts.test.ts`

- [ ] Step 1 테스트:
```ts
  it('v0.3: blob 결정적·바닥 원점·NaN 없음', () => {
    const a = blob(1, rngFor(1, 'x'));
    const b = blob(1, rngFor(1, 'x'));
    const c = blob(1, rngFor(2, 'x'));
    const arr = (g: THREE.BufferGeometry) => Array.from(g.attributes.position.array as Float32Array);
    expect(arr(a)).toEqual(arr(b));
    expect(arr(a)).not.toEqual(arr(c));
    expect(arr(a).every(Number.isFinite)).toBe(true);
    a.computeBoundingBox();
    expect(a.boundingBox!.min.y).toBeCloseTo(0, 5);
  });
  it('v0.3: prism 크기, arch 아래가 비어 있음', () => {
    const p = prism(4, 2, 3);
    p.computeBoundingBox();
    const s = p.boundingBox!.getSize(new THREE.Vector3());
    expect([s.x, s.y, s.z].map((v) => +v.toFixed(3))).toEqual([4, 2, 3]);
    const a = arch(6, 2, 0.8, 2.4);
    a.computeBoundingBox();
    expect(a.boundingBox!.max.x - a.boundingBox!.min.x).toBeCloseTo(6 + 2 * 0.8, 3);
    // 아치 중앙 바로 위(높이 rise*0.5)에는 정점이 없다 = 구멍
    const pos = a.attributes.position;
    let inside = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i)) < 1 && pos.getY(i) > 0.05 && pos.getY(i) < 1.0) inside++;
    expect(inside).toBe(0);
  });
  it('v0.3: ribbon은 parts에서 export', () => {
    expect(typeof ribbon).toBe('function');
  });
```
(import: `blob, prism, arch, ribbon` from parts, `rngFor` from runtime/rng)
- [ ] Step 2 FAIL 확인. Step 3 구현:
  - `ribbon`: road.ts 함수 이동(동작 동일), road.ts는 import.
  - `blob(r, rng, amp=0.18, detail=2)`: IcosahedronGeometry(r, detail) → mergeVertices로 같은 위치 정점 공유 → 각 고유 정점 방향으로 (1 + amp·(rng()*2-1)) 배율 → 비색인화·computeVertexNormals → 바닥 y=0으로 이동.
  - `prism(w, h, d)`: Shape 삼각형 (-w/2,0)-(w/2,0)-(0,h) 를 depth d로 Extrude, z 중심 정렬.
  - `arch(span, rise, thick, depth)`: 바깥 Shape(폭 span+2·thick, 높이 rise+thick 사각) − 반원 구멍(반지름 span/2, 중심 y 0 → 위로 rise까지 타원 스케일) Extrude depth, z 중심.
- [ ] Step 4 PASS + logistics 테스트 PASS. Step 5 커밋 `feat(parts): ribbon 공유, blob/prism/arch`

### Task 3: 지형 요소 — island, plateau, rock, river, waterfall, path

**Files:** Create `kit/modules/fairytale/{common,island,plateau,rock,river,waterfall,path}.ts`; Test `tests/unit/fairytale.test.ts`

- [ ] Step 1 테스트 (fairytale.test.ts 신규; ctx는 `rng: (s) => rngFor(7, s)`, style pastel):
```ts
const ctx: KitContext = { style: getStyle('pastel'), rng: (s) => rngFor(7, s), heightAt: () => 0, quality: 'preview', camera: new THREE.PerspectiveCamera() };
const verts = (o: THREE.Object3D) => { const out: number[] = []; o.traverse((m) => { const g = (m as THREE.Mesh).geometry; if (g) out.push(...(g.attributes.position.array as Float32Array)); }); return out; };
const bbox = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe('fairytale 지형', () => {
  it('island: 윗면 y≈0, 바위는 아래로, 반지름 반영, NaN 없음', () => {
    const h = island.create(ctx, { radius: 30, depth: 12 });
    const b = bbox(h.object3d);
    expect(b.max.y).toBeGreaterThan(-0.1);
    expect(b.max.y).toBeLessThan(1.5);
    expect(b.min.y).toBeLessThan(-8);
    expect(b.max.x).toBeGreaterThan(27);
    expect(b.max.x).toBeLessThan(36);
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    h.dispose();
  });
  it.each(['island', 'plateau', 'rock'])('%s: 같은 variant → 같은 정점, 다른 variant → 다름 (Review Focus 1)', (t) => {
    const T = BY[t];
    const a = verts(T.create(ctx, { variant: 1 }).object3d);
    const b = verts(T.create(ctx, { variant: 1 }).object3d);
    const c = verts(T.create(ctx, { variant: 2 }).object3d);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('plateau: 윗면 = height', () => {
    const b = bbox(BY.plateau.create(ctx, { radius: 9, height: 5 }).object3d);
    expect(b.max.y).toBeGreaterThan(4.8);
    expect(b.max.y).toBeLessThan(5.6);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.05);
  });
  it('waterfall: 원점 = 위 가장자리, 아래로 height', () => {
    const b = bbox(BY.waterfall.create(ctx, { height: 10, width: 3 }).object3d);
    expect(b.max.y).toBeLessThan(1.2);
    expect(b.min.y).toBeLessThan(-9);
  });
  it.each(['river', 'path'])('%s: 중복 점 유한, 점 1개 오류 (Review Focus 2)', (t) => {
    const h = BY[t].create(ctx, { points: [[0, 0], [0, 0], [10, 0], [10, 8]] });
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    expect(() => BY[t].create(ctx, { points: [[0, 0]] })).toThrow(/points/);
  });
  it('island update: 같은 t → 같은 상태 (Review Focus 3)', () => {
    const h = BY.island.create(ctx, {});
    h.update?.(3); const a = verts(h.object3d).slice(0, 0); const pa = h.object3d.children.map((c) => c.position.y);
    h.update?.(9); h.update?.(3); const pb = h.object3d.children.map((c) => c.position.y);
    expect(pa).toEqual(pb); void a;
  });
});
```
(`BY`는 Task 6 전까지 각 모듈을 직접 import해 만든 맵: `const BY = { island, plateau, rock, river, waterfall, path, … }`.)
- [ ] Step 2 FAIL. Step 3 구현 (spec §4 표; island = 잔디 윗면 디스크(외곽 반지름 r·(1+0.06·noise)) + 둘레 blob 바위 링 2~3단 + 밑면 blob 원뿔 + floaters 개 작은 blob(update로 ±0.3 sin)). river = ribbon(water, y 0.03) + 가장자리 rock blob 시드 배치. waterfall = 아래로 휜 물 리본(세로) + 위·아래 trim 물보라 blob(update로 살짝 scale). path = ribbon(road, y 0.04).
- [ ] Step 4 PASS. Step 5 커밋 `feat(fairytale): 지형 요소 island/plateau/rock/river/waterfall/path`

### Task 4: 건물 — castle, cottage, mushroom, windmill, bridge

**Files:** Create `kit/modules/fairytale/{castle,cottage,mushroom,windmill,bridge}.ts`; Test fairytale.test.ts

- [ ] Step 1 테스트:
```ts
describe('fairytale 건물', () => {
  it.each(['castle', 'cottage', 'mushroom', 'windmill', 'bridge'])('%s: 기본 생성, 바닥 원점, 크기, dispose', (t) => {
    const h = BY[t].create(ctx, {});
    h.update?.(1.2);
    const b = bbox(h.object3d);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.05);
    expect(b.min.y).toBeLessThan(0.6);
    expect(b.getSize(new THREE.Vector3()).length()).toBeGreaterThan(2);
    h.dispose();
  });
  it('castle: 탑 지붕은 roofAlt, towers 수만큼 원뿔', () => {
    const h = BY.castle.create(ctx, { towers: 4 });
    expect(h.object3d.getObjectByName('roofAlt')).toBeTruthy();
    expect(h.object3d.getObjectByName('dark')).toBeTruthy();
  });
  it('cottage: roof 선택, 잘못된 값 오류', () => {
    expect(BY.cottage.create(ctx, { roof: 'roofAlt' }).object3d.getObjectByName('roofAlt')).toBeTruthy();
    expect(() => BY.cottage.create(ctx, { roof: 'gold' })).toThrow(/roof/);
  });
  it('mushroom: 빨간 갓(accent2) + 흰 점(trim)', () => {
    const o = BY.mushroom.create(ctx, {}).object3d;
    expect(o.getObjectByName('accent2')).toBeTruthy();
    expect(o.getObjectByName('trim')).toBeTruthy();
  });
  it('windmill: 날개 각 = t·speed·2π, seek 순서 무관 (Review Focus 3)', () => {
    const h = BY.windmill.create(ctx, { speed: 0.25 });
    const sails = h.object3d.getObjectByName('sails')!;
    h.update!(2); const a = sails.rotation.z;
    h.update!(7); h.update!(2);
    expect(sails.rotation.z).toBeCloseTo(a, 9);
    expect(Math.abs(a)).toBeCloseTo(2 * 0.25 * 2 * Math.PI % (2 * Math.PI), 6);
  });
  it('castle 깃발: seek 순서 무관', () => {
    const h = BY.castle.create(ctx, {});
    const f = h.object3d.getObjectByName('flags')!;
    h.update!(1.5); const a = f.children.map((c) => c.rotation.y);
    h.update!(4); h.update!(1.5);
    expect(f.children.map((c) => c.rotation.y)).toEqual(a);
  });
  it('bridge: 로컬 X로 걸침 (span 반영)', () => {
    const b = bbox(BY.bridge.create(ctx, { span: 7 }).object3d);
    expect(b.max.x - b.min.x).toBeGreaterThan(7);
    expect(b.max.z - b.min.z).toBeLessThan(4);
  });
});
```
- [ ] Step 2 FAIL. Step 3 구현 (spec §4; windmill 날개 그룹 이름 'sails', 회전 z = (t·speed·2π) mod 2π; castle 깃발 그룹 'flags', 각 깃발 rotation.y = 0.35·sin(2πt·0.6 + i)).
- [ ] Step 4 PASS. Step 5 커밋 `feat(fairytale): 건물 castle/cottage/mushroom/windmill/bridge`

### Task 5: 자연 — fairytree, flowers, field, fence, cloud

**Files:** Create `kit/modules/fairytale/{fairytree,flowers,field,fence,cloud}.ts`; Modify `kit/runtime/world.ts` (요소가 `userData.noShadow`이면 castShadow 끔); Test fairytale.test.ts, world.test.ts

- [ ] Step 1 테스트:
```ts
describe('fairytale 자연', () => {
  it.each(['fairytree', 'flowers', 'field', 'cloud'])('%s: 기본 생성, 크기, dispose', (t) => {
    const h = BY[t].create(ctx, {});
    const b = bbox(h.object3d);
    expect(b.getSize(new THREE.Vector3()).length()).toBeGreaterThan(0.5);
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    h.dispose();
  });
  it.each(['fairytree', 'flowers'])('%s: variant 결정성 (Review Focus 1)', (t) => {
    expect(verts(BY[t].create(ctx, { variant: 3 }).object3d)).toEqual(verts(BY[t].create(ctx, { variant: 3 }).object3d));
  });
  it('fairytree kind conifer/puffy, 잘못된 kind 오류', () => {
    expect(BY.fairytree.create(ctx, { kind: 'conifer' }).object3d.getObjectByName('foliage')).toBeTruthy();
    expect(() => BY.fairytree.create(ctx, { kind: 'palm' })).toThrow(/kind/);
  });
  it('fence: 점 따라 기둥, 중복 점 유한, 점 1개 오류 (Review Focus 2)', () => {
    const h = BY.fence.create(ctx, { points: [[0, 0], [0, 0], [6, 0]] });
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    expect(bbox(h.object3d).max.x).toBeGreaterThan(5.5);
    expect(() => BY.fence.create(ctx, { points: [[0, 0]] })).toThrow(/points/);
  });
  it('cloud: userData.noShadow, update seek 무관', () => {
    const h = BY.cloud.create(ctx, {});
    expect(h.object3d.userData.noShadow).toBe(true);
    h.update!(2); const a = h.object3d.position.y;
    h.update!(5); h.update!(2);
    expect(h.object3d.position.y).toBe(a);
  });
});
```
world.test.ts:
```ts
  it('v0.3: userData.noShadow 요소는 그림자를 드리우지 않음 (Review Focus 5)', () => {
    const def: SceneDef = { meta: { width: 640, height: 360, fps: 30, duration: 2, seed: 1 }, style: 'pastel', elements: [{ id: 'c', type: 'cloud', at: [0, 10, 0] }], shots: [{ id: 'a', start: 0, end: 2, camera: { move: 'static', pos: [0, 10, 30], target: [0, 0, 0] } }] };
    const { world } = buildWorld(def, { quality: 'preview', aspect: 16 / 9 });
    const holder = world!.scene.getObjectByName('c')!;
    holder.traverse((o) => { if ((o as THREE.Mesh).isMesh) expect(o.castShadow).toBe(false); });
    world!.dispose();
  });
```
- [ ] Step 2 FAIL. Step 3 구현 (spec §4; world.ts `setShadows(h.object3d, !h.object3d.userData.noShadow, true)`). Task 6 전에는 cloud가 registry에 없으므로 world 테스트는 Task 6에서 GREEN → 이 테스트는 Task 6 Step 4에서 확인(Ruling 없이 계획된 순서).
- [ ] Step 4 fairytale.test PASS. Step 5 커밋 `feat(fairytale): 자연 fairytree/flowers/field/fence/cloud`

### Task 6: 키트 연결 — index, registry, vocab, bridgeOn, diorama, 문서, 버전

**Files:** Create `kit/modules/fairytale/{index.ts,vocab.json}`, `skills/scene-modules/references/fairytale.md`; Modify `kit/runtime/registry.ts`, `kit/anchors.ts`, `scripts/lib/kit-vocab.mjs` (CAMERA_DIORAMA), `scripts/storyboard.mjs` (camera diorama, 경고), `skills/scene-modules/SKILL.md`, `skills/scene-direct/SKILL.md`, `skills/scene-direct/references/storyboard.md`, `README.md`, `.claude-plugin/plugin.json`; Test `tests/unit/anchors.test.ts`, `tests/scripts/kit-vocab.test.mjs`, `tests/scripts/storyboard.test.mjs`, `tests/unit/skills.test.ts`, `tests/unit/concept.test.ts`(builtin 수)

- [ ] Step 1 테스트:
  - anchors: 
```ts
describe('bridgeOn', () => {
  const R: XZ[] = [[0, -10], [0, 0], [10, 10], [20, 10]];
  it('로컬 X가 강 법선과 평행 (Review Focus 4)', () => {
    const p = bridgeOn(R, 1);
    close(p.at, [0, 0, 0]);
    const yaw = (p.rotation[1] * Math.PI) / 180;
    const localX = [Math.cos(yaw), -Math.sin(yaw)];
    const t = [10 - 0, 10 - -10]; const l = Math.hypot(...t); const n = [-t[1] / l, t[0] / l];
    expect(Math.abs(localX[0] * n[0] + localX[1] * n[1])).toBeCloseTo(1, 6);
  });
  it('끝점·정수 아님·범위 밖 → 오류', () => {
    for (const i of [0, 3, 1.5, -1, 9]) expect(() => bridgeOn(R, i)).toThrow(/1\.\.2/);
  });
});
```
  - kit-vocab: 기존 양방향 테스트가 fairytale을 요구하도록 `expect(seen.length).toBeGreaterThanOrEqual(3)`.
  - storyboard: `camera: 'diorama'` → 프롬프트에 `Camera: Perspective miniature diorama`; scene이 ortho이고 diorama면 경고; `camera: 'top'`은 여전히 오류(메시지에 'diorama' 포함).
  - skills: scene-modules SKILL.md에 fairytale 16종 이름, references/fairytale.md 존재·'bridgeOn' 포함, storyboard.md에 '"diorama"', plugin.json 0.3.0.
  - concept.test(또는 registry 테스트)의 builtin 수 15 → 31.
- [ ] Step 2 FAIL. Step 3 구현: index `FAIRYTALE_ELEMENTS`(16), registry에 추가, vocab.json(spec §6), `bridgeOn`(spec §5), MODES.camera에 'diorama', `CAMERA_DIORAMA` export, 경고 규칙, 문서 표, README v0.3.0 줄, plugin.json 0.3.0.
- [ ] Step 4 전체 PASS(Task 5의 world 테스트 포함) + tsc. Step 5 커밋 `feat(fairytale): 키트 연결, vocab, bridgeOn, diorama 카메라, 문서, v0.3.0`

### Task 7: 벤치마크 06 + e2e

**Files:** `D:/omnivoice/scenes/06-fairytale-tour/scene.ts` (repo 밖), storyboard.json(`kit: 'fairytale'` 기록용으로 갱신하되 재생성 안 함); Modify `tests/e2e/run-e2e.mjs` (fairytale 단계), Create `tests/golden/fairytale_preview.png`

- [ ] Step 1: `update.mjs --project <06> --force`, `npm install --prefix <06>`(최초), scene.ts 작성(spec §7, style pastel, perspective, 25초 5샷).
- [ ] Step 2: `check` → ok, warnings []. `still --compare` → compare.png Read, 스토리보드 s1과 비교·수정 반복(최대 5라운드, 라운드마다 ledger 1줄).
- [ ] Step 3: preview 렌더 → 4컷 시트 확인 → final 렌더 → 4컷 시트 확인.
- [ ] Step 4: e2e에 fairytale 단계(작은 장면: island+castle+cottage+river+cloud, check + still 골든, 최초 실행은 골든 생성 후 눈으로 검수) → `node tests/e2e/run-e2e.mjs` ALL PASSED 2회.
- [ ] Step 5: 커밋 `test(e2e): fairytale 장면 골든`
