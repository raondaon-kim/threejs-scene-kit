# 물류·도시 키트

공통: 원점은 **바닥 중심**, 단위 m, 차량은 **+Z가 앞**. `at`으로 위치, `rotation`(도)으로 방향.
clay 스타일에서 movie2풍 클레이 룩. 다른 스타일에서도 동작한다(역할 색이 바뀜).

## warehouse — 창고
| param | 기본 | 설명 |
|---|---|---|
| width, depth, height | 24, 14, 7 | 크기 (m) |
| docks | 4 | 앞면(+Z) 도크 수. 도크 x 위치 = −0.36w + i·0.72w/(docks−1) (중심 대칭, 1개면 0) |
| skylights | 3 | 지붕 채광창 수 |
| ribs | true | 벽 세로 패널 리브 |
도크 위치·트럭 정차·후진 경로는 아래 **앵커** 헬퍼로 얻는다 (공식: 도크 x = −0.36w + i·0.72w/(docks−1), 트럭 z = depth/2 + length/2 + 0.7).

## truck — 트럭 (animatable: travel)
| param | 기본 | 설명 |
|---|---|---|
| kind | box | box(높은 화물칸) · van(낮은 화물칸) |
| length | 9 | 전체 길이 (5 이상) |
`follow`가 있으면 바퀴가 이동 거리만큼 굴러간다. 후진은 `rotation: [0,180,0]` + 도크 쪽 경로.

## forklift — 지게차 (animatable: lift, travel)
| param | 기본 | 설명 |
|---|---|---|
| lift | 0 | 포크 높이 0~1 (`tracks: {'param.lift': …}`로 애니메이션) |
| load | true | 포크에 팔레트+상자 적재 |

## pallet — 팔레트
| param | 기본 | 설명 |
|---|---|---|
| cargo | boxes | boxes(종이상자) · crates(파란 상자) · none |
| rows, cols, layers | 2, 2, 2 | 적재 칸 수 |
크기 1.2 × 1.0 m. 쌓으려면 at.y를 올린다.

## container — 해운 컨테이너
| param | 기본 | 설명 |
|---|---|---|
| length | 12 | 6 또는 12 (길이 방향 Z). 높이 2.6 → 2단 적재는 at.y = 2.62 |

## road — 도로
| param | 기본 | 설명 |
|---|---|---|
| points | (필수) | [[x,z], …] 2개 이상, **절대 좌표**(at 쓰지 않음). 부드러운 곡선으로 이음 |
| width | 6 | 폭 |
| dashes | true | 중앙 점선 |
도로 위 차량 경로는 `lane(같은 points, 1.6)` (앵커 섹션).

## lot — 마당·주차장
| param | 기본 | 설명 |
|---|---|---|
| width, depth | 20, 12 | 크기 |
| stalls | 0 | 주차선 개수 |
| role | road | 바닥 색 역할 (clay 마당은 neutral 권장) |

## tree — 나무
| param | 기본 | 설명 |
|---|---|---|
| kind | round | round(막대사탕) · cone(침엽수) |
| height | 3 | 높이 |
| pad | true | 둥근 화단 |

## pin — 지도 핀
| param | 기본 | 설명 |
|---|---|---|
| size | 1.6 | 높이 |
| bob | true | 위아래로 흔들림 |
항상 카메라 쪽을 향한다. `enter: { anim: 'pop' }`과 잘 어울린다.

## building — 사무 건물
| param | 기본 | 설명 |
|---|---|---|
| width, depth | 10, 10 | 크기 |
| floors | 4 | 층수 (층당 3.2m), 층마다 창 띠 |

## 앵커 (좌표 손계산 금지)

도크·트럭·차선 좌표는 직접 계산하지 말고 `kit/anchors`의 헬퍼로 얻는다. 결과는 숫자 배열이라 scene 데이터에 그대로 넣는다.

```ts
import { warehouseAnchors, lane, type XZ } from './kit/anchors';
import type { ElementDef, Vec3 } from './kit/runtime/types';

const els: ElementDef[] = [];                       // defineScene({ …, elements: els })
const add = (e: ElementDef) => els.push(e);

const WH = { at: [0, 0, 0] as Vec3, rotation: 0, width: 30, depth: 16, docks: 4 };
const wh = warehouseAnchors(WH);
add({ id: 'wh', type: 'warehouse', at: WH.at, rotation: [0, WH.rotation, 0],
  params: { width: WH.width, depth: WH.depth, docks: WH.docks } });
add({ id: 'truck-a', type: 'truck', ...wh.truck(1, { length: 9 }), params: { length: 9 } });  // 도크 1 정차
const b = wh.backIn(2, { length: 9, from: 13 });                                              // 도크 2 후진 진입
add({ id: 'truck-in', type: 'truck', at: b.at, rotation: b.rotation, params: { length: 9 },
  follow: { path: b.path, t0: 5, t1: 9 } });

const FRONT: XZ[] = [[-60, 28], [10, 28], [38, 26], [46, 14], [47, -40]];
add({ id: 'road', type: 'road', params: { points: FRONT, width: 7 } });
add({ id: 'truck-go', type: 'truck', follow: { path: lane(FRONT, 1.6), t0: 0, t1: 20 } });                    // 진행 방향 오른쪽 차선
add({ id: 'truck-back', type: 'truck', follow: { path: lane(FRONT, 1.6, { reverse: true }), t0: 0, t1: 20 } }); // 반대 방향
```

| 헬퍼 | 결과 |
|---|---|
| `wh.dock(i)` | 도크 i 문 중앙 바닥 [x, y, z] |
| `wh.truck(i, { length })` | `{ at, rotation }` 도크 앞 정차(뒷면이 노란 범퍼 바로 앞, 앞이 바깥) |
| `wh.backIn(i, { length, from })` | `{ at, rotation: [0,180,0], path }` 앞쪽 from m(기본 13)에서 정차 위치까지 |
| `lane(points, offset, { reverse })` | 진행 방향 오른쪽으로 offset m 평행 이동한 경로 (음수 = 왼쪽) |

- `warehouseAnchors`에는 warehouse 요소와 **같은** at·rotation(yaw, 도)·width·depth·docks를 넘긴다(상수 하나로 공유).
- 도크 인덱스는 0..docks−1. 범위를 벗어나면 check에서 오류로 보인다.

## 예시 (지게차 리프트)

```ts
{ id: 'fork', type: 'forklift', params: { load: true },
  follow: { path: [[-14, 22], [-10, 20], [-7.6, 16.6]], t0: 6, t1: 10.6 },
  tracks: { 'param.lift': [[10.6, 0], [12.2, 0.75]] } },
```
