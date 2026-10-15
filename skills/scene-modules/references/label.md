# label

| param | 타입 | 기본 | 설명 |
|---|---|---|---|
| text | 문자열 (필수) | – | `\n`으로 줄바꿈. 한글 지원(시스템 폰트 Malgun Gothic 우선) |
| size | m | 1 | 한 줄의 높이 |
| background | boolean | false | true면 neutral 색 둥근 배경판 |
| billboard | boolean | true | 항상 카메라를 향함. false면 rotation을 따름 |
| role | accent, accent2, accent3, neutral, label | label | 글자 색 |

라벨은 안개 영향을 받지 않고 항상 위에 그려진다.
너비는 글자 수에 비례한다. 대략 한 줄 너비 ≈ size × 글자 수 × 0.95.

```ts
{ id: 'title', type: 'label', at: [0, 10, 0], params: { text: '빛은 어떻게\n에너지가 될까?', size: 1.8, background: true },
  enter: { t: 0.5, anim: 'rise' }, exit: { t: 3.6, anim: 'fade' } }
```
