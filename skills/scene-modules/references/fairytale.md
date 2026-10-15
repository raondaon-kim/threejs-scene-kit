# 동화 키트 (pastel 디오라마)

`style: 'pastel'` + 원근 카메라와 함께 쓰는 동화 디오라마. 공통: 원점은 **바닥 중심**, 단위 m, **섬 윗면 y = 0**.
같은 `variant`(정수)면 모양이 같고, 바꾸면 다른 모양 (바위·나무·꽃·구름·섬).
배경은 하늘이므로 `environment: { sky: { preset: 'day' } }`만 두고 ground는 쓰지 않는다.

## 지형

| type | params (기본) | 설명 |
|---|---|---|
| island | radius 30, depth 12, floaters 6, variant | 떠 있는 섬: 잔디 윗면(y=0) + 바위 절벽 + 아래로 좁아지는 밑면 + 떠 있는 작은 바위(흔들림) |
| plateau | radius 9, height 5, variant | 높은 단. **윗면 높이 = height** → 위에 놓는 요소는 `at.y = height` |
| rock | size 1.5, variant | 둥근 바위 |
| river | points [[x,z]…] (절대), width 3 | 물 리본 + 모래 둑 + 가장자리 돌 |
| waterfall | height 10, width 3 | **원점 = 위 가장자리**, 아래로 늘어지고 +Z 쪽으로 휘어 떨어진다. 섬 가장자리에 두고 rotation으로 바깥을 향하게 |
| path | points (절대), width 1.6 | 흙길 |

## 건물 (+Z가 앞)

| type | params (기본) | 설명 |
|---|---|---|
| castle | size 12, towers 4 | 성채 + 원통 탑(라벤더 원뿔 지붕) + 톱니 성벽 + 아치 성문(+Z) + 깃발(흔들림) |
| cottage | width 3.2, depth 2.6, roof 'roof'\|'roofAlt' | 크림 벽, 박공지붕(복숭아 / 라벤더), 굴뚝, 둥근 창, 문 |
| mushroom | height 3, variant | 빨간 갓 + 흰 점 버섯집 |
| windmill | height 6, speed 0.25 (회전/초) | 풍차, 날개는 시간에 따라 회전 |
| bridge | span 7, width 2.4 | 돌 아치 다리, **로컬 X 방향으로 걸침** → `bridgeOn`으로 배치 |

## 자연

| type | params (기본) | 설명 |
|---|---|---|
| fairytree | kind 'puffy'\|'conifer', height 3.5, variant | 몽글한 나무 / 침엽수 |
| flowers | radius 1.5, count 24, variant | 꽃밭 |
| field | width 6, depth 4, rows 5 | 밀밭 |
| fence | points (절대) | 나무 울타리 (점을 직선으로 이음) |
| cloud | size 4, variant | 구름 (그림자 없음, 천천히 위아래) |

## 앵커

```ts
import { bridgeOn, islandEdge, lane, type XZ } from './kit/anchors';

const FALL = islandEdge(30, 90);                                                          // 섬 앞 가장자리 바깥
const RIVER: XZ[] = [[-4, -12], [-2, -4], [2, 4], [1, 14], [FALL.at[0], FALL.at[2]]];
add({ id: 'fall', type: 'waterfall', ...FALL, params: { height: 14 } });
add({ id: 'river', type: 'river', params: { points: RIVER, width: 3 } });
add({ id: 'bridge', type: 'bridge', ...bridgeOn(RIVER, 2), params: { span: 5 } });      // 점 2에서 강을 가로지름
add({ id: 'bank-path', type: 'path', params: { points: lane(RIVER, 3.5) } });            // 강 오른쪽 둑길
add({ id: 'castle', type: 'castle', at: [0, 5, -18] });                                  // plateau(height 5) 위
```

- `bridgeOn(points, i)`: i는 1..n−2 (양 끝 점 불가). 결과 `{ at, rotation }`.
- 높은 단 위: `at.y = plateau의 height`.
- 폭포: **`islandEdge(radius, angleDeg)`** 로 절벽 바위 바깥 지점을 얻어 강 끝점과 `waterfall`을 같은 곳에 둔다(바깥을 향하는 rotation 포함). 반지름 근처에 직접 두면 튀어나온 절벽 바위에 묻힌다. angleDeg: 0 = +X, 90 = +Z(카메라 정면).
- 높은 단의 절벽 바위는 radius + 약 1.5m까지 나온다 → 주변 건물은 그보다 바깥에.

## 구도 (원근 디오라마)

- fov 35~40, 섬 전체: 섬 중심에서 거리 ≈ radius × 2.6, 높이 ≈ radius × 1.4.
- 근접: 대상에서 거리 10~18, 높이 6~10. `move: 'path'`로 섬을 돌거나 내려오며 이어 찍는다.
