# 동화 키트 (pastel clay 디오라마) — 설계 (v0.3.0)

## 0. 목적·근거

- 사용자 요청: "동화 속 세계" 풍경 투어 영상. 룩 = 파스텔 클레이, 카메라 = 디오라마 원근(지름 80m 안팎의 둥근 섬을 원근 카메라로).
- 작업 순서(사용자 지정): Codex 스토리보드 먼저 → 승인된 그림으로 설계. 스토리보드: `D:\omnivoice\scenes\06-fairytale-tour\storyboard\s1~s5.png` (s1 = 마스터 레이아웃, s2~s5 = 물체 모양·앵글 참고. Codex가 샷마다 다른 섬을 그렸으므로 레이아웃은 s1 기준).
- 성공 기준: s1과 같은 구성·분위기의 25초 디오라마 투어(preview → final 1920×1080) + 다시 쓸 수 있는 동화 키트.
- 범위 밖: 인물·동물, 물 셰이더(굴절·흐름 애니메이션), CC0 에셋, 문자열 앵커.

## 1. 역할(Role) 추가

`rock`, `roof`, `roofAlt` 3개를 `Role`/`ALL_ROLES`에 추가하고 모든 스타일 팔레트에 색을 둔다.

| 스타일 | rock | roof | roofAlt |
|---|---|---|---|
| clay | #b9c0e0 | #5f86f2 | #94adf7 |
| stylized / minimal | 각 팔레트의 neutral·accent 계열에서 고름 (구분 가능한 색) |

## 2. 스타일 `pastel`

clay 파이프라인(LOOK 동일: 그림자·GTAO·IBL·neutral 톤매핑, bloom 없음)에 동화 팔레트.

| role | 색 | 쓰임 |
|---|---|---|
| ground | #9cc97a | 섬 윗면 잔디 |
| foliage | #86bf6a | 나무 |
| trunk | #9a6b4f | 줄기 |
| water | #8ed6f2 | 강·폭포 |
| rock | #c9b9ae | 절벽·바위 |
| road | #ead2a8 | 흙길 |
| body | #f6ead6 | 벽(크림) |
| bodyLight | #fbf3e6 | 버섯 줄기 등 |
| trim | #ffffff | 흰 점·구름·창틀 |
| dark | #5b4a5e | 창문·문 구멍·성문 |
| roof | #f2a48a | 복숭아 지붕 |
| roofAlt | #a98ae0 | 라벤더 지붕 |
| accent | #f6d26b | 깃발·버터 노랑 꽃 |
| accent2 | #ec7b74 | 버섯 갓(빨강)·분홍 꽃 |
| accent3 | #c7a6ec | 라벤더 꽃 |
| cargo | #f0c95e | 밀밭 |
| wood | #b98b62 | 울타리·문·풍차 날개 |
| neutral | #ddd3c8 | 다리·성벽 돌 |
| label | #4a3a55 | 라벨 |

하늘(모든 프리셋 공통 기반, dusk만 더 따뜻하게): top #a9b8ee, horizon #f6c9d6, bottom #c9cff2, sun #fff0d6, fog #f3d9e4, ambient #fff4ec, sunIntensity 2.4, ambientIntensity 0.6, sunDir [-0.6, 0.55, 0.35]. fogDensity 0.0008.
`StyleName`에 `'pastel'`, init.mjs STYLES에 pastel.

## 3. 부품 추가 (`kit/parts`)

- `ribbon(curve, u0, u1, steps, a, b, y)`: logistics/road.ts의 리본을 parts로 옮겨 공유(road는 import).
- `blob(r, rng, amp = 0.18, detail = 2)`: 시드 변형 아이코스피어(바위·구름·나무 덩어리). 바닥 원점, 결정적.
- `prism(w, h, d)`: 박공지붕용 삼각 기둥(바닥 원점, 용마루 Z축 방향).
- `arch(span, rise, thick, depth)`: 아치 모양을 Z로 압출(다리·성문).

## 4. 동화 키트 요소 (`kit/modules/fairytale`, 16종)

공통: 원점 바닥 중심, 단위 m, 시드는 `ctx.rng(<type>)` + params.variant(정수)로 결정적. 섬 윗면이 y=0.

