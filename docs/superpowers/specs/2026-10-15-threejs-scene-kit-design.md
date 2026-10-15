# threejs-scene-kit 설계 (v0.1)

- 작성일: 2026-10-15
- 상태: 사용자 부재 중 작성. **돌아와서 검토 필요**
- 근거 자료: `D:\omnivoice\research\FINDINGS.md` (레퍼런스 15개 분석)

> 표기: **[확정]**은 사용자가 대화에서 결정한 사항, **[제안]**은 사용자 부재 중 내가 결정한 사항이다. [제안] 항목은 검토 후 바꿀 수 있다.

---

## 1. 목적과 범위

### 1.1 목적
- 교육 강의 콘텐츠와 유튜브 쇼츠에 쓸 **짧은 영화 형식의 3D 영상**을 만든다. 배경·분위기 씬과 개념 시각화를 함께 담는다. [확정]
- 사람이 **대화로 연출을 지시**하고, 에이전트가 장면을 고치는 과정을 반복한다. [확정]
- 핵심 가치
  - **토큰 절약**: 에이전트는 검증된 코드를 읽거나 새로 만들지 않고, 장면 데이터만 고친다.
  - **결정적 결과**: 같은 입력이면 항상 같은 프레임이 나온다.

### 1.2 v0.1 범위

**포함**
- **출력**: 3D 무음 MP4. 자막·나레이션·음악은 나중에 Remotion 등에서 합친다. [확정]
- **렌더 환경**: 이 PC(Windows, GTX 1650). 헤드리스 Chromium으로 프레임을 캡처한 뒤 ffmpeg로 인코딩한다. [확정]
- **타임라인 미리보기**: 브라우저 UI에서 시간을 스크럽하고, 샷 구간을 표시한다. [확정]
- **스타일 프리셋**: 다중 스타일 구조로 만들고, v0.1에는 `stylized`와 `minimal` 두 종을 넣는다. [확정: 프리셋 전환 / 제안: 2종]
- **장면 기술 방식**: 혼합형. 타입이 있는 장면 데이터를 기본으로 하고, 필요할 때 커스텀 요소를 쓴다. [확정]

**제외**
- 오디오, 자막, Remotion 연동 코드
- 캐릭터와 리깅
- 물리 시뮬레이션
- WebGPU
- GLB 에셋 파이프라인
- 클라우드 렌더

### 1.3 성공 기준
1. 샘플 장면 하나가 `init → check → still → render` 전 과정을 통과한다. 결과로 1080×1920, 30fps MP4가 나온다.
2. 같은 장면을 두 번 렌더하면 프레임이 동일하다(또는 허용 오차 이내).
3. 스타일만 바꾸면 같은 장면이 다른 룩으로 나온다.
4. 흔한 연출 수정(타이밍 변경, 색·스타일 변경, 요소 추가)은 `scene.ts` 몇 줄만 고치면 된다.
5. 에이전트가 `kit/` 소스를 읽지 않고도 작업할 수 있다. SKILL.md, 레퍼런스, `--help`만으로 충분하다.

---

## 2. 전체 구조 [제안]

구성은 두 층이다. **플러그인**(도구와 검증된 코드)이 **영상 프로젝트**(작업 공간)를 생성한다.

