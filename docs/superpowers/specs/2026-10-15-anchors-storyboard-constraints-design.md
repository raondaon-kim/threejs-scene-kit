# 앵커 헬퍼 + 스토리보드 제약 — 설계 (v0.2.1)

## 0. 목적

다음 영상 제작에서 스토리보드 비교 라운드를 4회 → 1~2회로 줄인다.

- 05-logistics-hub 비교 라운드의 상당 부분은 키트로 만들 수 없는 목표(승용차·원경 마을·원근 저각 카메라)를 쫓는 데 쓰였다 → **A-1 스토리보드 제약**.
- 도크 좌표·트럭 정지 z·차선 오프셋을 손으로 계산하다 v0.2 최종 리뷰의 도크 비대칭 버그가 생겼다 → **A-2 앵커 헬퍼**.

범위 밖: scene 데이터의 문자열 앵커(`at: 'wh.dock[2]'`), scatter 헬퍼, warehouse 외 요소의 앵커.

## 1. A-1 스토리보드 제약 (`scripts/storyboard.mjs`)

### 1.1 storyboard.json 필드 (선택)

| 필드 | 값 | 기본 | 의미 |
|---|---|---|---|
| vocab | `"kit"` \| `"free"` | `"kit"` | kit: 키트 목록 문장과 금지 문장을 프롬프트에 넣음 |
| camera | `"iso"` \| `"free"` | `"iso"` | iso: 고정 아이소메트릭 카메라 문장을 넣음 |

샷 단위로도 같은 필드(`shots[].vocab`, `shots[].camera`)를 둘 수 있고, 샷 값이 우선한다.
허용값 외의 값은 `loadStoryboard`가 ScriptError(`path: vocab` 또는 `shots[i].camera` 등)로 거부한다.

### 1.2 프롬프트 조립 순서

```
<저장 지시>            (기존)
Style: <style>         (기존)
Camera: <CAMERA_ISO>   (camera = iso일 때)
Objects: <VOCAB 문장>  (vocab = kit일 때)
Content: <prompt>      (기존)
<응답 지시>            (기존)
```

- `CAMERA_ISO` = `Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.`
  (scene의 아이소 방향 `target + [45, 67, 78]`: 방위 atan2(45,78)=30°, 고도 atan2(67, hypot(45,78))≈37°.)
- VOCAB 문장 = `Only depict objects from this list: <구문들을 ", "로 이음>. Do not include: cars, people, text, logos, distant towns, water, bridges.`

### 1.3 `scripts/lib/kit-vocab.mjs`

```js
export const KIT_VOCAB = {
  warehouse: 'a warehouse with loading docks',
  truck: 'box trucks and vans',
  forklift: 'yellow forklifts',
  pallet: 'pallets with cardboard boxes or blue crates',
  container: 'shipping containers',
  road: 'roads with a dashed center line',
  lot: 'paved lots',
  tree: 'round lollipop trees and cone trees',
  pin: 'blue map pins',
  building: 'simple office buildings',
};
export const FORBIDDEN = 'cars, people, text, logos, distant towns, water, bridges';
export function vocabSentence() { ... }
```

동기화 테스트: `LOGISTICS_ELEMENTS`의 모든 type에 KIT_VOCAB 항목이 있어야 한다 (키트가 늘면 실패로 알림).

## 2. A-2 앵커 헬퍼 (`kit/anchors.ts`)

순수 함수. three.js에 의존하지 않는다. scene.ts에서 `import { warehouseAnchors, lane } from './kit/anchors'`.
결과는 숫자 배열이므로 scene 스키마·validate·world는 바뀌지 않는다.

### 2.1 `warehouseAnchors(opts)`

```ts
interface WarehouseAnchorOpts { at?: Vec3; rotation?: number /* yaw, 도 */; width?: number; depth?: number; docks?: number }
interface Placement { at: Vec3; rotation: Vec3 }
interface BackIn extends Placement { path: Array<[number, number]> }
function warehouseAnchors(o): {
  dock(i: number): Vec3;                                            // 도크 문 중앙 바닥
  truck(i: number, o?: { length?: number }): Placement;             // 도크 앞 정차, 앞이 바깥(+Z 로컬)
  backIn(i: number, o?: { length?: number; from?: number }): BackIn; // 후진 진입
}
```

- 기본값은 warehouse 요소와 동일: width 24, depth 14, docks 4, at [0,0,0], rotation 0. truck length 9, backIn from 13.
- 로컬 좌표: dock(i) = (dockPositions(w, docks)[i], 0, d/2). truck z = d/2 + length/2 + 0.7.
- 월드 변환: 로컬 (x, z)를 yaw만큼 Y축 회전(three.js 규약: x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ) 후 at을 더한다.
- truck.rotation = [0, yaw, 0]. backIn.rotation = [0, 180, 0] (follow가 진행 방향 yaw를 더하므로 창고 회전과 무관).
- backIn.path = [로컬 (x, zTruck + from) → (x, zTruck)]의 월드 변환. backIn.at = 정차 위치.
- 오류: i가 0..docks−1 정수가 아니거나 숫자 파라미터가 유한하지 않으면 `Error('warehouseAnchors: dock 인덱스 i는 0..N-1')` 형식으로 throw.
- `dockPositions`는 `kit/modules/logistics/warehouse.ts`의 것을 그대로 import (공식 단일화).

### 2.2 `lane(points, offset, opts?)`

```ts
function lane(points: Array<[number, number]>, offset: number, opts?: { reverse?: boolean }): Array<[number, number]>
```

- reverse면 points를 뒤집은 뒤 처리 (반대 방향 차량).
- 진행 방향 (fx, fz)의 오른쪽 = (−fz, fx). 양수 offset = 오른쪽.
- 끝점: 인접 구간 방향의 오른쪽. 내부 점: 앞뒤 구간 단위 방향의 이등분 법선, 길이 offset / cos(반각), 배율 상한 2.
- 연속 중복점은 먼저 제거. 남은 점이 2개 미만이면 throw. 결과에 NaN 없음.

## 3. 문서

- `skills/scene-direct/references/storyboard.md`: 자동 제약 설명, vocab/camera 필드, free로 끄기.
- `skills/scene-modules/references/logistics.md`: "앵커" 섹션(예시 포함), 예시 코드를 앵커 기준으로.
- `skills/scene-direct/SKILL.md`: 연출표 "도크로 후진" → `wh.backIn`, "도로를 따라" → `lane`.
- `skills/scene-modules/SKILL.md`: 앵커 한 줄.
- `template/storyboard.example.json`: 변경 없음(기본값으로 동작).

## 4. 검증

- 단위: anchors(도크 = 실제 warehouse 메시의 도크 프레임 중심, 회전 90°, truck z, backIn 경로·회전, 잘못된 인덱스), lane(직선 오프셋, 90° 꺾임 거리 유지, reverse, 중복점, 2점, NaN 없음), kit-vocab 동기화.
- 스크립트: fake codex로 log.json의 prompt에 Camera/Objects 줄 포함, free로 각각 빠짐, 잘못된 값 거부.
- 회귀: 05-logistics-hub scene.ts를 앵커로 재작성 → 도크·트럭은 기존 최종 프레임과 meanDiff ≈ 0 수준(차선은 손값과 다를 수 있음 → compare로 육안 확인) → preview/final 재렌더.
