# threejs-scene-kit v0.2 설계: 클레이 룩 · 물류 키트 · 스토리보드

- 작성일: 2026-10-15
- 상태: 1~5절 방향은 대화에서 승인받음. 세부 사항은 사용자 부재 중 확정(**[제안]** 표시)
- 선행 문서: `2026-10-15-threejs-scene-kit-design.md` (v0.1)
- 레퍼런스: `D:\omnivoice\movie2.mp4` (WareTrack 물류 대시보드의 3D 화면)

## 0. 목표
v0.1의 기본 도형 영상은 품질이 부족했다. v0.2는 **movie2 수준의 아이소메트릭 클레이 3D 영상**을 만든다.

- 흐름: Codex CLI로 이미지 스토리보드를 만들고, 그 스토리보드를 보고 장면을 구성한다.
- 화질: **preview 영상을 먼저**, 승인 뒤 final 영상을 만든다.

**성공 기준**
1. 물류 허브 벤치마크 장면이 스토리보드와 나란히 놓았을 때 같은 룩으로 보인다.
   - 부드러운 그림자, 접촉 음영(AO), 둥근 모서리, 단색 팔레트가 있어야 한다.
   - 실제로 모델링된 오브젝트(창고, 트럭, 지게차 등)가 있어야 한다.
2. 트럭은 경로를 따라 이동하고, 지게차 포크가 오르내리며, 핀은 흔들린다. 카메라는 아이소메트릭이다.
3. `storyboard → check → still --compare → render(preview) → render --quality final` 전 과정이 스크립트로 동작한다.
4. v0.1 장면(stylized·minimal, 기존 요소)은 그대로 동작한다.

**범위 밖 (v0.3 이후)**: CC0 에셋 시스템, 데이터 레시피 오브젝트, 식생·물 고급화, UI 오버레이

## 1. 작업 흐름 [승인]
```
storyboard.json 작성 → storyboard.mjs(codex exec, 샷별 이미지) → [사용자 확인]
→ scene.ts 구성 → check → still --compare(스토리보드 | 렌더) 반복
→ render (기본 preview) → [사용자 확인] → render --quality final
```

## 2. 렌더 파이프라인 [승인 + 제안 세부]

### 2.1 스타일 look
각 Style에 `look`을 추가한다.

| look 항목 | clay | stylized / minimal |
|---|---|---|
| shadows | on (PCFSoft) | on |
| ao (GTAOPass) | on | on (약하게) |
| bloom | 약하게 (threshold 0.9) | off |
| toneMapping | Neutral | None (v0.1과 같은 색) |
| envIntensity (RoomEnvironment IBL) | 0.45 | 0 |

### 2.2 clay 팔레트 (역할 → 색)

| 역할 | 색 | 역할 | 색 |
|---|---|---|---|
| ground | #e6e9fb | road | #d4dbf5 |
| body | #3f6cf0 | bodyLight | #8fa8f7 |
| trim | #ffffff | dark | #27315c |
| accent | #ffb020 | accent2 | #3f6cf0 |
| accent3 | #6fcf97 | cargo | #d2a679 |
| wood | #b98a5e | foliage | #6fcf8f |
| trunk | #a77b55 | water | #9db8f5 |
| neutral | #ffffff | label | #1d2550 |

- 역할 목록(Role)에 **body, bodyLight, trim, dark, road, cargo, wood**를 추가한다.
- 다른 스타일에는 이 역할들이 비슷한 색으로 매핑된다.

### 2.3 그림자와 렌더 패스
- **그림자**
  - 방향광 하나가 그림자를 만든다.
  - 그림자 영역은 요소들의 경계 상자(Box3)에 여유 8m를 더해 자동으로 맞추고, 크기는 20~140m로 제한한다.
  - 모든 요소 메시는 그림자를 드리우고 받는다. 라벨, 하늘, 물은 제외한다.
- **패스 체인**: `RenderPass → GTAOPass → (UnrealBloomPass) → OutputPass`
  - 시간 누적 효과(TAA)는 쓰지 않는다. 어느 프레임이든 seekable해야 하기 때문이다.

### 2.4 화질 단계
| | preview (기본) | final |
|---|---|---|
| 해상도 | 0.5배 | 1배 출력, **2배로 렌더 후 축소(SSAA)** |
| 그림자 맵 | 2048 | 4096 |
| GTAO samples | 8 | 16 |

### 2.5 구조
- `buildWorld`는 렌더러와 무관하게 유지한다(Node 테스트용).
- 새 `kit/runtime/pipeline.ts`의 `createPipeline(renderer, world, look, quality)`가 IBL, 그림자, 컴포저를 맡는다. 브라우저 전용이다.

## 3. 부품 + 물류 키트 [승인 + 제안 세부]

### 3.1 부품 (`kit/parts/`)
- **형태**: `roundedBox(w,h,d,r)`, `cylinder`, `wheel(radius,width)`, `pinShape(size)` (lathe)
- **배치 도우미**: `place(geo, x,y,z, ry?)`
- **병합**: `buildByRole(parts)`가 `{role, geo}[]`를 역할별로 병합해 역할당 메시 하나로 만든다(draw call 절감).
- **좌표 관례**
  - 오브젝트 원점은 **바닥 중심**이다.
  - 차량의 앞은 **+Z**다.

### 3.2 오브젝트 10종 (요소 type)