```
threejs-scene-kit/                     ← 플러그인 저장소
├── .claude-plugin/plugin.json
├── skills/
│   ├── scene-direct/                   연출 워크플로 (메인)
│   │   ├── SKILL.md
│   │   └── references/scene-schema.md  장면 데이터 전체 명세
│   ├── scene-modules/                  모듈 카탈로그
│   │   ├── SKILL.md                    모듈 한 줄 요약 표
│   │   └── references/<module>.md      모듈별 파라미터
│   └── scene-custom/                   커스텀 요소 작성 규약
│       └── SKILL.md
├── kit/                                ← 프로젝트로 복사되는 검증된 코드 (TypeScript)
│   ├── runtime/                        스케줄러, 카메라, 렌더러, 검증기, 스타일 시스템
│   ├── modules/environment/            sky, terrain, trees, water
│   ├── modules/concept/                shape, label, arrow, bars, line
│   ├── styles/                         stylized, minimal
│   └── preview/                        타임라인 UI + 캡처 브리지
├── template/                           init이 쓰는 프로젝트 골격 (package.json, index.html, scene.ts 샘플)
├── scripts/                            Node ESM 스크립트, 플러그인 자체는 의존성 없음
│   ├── init.mjs   check.mjs   still.mjs   render.mjs   update.mjs
│   └── lib/                            공통: 프로젝트 탐색, 서버 기동, 브라우저 제어, JSON 출력
└── tests/

my-video/                              ← 영상 프로젝트 (init으로 생성)
├── scene.ts           ★ 에이전트가 주로 고치는 파일
├── custom/            커스텀 요소 (선택)
├── kit/               복사본, 직접 수정 금지
│   └── manifest.json  플러그인 버전과 파일별 sha256
├── index.html, package.json (three, vite, playwright)
└── out/               stills/, frames 없음(파이프로 바로 인코딩), video.mp4
```

### 2.1 흐름

```
대화 지시 → scene.ts 수정 → check → still (시점 몇 개) → 피드백 반복 → render → out/video.mp4
                                    └ 또는 npm run dev로 타임라인 미리보기
```

### 2.2 설계 결정
- **kit을 복사하는 이유**
  - 플러그인이 업데이트돼도 기존 영상 프로젝트는 재현 가능해야 한다.
  - `update.mjs`가 manifest 해시로 로컬 수정 여부를 감지한 뒤 갱신한다.
- **스크립트는 프로젝트의 `node_modules`를 쓴다**
  - vite와 playwright를 프로젝트 쪽에서 `createRequire`로 불러온다.
  - 그래서 플러그인 자체는 설치할 것이 없다.

---

## 3. 장면 데이터 형식 (`scene.ts`) [제안]

```ts
import { defineScene } from './kit/runtime/scene';

export default defineScene({
  meta: { width: 1080, height: 1920, fps: 30, duration: 12, seed: 7 },
  style: 'stylized',                       // 'stylized' | 'minimal'
  environment: {
    sky: { preset: 'dawn' },              // dawn | day | dusk | night (스타일 팔레트와 결합)
    terrain: { size: 200, height: 12, roughness: 0.5 },
    trees: { count: 300, area: 160, avoidCenter: 18 },
    water: { level: -1 },                 // 생략하면 없음
  },
  elements: [
    { id: 'title', type: 'label', at: [0, 9, 0],
      params: { text: '광합성이란?', size: 2.4 },
      enter: { t: 1.0, anim: 'rise', dur: 0.8 },
      exit:  { t: 5.0, anim: 'fade', dur: 0.5 } },
    { id: 'chart', type: 'bars', at: [0, 2, 0],
      params: { values: [3, 7, 5], labels: ['A', 'B', 'C'], role: 'accent' },
      enter: { t: 6.0, anim: 'grow', dur: 1.5 } },
  ],
  shots: [
    { id: 'open',  start: 0, end: 6,  camera: { move: 'dolly', from: [0, 6, 40], to: [0, 7, 22], target: [0, 6, 0], ease: 'inOut' } },
    { id: 'chart', start: 6, end: 12, camera: { move: 'orbit', center: [0, 3, 0], radius: 14, height: 4, fromDeg: -20, toDeg: 25 } },
  ],
  custom: [],                              // 커스텀 요소 정의 목록 (5절)
});
```

### 3.1 시간 모델
- 모든 값은 **절대 시간 t(초)의 순수 함수**다. 어떤 프레임이든 순서와 상관없이 seek할 수 있다.
- 프레임 i의 시간은 `t = i / fps`다.
- **실시간 루프, `Date.now`, `Math.random`은 사용하지 않는다.**

### 3.2 요소 (elements)
- **공통 필드**: `id`(고유), `type`, `at`([x,y,z]), `rotation?`(도), `scale?`, `params`, `enter?`, `exit?`, `tracks?`
- **등장·퇴장 애니메이션**
  - 종류: `none` | `fade` | `pop` | `rise` | `grow`
  - `grow`는 요소가 `setProgress`를 지원할 때만 쓸 수 있다(arrow, bars, line).
  - `enter`가 없으면 t=0부터 보인다. `exit`가 없으면 끝까지 남는다.
