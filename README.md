# threejs-scene-kit

대화로 연출하는 절차적 Three.js 짧은 영상 제작 키트 (Claude Code 플러그인).
교육 강의·유튜브 쇼츠용 3D 장면을 **장면 데이터(`scene.ts`)만 고쳐서** 만들고, 결정적인 무음 MP4로 렌더한다.
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
- 시스템 PATH의 ffmpeg (render용)
- 영상 프로젝트에서 `npm install`로 three, vite, playwright 패키지 설치
- Chromium은 별도 설치: `npm exec --prefix <프로젝트> -- playwright install chromium` (최초 1회. 이미 캐시가 있으면 생략 가능)

## 설치

```
claude --plugin-dir D:\omnivoice\threejs-scene-kit
```

또는 로컬 마켓플레이스에 등록해서 설치한다.

## 사용 흐름

```
node scripts/init.mjs my-video --style stylized
npm install --prefix my-video
npm exec --prefix my-video -- playwright install chromium
node <플러그인>/scripts/check.mjs --project my-video
node <플러그인>/scripts/still.mjs --project my-video --at 1,5,9 --sheet
node <플러그인>/scripts/render.mjs --project my-video        # → my-video/out/video.mp4
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
