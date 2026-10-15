# 룩 업그레이드: p5.js 표면 질감 · 형상 디테일 · 메쉬 그라디언트 배경 — 설계 (v0.4.0)

## 0. 목적·원칙

- 사용자 요청: "메쉬와 p5.js 적용" — 표면 질감, 형상 디테일(메쉬), 배경·하늘(메쉬 그라디언트). 2D 오버레이는 범위 밖.
- **플러그인 기능으로 만든다**: 장면 작성자(Claude)는 이름 붙은 프리셋을 `scene.ts` 데이터로 고른다. p5/셰이더 코드를 쓰지 않는다. 모든 키트·스타일에서 동작하고, 검증기가 오류 위치·허용값을 알려준다. 결정적(시드)이며 테스트·문서·확인 스크립트가 함께 간다.
- 기존 화면 불변: 기본값은 꺼짐. 스타일 `pastel`만 기본 질감을 켠다(clay·stylized·minimal·물류 골든 불변).
- 방식(A안): p5.js(1.11.13, 인스턴스 모드)로 반복 가능한 **회색조 디테일 텍스처**를 그리고, 재질 셰이더에서 **월드 좌표 투영(triplanar)** 으로 기본색에 곱한다. UV가 없는 기존 형상에도 바로 적용된다. 스파이크로 Chromium에서 setup 동기 실행·같은 시드 = 같은 픽셀 확인.

## 1. 텍스처 라이브러리 `kit/textures/`

```ts
interface TextureDef {
  name: string;                 // 영문 소문자·숫자·대시
  tile: number;                 // 한 장이 덮는 길이(m) 기본값
  draw(p: p5, o: { seed: number; size: number }): void;  // size×size, 회색조(평균 ≈ 128), 가장자리 이어짐
}
defineTexture(def): TextureDef
```

- 내장 7종 (`kit/textures/builtin/*.ts`): `grass-brush`(4m), `rock-grain`(3m), `roof-tiles`(1.2m), `soil-pebbles`(2.5m), `water-ripple`(5m), `wood-grain`(1.5m), `paper`(6m).
- `kit/textures/names.ts`: `BUILTIN_TEXTURES: readonly string[]` (p5 import 없음 — 검증기용).
- 결정성 규칙: `p.randomSeed(seed)`, `p.noiseSeed(seed)` 후 `p.random`/`p.noise`만 사용. `frameCount`·`millis`·`Math.random` 금지. 이음매 없는 반복은 그릴 때 좌우·상하로 감아 그리기(wrap)로 보장.
- 커스텀: 프로젝트 `custom/textures/*.ts`에서 `defineTexture`로 만들고 `scene.ts`의 `customTextures: [...]`로 넘긴다(커스텀 요소와 같은 방식). 이름이 내장과 겹치면 오류.

## 2. TextureProvider (렌더러 주입)

```ts
interface TextureProvider {
  surface(def: TextureDef, seed: number): THREE.Texture;          // 512px, RepeatWrapping, 같은 (name, seed)는 캐시
  background(spec: BackgroundSpec, colors: string[], aspect: number, seed: number): THREE.Texture;
  dispose(): void;
}
buildWorld(def, { quality, aspect, textures?: TextureProvider })
```

- 브라우저: `kit/textures/provider.ts`의 `createP5Provider()` (p5 사용). `kit/preview/main.ts`가 넘긴다.
- provider가 없으면(노드 단위 테스트) 질감·배경을 적용하지 않고 기존 하늘을 쓴다. 테스트는 가짜 provider(DataTexture)로 적용 경로를 검증한다.

## 3. 표면 적용 (`kit/runtime/surface.ts`)

- 장면 데이터:
```ts
look?: {
  surfaces?: Partial<Record<Role, string | { texture: string; tile?: number; strength?: number; flow?: [number, number] } | 'none'>>;
  strength?: number;   // 0~1, 전체 기본 세기 (스타일 기본값 덮어씀)
}
```
- 스타일 기본값 `Style.surfaces?` (pastel만): ground grass-brush, rock rock-grain, roof·roofAlt roof-tiles, road soil-pebbles, water water-ripple(flow [0, 0.25] m/s), wood wood-grain, body·bodyLight paper. pastel `surfaceStrength` 0.35.
- 병합: 스타일 기본 → `look.surfaces`(역할별 덮어쓰기, `'none'`이면 끔).
- 적용: world가 요소·환경 메시를 순회해 `mesh.name`(= role, buildByRole·doubleSided 규약)이 surfaces에 있으면 재질에 `applySurface`. MeshStandardMaterial·MeshToonMaterial만 대상(ShaderMaterial·MeshBasic 제외).
- 셰이더: `onBeforeCompile`로 월드 위치·법선 varying 추가, 세 평면(zy·xz·xy) 샘플을 |n|⁴ 가중 평균 → `diffuseColor.rgb *= 1 + (d − 0.5)·2·strength`. flow는 `uTime`(world 공유 uniform, setTime이 갱신)으로 xz 샘플 이동. `customProgramCacheKey`로 구분. `material.userData.surface = name`.