- **`tracks`** (선택): 속성별 키프레임. 예: `{ 'position.y': [[2,0],[4,3]], 'opacity': [...] }`. 키프레임 사이는 smoothstep으로 보간한다.
- **`role`**: 요소의 의미 역할이다. 실제 색과 재질은 스타일이 정한다.
  - 사용 가능한 값: `accent` | `accent2` | `accent3` | `neutral` | `label`

### 3.3 샷 (shots)
- 구간은 `[start, end)`다. 샷은 서로 겹치지 않아야 하고, 사이에 빈 시간이 있으면 안 된다(검증기가 확인).
- 샷 경계는 하드 컷이다. 크로스페이드는 v0.1 범위 밖이다.
- **카메라 무빙**

  | 무빙 | 필드 |
  |---|---|
  | `static` | `pos`, `target` |
  | `dolly` | `from`, `to`, `target` (`targetTo?`) |
  | `orbit` | `center`, `radius`, `height`, `fromDeg`, `toDeg` |
  | `crane` | `from`, `to`, `target` (dolly와 같지만 기본 이징이 다름) |

- **공통 필드**: `ease`(`linear` | `in` | `out` | `inOut`), `fov`(기본 40)

### 3.4 검증 (check)
아래 항목을 오류 목록(JSON)으로 보고한다.
- 필수 필드 누락, 알 수 없는 `type`·`anim`·`move`·`role`
- 중복 `id`
- 샷 구간의 겹침과 빈 구간
- 범위를 벗어난 시간
- `grow`를 지원하지 않는 요소에 `grow` 사용
- 잘못된 키프레임 경로

메시지 형식은 `path: message`다. 예: `elements[1].enter.anim: 'spin'은 지원하지 않음. 가능: none|fade|pop|rise|grow`

---

## 4. 런타임과 모듈 규약 [제안]

### 4.1 모듈 규약 (kit 내부, 커스텀 요소도 같은 규약)

```ts
interface ElementHandle {
  object3d: THREE.Object3D;
  update?(t: number): void;          // 절대시간 순수함수 (바람·물결 등)
  setProgress?(p: number): void;     // 0..1, grow 애니메이션용
  setOpacity?(o: number): void;      // 미지원 시 런타임이 material.opacity 일괄 처리
  dispose(): void;
}
type ElementFactory = (ctx: KitContext, params: any) => ElementHandle;

interface KitContext {
  style: Style;                       // material(role), palette, fogColor 등
  rng(salt: string): () => number;    // mulberry32(seed ^ hash(salt))
  heightAt(x: number, z: number): number;  // terrain 없으면 0
  quality: 'preview' | 'final';
}
```

### 4.2 결정성
- `kit/runtime/rng.ts`가 제공하는 것: `mulberry32`, `hashString`(FNV-1a), `deriveSeed(seed, salt)`
- 모듈마다 고유한 salt를 쓴다.
- noise도 시드 기반으로 만든다(`createNoise2D(rng)`). 전역 상태는 두지 않는다.

### 4.3 스타일 시스템
`Style` 인터페이스는 다음을 제공한다.
- `palette`(역할별 색), `background`, `fog`
- `material(role)`(캐시됨)
- `lights(scene)`(조명 리그 구성)
- `sky(preset)`(하늘 색 그라데이션)
- `outline?`

| 프리셋 | 재질 | 조명 | 그 밖 |
|---|---|---|---|
| `stylized` | `MeshToonMaterial` + 3단 그라데이션 맵 | 따뜻한 팔레트 | 짙은 안개 |
| `minimal` | `MeshStandardMaterial` (거칠기 0.6) | 부드러운 키 라이트 | 중립 팔레트, 옅은 안개 |

- 하늘 프리셋(`dawn`/`day`/`dusk`/`night`)은 스타일별 팔레트와 결합해 sky·fog·조명 색을 정한다.

### 4.4 v0.1 모듈

