# arrow

| param | 타입 | 기본 | 설명 |
|---|---|---|---|
| to | [x, y, z] | [0, 2, 0] | 끝점. **요소 위치(at) 기준 상대 좌표**. [0,0,0]이면 오류 |
| thickness | m | 0.08 | 몸통 반지름. 머리는 이에 비례 |
| role | accent, accent2, accent3, neutral, label | accent | 색 |

`anim: 'grow'`면 시작점에서 끝점으로 그려지듯 자란다.
A 지점에서 B 지점으로 잇기: `at = A`, `to = B − A`.

```ts
{ id: 'ray', type: 'arrow', at: [-1.4, 7.4, -0.6], params: { to: [2.4, -5.2, 0.6], thickness: 0.1, role: 'accent2' },
  enter: { t: 4.8, anim: 'grow', dur: 1.2 } }
```
