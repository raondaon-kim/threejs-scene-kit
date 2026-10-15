---
name: scene-direct
description: 교육 강의·유튜브 쇼츠용 3D 짧은 영상을 대화로 연출할 때 사용. Three.js 절차적 장면(지형·하늘·나무·물 + 도형·라벨·화살표·막대그래프·선)을 scene.ts 데이터만 고쳐서 만들고, 스틸 시트로 확인하고, 결정적 MP4(기본 1080x1920)로 렌더한다. "3D 영상", "쇼츠 장면", "씬 연출", "카메라 무빙", "장면 렌더" 요청에 사용.
allowed-tools:
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/still.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" *)
---

# 장면 연출 (scene-direct)

영상 하나 = 프로젝트 폴더 하나. 연출은 **`scene.ts` 데이터 수정**으로만 한다.
검증된 코드(`kit/`)는 이미 들어 있으므로 다시 만들거나 읽지 않는다.

## 절대 규칙

1. **`kit/` 소스를 읽거나 고치지 않는다.** 필요한 정보는 이 문서, `references/scene-schema.md`, scene-modules 스킬에 있다. 스크립트가 궁금하면 `--help`만 본다.
2. **스크립트는 한 번에 하나, 단독 Bash 명령으로 실행한다.** `&&`, `|`, `;`, 리다이렉트로 잇지 않는다(사전 승인 접두사와 맞지 않아 권한 창이 뜬다).
3. 스크립트 출력은 JSON 한 줄이다. `ok`와 `errors[].path`만 보고 판단한다.
4. 수정 후 반드시 `check` → 결과 확인은 `still --sheet` 시트 **한 장**을 Read. 영상 전체를 반복 렌더하지 않는다.
5. `render`는 사용자가 최종본을 원할 때만 실행한다.
6. 데이터로 표현할 수 없을 때만 scene-custom 스킬로 커스텀 요소를 만든다.

## 흐름

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" <폴더> --style stylized     # 새 프로젝트 (stylized|minimal)
(프로젝트 폴더에서) npm install                                         # 처음 한 번
node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs" --project <폴더>           # 검증
node "${CLAUDE_PLUGIN_ROOT}/scripts/still.mjs" --project <폴더> --at 1,4,8 --sheet   # 확인
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs" --project <폴더>          # 최종 MP4 → out/video.mp4
```

- 사용자가 직접 보고 싶어 하면: 프로젝트 폴더에서 `npm run dev` → 브라우저 타임라인(스크럽·샷 구간·재생).
- 부분 렌더: `render.mjs --from 4 --to 8 --out out/part.mp4`
- 고해상도 스틸: `still.mjs --at 6 --quality final`

## 연출 지시 → 데이터 수정

| 지시 예 | 수정 |
|---|---|
| "제목을 1초 늦게" | 해당 요소 `enter.t` +1 (exit도 같이 밀지 확인) |
| "그래프가 천천히 자라게" | 막대 요소 `enter: { anim: 'grow', dur: 2.5 }` |
| "전체를 미니멀하게" | `style: 'minimal'` |
| "해질녘 분위기" | `environment.sky.preset: 'dusk'` (dawn/day/dusk/night) |
| "나무를 더 빽빽하게" | `environment.trees.count` 증가 (최대 5000) |
| "카메라가 천천히 돌게" | 샷 `camera: { move: 'orbit', center, radius, height, fromDeg, toDeg }` |
| "가까이 다가가며 시작" | 샷 `camera: { move: 'dolly', from, to, target }` |
| "15초로 늘려줘" | `meta.duration` 변경 + 마지막 샷 `end`를 같게 |
| "구가 떠올랐다가 내려오게" | 요소 `tracks: { 'position.y': [[2, 3], [4, 6], [6, 3]] }` |
| "화살표로 연결" | `type: 'arrow'`, `params.to`는 요소 위치 기준 상대 좌표 |
| "가로 영상으로" | `meta.width: 1920, height: 1080` (짝수 필수) |

## 구도 요령 (세로 1080×1920, fov 40)

- 거리 d에서 보이는 가로 반폭 ≈ d × 0.207 (18m → ±3.7m). 세로 화면은 좁으니 요소를 x ±3 안에 모은다.
- 지형 중앙 반경 `flatRadius`(기본 15m)는 높이 0인 무대다. 개념 요소는 이곳에 둔다.
- 장면이 바뀌면 이전 요소에 `exit`를 줘서 겹치지 않게 한다.

## 오류 대응

- `check`가 `ok:false`면 `errors[].path` 위치의 필드를 고친다. 메시지에 허용값 목록이 있다.
- `path: console` 오류는 브라우저 런타임 오류다. 최근 수정한 커스텀 요소나 params를 의심한다.
- `project` 오류는 폴더 경로나 `npm install` 누락이다.

## 참고

- 장면 형식 전체: `references/scene-schema.md`
- 요소별 params: scene-modules 스킬
- 직접 만드는 요소: scene-custom 스킬