| 분류 | type | 내용 | 진행도(grow) |
|---|---|---|---|
| 환경 | sky | 그라데이션 스카이돔. 시간과 무관 | – |
| 환경 | terrain | 시드 노이즈 높이장, 정점색, `heightAt` 제공 | – |
| 환경 | trees | 로우폴리 나무(줄기+원뿔 잎 2단). InstancedMesh, 시드 Poisson 배치, 지형 높이에 맞춤, 바람 흔들림 | – |
| 환경 | water | 평면 + t 기반 정점 물결 | – |
| 개념 | shape | box, sphere, cylinder, cone, torus | – |
| 개념 | label | 캔버스 텍스트 → 텍스처 평면. 한글 지원, 카메라를 향하는 옵션 | – |
| 개념 | arrow | from → to, 몸통이 자라며 머리가 따라감 | ✓ |
| 개념 | bars | 값 배열 → 막대들, 아래 라벨 | ✓ |
| 개념 | line | 점 목록을 이은 곡선(CatmullRom) 튜브를 그려 나감 | ✓ |

### 4.5 렌더러
- `WebGLRenderer`(antialias, `preserveDrawingBuffer: true`)를 쓰고, 픽셀비는 1로 고정한다.
- `quality: preview`면 해상도를 0.5배로 낮추고, `final`이면 원본 해상도로 렌더한다.
- 그림자는 v0.1에서 끈다. 스타일 프리셋에서 조명과 안개로 깊이감을 낸다.

---

## 5. 커스텀 요소 [제안]

```ts
// custom/spiral.ts
import { defineElement } from '../kit/runtime/element';
export default defineElement({
  type: 'spiral',
  supportsGrow: true,
  create(ctx, params) { /* ... */ return { object3d, setProgress, dispose }; },
});
// scene.ts
import spiral from './custom/spiral';
defineScene({ ..., custom: [spiral], elements: [{ id:'s', type:'spiral', ... }] });
```

- 커스텀 요소의 규칙
  - 4.1 규약을 따른다.
  - `ctx.rng`, `ctx.style`만 쓴다.
  - `Math.random`과 실시간 값은 금지한다.
- 쓸 만한 커스텀 요소는 나중에 테스트를 붙여 kit 모듈로 승격한다.

---

## 6. 미리보기와 캡처 브리지 [제안]

### 6.1 미리보기
- `npm run dev`를 실행하면 Vite 페이지가 열린다.
- 화면 구성
  - 세로 캔버스(화면 크기에 맞춰 축소)
  - 하단 타임라인: 스크럽 바, 샷 구간 색 블록, 요소 enter/exit 마커, 재생/정지, 현재 시간
- 재생은 실시간이 아니라 시간을 `t`로 seek해서 그린다. 그래서 렌더 결과와 같다.

### 6.2 캡처 브리지 (`window.__KIT__`)
페이지가 노출하는 인터페이스다.
- `ready: Promise<{ok, errors}>`: 폰트 로드와 검증까지 끝나면 resolve된다.
- `info()`: `{ width, height, fps, duration, shots }`
- `renderAt(t): Promise<void>`: 해당 시점을 동기적으로 렌더한다.
- `capture(): string`: `canvas.toDataURL('image/png')`
- `?capture=1` 쿼리를 붙이면 UI 없이 캔버스만 원본 크기로 띄운다.

---

## 7. 스크립트 [제안]

공통 규칙
- 모두 단독으로 실행한다: `node "${CLAUDE_PLUGIN_ROOT}/scripts/<x>.mjs" <args>`
- 대상 프로젝트는 `--project <dir>`로 지정한다. 기본값은 현재 폴더다.
- stdout은 **JSON 한 줄**이다: `{ ok, ... }`
- 실패하면 `ok: false`와 `errors`를 출력하고, 0이 아닌 종료 코드로 끝난다.
- `--help`를 지원한다.