| type | params (기본) | 설명 | update |
|---|---|---|---|
| island | radius 30, depth 12, floaters 6 | 둥근 윗면(외곽 노이즈), 둘레 바위 절벽 2~3단, 아래로 좁아지는 바위 밑면, 떠 있는 작은 바위 | 떠 있는 바위 살짝 위아래 |
| plateau | radius 9, height 5 | 높은 단: 잔디 윗면(y=height) + 바위 절벽 둘레 | – |
| rock | size 1.5, variant 0 | 둥근 바위 | – |
| river | points [[x,z]…] (절대), width 3 | 물 리본(y 0.03) + 가장자리 돌(시드) | – |
| waterfall | height 10, width 3 | 원점 = 위 가장자리(y=0), 아래로 늘어진 물줄기 + 위·아래 물보라 | 물보라 출렁임 |
| path | points (절대), width 1.6 | 흙길 리본 | – |
| bridge | span 7, width 2.4 | 돌 아치 다리, 로컬 X 방향으로 걸침, 난간 | – |
| castle | size 12, towers 4 | 중앙 성채 + 모서리 원통 탑(라벤더 원뿔 지붕) + 톱니 성벽 + 아치 성문 + 깃발 | 깃발 흔들림 |
| cottage | width 3.2, depth 2.6, roof 'roof'\|'roofAlt' | 크림 벽, 박공지붕(기와 줄), 굴뚝, 둥근 창, 문 | – |
| mushroom | height 3 | 버섯집: 줄기 + 빨간 갓 + 흰 점 + 문·창 | – |
| windmill | height 6, speed 0.25 (회전/초) | 원통 탑 + 원뿔 지붕 + 날개 4개(+Z 쪽) | 날개 회전 = t·speed |
| fairytree | kind 'puffy'\|'conifer', height 3.5, variant | 몽글한 덩어리 나무 / 원뿔 3단 침엽수 | – |
| flowers | radius 1.5, count 24, variant | 꽃밭(색 accent/accent2/accent3/trim) | – |
| field | width 6, depth 4, rows 5 | 밀밭 줄 | – |
| fence | points (절대) | 나무 기둥 1m 간격 + 가로대 2줄 | – |
| cloud | size 4, variant | 흰 덩어리 구름 (그림자 안 드리움) | 천천히 위아래 |

움직임은 update(t)의 결정적 함수(시간만의 함수). 이동은 기존 tracks/follow.

## 5. 앵커

`bridgeOn(points, i)` (kit/anchors.ts, 순수): 제어점 i(1..n-2)에서 강을 가로지르는 다리 배치 `{ at:[x,0,z], rotation:[0,yaw,0] }`. 다리의 로컬 X가 그 점의 강 법선(앞뒤 점 차이의 오른쪽)과 일치. i가 범위 밖이면 오류.
흙길·울타리를 강가에 놓을 때는 기존 `lane` 사용.

## 6. 스토리보드

- `kit/modules/fairytale/vocab.json`: 16종 구문, avoid = people, animals, text, logos, cars, modern buildings.
- camera 값에 `"diorama"` 추가: `Perspective miniature diorama view from a high three-quarter angle, the whole scene reads like a small handcrafted model, gentle tilt-shift depth of field.`
- 경고: camera iso인데 ortho 아님 → 기존 경고, camera diorama인데 ortho → 경고.

## 7. 벤치마크 `D:\omnivoice\scenes\06-fairytale-tour`

1920×1080, 25초, perspective, pastel. s1 배치: 뒤쪽 plateau 위 castle, plateau에서 흘러내리는 river가 섬을 가로질러 앞 가장자리 waterfall로, 중간 bridge, 왼쪽 마을(cottage·mushroom·fence·flowers), 오른쪽 windmill + field, fairytree·rock 다수, 섬 둘레 cloud.
샷 = 스토리보드 at(2.5/8/13/18/22.5) 중심, 카메라는 path/orbit 계열. compare → preview → final.

## 8. 검증

- 단위: pastel 스타일(모든 role·하늘), 새 role이 모든 스타일에 존재, parts(blob 결정성·바닥 원점·NaN 없음, prism·arch 크기), 16종 요소(기본 생성·원점 규약·dispose·update 결정성·잘못된 params 오류), bridgeOn(법선 일치·범위 오류), vocab 동기화(기존 테스트가 fairytale 포함 자동 검사), storyboard diorama 모드·경고.
- e2e: fairytale 장면 check + still 골든.
- 버전 0.3.0.
