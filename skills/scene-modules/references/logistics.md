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
도크 앞에 트럭을 대려면 트럭 `at = [도크x, 0, depth/2 + length/2 − 0.3]`.
예: width 30, docks 4 → 도크 x = −10.8, −3.6, 3.6, 10.8. depth 16, 트럭 길이 9 → z = 12.2.

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
도로 위 차량은 같은 점에서 차선만큼(±1.6m) 옮긴 `follow.path`를 쓴다.

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

## 예시 (창고 30×16, 도크 3번으로 후진 + 지게차 리프트)

```ts
{ id: 'wh', type: 'warehouse', at: [0, 0, 0], params: { width: 30, depth: 16, docks: 4 } },
{ id: 'truck-in', type: 'truck', at: [3.6, 0, 12.2], rotation: [0, 180, 0],
  follow: { path: [[3.6, 26], [3.6, 12.2]], t0: 5, t1: 9 } },
{ id: 'fork', type: 'forklift', params: { load: true },
  follow: { path: [[-14, 22], [-10, 20], [-7.6, 16.6]], t0: 6, t1: 10.6 },
  tracks: { 'param.lift': [[10.6, 0], [12.2, 0.75]] } },
```