| 스크립트 | 동작 | 출력 |
|---|---|---|
| `init.mjs <dir> [--style]` | template과 kit 복사, manifest 생성. 비어 있지 않은 폴더는 거부(`--force`로 허용). npm install은 하지 않음 | `{ok, project, next:"npm install"}` |
| `check.mjs` | manifest 무결성 + 페이지 로드 후 검증 결과 | `{ok, errors, warnings, kit:{modified:[...]}}` |
| `still.mjs --at 0,3.5,8 [--sheet] [--quality final]` | 지정 시점 PNG, `--sheet`면 콘택트 시트 1장 | `{ok, files:[...], sheet}` |
| `render.mjs [--from] [--to]` | 프레임 PNG를 파이프로 ffmpeg에 전달 → H.264 yuv420p, crf 18 | `{ok, file, frames, seconds}` |
| `update.mjs [--force]` | 로컬 수정이 없으면 kit 갱신, 있으면 목록을 보여주고 거부 | `{ok, updated, skippedModified}` |

- 서버: 스크립트가 프로젝트의 vite로 임시 서버를 띄우고 끝나면 닫는다.
- 브라우저: 프로젝트의 playwright chromium을 쓴다. 기본 GPU 경로가 실패하면 SwiftShader로 폴백한다.
- 콘택트 시트는 브라우저 안에서 캔버스로 합성한다. 그래서 별도 이미지 라이브러리가 필요 없다.

---

## 8. 스킬 문서 [제안]

- **`scene-direct/SKILL.md`** (목표 150줄 이하)
  - 워크플로
  - 스크립트 명령: 하나씩 단독 실행, `&&`·`|` 금지
  - 규칙: "kit/ 소스를 읽지 말 것", "scene.ts만 수정할 것", "확인은 still 몇 장으로", "check 통과 전에 render 금지"
  - 흔한 연출 지시를 데이터 수정으로 바꾸는 예시 표
- **`references/scene-schema.md`**: 3절의 전체 명세
- **`scene-modules/SKILL.md`**: 모듈 표(type, 용도, 주요 params 한 줄). 상세는 `references/<type>.md`
- **`scene-custom/SKILL.md`**: 데이터로 표현할 수 없을 때만 쓴다. 규약과 템플릿
- **frontmatter**: 공식 허용 키만 쓴다. `allowed-tools`에 스크립트 접두사를 사전 승인한다.

---

## 9. 테스트 [제안]

| 층 | 도구 | 내용 |
|---|---|---|
| 단위 | vitest (Node) | rng·noise 결정성, 이징·키프레임 보간, enter/exit 진행도 계산, 샷 탐색, 카메라 경로, 검증기 오류 케이스, 모듈 create→dispose(three를 Node에서 사용), Poisson 배치 결정성 |
| 스크립트 | vitest + 임시 폴더 | init 결과 구조, manifest 해시, update의 수정 감지 |
| E2E | 실제 브라우저 | 샘플 프로젝트 init → npm install → check → still → render(1초). PNG가 비어 있지 않은지, 같은 시점을 두 번 캡처했을 때 같은지, MP4 프레임 수(ffprobe) |
| 골든 | 고정 시드 스틸 | `tests/golden/*.png`와 픽셀 평균 차이로 비교(허용 오차 설정) |

---

## 10. 위험과 대응

| 위험 | 대응 |
|---|---|
| 헤드리스 Chromium에서 GPU를 못 잡음 | SwiftShader 폴백(느리지만 결정적). 렌더 시간을 출력에 포함 |
| 한글 폰트가 기기마다 다름 | v0.1은 시스템 폰트(Malgun Gothic) 사용 + `document.fonts.ready` 대기. 폰트 번들은 검토 필요 |
| 1080×1920 PNG 캡처가 느림 | 프레임을 파이프로 바로 인코딩. 시간 측정 후 필요하면 JPEG 중간 포맷 검토 |
| kit TS를 Node 테스트에서 import | vitest가 TS를 처리 |

## 11. 검토가 필요한 결정 (사용자)

1. 스타일 프리셋 2종(`stylized`, `minimal`)의 구체적인 룩
2. 하드 컷만 지원(크로스페이드는 v0.2)
3. 그림자 끔(성능과 단순성 때문)
4. 한글 폰트: 시스템 폰트를 쓸지, Noto Sans KR(OFL)을 번들할지
5. 플러그인 이름 `threejs-scene-kit`
