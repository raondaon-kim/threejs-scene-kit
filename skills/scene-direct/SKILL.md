---
name: scene-direct
description: 교육 강의·유튜브 쇼츠용 고품질 3D 짧은 영상을 대화로 연출할 때 사용. Codex로 이미지 스토리보드를 만들고, 그 스토리보드를 보며 scene.ts 데이터만 고쳐 Three.js 장면(클레이 아이소메트릭 물류·도시 키트, 지형·하늘·나무, 도형·라벨·화살표·그래프)을 구성하고, 비교 시트로 맞춘 뒤 preview → final MP4로 렌더한다. "3D 영상", "쇼츠 장면", "스토리보드", "아이소메트릭", "씬 연출", "장면 렌더" 요청에 사용.
allowed-tools:
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/still.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" *)
---

# 장면 연출 (scene-direct)

영상 하나 = 프로젝트 폴더 하나. 연출은 **`scene.ts` 데이터 수정**으로만 한다.
검증된 코드(`kit/`)는 이미 들어 있으므로 다시 만들거나 읽지 않는다.

## 절대 규칙

1. **`kit/` 소스를 읽거나 고치지 않는다.** 필요한 정보는 이 문서, `references/`, scene-modules 스킬에 있다. 스크립트가 궁금하면 `--help`만 본다.
2. **스크립트는 한 번에 하나, 단독 Bash 명령으로.** `&&`, `|`, `;`, 리다이렉트로 잇지 않는다 (사전 승인 접두사와 맞지 않아 권한 창이 뜬다).
3. 스크립트 출력은 JSON 한 줄. `ok`와 `errors[].path`만 보고 판단한다.
4. 확인은 **시트 한 장**(still `--sheet` 또는 `--compare`)을 Read. 영상을 반복 렌더하지 않는다.
5. 렌더는 **preview 먼저**, 사용자가 승인하면 `--quality final`.
6. 데이터로 표현할 수 없을 때만 scene-custom 스킬로 커스텀 요소를 만든다.

## 흐름

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" <폴더> --style clay                  # stylized|minimal|clay
npm install --prefix "<폴더>"                                                     # 처음 한 번
npm exec --prefix "<폴더>" -- playwright install chromium                          # 처음 한 번
(storyboard.example.json을 참고해 <폴더>/storyboard.json 작성)
node "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard.mjs" --project <폴더>               # 샷당 1~2분, Codex 사용
  → storyboard/sheet.png를 사용자에게 보여주고 방향 승인
(scene.ts 작성: 스토리보드 샷 = scene 샷, storyboard.json의 at = 비교 시점)
node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs" --project <폴더>
node "${CLAUDE_PLUGIN_ROOT}/scripts/still.mjs" --project <폴더> --compare           # [스토리보드 | 렌더] 비교
  → 차이를 scene.ts로 고치고 반복 (보통 3~5회)
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs" --project <폴더>                    # preview → out/video-preview.mp4
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs" --project <폴더> --quality final    # final → out/video.mp4
```

- 스토리보드 한 샷만 다시: `storyboard.mjs --project <폴더> --shot s2` (storyboard.json의 prompt를 고친 뒤)
- 특정 시점 스틸: `still.mjs --project <폴더> --at 1,4,8 --sheet`
- 미리보기 UI: `npm --prefix <폴더> run dev` (타임라인 스크럽·샷 구간·재생)
- 부분 렌더: `render.mjs --from 4 --to 8 --out out/part.mp4`

## 연출 지시 → 데이터 수정

| 지시 예 | 수정 |
|---|---|
| "제목을 1초 늦게" | 해당 요소 `enter.t` +1 |
| "아이소메트릭으로" | `meta.projection: 'ortho'` + 샷 카메라 `size`(화면 세로 m) |
| "천천히 줌인" | 샷 카메라 `size: 40, sizeTo: 30` |
| "트럭이 도로를 따라 달리게" | 요소 `follow: { path: [[x,z],…], t0, t1 }` (진행 방향을 자동으로 향함) |
| "도크로 후진" | `follow` 경로를 도크 쪽으로 + `rotation: [0, 180, 0]` |
| "지게차가 짐을 들어 올리게" | `tracks: { 'param.lift': [[t,0],[t+1.5,0.8]] }` |
| "컷 없이 이어서 날아가듯" | 샷 카메라 `move: 'path'`, `points`, `target` |
| "전체를 클레이 룩으로" | `style: 'clay'`, `environment: { ground: {} }` |
| "그래프가 천천히 자라게" | 막대 요소 `enter: { anim: 'grow', dur: 2.5 }` |
| "15초로 늘려줘" | `meta.duration` + 마지막 샷 `end` |

## 구도 요령

- **ortho**: 카메라 위치는 방향만 정한다. 화면에 보이는 세로 폭 = `size`(m), 가로 = size × 화면비.
  예: 1920×1080, size 18 → 가로 32m. 아이소 방향 예: `target + [45, 67, 78]`.
- **perspective (fov 40)**: 거리 d에서 가로 반폭 ≈ d × 0.36 (16:9), d × 0.207 (9:16).
- 물체가 많은 장면은 반복문으로 배치하되 `Math.random` 대신 해시(예: `(i*9301 % 233280)/233280`)로 결정적인 변화를 준다.
- 장면이 바뀌면 이전 요소에 `exit`를 줘 겹치지 않게 한다.

## 오류 대응

- `check`가 `ok:false`면 `errors[].path` 위치의 필드를 고친다. 메시지에 허용값이 있다.
- `scene.ts:줄:열 [PARSE_ERROR]`는 문법 오류. `path: console`은 브라우저 런타임 오류.
- `storyboard` 오류 `codex가 이미지를 저장하지 않음`은 prompt를 다듬어 `--shot`으로 재시도.
- `browser` 오류(Chromium 없음)는 안내된 설치 명령 실행.

## 참고

- 장면 형식 전체: `references/scene-schema.md`
- 스토리보드: `references/storyboard.md`
- 요소별 params: scene-modules 스킬 (물류 키트 포함)
- 직접 만드는 요소: scene-custom 스킬
