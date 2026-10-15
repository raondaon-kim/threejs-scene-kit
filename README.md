# threejs-scene-kit

대화와 Codex 스토리보드로 연출하는 고품질 Three.js 짧은 영상 제작 키트 (Claude Code 플러그인, v0.2.2).
교육 강의·유튜브 쇼츠용 3D 장면을 **장면 데이터(`scene.ts`)만 고쳐서** 만들고, 결정적인 무음 MP4로 렌더한다.
v0.2: movie2풍 클레이 아이소메트릭 룩(그림자·AO·IBL·SSAA), 절차적 물류·도시 키트 10종, 경로 이동·파라미터 애니메이션, ortho·path 카메라, Codex 스토리보드 → 비교 시트 → preview/final 렌더.
v0.2.1: 앵커 헬퍼(`kit/anchors`: 도크·트럭 정차·후진 경로·차선)로 좌표 손계산 제거, 스토리보드에 키트 목록·고정 아이소 카메라 자동 주입(물류 장면용, `free`로 끄기).
v0.2.2: 스토리보드 키트 목록을 키트별 vocab.json에서 조립("kit": "logistics" | "concept" | 배열). 새 키트 = kit/modules/<키트>/index.ts(*_ELEMENTS) + vocab.json + kit/runtime/registry.ts의 BUILTIN_ELEMENTS에 추가 (테스트가 셋의 일치를 검사).
자막·나레이션·음악은 결과 영상을 Remotion 등에서 합치는 것을 전제로 한다.

## 구성

| 경로 | 내용 |
|---|---|
| `skills/scene-direct` | 연출 워크플로 (메인 스킬) |
| `skills/scene-modules` | 요소·환경 카탈로그 |
| `skills/scene-custom` | 커스텀 요소 규약 |
| `kit/` | 프로젝트로 복사되는 검증된 TypeScript 코드 (런타임, 모듈, 스타일, 미리보기) |
| `template/` | 새 영상 프로젝트 골격 |
| `scripts/` | init, check, still, render, update (Node 내장 모듈만 사용) |

## 요구사항

- Node 22 이상
- 시스템 PATH의 ffmpeg (render, 스토리보드 시트)
- Codex CLI (스토리보드용, VS Code OpenAI 확장 동봉본 자동 탐지 또는 `CODEX_EXE`)
- 영상 프로젝트에서 `npm install`로 three, vite, playwright 패키지 설치
- Chromium은 별도 설치: `npm exec --prefix <프로젝트> -- playwright install chromium` (최초 1회. 이미 캐시가 있으면 생략 가능)

## 설치

```
claude --plugin-dir D:\omnivoice\threejs-scene-kit
```

또는 로컬 마켓플레이스에 등록해서 설치한다.

## 사용 흐름

```
node scripts/init.mjs my-video --style clay
npm install --prefix my-video
npm exec --prefix my-video -- playwright install chromium
(my-video/storyboard.json 작성)
node <플러그인>/scripts/storyboard.mjs --project my-video    # Codex로 샷별 이미지
node <플러그인>/scripts/check.mjs --project my-video
node <플러그인>/scripts/still.mjs --project my-video --compare  # [스토리보드 | 렌더]
node <플러그인>/scripts/render.mjs --project my-video        # preview → out/video-preview.mp4
node <플러그인>/scripts/render.mjs --project my-video --quality final  # → out/video.mp4
npm run dev                                                  # 브라우저 타임라인 미리보기
```

## 개발

```
npm install
npm test            # 단위 + 스크립트 테스트 (vitest)
npm run typecheck   # kit 타입 검사
npm run e2e         # 실제 브라우저: init → check → still → 결정성 → 골든 → 1초 렌더
```

설계: `docs/superpowers/specs/2026-10-15-threejs-scene-kit-design.md`
