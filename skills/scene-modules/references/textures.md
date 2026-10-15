# 표면 질감 · 배경 (p5.js)

질감은 **회색조 디테일**이라 색은 스타일 팔레트 그대로, 명암 결만 더한다. 형상에 UV가 없어도 월드 좌표로 투영되어 바로 입혀진다.
견본은 `node "${CLAUDE_PLUGIN_ROOT}/scripts/swatch.mjs" --project <폴더>` → `out/swatch.png` 한 장을 Read해서 고른다.

## 내장 텍스처

| 이름 | 기본 tile(m) | 어울리는 role |
|---|---|---|
| grass-brush | 4 | ground (잔디 붓터치) |
| rock-grain | 3 | rock, neutral (바위 결·금) |
| roof-tiles | 1.2 | roof, roofAlt (기와 줄) |
| soil-pebbles | 2.5 | road (흙길·자갈) |
| water-ripple | 5 | water (물결, flow로 흐름) |
| wood-grain | 1.5 | wood, trunk (나뭇결) |
| paper | 6 | body, bodyLight (벽의 은은한 손맛) |

- 스타일 기본값: `pastel`만 질감이 켜져 있다(ground grass-brush, rock rock-grain, roof·roofAlt roof-tiles, road soil-pebbles, water water-ripple 흐름, wood wood-grain, body·bodyLight paper, 세기 0.35). clay·stylized·minimal은 기본 없음.

## look (장면 단위, 선택)

```ts
look: {
  strength: 0.5,                                   // 0~1 전체 세기
  surfaces: {
    ground: 'grass-brush',                         // role → 텍스처 이름
    roof: 'none',                                  // 끄기
    water: { texture: 'water-ripple', tile: 4, strength: 0.6, flow: [0, 0.3] },  // 상세 (flow: m/s, 윗면에만)
  },
},
```

- 우선순위: 개별 strength > `look.strength` > 스타일 기본 > 0.35. tile은 지정값 > 텍스처 기본.
- role은 메시 이름이다(키트 요소는 부품을 role별로 합쳐 그 이름을 붙인다). 개념 요소처럼 role 이름이 없는 메시는 질감이 적용되지 않는다.

## 배경: 메쉬 그라디언트 (environment.background)

```ts
environment: { sky: { preset: 'day' }, background: { kind: 'meshGradient', preset: 'sunset', sun: true } }
environment: { background: { kind: 'meshGradient', colors: ['#a9b8ee', '#f6c9d6', '#ffd2b0'] } }
```

| 필드 | 값 |
|---|---|
| kind | `'meshGradient'` |
| preset | `'dawn'` \| `'day'` \| `'dusk'` \| `'sunset'` (스타일 하늘색 사용, 없으면 sky.preset) |
| colors | `#rrggbb` 2~6개 (위→아래 순서로 배치, preset보다 우선) |
| sun | 왼쪽 위 해와 번짐 |
| seed | 덩어리 배치 시드 (정수, 기본 meta.seed) |

화면 배경이라 카메라가 아래를 내려다봐도 그라데이션이 보인다. 배경이 있으면 구형 하늘은 그리지 않는다.

## 커스텀 텍스처

scene-custom 스킬의 "커스텀 텍스처" 절: `custom/textures/<이름>.ts`에서 `defineTexture` → `scene.ts`의 `customTextures: [...]` → look.surfaces에서 이름으로 사용.
