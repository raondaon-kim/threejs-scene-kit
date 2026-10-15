# line

| param | 타입 | 기본 | 설명 |
|---|---|---|---|
| points | [x, y, z] 배열 (필수, 2개 이상) | – | 지나는 점. **요소 위치 기준 상대 좌표**. 부드러운 곡선으로 이음 |
| radius | m | 0.06 | 튜브 두께 |
| role | accent, accent2, accent3, neutral, label | accent | 색 |

`anim: 'grow'`면 첫 점에서 마지막 점 방향으로 그려진다. 성장 곡선, 경로, 흐름 표현에 쓴다.

```ts
{ id: 'curve', type: 'line', at: [0, 1, 3], params: { points: [[-3, 0, 0], [-1, 1, 0], [1, 3, 0], [3, 5.5, 0]] },
  enter: { t: 9, anim: 'grow', dur: 2 } }
```
