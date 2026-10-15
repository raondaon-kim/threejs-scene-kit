---
name: scene-custom
description: threejs-scene-kit의 내장 요소(shape, label, arrow, bars, line)와 scene.ts 데이터로 표현할 수 없는 연출이 필요할 때만 사용. custom/ 폴더에 규약을 따르는 요소를 작성하고 scene.ts의 custom에 등록한다. 기존 요소의 params, tracks, 조합으로 가능한지 먼저 확인할 것.
---

# 커스텀 요소

## 먼저 확인

커스텀 요소는 토큰과 검증 비용이 크다. 아래로 안 되는지 먼저 본다.
- 여러 내장 요소 조합 (예: 원자 = sphere 여러 개 + tracks)
- `tracks`로 움직임 (위치, 회전, 크기, 투명도 키프레임)
- `params.role`, `style`, `sky.preset`으로 색과 분위기

## 규약 (반드시 지킬 것)

1. 파일은 `custom/<이름>.ts`, `defineElement`로 default export.
2. `create(ctx, params)`는 `{ object3d, update?, setProgress?, setOpacity?, dispose }`를 반환한다.
3. **상태는 절대시간 t의 순수함수.** `update(t)` 안에서 이전 값을 누적하지 않는다. 같은 t면 항상 같은 모습.
4. 난수는 `ctx.rng('이름')`만 쓴다. `Math.random`, `Date.now`, `performance.now` 금지.
5. 재질은 `ctx.style.material(role)`로 만든다(스타일 전환이 자동 반영됨). 새 인스턴스이므로 `dispose`에서 해제한다.
6. 만든 geometry, material, texture는 모두 `dispose`에서 해제한다.
7. `grow`를 지원하려면 `supportsGrow: true`와 `setProgress(p: 0..1)`를 구현한다.
8. 잘못된 params는 `throw new Error('type.params.x는 ...')`로 알린다(check가 경로와 함께 보고).

## 템플릿

```ts
// custom/spiral.ts
import * as THREE from 'three';
import { defineElement } from '../kit/runtime/element';

export default defineElement({
  type: 'spiral',
  supportsGrow: true,
  create(ctx, params) {
    const turns = typeof params.turns === 'number' ? params.turns : 3;
    const pts = Array.from({ length: 200 }, (_, i) => {
      const a = (i / 199) * turns * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 2, i * 0.03, Math.sin(a) * 2);
    });
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.08, 8, false);
    const mat = ctx.style.material('accent');
    const mesh = new THREE.Mesh(geo, mat);
    return {
      object3d: mesh,
      setProgress(p) { geo.setDrawRange(0, Math.round(p * 400) * 8 * 6); },
      update(t) { mesh.rotation.y = t * 0.5; },
      dispose() { geo.dispose(); mat.dispose(); },
    };
  },
});
```

## 등록과 검증

```ts
// scene.ts
import spiral from './custom/spiral';
export default defineScene({ ..., custom: [spiral],
  elements: [{ id: 's', type: 'spiral', params: { turns: 4 }, enter: { t: 1, anim: 'grow', dur: 2 } }] });
```

- type 이름이 내장 요소와 겹치면 check 오류.
- 작성 후 `check.mjs` → `still.mjs --sheet`로 확인. `path: console` 오류는 이 파일의 런타임 오류다.
- `kit/`은 수정하지 않는다. 쓸 만한 커스텀 요소는 플러그인에 테스트와 함께 추가하는 것을 사용자에게 제안한다.
