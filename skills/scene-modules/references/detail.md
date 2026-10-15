# 디테일: grass · scatter

어느 키트와도 함께 쓰는 형상 디테일과 배치 헬퍼.

## grass — 인스턴싱 풀포기

```ts
add({ id: 'grass', type: 'grass', params: { radius: 32, count: 14000, height: 0.32, avoid: [RIVER, ...PATHS], avoidWidth: 4.6 } });
```

| param | 기본 | 설명 |
|---|---|---|
| center | [0, 0] | 원 중심 [x, z], **절대 좌표** (`at`·rotation을 주면 avoid 좌표까지 함께 움직이므로 주지 않는다) |
| radius | 10 | 원 반지름(m) |
| count | 1500 | 풀포기 수, **최대 20000** (avoid 때문에 덜 놓일 수 있음) |
| height | 0.35 | 풀포기 높이(m) |
| avoid | 없음 | 비울 선들 `[[x, z], …][]` (강·길 points를 그대로) |
| avoidWidth | 2 | 선 폭(m): 선에서 avoidWidth/2 안에는 심지 않음 (잎 끝은 최대 약 0.1m 들어올 수 있으니 길 폭보다 약간 넓게) |
| role | 'ground' | 색 역할 (기본은 잔디 바닥과 같은 색이라 자연스럽게 섞임) |
| variant | 0 | 배치 시드 |

- 높이 y = 0에만 심는다(높은 단 위에는 생기지 않음). 그림자를 드리우지 않는다.
- 비용: 14000개에서 렌더 시간 증가는 작다(프레임당 수 ms).

## scatter — 흩뿌리기 배치 헬퍼

```ts
import { scatter } from './kit/layout';

els.push(...scatter({ type: 'fairytree', count: 80, radius: 28, seed: 6, minDist: 2.4,
  avoid: [RIVER, ...PATHS], avoidWidth: 6, idPrefix: 'bush',
  params: (i, rnd) => ({ kind: 'puffy', height: 1.4 + rnd() * 0.8 }) }));
```

| 옵션 | 기본 | 설명 |
|---|---|---|
| type | (필수) | 흩뿌릴 요소 type |
| count | (필수) | 최대 개수 0~5000 (minDist·avoid 때문에 덜 놓일 수 있음) |
| center | [0, 0] | 원 중심 [x, z] (절대 좌표) |
| radius | (필수) | 원 반지름(m) |
| seed | (필수) | 정수. 같은 옵션·seed면 같은 배치 |
| minDist | 0 | 서로 최소 거리(m) |
| avoid / avoidWidth | 없음 / 2 | grass와 같음 |
| params | {} | 공통 객체 또는 `(i, rnd) => 객체`. `variant: i`가 자동으로 들어감(명시하면 그 값) |
| idPrefix | type | id = `<idPrefix>-<i>`. **같은 type으로 두 번 부를 땐 idPrefix를 다르게**(id 중복·같은 배치 방지) |
| y | 0 | 높이(at.y). 높은 단 위에 흩뿌릴 땐 그 height |
| rotate | true | 무작위 Y 회전 |

- 결과는 `ElementDef[]`라 `elements`에 펼쳐 넣는다. 결과를 `.filter(…)`로 더 거를 수 있다.