| type | params (기본값) | animatable |
|---|---|---|
| warehouse | width 24, depth 14, height 7, docks 4, skylights 3 | – |
| truck | kind 'box'(box, van), length 9 | travel |
| forklift | lift 0 (0~1), load true | lift, travel |
| pallet | cargo 'boxes'(boxes, crates, none), rows 2, cols 2, layers 2 | – |
| container | length 12 (6 또는 12) | – |
| road | points [[x,z]…] (2개 이상), width 6, dashes true | – |
| lot | width 20, depth 12, stalls 0 | – |
| tree | kind 'round'(round, cone), height 3, pad true | – |
| pin | size 1.6, bob true | – |
| building | width 10, depth 10, floors 4 | – |

### 3.3 애니메이션 확장
- 요소 정의(ElementType)에 `animatable?: string[]`, 핸들에 `setParam?(name, value)`를 추가한다.
- **tracks 경로**: `param.<name>` 형식을 허용한다. 해당 요소의 animatable에 있는 이름만 받는다.
- **follow**: `{ path: [x,z][] (2개 이상), t0, t1, ease? }`
  - 경로는 centripetal Catmull-Rom 곡선으로 잇고, 호 길이 기준으로 진행한다.
  - 위치는 (x, at.y, z), 방향 yaw는 접선을 향한다(+Z가 앞).
  - 이동 거리(m)를 `setParam('travel', d)`로 전달해 바퀴를 굴린다.
  - follow가 있으면 position.x/z 트랙은 무시한다(검증기에서 경고).

## 4. 카메라 [승인 + 제안 세부]
- `meta.projection`: `'perspective'`(기본) 또는 `'ortho'`
- **ortho 카메라**
  - 공통 필드 `size`(화면 세로 높이 m, 기본 30)와 `sizeTo`(샷 안에서 줌, 같은 ease로 보간)를 쓴다.
  - 카메라 위치는 방향만 정하고, 위치에서 타깃까지 거리 + 500m를 클리핑 범위로 둔다.
- **새 move `path`**: `{ points: Vec3[] (2개 이상), target: Vec3 | targets: Vec3[], ease? }`
  - Catmull-Rom 곡선의 호 길이 기준으로 움직인다. 컷 없이 이어지는 비행에 쓴다.

## 5. 스토리보드와 검증 [승인 + 제안 세부]

### 5.1 storyboard.json (프로젝트 루트)
```json
{ "aspect": "16:9", "style": "공통 스타일 프롬프트(영문)",
  "shots": [ { "id": "s1", "at": 2.5, "prompt": "샷 내용(영문)" } ] }
```
`at`은 compare할 때 렌더할 장면 시각이다.

### 5.2 storyboard.mjs
- **사용법**: `storyboard.mjs --project <dir> [--shot id] [--concurrency 2]`
- **codex 찾는 순서**: 환경변수 `CODEX_EXE` → PATH의 `codex` → `%USERPROFILE%\.vscode\extensions\openai.chatgpt-*\bin\windows-x86_64\codex.exe`(최신 버전)
  - `CODEX_EXE`가 `.mjs`·`.js`면 node로 실행한다(테스트용 가짜 codex).
- **호출**: `codex exec --skip-git-repo-check --ephemeral -s workspace-write -C <project> <prompt>`
  - 프롬프트로 `storyboard/<id>.png`에 저장하라고 지시한다.
- **결과**
  - 파일이 생기지 않으면 실패로 처리한다.
  - `storyboard/log.json`에 프롬프트, 소요 시간, 성공 여부를 기록한다.
  - `storyboard/sheet.png`를 만든다(브라우저 합성).

### 5.3 still.mjs --compare
storyboard.json의 각 샷에 대해 [스토리보드 이미지 | 해당 `at` 시점의 렌더]를 나란히 놓은 시트 1장(`out/stills/compare.png`)을 만든다.

### 5.4 render.mjs
- 기본 quality는 `preview`, `--quality final`이면 SSAA 2배로 렌더한다.
- 출력 파일 기본값: `out/video-preview.mp4` / `out/video.mp4`

### 5.5 update.mjs
kit에 더해 템플릿의 인프라 파일(`vite.config.ts`, `index.html`, `tsconfig.json`)도 갱신한다. `scene.ts`, `package.json`, `custom/`은 건드리지 않는다.

## 6. 테스트
- **부품**: 경계 상자, 원점이 바닥 중심인지, 결정성
- **오브젝트**: 10종의 create→dispose, 잘못된 params 오류, setParam, 역할별 병합
- **follow·path 카메라**: t별 위치·방향, 호 길이 진행, seekable
- **검증기**: 새 역할, `param.*` 트랙, follow 형식, `projection`·`size`·`sizeTo`
- **스크립트**: storyboard(가짜 codex로 성공·실패), compare 시트
- **E2E**: 기존 단계 + clay 물류 미니 장면 still과 골든, preview 렌더

## 7. 위험
| 위험 | 대응 |
|---|---|
| GTAO와 SSAA로 final 렌더가 느림 | 측정한 프레임당 시간을 출력에 포함. 필요하면 `--ss 1.5` |
| Vite 의존성 최적화(three/addons) 중복 인스턴스 | vite.config의 optimizeDeps.include에 addons를 명시 |
| Codex 이미지의 일관성 | 공통 스타일 프롬프트, 필요하면 `--shot`으로 재생성 |
