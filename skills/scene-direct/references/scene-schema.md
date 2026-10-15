# scene.ts 형식

```ts
import { defineScene } from './kit/runtime/scene';
export default defineScene({ meta, style, environment?, elements?, shots, custom? });
```

## 시간 모델

- 모든 값은 **절대시간 t(초)** 기준이다. 프레임 i의 시간은 `t = i / fps`, 프레임 수는 `round(duration × fps)`.
- 어떤 시점이든 독립적으로 계산된다(이전 프레임에 의존하지 않음). 같은 scene.ts는 항상 같은 영상이 된다.

## meta (필수)

| 필드 | 타입 | 설명 |
|---|---|---|
| width, height | 짝수 정수 | 출력 해상도. 쇼츠 1080×1920, 가로 1920×1080 |
| fps | 숫자 | 보통 30 |
| duration | 초 | 영상 길이. 마지막 샷의 end와 같아야 함 |
| seed | 정수 | 지형·나무 배치의 시드. 바꾸면 다른 풍경 |

## style (필수)

`'stylized'`(툰 셰이딩, 따뜻한 색) 또는 `'minimal'`(중립색, 부드러운 조명). 같은 장면을 스타일만 바꿔 렌더할 수 있다.

## environment (선택)

| 필드 | 기본값 | 설명 |
|---|---|---|
| sky.preset | `'day'` | dawn, day, dusk, night |
| terrain | 없음 | 있으면 지형 생성. `{ size: 200, height: 10, roughness: 0.5, flatRadius: 15 }` |
| trees | 없음 | `{ count: 250, area: 160, avoidCenter: 18 }`. 지형 높이에 맞춰 배치 |
| water | 없음 | `{ level: -1, size: 지형 크기 }`. 물결은 시간에 따라 움직임 |

environment를 통째로 생략하면 하늘만 있는 빈 무대가 된다.

## elements (선택)

| 필드 | 설명 |
|---|---|
| id | 고유 문자열 |
| type | shape, label, arrow, bars, line, 또는 custom에 등록한 type |
| at | `[x, y, z]` 위치(m). 기본 [0,0,0] |
| rotation | `[x, y, z]` 회전(도) |
| scale | 배율 |
| params | 요소별 설정 (scene-modules 스킬). `role`로 색 역할 지정: accent, accent2, accent3, neutral, label |
| enter | `{ t, anim, dur? }` 등장. 없으면 처음부터 보임 |
| exit | `{ t, anim, dur? }` 퇴장. 없으면 끝까지 보임 |
| tracks | 속성 키프레임 |

### 애니메이션 (enter/exit의 anim)

| anim | 효과 |
|---|---|
| none | 즉시 |
| fade | 투명도 |
| pop | 튀어나오듯 확대 |
| rise | 아래에서 1.5m 떠오르며 나타남 |
| grow | 그려지듯 자람 (arrow, bars, line만) |

`dur` 기본값 0.6초. exit는 같은 효과를 거꾸로 적용한다.

### tracks

`{ '경로': [[t, 값], ...] }`. 키프레임 사이는 부드럽게(smoothstep) 보간하고, 구간 밖은 끝값을 유지한다.

| 경로 | 의미 |
|---|---|
| position.x / .y / .z | 절대 위치(at 대신) |
| rotation.x / .y / .z | 절대 회전(도) |
| scale | 절대 배율 |
| opacity | 투명도 배율(등장 효과와 곱함) |

## shots (필수)

`{ id, start, end, camera }`. 첫 샷은 0에서 시작하고, 각 샷은 이전 샷 end에서 이어지며, 마지막 end = duration. 샷 경계는 컷 전환.

| move | 필드 | 기본 이징 |
|---|---|---|
| static | pos, target | – |
| dolly | from, to, target, targetTo? | inOut |
| crane | from, to, target, targetTo? | out |
| orbit | center, radius, height, fromDeg, toDeg | inOut |

공통: `ease`(linear, in, out, inOut), `fov`(기본 40, 10~120).
orbit 각도 0도는 +z 방향(정면), 90도는 +x 방향.

## custom (선택)

`defineElement`로 만든 요소 정의 배열. scene-custom 스킬 참고.
