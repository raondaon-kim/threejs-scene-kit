# shape

| param | 타입 | 기본 | 설명 |
|---|---|---|---|
| kind | box, sphere, cylinder, cone, torus | box | 도형 종류. 그 외 값은 check 오류 |
| size | m | 1 | 지름 또는 한 변 길이 (torus는 바깥 지름) |
| role | accent, accent2, accent3, neutral, label | accent | 색 역할 |

원점은 도형 중심이다. 바닥에 놓으려면 `at`의 y를 size/2로 둔다.

```ts
{ id: 'sun', type: 'shape', at: [-2, 8, 0], params: { kind: 'sphere', size: 2, role: 'accent2' },
  enter: { t: 1, anim: 'pop' } }
```