## 4. 배경: 메쉬 그라디언트

```ts
environment.background?: { kind: 'meshGradient'; preset?: 'dawn' | 'day' | 'dusk' | 'sunset'; colors?: string[]; sun?: boolean; seed?: number }
```
- 색: `colors`(2~6개 #hex)가 있으면 그것, 없으면 스타일 하늘(preset 또는 environment.sky.preset 또는 'day')의 top·horizon·bottom·sun.
- p5로 화면비 크기(가로 1024) 캔버스에 큰 색 덩어리 여러 개를 시드로 배치·블러 → 부드러운 다색 그라디언트, `sun`이면 해와 번짐. `scene.background`에 깐다(화면 공간: 카메라가 내려다봐도 보임). 배경이 있으면 구형 하늘은 만들지 않는다.

## 5. 형상 디테일

- `parts.shade(geo, { top, bottom })`: bbox 높이 비율로 RGB 배율(정점 색 `color`)을 넣는다. `buildByRole`은 역할 그룹 안에 색이 있는 부품이 하나라도 있으면 나머지를 흰색으로 채워 병합하고 재질을 `{ vertexColors: true, keepColor: true }`로 만든다.
- `MaterialOpts.keepColor`: 정점 색을 팔레트 색에 **곱한다**(모든 스타일 material이 지원; 기존 vertexColors 사용처는 그대로 흰색 기반).
- 적용(동화 키트만): fairytree 수관(위 1.12·아래 0.78) + `tint`(기본 0.06, 시드로 RGB 흔들림), rock·rockRing·island 바위(위 1.05·아래 0.72), cloud(아래 0.9, 살짝 라벤더).
- 새 범용 요소 `grass` (키트 `detail`, vocab 포함):
  - params: `center` [x,z] (절대, 기본 [0,0]), `radius` 10, `count` 1500(최대 20000), `height` 0.35, `avoid` [[x,z]…][] 선들, `avoidWidth` 2, `variant`.
  - 인스턴싱(InstancedMesh) 잎(가는 휜 삼각 띠), 인스턴스 색 흔들림, 그림자 드리우지 않음(`noShadow`), 결정적.
- 배치 헬퍼 `kit/layout.ts` (순수): `scatter({ type, count, center, radius, seed, minDist?, avoid?, avoidWidth?, params?, idPrefix? }) → ElementDef[]` — 시드 배치(거부 표본), 회전 시드, `variant: i` 자동. 반복문·해시 지터를 대신한다.

## 6. 확인 스크립트 `scripts/swatch.mjs`

`node swatch.mjs --project <폴더>` → 브라우저에서 내장+커스텀 텍스처와 배경 프리셋을 그려 `out/swatch.png` 한 장(이름 라벨). 출력 JSON `{ ok, file, textures[], backgrounds[] }`.

## 7. 배포·문서·버전

- 템플릿 `package.json`에 `p5: 1.11.13`, devDependencies `@types/p5: 1.7.7`; `vite.config.ts` optimizeDeps include `p5`. 저장소 devDependencies에도 추가.
- `update.mjs`: 템플릿 dependencies·devDependencies 중 프로젝트에 없는 것을 package.json에 추가하고 출력에 `install: true` + 안내.
- 문서: scene-schema(look, background, customTextures), scene-modules SKILL(질감 표·grass·scatter), `references/textures.md`, scene-custom SKILL(커스텀 텍스처 절차·결정성 규칙), README.
- 버전 0.4.0.

## 8. 검증

- 단위(노드): 검증기(look·background·customTextures 오류 경로·허용값), surfaces 병합, world가 가짜 provider로 재질 표시(userData.surface)·uTime 갱신·배경 설정·하늘 생략, shade·keepColor·buildByRole 병합, grass 결정성·회피·개수 상한, scatter 결정성·minDist·회피, update 의존성 병합.
- e2e(브라우저): 텍스처 결정성(같은 시드 픽셀 동일, 다른 시드 다름, 가장자리 이어짐), swatch 생성, 셰이더 컴파일(콘솔 오류 없음), pastel 골든 갱신(눈 검수), clay·t6 골든 불변.
- 벤치마크 06: 질감·배경·grass·scatter 적용 → compare → preview → final, 렌더 시간 증가 측정(목표 +30% 이내).
