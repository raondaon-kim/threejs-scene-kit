# bars

| param | 타입 | 기본 | 설명 |
|---|---|---|---|
| values | 숫자 배열 (필수) | – | 막대 값. 최댓값이 maxHeight가 됨. 음수는 절댓값으로 표시 |
| labels | 문자열 배열 | 없음 | 막대 아래 라벨. values와 길이가 같아야 함 |
| maxHeight | m | 5 | 가장 큰 막대 높이 |
| width | m | 1 | 막대 폭 |
| gap | m | 0.4 | 막대 간격 |
| roles | role 배열 | [accent, accent2, accent3] | 막대 색 순환 |

원점은 그래프 바닥 중앙. 전체 폭 = n × width + (n−1) × gap.
`anim: 'grow'`면 왼쪽부터 차례로 자란다.

```ts
{ id: 'chart', type: 'bars', at: [0, 0.6, 2], params: { values: [2, 5, 8], labels: ['아침', '정오', '오후'] },
  enter: { t: 8.3, anim: 'grow', dur: 1.4 } }
```
