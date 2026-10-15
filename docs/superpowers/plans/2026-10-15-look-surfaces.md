# 룩 업그레이드 (p5 질감·형상 디테일·메쉬 그라디언트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장면 데이터로 고르는 p5.js 표면 질감(월드 투영), 메쉬 그라디언트 배경, 정점 색 음영·잔디 인스턴싱·scatter 배치를 플러그인 기능으로 추가하고 06 장면에 적용한다.

**Architecture:** 텍스처 정의(`kit/textures`)는 p5 그리기 함수 + 메타. 렌더러가 `TextureProvider`를 world에 주입(브라우저 = p5, 노드 테스트 = 가짜). world는 메시 이름(role)으로 질감을 고르고 `onBeforeCompile` triplanar로 기본색에 곱한다. 배경은 provider가 그린 캔버스를 `scene.background`로. 형상 디테일은 parts.shade(정점 색), detail 키트 grass(InstancedMesh), 순수 헬퍼 layout.scatter.

**Tech Stack:** p5 1.11.13 (+@types/p5 1.7.7), three 0.186.1, TypeScript 5.9, vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-10-15-look-surfaces-design.md`

## Global Constraints

- 기본 꺼짐: clay·stylized·minimal은 `surfaces` 없음 → 기존 골든(t6, clay) 불변. pastel만 기본 질감.
- 결정성: p5 그리기는 `randomSeed`·`noiseSeed` 후 `p.random`/`p.noise`만. 시드 = `meta.seed` 기반 (`deriveSeed(meta.seed, 'tex:'+name)`).
- 텍스처 이름: `^[a-z0-9-]+$`. 내장 7종: grass-brush, rock-grain, roof-tiles, soil-pebbles, water-ripple, wood-grain, paper.
- 셰이더 공식: `diffuseColor.rgb *= 1.0 + (d - 0.5) * 2.0 * strength`, 가중치 |n|⁴ 정규화, 샘플 좌표 = 월드좌표 / tile (+ flow·uTime, xz 평면만).
- 검증 오류 경로: `look.surfaces.<role>`, `look.strength`, `environment.background.<key>`, `customTextures[i]`.
- p5 버전 1.11.13 고정, optimizeDeps include `p5`.
- git commit은 단독 Bash 호출(`-n` 섞지 않기), 파일 수정은 Edit/Write. heredoc 안 `\n`·백슬래시 주의(Write 도구 우선).
- 버전 0.4.0.

## Review Focus

1. 텍스처 가장자리 이어짐(좌우·상하 픽셀 차이 작음) — 반복 무늬에 이음선이 보이지 않아야 한다 (Task 1 e2e).
2. 같은 role 메시가 여러 요소에 있어도 질감·uTime이 모두 적용되고 seek 순서와 무관 (Task 2 테스트).
3. `look.surfaces`에 모르는 role/텍스처, strength 범위 밖, background colors 형식 오류 → 경로·허용값 담은 오류 (Task 2, 3 테스트).
4. shade 색이 있는 부품과 없는 부품이 같은 role에 섞여도 병합 성공(색 없는 쪽 흰색) (Task 4 테스트).
5. grass `avoid` 선 근처(avoidWidth/2 이내)에 잎이 없고 count 상한 20000 (Task 5 테스트).

---

### Task 1: 의존성 + 텍스처 라이브러리 + provider + swatch

**Files:** Modify `package.json`(devDeps p5, @types/p5), `template/package.json`, `template/vite.config.ts`; Create `kit/textures/{types.ts,names.ts,index.ts,provider.ts,gradient.ts}`, `kit/textures/builtin/{grass-brush,rock-grain,roof-tiles,soil-pebbles,water-ripple,wood-grain,paper}.ts`, `scripts/swatch.mjs`; Modify `kit/preview/main.ts`(window.swatch), `scripts/lib/browser.mjs` 필요 시; Test `tests/unit/textures.test.ts`, `tests/e2e/run-e2e.mjs`

- [ ] Step 1 단위 테스트 (노드, p5 실행 없음):
```ts
import { describe, it, expect } from 'vitest';
import { BUILTIN_TEXTURES } from '../../kit/textures/names';
import { BUILTIN_TEXTURE_DEFS, defineTexture } from '../../kit/textures';
describe('textures', () => {
  it('내장 7종 이름 = 정의 목록, tile 양수, 이름 규칙', () => {
    expect([...BUILTIN_TEXTURES].sort()).toEqual(['grass-brush', 'paper', 'rock-grain', 'roof-tiles', 'soil-pebbles', 'water-ripple', 'wood-grain']);
    expect(BUILTIN_TEXTURE_DEFS.map((d) => d.name).sort()).toEqual([...BUILTIN_TEXTURES].sort());
    for (const d of BUILTIN_TEXTURE_DEFS) { expect(d.tile).toBeGreaterThan(0); expect(d.name).toMatch(/^[a-z0-9-]+$/); }
  });
  it('defineTexture 검사', () => {
    expect(() => defineTexture({ name: 'Bad Name', tile: 1, draw() {} })).toThrow(/name/);
    expect(() => defineTexture({ name: 'ok', tile: 0, draw() {} })).toThrow(/tile/);
  });
});
```
e2e 단계 `textures: 결정성·이어짐·swatch` (Step 4에서 추가): swatch.mjs 실행 → ok, out/swatch.png 존재; 페이지에서 `window.__textureProbe(name, seed)`가 돌려주는 해시가 같은 시드 2회 동일·다른 시드 다름, 이어짐 지표(좌우 끝 열·상하 끝 행 평균 차이 < 24) 7종 모두.
- [ ] Step 2 FAIL 확인 (`npx vitest run tests/unit/textures.test.ts` → 모듈 없음)
- [ ] Step 3 구현: 의존성 설치(`npm install -D p5@1.11.13 @types/p5@1.7.7`), 템플릿 반영. TextureDef/defineTexture(이름·tile·draw 검사), names.ts, 내장 7종(wrap 그리기: 각 획을 x±size·y±size 9곳에 그림), provider(createP5Provider: 오프스크린 p5 인스턴스로 그리고 캔버스 복사 → CanvasTexture RepeatWrapping, SRGB 아님(LinearSRGB 데이터), 캐시), gradient(메쉬 그라디언트 그리기), main.ts에 `window.swatch()`·`window.__textureProbe()`, swatch.mjs(openKit → evaluate → PNG 저장).
- [ ] Step 4 PASS + e2e 단계 추가·통과. Step 5 커밋 `feat(textures): p5 텍스처 라이브러리 7종, provider, swatch`

### Task 2: 표면 적용 (look.surfaces, triplanar, uTime)

**Files:** Modify `kit/runtime/types.ts`(SceneDef.look, customTextures), `kit/runtime/style.ts`(Style.surfaces, surfaceStrength), `kit/styles/pastel.ts`, `kit/runtime/validate.ts`, `kit/runtime/world.ts`; Create `kit/runtime/surface.ts`; Test `tests/unit/surface.test.ts`, `tests/unit/validate.test.ts`

- [ ] Step 1 테스트:
```ts
// surface.test.ts — 가짜 provider
const fake = { surface: (d, seed) => Object.assign(new THREE.DataTexture(new Uint8Array([128,128,128,255]), 1, 1), { userData: { name: d.name, seed } }), background: () => new THREE.DataTexture(new Uint8Array([255,0,0,255]),1,1), dispose() {} };
it('pastel 기본 질감이 role 메시에 적용, clay는 없음', ...) // castle → 'roofAlt' 메시 material.userData.surface === 'roof-tiles'; clay 장면 warehouse는 userData.surface 없음
it('look.surfaces 덮어쓰기·none', ...)      // { ground: 'rock-grain', roof: 'none' }
it('flow 질감은 setTime이 uTime 갱신, seek 무관 (Review Focus 2)', ...) // water 메시 두 개, setTime(3)/(9)/(3) 후 uniform 값 3
it('provider 없으면 질감 미적용·오류 없음', ...)
it('mergeSurfaces 우선순위', ...)           // 순수 함수 단위 테스트
```
validate.test.ts:
```ts
it('look 검증 (Review Focus 3)', () => {
  const bad = { ...base, look: { surfaces: { lava: 'grass-brush', ground: 'nope' }, strength: 2 } };
  const paths = validateScene(bad, info).map((i) => i.path);
  expect(paths).toEqual(expect.arrayContaining(['look.surfaces.lava', 'look.surfaces.ground', 'look.strength']));
});
```
- [ ] Step 2 FAIL. Step 3 구현(spec §3). world: `buildWorld(def, { quality, aspect, textures? })`, `uTime = { value: 0 }`, 요소 생성 후 traverse로 적용, setTime에서 `uTime.value = t`, dispose에서 텍스처는 provider 소유(해제 안 함). main.ts가 provider 전달.
- [ ] Step 4 PASS + 전체. Step 5 커밋 `feat(look): 표면 질감 — look.surfaces, triplanar, flow`

### Task 3: 메쉬 그라디언트 배경

**Files:** Modify `kit/runtime/types.ts`(EnvironmentDef.background), `validate.ts`, `world.ts`; Test `tests/unit/surface.test.ts`, `validate.test.ts`

- [ ] Step 1 테스트: background 지정 + provider → `scene.background`가 provider 텍스처, 구형 하늘(ShaderMaterial BackSide 구) 없음; provider 없으면 기존 하늘; 검증(`kind` 오류, `preset` 오류, `colors` 2~6개 #hex, `sun` boolean) 경로 `environment.background.<key>`.
- [ ] Step 2 FAIL. Step 3 구현(spec §4; 색 결정 함수 `backgroundColors(spec, style, skyPreset)` 순수 export·테스트).
- [ ] Step 4 PASS. Step 5 커밋 `feat(look): 메쉬 그라디언트 배경`

### Task 4: 정점 색 음영 (shade, keepColor) + 동화 키트 적용

**Files:** Modify `kit/parts/index.ts`(shade, buildByRole 색 병합), `kit/runtime/style.ts`(MaterialOpts.keepColor), `kit/styles/*.ts`(4종 material), `kit/modules/fairytale/{fairytree,rock,common,island,cloud}.ts`; Test `tests/unit/parts.test.ts`, `tests/unit/fairytale.test.ts`

- [ ] Step 1 테스트: shade가 color 속성(위·아래 배율) 생성; 색 있는 부품 + 없는 부품 같은 role 병합 성공·없는 쪽 1,1,1 (Review Focus 4); keepColor 재질은 color = 팔레트·vertexColors true (4 스타일); fairytree 메시에 color 속성, tint 변주는 variant마다 다르고 같은 variant 같음.
- [ ] Step 2 FAIL. Step 3 구현(spec §5). Step 4 PASS(기존 골든 영향: 동화 키트만). Step 5 커밋 `feat(parts): 정점 색 음영 shade + keepColor, 동화 키트 적용`

### Task 5: grass (detail 키트) + layout.scatter

**Files:** Create `kit/modules/detail/{index.ts,grass.ts,vocab.json}`, `kit/layout.ts`; Modify `kit/runtime/registry.ts`; Test `tests/unit/detail.test.ts`, `tests/unit/layout.test.ts`, `tests/unit/concept.test.ts`(builtin 목록 +grass)

- [ ] Step 1 테스트: grass InstancedMesh count = min(count, 20000), 같은 variant 같은 행렬, avoid 선 근처(avoidWidth/2) 인스턴스 없음 (Review Focus 5), noShadow; scatter 결정성·count 이하·minDist·center/radius 안·avoid·`variant: i`·id 접두사·params 함수.
- [ ] Step 2 FAIL. Step 3 구현. Step 4 PASS(kit-vocab 양방향 테스트가 detail 포함 자동 검사). Step 5 커밋 `feat(detail): grass 인스턴싱 + layout.scatter`

### Task 6: 커스텀 텍스처·문서·update 의존성·버전

**Files:** Modify `kit/runtime/world.ts`·`validate.ts`(customTextures), `scripts/update.mjs`, `skills/**`, `README.md`, `.claude-plugin/plugin.json`; Create `skills/scene-modules/references/textures.md`; Test `tests/unit/validate.test.ts`, `tests/scripts/init-update.test.mjs`, `tests/unit/skills.test.ts`

- [ ] Step 1 테스트: customTextures 이름 충돌·형식 오류 경로 `customTextures[i]`, 커스텀 이름을 look.surfaces에서 허용; update가 템플릿 deps 중 없는 것(p5)을 package.json에 추가하고 `install: true`; 문서(textures.md 7종·결정성 규칙, schema에 look/background/customTextures, SKILL에 grass·scatter·swatch, scene-custom에 defineTexture), 버전 0.4.0.
- [ ] Step 2 FAIL. Step 3 구현. Step 4 PASS. Step 5 커밋 `feat: 커스텀 텍스처, update 의존성 병합, 문서, v0.4.0`

### Task 7: 06 장면 적용 + e2e 골든

- [ ] Step 1: 06 `update --force` + `npm install`(p5), scene.ts에 background meshGradient(sun), grass(강·길 avoid), 나무·덤불을 scatter로, pastel 기본 질감 사용.
- [ ] Step 2: check → swatch 확인(Read) → compare 라운드(최대 4, ledger 기록).
- [ ] Step 3: preview·final 렌더, 렌더 시간 비교(이전 final 79.8s), 시트 확인.
- [ ] Step 4: e2e: fairytale 골든 재생성(눈 검수), clay·t6 골든 불변 확인, ALL PASSED 2회. 커밋 `test(e2e): 질감·배경 반영 골든`
