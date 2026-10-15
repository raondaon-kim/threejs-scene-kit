# 스토리보드 (storyboard.json + storyboard.mjs)

Codex CLI(`codex exec`)의 이미지 생성으로 샷별 콘셉트 이미지를 만든다. 이 이미지는 **목표 구도·구성·분위기**이며, 렌더가 픽셀 단위로 같을 필요는 없다.

## storyboard.json (프로젝트 루트)

```json
{
  "aspect": "16:9",
  "style": "premium isometric 3D clay render, monochrome blue and white palette, soft shadows, ambient occlusion, light lavender ground, rounded edges, no text, no UI, no logos, no people.",
  "shots": [
    { "id": "s1", "at": 2.5, "prompt": "Wide isometric view of a blue warehouse with four loading docks, trucks on a curved road, round trees, blue map pins." },
    { "id": "s2", "at": 7.5, "prompt": "Closer view of the loading docks: two trucks backing in, a yellow forklift carrying a pallet of boxes." }
  ]
}
```

| 필드 | 설명 |
|---|---|
| aspect | `16:9` 또는 `9:16` (scene의 meta.width/height와 맞출 것) |
| style | 모든 샷 공통 스타일(영문). 스타일 일관성의 핵심 |
| shots[].id | 영문·숫자·대시. `storyboard/<id>.png`로 저장 |
| shots[].at | `still --compare`에서 렌더할 장면 시각(초). 보통 해당 scene 샷의 중간 |
| shots[].prompt | 샷 내용(영문). 등장 오브젝트·카메라 거리·배치를 구체적으로 |

## 자동 제약 (기본 켜짐, 물류 키트·ortho 장면 전용)

모든 샷 프롬프트에 두 줄이 자동으로 들어간다 (Style 뒤, Content 앞).
**개념·강의 장면(라벨·도형·그래프, perspective)은 `"vocab": "free", "camera": "free"`로 끈다.** 장면과 맞지 않으면 storyboard 출력 `warnings`가 알려준다.

- `Camera:` 렌더와 같은 고정 아이소 카메라 (ortho, 정면 오른쪽 30°, 고도 약 37° = `target + [45, 67, 78]`)
- `Objects:` 키트에 있는 물체만 허용 + 승용차·사람·글자·원경 마을·물·다리 금지

끄기 (전역 또는 샷 단위, 샷 값 우선):

```json
{ "vocab": "free", "camera": "free", "shots": [{ "id": "s3", "prompt": "...", "camera": "iso" }] }
```

| 필드 | 값 | 기본 |
|---|---|---|
| vocab | `"kit"` \| `"free"` | `"kit"` |
| camera | `"iso"` \| `"free"` | `"iso"` |

실제로 들어간 프롬프트는 `storyboard/log.json`에서 확인한다.

## 작성 요령

- 키트 목록은 자동으로 들어가므로 prompt에는 배치·카메라 거리(wide establishing / closer / close-up)만 구체적으로 쓴다.
- 샷마다 카메라 거리를 명시: wide establishing / closer / close-up.
- clay 스타일 문구 예시는 위 style을 그대로 쓴다. 색을 바꾸려면 style과 scene의 style(팔레트)을 함께 바꾼다.

## 실행

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard.mjs" --project <폴더>            # 전체 (동시 2개)
node "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard.mjs" --project <폴더> --shot s3  # 한 장만 다시
```

- 결과: `storyboard/<id>.png`, `storyboard/sheet.png`(2열 시트), `storyboard/log.json`(프롬프트·소요시간 누적).
- codex 위치: `CODEX_EXE` 환경변수 → PATH의 codex(Windows는 .exe 또는 npm 전역 설치를 node로 실행) → VS Code/Cursor의 OpenAI 확장 동봉본.
- 샷당 보통 1~2분, Codex 사용량을 소모한다. 사용자 승인 없이 전체를 반복 생성하지 않는다.

## 비교

`still.mjs --compare` → `out/stills/compare.png`: 행마다 [스토리보드 | `at` 시점 preview 렌더].
차이를 보고 scene.ts의 카메라(`size`, 방향), 배치, 요소를 고친다.
