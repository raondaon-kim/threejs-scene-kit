---
name: scene-modules
description: threejs-scene-kit 장면에 넣을 수 있는 요소와 환경의 카탈로그. scene.ts의 elements나 environment를 작성·수정할 때 type과 params를 확인하는 용도. 물류·도시 키트(warehouse, truck, forklift, pallet, container, road, lot, tree, pin, building), 개념 요소(shape, label 한글 지원, arrow, bars, line), 지형·하늘·나무·물·바닥.
---

# 모듈 카탈로그

모든 요소는 검증된 코드로 이미 프로젝트 `kit/`에 들어 있다. 소스를 읽지 말고 아래 표와 references만 본다.

## 물류·도시 키트 (clay 스타일과 함께 쓰는 movie2풍 아이소메트릭)

| type | 용도 | 주요 params | animatable |
|---|---|---|---|
| warehouse | 창고 + 앞면(+Z) 도크 | width, depth, height, docks, skylights, ribs | – |
| truck | 트럭 (+Z가 앞) | kind(box, van), length | travel |
| forklift | 지게차 | lift(0~1), load | lift, travel |
| pallet | 팔레트 + 적재물 | cargo(boxes, crates, none), rows, cols, layers | – |
| container | 해운 컨테이너 | length(6, 12) | – |
| road | 곡선 도로 (절대 좌표) | points [[x,z]…], width, dashes | – |
| lot | 마당·주차장 | width, depth, stalls, role | – |
| tree | 나무 | kind(round, cone), height, pad | – |
| pin | 지도 핀 (카메라를 향함) | size, bob | – |
| building | 사무 건물 | width, depth, floors | – |

- 원점은 바닥 중심, 단위 m. 움직임은 `follow`(경로 이동, 바퀴 자동 회전)와 `tracks: {'param.lift': …}`.
- 좌표 손계산 금지: 도크·트럭 정차·후진 경로·차선은 `import { warehouseAnchors, lane } from './kit/anchors'` (logistics.md 앵커 섹션).
- 상세·배치 공식·예시: `references/logistics.md`

## 동화 키트 (pastel 스타일 + 원근 디오라마)

| type | 용도 | 주요 params | 움직임 |
|---|---|---|---|
| island | 떠 있는 섬(윗면 y=0) | radius, depth, floaters, variant | 떠 있는 바위 |
| plateau | 높은 단(윗면 = height) | radius, height | – |
| rock | 바위 | size, variant | – |
| river | 강 (절대 좌표) | points, width | – |
| waterfall | 폭포(원점 = 위 가장자리) | height, width | 물보라 |
| path | 흙길 (절대 좌표) | points, width | – |
| bridge | 돌 아치 다리(로컬 X) | span, width | – |
| castle | 성 | size, towers | 깃발 |
| cottage | 오두막 | width, depth, roof | – |
| mushroom | 버섯집 | height | – |
| windmill | 풍차 | height, speed | 날개 회전 |
| fairytree | 동화 나무 | kind(puffy, conifer), height | – |
| flowers | 꽃밭 | radius, count | – |
| field | 밀밭 | width, depth, rows | – |
| fence | 울타리 (절대 좌표) | points | – |
| cloud | 구름(그림자 없음) | size | 위아래 |

- 다리 배치는 `bridgeOn(RIVER, i)`, 폭포는 `islandEdge(radius, 각도)` (kit/anchors). 상세·구도: `references/fairytale.md`
- 같은 type·같은 variant는 같은 모양. 나무·꽃·바위·버섯·구름·섬·높은 단을 여러 개 놓을 땐 `variant: i`로 다르게.

## 개념 요소

| type | 용도 | 주요 params | grow |
|---|---|---|---|
| shape | 기본 도형 | kind(box, sphere, cylinder, cone, torus), size, role | ✗ |
| label | 텍스트(한글·여러 줄) | text(`\n` 줄바꿈), size(한 줄 높이 m), background, billboard, role | ✗ |
| arrow | 화살표 | to(상대 좌표), thickness, role | ✓ |
| bars | 막대그래프 | values, labels, maxHeight, width, gap, roles | ✓ |
| line | 곡선 튜브 | points(상대 좌표 2개 이상), radius, role | ✓ |

- 라벨은 AO·그림자 영향 없이 항상 위에 그려진다.
- 상세 params: `references/<type>.md`

## 표면 질감 · 디테일 (모든 키트 공통)

| 기능 | 쓰는 곳 | 요점 |
|---|---|---|
| 표면 질감 (p5.js) | `look: { surfaces: { ground: 'grass-brush', … }, strength }` | 내장 7종, role별. pastel은 기본 켜짐. `references/textures.md` |
| 메쉬 그라디언트 배경 | `environment.background: { kind: 'meshGradient', preset, sun }` | 화면 배경, 구형 하늘 대신 |
| grass | 요소 `{ type: 'grass', params: { center, radius, count, avoid } }` | 인스턴싱 풀포기(최대 20000), 강·길 points를 avoid로 비움 |
| scatter | `import { scatter } from './kit/layout'` → `elements: [...scatter({ type, count, center, radius, seed, minDist, avoid })]` | 나무·꽃·바위 흩뿌리기(반복문·해시 대신), variant 자동 |

- grass·scatter 전체 옵션: `references/detail.md`

## 환경 (environment)

| 키 | 내용 |
|---|---|
| ground | 평평한 바닥판 (clay 장면 권장). size |
| sky | 그라데이션 하늘. preset: dawn, day, dusk, night |
| terrain | 시드 기반 지형. 중앙 flatRadius는 평평한 무대 |
| trees | 로우폴리 숲(환경용, 개별 tree 요소와 별개) |
| water | 물결치는 수면 |

상세: `references/environment.md`

## role (색 역할)

`rock`, `roof`, `roofAlt`, `body`, `bodyLight`, `trim`, `dark`, `road`, `cargo`, `wood`, `accent`, `accent2`, `accent3`, `neutral`, `label`, `ground`, `foliage`, `trunk`, `water`.
실제 색은 스타일이 정한다. clay: body 파랑 #3f6cf0, bodyLight #94adf7, trim 흰색, dark 남색 #27315c, accent 노랑 #ffb020, cargo 종이상자 #d2a679.

없는 요소가 필요하면 scene-custom 스킬을 쓴다.
