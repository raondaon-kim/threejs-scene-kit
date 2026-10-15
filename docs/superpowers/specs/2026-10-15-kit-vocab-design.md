# 키트 목록 자동화 (vocab.json) — 설계 (v0.2.2)

## 0. 목적

스토리보드의 `Objects:` 제약 문구가 `scripts/lib/kit-vocab.mjs`에 물류 전용으로 하드코딩돼 있다.
새 키트(예: 자연)를 추가할 때 스토리보드 코드를 고치지 않도록, **키트 폴더마다 데이터 파일 `vocab.json`** 을 두고 storyboard.json에서 키트를 고른다.

범위 밖: 자연 키트 자체, environment(지형·하늘·숲·물) vocab, 커스텀 요소 vocab, 샷 단위 kit 선택.

## 1. `kit/modules/<kit>/vocab.json`

```json
{ "label": "물류·도시",
  "objects": { "<element type>": "<영문 구문>", … },
  "avoid": ["<영문 구문>", …] }
```

- `label`: 비어 있지 않은 문자열. `objects`: 비어 있지 않은 객체, 값은 비어 있지 않은 문자열. `avoid`: 문자열 배열(빈 배열 허용).
- 키트 이름 = 폴더 이름. `vocab.json`이 있는 폴더만 키트로 인식.
- 이번에 두 개:
  - `logistics`: objects = 현재 KIT_VOCAB 10종 그대로, avoid = `cars, people, text, logos, distant towns, water, bridges` (현재 FORBIDDEN 순서 그대로).
  - `concept`: objects = shape `simple geometric solids (boxes, spheres, cylinders, cones, tori)`, label `short text labels`, arrow `3D arrows`, bars `3D bar charts`, line `smooth curved tube lines`; avoid = `people, logos, photorealistic scenery`.
- `kit/modules/concept/index.ts`에 `CONCEPT_ELEMENTS = [shape, label, arrow, bars, line]`를 두고 registry가 이를 쓴다(순서 유지).

## 2. `scripts/lib/kit-vocab.mjs`

- `KIT_ROOT` = 플러그인의 `kit/modules` (스크립트 기준 상대 경로, 프로젝트 사본이 아니라 최신 플러그인 키트).
- `loadKits(root = KIT_ROOT)` → `Map<name, { label, objects, avoid }>`. 형식이 틀리면 `Error('<name>/vocab.json: <문제>')`.
- `vocabSentence(kits = ['logistics'], root?)`:
  - objects = 고른 키트 순서대로 구문을 이어 붙이고 중복 제거.
  - avoid = **고른 키트 모두가 금지하는 항목(교집합)**, 첫 키트의 순서.
  - `Only depict objects from this list: <objects ", ">.` + (avoid가 있으면) ` Do not include: <avoid ", ">.`
  - `vocabSentence(['logistics'])`는 현재 문장과 **완전히 같다**(하위 호환).
- `kitTypes(kits, root?)` → 고른 키트의 element type 배열.
- `CAMERA_ISO`는 그대로. `KIT_VOCAB`, `FORBIDDEN` 상수는 제거.

## 3. storyboard.json `kit`

| 필드 | 값 | 기본 |
|---|---|---|
| kit | `"<키트>"` \| `["<키트>", …]` (1개 이상) | `"logistics"` |

- 모르는 키트 이름·빈 배열·문자열이 아닌 값 → ScriptError `path: storyboard.kit`, 메시지에 사용 가능한 키트 목록(이름 정렬).
- `vocab: 'kit'`인 샷의 `Objects:` 줄 = `vocabSentence(선택 키트)`.
- 경고: 기존 "물류 요소 없음" → **선택 키트의 요소가 scene.ts에 없음** (메시지에 키트 이름, `"kit"`을 맞추거나 `"vocab": "free"` 안내).

## 4. 문서·버전

- storyboard.md: `kit` 필드와 예(`"kit": "concept"` 강의 장면, 배열 시 금지 목록은 교집합).
- README: "키트 추가 시 `kit/modules/<kit>/index.ts`(`*_ELEMENTS`)와 `vocab.json`" 한 줄 + v0.2.2 줄.
- `template/storyboard.example.json`에 `"kit": "logistics"` 명시.
- plugin.json 0.2.2 (kit 파일이 바뀌므로 기존 프로젝트에 update 안내가 뜨게).

## 5. 검증

- 동기화(양방향, 키트 일반화): `kit/modules/*/index.ts`가 내보내는 `*_ELEMENTS` 배열을 가진 모든 키트는 vocab.json이 있고, objects 키 집합 = element type 집합.
- loadKits 형식 오류, vocabSentence 하위 호환·합집합·교집합·avoid 빈 경우, kitTypes.
- storyboard: concept 선택 시 Objects에 bar charts·text 허용, 배열 선택 시 교집합, 모르는 키트 오류, 템플릿 장면 + concept → vocab 경고 없음.
