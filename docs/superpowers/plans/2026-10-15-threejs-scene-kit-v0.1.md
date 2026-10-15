# threejs-scene-kit v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대화로 연출을 지시하면 장면 데이터(`scene.ts`)만 바꿔서 결정적인 3D 무음 MP4(기본 1080×1920)를 만드는 Claude Code 플러그인을 만든다.

**Architecture:** 플러그인 안에 검증된 TypeScript 코드(`kit/`)와 프로젝트 골격(`template/`)이 들어 있다. `init` 스크립트가 이 둘을 영상 프로젝트로 복사한다. 런타임(`buildWorld`)은 장면 데이터를 해석하고, 모든 상태를 절대시간 t의 순수함수로 계산한다. Node 스크립트는 프로젝트의 vite와 playwright를 빌려 쓴다. 이 스크립트들이 헤드리스 Chromium에서 `window.__KIT__` 브리지로 검증·스틸·프레임을 얻고, 프레임은 ffmpeg로 인코딩한다.

**Tech Stack:** three 0.186.1, TypeScript 5.9.3, vite 8.3.4, vitest 5.0.4, playwright 1.63.0 (캐시된 chromium-1243과 일치), ffmpeg 6 (시스템), Node 22.

**Spec:** `docs/superpowers/specs/2026-10-15-threejs-scene-kit-design.md`

## Global Constraints

- **런타임 결정성:** 런타임 코드(`kit/`)에서 `Math.random`, `Date.now`, `performance.now`를 사용하지 않는다. 예외는 미리보기 재생 루프(`timeline-ui.ts`)뿐이다.
- **시간 모델:** 모든 장면 상태는 절대시간 t(초)의 순수함수다. 프레임 i의 시간은 `t = i / fps`다.
- **좌표와 단위:** Y-up, 단위는 미터, 회전 값은 도(degree)다.
- **재질 소유권:** `Style.material(role)`은 호출할 때마다 새 인스턴스를 반환한다. 해제(dispose)는 호출자가 한다. 요소별 opacity가 서로 번지지 않게 하기 위해서다.
- **스크립트 출력:** stdout은 JSON 한 줄 `{"ok":true|false,...}`이고, 실패하면 exit 1과 `errors:[{path,message}]`를 낸다.
- **스크립트 의존성:** 스크립트는 Node 내장 모듈만 import한다. vite와 playwright는 `importFromProject`로 프로젝트의 node_modules에서 불러온다.
- **오류 메시지:** 사용자와 에이전트에게 보이는 오류 메시지는 한국어로 쓰고, `path: message` 형식을 따른다.
- **고정 버전:** 템플릿 의존성은 three 0.186.1, @types/three 0.186.0, vite 8.3.4, playwright 1.63.0으로 고정한다.

## Review Focus

1. **환경 없는 장면:** environment가 비어 있어도 하늘만 있는 장면이 렌더돼야 한다. → Task 7 테스트로 고정한다.
2. **시간 범위 밖 입력:** `renderAt`이나 `setTime`에 범위를 벗어난 t(음수, duration 초과)가 들어오면 clamp한 뒤 마지막 샷의 끝 포즈를 쓴다. → Task 2 `findShot` 테스트, Task 8 `clampT`
3. **커스텀 요소 이름 충돌:** 커스텀 요소의 type이 내장 요소와 겹치면 크래시 대신 이슈로 보고한다. → Task 6 registry 테스트, Task 8 boot
4. **fps로 나누어떨어지지 않는 duration:** 프레임 수는 `round(duration * fps)`로 정한다. → Task 10 render 계산과 E2E
5. **한글 여러 줄 라벨:** `\n`이 들어간 한글 라벨이 잘리지 않아야 한다. → Task 10 E2E 샘플 장면에 포함하고 스틸로 눈으로 확인한다.

---

## File Structure

```
.claude-plugin/plugin.json          플러그인 매니페스트 (Task 11)
package.json, tsconfig.json, vitest.config.ts, .gitignore   개발 환경 (Task 1)
kit/runtime/
  types.ts        장면/요소/카메라 타입과 허용값 상수 (Task 2)
  rng.ts          mulberry32, hashString, deriveSeed, rngFor, createNoise2D (Task 1)
  easing.ts       clamp01, lerp, lerp3, ease, easeOutBack, smoothstep (Task 1)
  timeline.ts     animMods, elementState, sampleTrack, findShot (Task 2)
  camera.ts       cameraPose (Task 2)
  validate.ts     validateScene (Task 3)
  style.ts        Style 인터페이스, createLights, FONT_STACK (Task 4)
  element.ts      defineElement (Task 6)
  scene.ts        defineScene (Task 6)
  registry.ts     BUILTIN_ELEMENTS, elementRegistry, typeInfo (Task 6)
  world.ts        buildWorld (Task 7)
kit/styles/  stylized.ts, minimal.ts, index.ts(getStyle) (Task 4)
kit/modules/environment/  sky.ts, heightfield.ts, terrain.ts, poisson.ts, trees.ts, water.ts (Task 5)
kit/modules/concept/      shape.ts, label.ts, arrow.ts, bars.ts, line.ts (Task 6)
kit/preview/  main.ts(boot), sheet.ts, timeline-ui.ts, ui.css (Task 8)
template/     index.html, package.json, vite.config.ts, tsconfig.json, scene.ts, .gitignore (Task 8)
scripts/lib/  args.mjs, output.mjs, paths.mjs, manifest.mjs, project.mjs, server.mjs, browser.mjs (Task 9, 10)
scripts/      init.mjs, update.mjs (Task 9), check.mjs, still.mjs, render.mjs (Task 10)
skills/       scene-direct/, scene-modules/, scene-custom/ (Task 11)
tests/unit/*.test.ts, tests/scripts/*.test.mjs, tests/e2e/run-e2e.mjs, tests/golden/ (각 Task)
```

---

### Task 1: 개발 환경 + 결정적 난수·이징

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `kit/runtime/rng.ts`, `kit/runtime/easing.ts`, `kit/runtime/types.ts`(Vec3만 먼저)
- Test: `tests/unit/rng.test.ts`, `tests/unit/easing.test.ts`

**Interfaces:**
- Produces:
  - `rng.ts`: `type Rng = () => number`, `hashString(s): number`, `mulberry32(seed): Rng`, `deriveSeed(seed, salt): number`, `rngFor(seed, salt): Rng`, `createNoise2D(rng): (x, y) => number`
  - `easing.ts`: `type EaseName`, `EASES`, `clamp01`, `lerp`, `lerp3(a: Vec3, b: Vec3, t): Vec3`, `ease(name, t)`, `easeOutBack(t)`, `smoothstep(t)`

- [ ] **Step 1: 개발 환경 파일 작성**

`package.json`
```json
{
  "name": "threejs-scene-kit-dev",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json",
    "e2e": "node tests/e2e/run-e2e.mjs"
  },
  "devDependencies": {
    "@types/three": "0.186.0",
    "pngjs": "7.0.0",
    "three": "0.186.1",
    "typescript": "5.9.3",
    "vite": "8.3.4",
    "vitest": "5.0.4"
  }
}
```

`tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["kit", "tests/unit"]
}
```

`vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/scripts/**/*.test.mjs'], environment: 'node', testTimeout: 60000 },
});
```

`.gitignore`
```
node_modules/
tests/.e2e/
*.log
```

Run: `npm install`
Expected: 설치가 완료되고 오류가 없다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/unit/rng.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, hashString, deriveSeed, rngFor, createNoise2D } from '../../kit/runtime/rng';

describe('rng', () => {
  it('같은 seed는 같은 수열', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('다른 salt는 다른 스트림', () => {
    expect(rngFor(1, 'trees')()).not.toBe(rngFor(1, 'terrain')());
    expect(deriveSeed(1, 'a')).toBe(deriveSeed(1, 'a'));
  });
  it('hashString은 FNV-1a 32bit', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
  });
  it('noise는 결정적이고 [-1,1] 근처 범위', () => {
    const n1 = createNoise2D(mulberry32(7)), n2 = createNoise2D(mulberry32(7));
    for (let i = 0; i < 50; i++) {
      const v = n1(i * 0.37, i * 0.11);
      expect(v).toBe(n2(i * 0.37, i * 0.11));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.01);
    }
  });
});
```

`tests/unit/easing.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { ease, clamp01, easeOutBack, smoothstep, lerp3 } from '../../kit/runtime/easing';

describe('easing', () => {
  it('끝점 보존', () => {
    for (const n of ['linear', 'in', 'out', 'inOut'] as const) {
      expect(ease(n, 0)).toBeCloseTo(0);
      expect(ease(n, 1)).toBeCloseTo(1);
    }
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
  });
  it('범위 밖 입력은 clamp', () => {
    expect(clamp01(-2)).toBe(0);
    expect(ease('inOut', 5)).toBe(1);
  });
  it('lerp3', () => {
    expect(lerp3([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run tests/unit/rng.test.ts tests/unit/easing.test.ts`
Expected: FAIL (모듈을 찾을 수 없음)

- [ ] **Step 4: 구현**

`kit/runtime/types.ts` (이 단계에서는 Vec3만 작성하고, Task 2에서 확장한다)
```ts
export type Vec3 = [number, number, number];
```

`kit/runtime/rng.ts`
```ts
/** 결정적 난수와 노이즈. kit 안에서 Math.random 사용 금지. */
export type Rng = () => number;

/** FNV-1a 32bit */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 기능별 하위 스트림: 새 salt를 추가해도 기존 salt의 출력은 변하지 않는다. */
export function deriveSeed(seed: number, salt: string): number {
  return (Math.imul(seed >>> 0, 0x9e3779b1) ^ hashString(salt)) >>> 0;
}

export function rngFor(seed: number, salt: string): Rng {
  return mulberry32(deriveSeed(seed, salt));
}

/** 2D simplex noise. rng로 순열을 섞으므로 seed마다 다른 지형. 반환 범위 약 [-1, 1]. */
export function createNoise2D(rng: Rng): (x: number, y: number) => number {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const corner = (x: number, y: number, gi: number) => {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    t *= t;
    const g = grad[gi & 7];
    return t * t * (g[0] * x + g[1] * y);
  };
  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const n =
      corner(x0, y0, perm[ii + perm[jj]]) +
      corner(x1, y1, perm[ii + i1 + perm[jj + j1]]) +
      corner(x2, y2, perm[ii + 1 + perm[jj + 1]]);
    return 70 * n;
  };
}
```

`kit/runtime/easing.ts`
```ts
import type { Vec3 } from './types';

export type EaseName = 'linear' | 'in' | 'out' | 'inOut';
export const EASES: readonly EaseName[] = ['linear', 'in', 'out', 'inOut'];

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function ease(name: EaseName, t: number): number {
  const x = clamp01(t);
  switch (name) {
    case 'in':
      return x * x * x;
    case 'out':
      return 1 - Math.pow(1 - x, 3);
    case 'inOut':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    default:
      return x;
  }
}

export function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/rng.test.ts tests/unit/easing.test.ts`
Expected: PASS (7개 테스트)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore kit/runtime tests/unit
git commit -m "feat(kit): deterministic rng/noise and easing"
```

---

### Task 2: 장면 타입 + 타임라인 + 카메라

**Files:**
- Modify: `kit/runtime/types.ts` (전체 교체)
- Create: `kit/runtime/timeline.ts`, `kit/runtime/camera.ts`
- Test: `tests/unit/timeline.test.ts`, `tests/unit/camera.test.ts`

**Interfaces:**
- Consumes: `ease`, `easeOutBack`, `clamp01`, `lerp`, `lerp3`, `smoothstep`, `EaseName` (Task 1)
- Produces:
  - `types.ts`: `Vec3`, `Role`, `ELEMENT_ROLES`, `StyleName`, `STYLE_NAMES`, `SkyPreset`, `SKY_PRESETS`, `AnimName`, `ANIMS`, `TrackPath`, `TRACK_PATHS`, `Cue`, `ElementDef`, `CameraMove`, `CAMERA_MOVES`, `ShotDef`, `EnvironmentDef`, `SceneMeta`, `SceneDef`, `Quality`, `ElementHandle`, `KitContext`, `ElementType`
  - `timeline.ts`: `DEFAULT_DUR = 0.6`, `animMods(anim, p): AnimMods`, `elementState(el, t): ElementState`, `sampleTrack(keys, t)`, `findShot(shots, t): { shot, u }`
  - `camera.ts`: `DEFAULT_FOV = 40`, `cameraPose(cam, u): CameraPose { position, target, fov }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/timeline.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { elementState, sampleTrack, findShot, animMods } from '../../kit/runtime/timeline';
import type { ShotDef } from '../../kit/runtime/types';

describe('elementState', () => {
  it('enter 없으면 처음부터 완전히 보임', () => {
    expect(elementState({}, 0)).toMatchObject({ visible: true, opacity: 1, scale: 1, dy: 0, progress: null });
  });
  it('enter 전에는 숨김, 진행 중에는 부분값', () => {
    const el = { enter: { t: 2, anim: 'fade' as const, dur: 1 } };
    expect(elementState(el, 1.9).visible).toBe(false);
    const mid = elementState(el, 2.5);
    expect(mid.visible).toBe(true);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    expect(elementState(el, 3).opacity).toBeCloseTo(1);
  });
  it('exit 완료 후 숨김, anim none은 즉시', () => {
    expect(elementState({ exit: { t: 5, anim: 'fade', dur: 1 } }, 6).visible).toBe(false);
    expect(elementState({ exit: { t: 5, anim: 'none' } }, 5).visible).toBe(false);
    expect(elementState({ exit: { t: 5, anim: 'none' } }, 4.99).visible).toBe(true);
  });
  it('grow는 progress, exit grow는 줄어듦', () => {
    const el = { enter: { t: 0, anim: 'grow' as const, dur: 1 }, exit: { t: 3, anim: 'grow' as const, dur: 1 } };
    expect(elementState(el, 0).progress).toBeCloseTo(0);
    expect(elementState(el, 2).progress).toBeCloseTo(1);
    expect(elementState(el, 3.5).progress!).toBeLessThan(1);
  });
  it('pop/rise 수식', () => {
    expect(animMods('rise', 0).dy).toBeCloseTo(-1.5);
    expect(animMods('rise', 1).dy).toBeCloseTo(0);
    expect(animMods('pop', 0).scale).toBeGreaterThan(0);
  });
});

describe('sampleTrack', () => {
  const keys: Array<[number, number]> = [[1, 0], [3, 10]];
  it('구간 밖은 끝값 유지', () => {
    expect(sampleTrack(keys, 0)).toBe(0);
    expect(sampleTrack(keys, 9)).toBe(10);
  });
  it('중간은 smoothstep 보간', () => {
    expect(sampleTrack(keys, 2)).toBeCloseTo(5);
  });
});

describe('findShot', () => {
  const cam = { move: 'static' as const, pos: [0, 0, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  const shots: ShotDef[] = [
    { id: 'a', start: 0, end: 4, camera: cam },
    { id: 'b', start: 4, end: 10, camera: cam },
  ];
  it('구간 탐색과 u', () => {
    expect(findShot(shots, 2)).toMatchObject({ u: 0.5 });
    expect(findShot(shots, 2).shot.id).toBe('a');
    expect(findShot(shots, 4).shot.id).toBe('b');
  });
  it('범위 밖은 clamp (Review Focus 2)', () => {
    expect(findShot(shots, -3).shot.id).toBe('a');
    expect(findShot(shots, -3).u).toBe(0);
    expect(findShot(shots, 99).shot.id).toBe('b');
    expect(findShot(shots, 99).u).toBe(1);
  });
});
```

`tests/unit/camera.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { cameraPose } from '../../kit/runtime/camera';

describe('cameraPose', () => {
  it('static', () => {
    expect(cameraPose({ move: 'static', pos: [1, 2, 3], target: [0, 0, 0] }, 0.7)).toEqual({ position: [1, 2, 3], target: [0, 0, 0], fov: 40 });
  });
  it('dolly는 시작·끝 위치', () => {
    const c = { move: 'dolly' as const, from: [0, 0, 10] as [number, number, number], to: [0, 0, 0] as [number, number, number], target: [0, 0, -5] as [number, number, number] };
    expect(cameraPose(c, 0).position).toEqual([0, 0, 10]);
    expect(cameraPose(c, 1).position).toEqual([0, 0, 0]);
    expect(cameraPose({ ...c, ease: 'linear' }, 0.5).position[2]).toBeCloseTo(5);
  });
  it('orbit은 각도 기준 원 위', () => {
    const p = cameraPose({ move: 'orbit', center: [0, 1, 0], radius: 10, height: 2, fromDeg: 0, toDeg: 90, ease: 'linear' }, 1);
    expect(p.position[0]).toBeCloseTo(10);
    expect(p.position[1]).toBeCloseTo(3);
    expect(p.position[2]).toBeCloseTo(0);
    expect(p.target).toEqual([0, 1, 0]);
  });
  it('fov 지정', () => {
    expect(cameraPose({ move: 'static', pos: [0, 0, 1], target: [0, 0, 0], fov: 60 }, 0).fov).toBe(60);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/timeline.test.ts tests/unit/camera.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`kit/runtime/types.ts` (전체 교체)
```ts
import type * as THREE from 'three';
import type { EaseName } from './easing';
import type { Style } from './style';

export type Vec3 = [number, number, number];

export type Role = 'ground' | 'foliage' | 'trunk' | 'water' | 'accent' | 'accent2' | 'accent3' | 'neutral' | 'label';
/** 장면 요소(params.role)에 쓸 수 있는 역할 */
export const ELEMENT_ROLES: readonly Role[] = ['accent', 'accent2', 'accent3', 'neutral', 'label'];

export type StyleName = 'stylized' | 'minimal';
export const STYLE_NAMES: readonly StyleName[] = ['stylized', 'minimal'];

export type SkyPreset = 'dawn' | 'day' | 'dusk' | 'night';
export const SKY_PRESETS: readonly SkyPreset[] = ['dawn', 'day', 'dusk', 'night'];

export type AnimName = 'none' | 'fade' | 'pop' | 'rise' | 'grow';
export const ANIMS: readonly AnimName[] = ['none', 'fade', 'pop', 'rise', 'grow'];

export type TrackPath =
  | 'position.x' | 'position.y' | 'position.z'
  | 'rotation.x' | 'rotation.y' | 'rotation.z'
  | 'scale' | 'opacity';
export const TRACK_PATHS: readonly TrackPath[] = [
  'position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'scale', 'opacity',
];

export interface Cue {
  t: number;
  anim: AnimName;
  dur?: number;
}

export interface ElementDef {
  id: string;
  type: string;
  at?: Vec3;
  rotation?: Vec3;
  scale?: number;
  params?: Record<string, unknown>;
  enter?: Cue;
  exit?: Cue;
  /** 값은 절대값: position/rotation(도)/scale은 덮어쓰기, opacity는 곱하기 */
  tracks?: Partial<Record<TrackPath, Array<[number, number]>>>;
}

export type CameraMove =
  | { move: 'static'; pos: Vec3; target: Vec3; fov?: number }
  | { move: 'dolly' | 'crane'; from: Vec3; to: Vec3; target: Vec3; targetTo?: Vec3; ease?: EaseName; fov?: number }
  | { move: 'orbit'; center: Vec3; radius: number; height: number; fromDeg: number; toDeg: number; ease?: EaseName; fov?: number };
export const CAMERA_MOVES = ['static', 'dolly', 'orbit', 'crane'] as const;

export interface ShotDef {
  id: string;
  start: number;
  end: number;
  camera: CameraMove;
}

export interface EnvironmentDef {
  sky?: { preset?: SkyPreset };
  terrain?: { size?: number; height?: number; roughness?: number; flatRadius?: number };
  trees?: { count?: number; area?: number; avoidCenter?: number };
  water?: { level?: number; size?: number };
}

export interface SceneMeta {
  width: number;
  height: number;
  fps: number;
  duration: number;
  seed: number;
}

export interface SceneDef {
  meta: SceneMeta;
  style: StyleName;
  environment?: EnvironmentDef;
  elements?: ElementDef[];
  shots: ShotDef[];
  custom?: ElementType[];
}

export type Quality = 'preview' | 'final';

/** 모든 요소·환경 모듈이 반환하는 핸들. 상태는 절대시간 t의 순수함수여야 한다. */
export interface ElementHandle {
  object3d: THREE.Object3D;
  update?(t: number): void;
  setProgress?(p: number): void;
  setOpacity?(o: number): void;
  dispose(): void;
}

export interface KitContext {
  style: Style;
  rng(salt: string): () => number;
  heightAt(x: number, z: number): number;
  quality: Quality;
  camera: THREE.PerspectiveCamera;
}

export interface ElementType {
  type: string;
  supportsGrow?: boolean;
  create(ctx: KitContext, params: Record<string, unknown>): ElementHandle;
}
```

> `style.ts`는 Task 4에서 만든다. Task 2의 테스트는 `import type`만 쓰므로 vitest(esbuild)는 통과한다. 다만 `npm run typecheck`는 Task 4 이후에 실행한다.

`kit/runtime/timeline.ts`
```ts
import { clamp01, ease, easeOutBack, lerp, smoothstep } from './easing';
import type { AnimName, Cue, ShotDef } from './types';

export const DEFAULT_DUR = 0.6;

export interface AnimMods {
  opacity: number;
  scale: number;
  dy: number;
  progress: number | null;
}

export function animMods(anim: AnimName, p: number): AnimMods {
  const x = clamp01(p);
  switch (anim) {
    case 'fade':
      return { opacity: ease('out', x), scale: 1, dy: 0, progress: null };
    case 'pop':
      return { opacity: clamp01(x * 3), scale: Math.max(0.0001, easeOutBack(x)), dy: 0, progress: null };
    case 'rise':
      return { opacity: ease('out', x), scale: 1, dy: -1.5 * (1 - ease('out', x)), progress: null };
    case 'grow':
      return { opacity: 1, scale: 1, dy: 0, progress: ease('inOut', x) };
    default:
      return { opacity: 1, scale: 1, dy: 0, progress: null };
  }
}

export interface ElementState {
  visible: boolean;
  opacity: number;
  scale: number;
  dy: number;
  progress: number | null;
}

const HIDDEN: ElementState = { visible: false, opacity: 0, scale: 1, dy: 0, progress: 0 };

function cueProgress(c: Cue, t: number): number {
  return c.anim === 'none' ? 1 : clamp01((t - c.t) / (c.dur ?? DEFAULT_DUR));
}

export function elementState(el: { enter?: Cue; exit?: Cue }, t: number): ElementState {
  let pIn = 1;
  let pOut = 0;
  if (el.enter) {
    if (t < el.enter.t) return HIDDEN;
    pIn = cueProgress(el.enter, t);
  }
  if (el.exit && t >= el.exit.t) {
    pOut = cueProgress(el.exit, t);
    if (pOut >= 1) return HIDDEN;
  }
  const a = animMods(el.enter?.anim ?? 'none', pIn);
  const b = animMods(el.exit?.anim ?? 'none', 1 - pOut);
  const progress = a.progress === null && b.progress === null ? null : (a.progress ?? 1) * (b.progress ?? 1);
  return { visible: true, opacity: a.opacity * b.opacity, scale: a.scale * b.scale, dy: a.dy + b.dy, progress };
}

export function sampleTrack(keys: Array<[number, number]>, t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, smoothstep((t - t0) / (t1 - t0)));
    }
  }
  return last[1];
}

export function findShot(shots: ShotDef[], t: number): { shot: ShotDef; u: number } {
  let shot = shots[0];
  for (const s of shots) if (t >= s.start) shot = s;
  return { shot, u: clamp01((t - shot.start) / (shot.end - shot.start)) };
}
```

`kit/runtime/camera.ts`
```ts
import { ease, lerp, lerp3 } from './easing';
import type { CameraMove, Vec3 } from './types';

export const DEFAULT_FOV = 40;

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/** u: 샷 안의 진행도 0..1 */
export function cameraPose(cam: CameraMove, u: number): CameraPose {
  const fov = cam.fov ?? DEFAULT_FOV;
  switch (cam.move) {
    case 'static':
      return { position: [...cam.pos] as Vec3, target: [...cam.target] as Vec3, fov };
    case 'dolly':
    case 'crane': {
      const e = ease(cam.ease ?? (cam.move === 'crane' ? 'out' : 'inOut'), u);
      return { position: lerp3(cam.from, cam.to, e), target: lerp3(cam.target, cam.targetTo ?? cam.target, e), fov };
    }
    case 'orbit': {
      const e = ease(cam.ease ?? 'inOut', u);
      const a = (lerp(cam.fromDeg, cam.toDeg, e) * Math.PI) / 180;
      const [cx, cy, cz] = cam.center;
      return {
        position: [cx + Math.sin(a) * cam.radius, cy + cam.height, cz + Math.cos(a) * cam.radius],
        target: [cx, cy, cz],
        fov,
      };
    }
    default:
      throw new Error(`알 수 없는 카메라 move: ${(cam as { move: string }).move}`);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/timeline.test.ts tests/unit/camera.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add kit/runtime tests/unit
git commit -m "feat(kit): scene types, timeline evaluation, camera poses"
```

---

### Task 3: 장면 검증기

**Files:**
- Create: `kit/runtime/validate.ts`
- Test: `tests/unit/validate.test.ts`

**Interfaces:**
- Consumes: `types.ts` 상수(`STYLE_NAMES`, `SKY_PRESETS`, `ANIMS`, `TRACK_PATHS`, `ELEMENT_ROLES`, `CAMERA_MOVES`), `EASES`
- Produces: `interface Issue { path: string; message: string }`, `interface TypeInfo { supportsGrow: boolean }`, `validateScene(input: unknown, types: Map<string, TypeInfo>): Issue[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/validate.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { validateScene, type TypeInfo } from '../../kit/runtime/validate';

const types = new Map<string, TypeInfo>([
  ['shape', { supportsGrow: false }],
  ['arrow', { supportsGrow: true }],
]);
const cam = { move: 'static', pos: [0, 2, 10], target: [0, 0, 0] };
const good = () => ({
  meta: { width: 1080, height: 1920, fps: 30, duration: 10, seed: 1 },
  style: 'stylized',
  environment: { sky: { preset: 'dawn' }, terrain: { size: 100 } },
  elements: [
    { id: 'a', type: 'shape', at: [0, 1, 0], enter: { t: 1, anim: 'pop' } },
    { id: 'b', type: 'arrow', enter: { t: 2, anim: 'grow' }, tracks: { 'position.y': [[0, 0], [2, 3]] } },
  ],
  shots: [
    { id: 's1', start: 0, end: 4, camera: cam },
    { id: 's2', start: 4, end: 10, camera: { move: 'orbit', center: [0, 0, 0], radius: 10, height: 2, fromDeg: 0, toDeg: 30 } },
  ],
});
const paths = (s: unknown) => validateScene(s, types).map((i) => i.path);

describe('validateScene', () => {
  it('정상 장면은 이슈 없음', () => {
    expect(validateScene(good(), types)).toEqual([]);
  });
  it('meta 오류', () => {
    const s = good();
    (s.meta as any).fps = 0;
    (s.meta as any).seed = 1.5;
    (s.meta as any).width = 1081;
    expect(paths(s)).toEqual(expect.arrayContaining(['meta.fps', 'meta.seed', 'meta.width']));
  });
  it('알 수 없는 style·preset·type·anim·role', () => {
    const s = good() as any;
    s.style = 'anime';
    s.environment.sky.preset = 'noon';
    s.elements[0].type = 'cube';
    s.elements[1].enter.anim = 'spin';
    s.elements[1].params = { role: 'blue' };
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining(['style', 'environment.sky.preset', 'elements[0].type', 'elements[1].enter.anim', 'elements[1].params.role']));
    const msg = validateScene(s, types).find((i) => i.path === 'elements[1].enter.anim')!.message;
    expect(msg).toContain('none|fade|pop|rise|grow');
  });
  it('grow 미지원 요소', () => {
    const s = good() as any;
    s.elements[0].enter.anim = 'grow';
    expect(paths(s)).toContain('elements[0].enter.anim');
  });
  it('중복 id, exit가 enter보다 앞섬, 시간 범위 밖', () => {
    const s = good() as any;
    s.elements[1].id = 'a';
    s.elements[0].exit = { t: 0.5, anim: 'fade' };
    s.elements[1].enter.t = 11;
    expect(paths(s)).toEqual(expect.arrayContaining(['elements[1].id', 'elements[0].exit.t', 'elements[1].enter.t']));
  });
  it('tracks 경로·형식·정렬', () => {
    const s = good() as any;
    s.elements[1].tracks = { 'position.w': [[0, 1]], scale: [[2, 1], [1, 2]], opacity: 'x' };
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining(["elements[1].tracks['position.w']", "elements[1].tracks['scale']", "elements[1].tracks['opacity']"]));
  });
  it('샷 겹침·빈 구간·시작·끝·카메라 필드', () => {
    const s = good() as any;
    s.shots[1].start = 5;
    s.shots[1].end = 9;
    s.shots[0].camera = { move: 'dolly', from: [0, 0, 1], target: [0, 0, 0] };
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining(['shots[1].start', 'shots[1].end', 'shots[0].camera.to']));
  });
  it('첫 샷은 0초 시작, 샷 없음, 잘못된 move', () => {
    const s = good() as any;
    s.shots[0].start = 1;
    expect(paths(s)).toContain('shots[0].start');
    s.shots = [];
    expect(paths(s)).toContain('shots');
    s.shots = [{ id: 'x', start: 0, end: 10, camera: { move: 'zoom' } }];
    expect(paths(s)).toContain('shots[0].camera.move');
  });
  it('객체가 아니면 즉시 보고', () => {
    expect(paths(null)).toEqual(['']);
  });
  it('환경 수치 범위', () => {
    const s = good() as any;
    s.environment.trees = { count: 99999 };
    s.environment.terrain.roughness = 3;
    expect(paths(s)).toEqual(expect.arrayContaining(['environment.trees.count', 'environment.terrain.roughness']));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`kit/runtime/validate.ts`
```ts
import { EASES } from './easing';
import { ANIMS, CAMERA_MOVES, ELEMENT_ROLES, SKY_PRESETS, STYLE_NAMES, TRACK_PATHS, type TrackPath } from './types';

export interface Issue {
  path: string;
  message: string;
}
export interface TypeInfo {
  supportsGrow: boolean;
}

type Err = (path: string, message: string) => void;
type Obj = Record<string, any>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (xs: readonly string[]) => xs.join('|');
const VEC = '[x, y, z] 숫자 3개여야 함';

function oneOf(err: Err, path: string, v: unknown, allowed: readonly string[]) {
  if (!allowed.includes(v as string)) err(path, `'${String(v)}'은 지원하지 않음. 가능: ${list(allowed)}`);
}

function numIn(err: Err, o: Obj | undefined, base: string, key: string, min: number, max: number, integer = false) {
  if (!o || o[key] === undefined) return;
  const v = o[key];
  if (!isNum(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    err(`${base}.${key}`, `${integer ? '정수' : '숫자'} ${min} ~ ${max} 범위여야 함`);
  }
}

function validateEnvironment(env: unknown, err: Err) {
  if (env === undefined) return;
  if (!isObj(env)) return err('environment', '객체여야 함');
  if (env.sky !== undefined) {
    if (!isObj(env.sky)) err('environment.sky', '객체여야 함');
    else if (env.sky.preset !== undefined) oneOf(err, 'environment.sky.preset', env.sky.preset, SKY_PRESETS);
  }
  for (const k of ['terrain', 'trees', 'water'] as const) {
    if (env[k] !== undefined && !isObj(env[k])) err(`environment.${k}`, '객체여야 함');
  }
  const t = isObj(env.terrain) ? env.terrain : undefined;
  numIn(err, t, 'environment.terrain', 'size', 10, 2000);
  numIn(err, t, 'environment.terrain', 'height', 0, 200);
  numIn(err, t, 'environment.terrain', 'roughness', 0, 1);
  numIn(err, t, 'environment.terrain', 'flatRadius', 0, 500);
  const tr = isObj(env.trees) ? env.trees : undefined;
  numIn(err, tr, 'environment.trees', 'count', 0, 5000, true);
  numIn(err, tr, 'environment.trees', 'area', 10, 2000);
  numIn(err, tr, 'environment.trees', 'avoidCenter', 0, 500);
  const w = isObj(env.water) ? env.water : undefined;
  numIn(err, w, 'environment.water', 'level', -100, 100);
  numIn(err, w, 'environment.water', 'size', 10, 4000);
}

function validateElements(els: unknown, types: Map<string, TypeInfo>, duration: number, err: Err) {
  if (els === undefined) return;
  if (!Array.isArray(els)) return err('elements', '배열이어야 함');
  const ids = new Set<string>();
  els.forEach((e: unknown, i) => {
    const p = `elements[${i}]`;
    if (!isObj(e)) return err(p, '객체여야 함');
    if (typeof e.id !== 'string' || !e.id) err(`${p}.id`, '비어 있지 않은 문자열이어야 함');
    else if (ids.has(e.id)) err(`${p}.id`, `'${e.id}' 중복`);
    else ids.add(e.id);
    const info = types.get(e.type);
    if (!info) err(`${p}.type`, `'${String(e.type)}'은 알 수 없는 요소. 가능: ${list([...types.keys()])}`);
    if (e.at !== undefined && !isVec3(e.at)) err(`${p}.at`, VEC);
    if (e.rotation !== undefined && !isVec3(e.rotation)) err(`${p}.rotation`, '[x, y, z] 도(degree) 숫자 3개여야 함');
    if (e.scale !== undefined && (!isNum(e.scale) || e.scale <= 0)) err(`${p}.scale`, '0보다 큰 숫자여야 함');
    if (e.params !== undefined) {
      if (!isObj(e.params)) err(`${p}.params`, '객체여야 함');
      else if (e.params.role !== undefined) oneOf(err, `${p}.params.role`, e.params.role, ELEMENT_ROLES);
    }
    for (const key of ['enter', 'exit'] as const) {
      const c = e[key];
      if (c === undefined) continue;
      const cp = `${p}.${key}`;
      if (!isObj(c)) {
        err(cp, '객체여야 함');
        continue;
      }
      if (!isNum(c.t) || c.t < 0 || c.t > duration) err(`${cp}.t`, `0 ~ ${duration}초 사이여야 함`);
      if (!ANIMS.includes(c.anim)) oneOf(err, `${cp}.anim`, c.anim, ANIMS);
      else if (c.anim === 'grow' && info && !info.supportsGrow) err(`${cp}.anim`, `'${e.type}'은 grow를 지원하지 않음`);
      if (c.dur !== undefined && (!isNum(c.dur) || c.dur <= 0)) err(`${cp}.dur`, '0보다 큰 숫자여야 함');
    }
    if (isObj(e.enter) && isObj(e.exit) && isNum(e.enter.t) && isNum(e.exit.t) && e.exit.t < e.enter.t) {
      err(`${p}.exit.t`, 'enter.t보다 앞설 수 없음');
    }
    if (e.tracks !== undefined) {
      if (!isObj(e.tracks)) err(`${p}.tracks`, '객체여야 함');
      else {
        for (const [k, keys] of Object.entries(e.tracks)) {
          const tp = `${p}.tracks['${k}']`;
          if (!TRACK_PATHS.includes(k as TrackPath)) {
            err(tp, `알 수 없는 경로. 가능: ${list(TRACK_PATHS)}`);
            continue;
          }
          const okShape = Array.isArray(keys) && keys.length > 0 &&
            keys.every((kv: unknown) => Array.isArray(kv) && kv.length === 2 && isNum(kv[0]) && isNum(kv[1]));
          if (!okShape) {
            err(tp, '[[시간, 값], ...] 형식이어야 함');
            continue;
          }
          for (let j = 1; j < keys.length; j++) {
            if (keys[j][0] <= keys[j - 1][0]) {
              err(tp, '키프레임 시간은 오름차순이어야 함');
              break;
            }
          }
        }
      }
    }
  });
}

function validateCamera(c: unknown, p: string, err: Err) {
  if (!isObj(c)) return err(p, '필수 항목 누락');
  const need = (k: string, ok: (v: unknown) => boolean, msg: string) => {
    if (!ok(c[k])) err(`${p}.${k}`, msg);
  };
  switch (c.move) {
    case 'static':
      need('pos', isVec3, VEC);
      need('target', isVec3, VEC);
      break;
    case 'dolly':
    case 'crane':
      need('from', isVec3, VEC);
      need('to', isVec3, VEC);
      need('target', isVec3, VEC);
      if (c.targetTo !== undefined) need('targetTo', isVec3, VEC);
      break;
    case 'orbit':
      need('center', isVec3, VEC);
      need('radius', (v) => isNum(v) && v > 0, '0보다 큰 숫자여야 함');
      need('height', isNum, '숫자여야 함');
      need('fromDeg', isNum, '숫자여야 함');
      need('toDeg', isNum, '숫자여야 함');
      break;
    default:
      return oneOf(err, `${p}.move`, c.move, CAMERA_MOVES);
  }
  if (c.ease !== undefined) oneOf(err, `${p}.ease`, c.ease, EASES);
  if (c.fov !== undefined && (!isNum(c.fov) || c.fov < 10 || c.fov > 120)) err(`${p}.fov`, '10 ~ 120 사이여야 함');
}

function validateShots(shots: unknown, duration: number, err: Err) {
  if (!Array.isArray(shots) || shots.length === 0) return err('shots', '샷이 1개 이상 필요');
  const ids = new Set<string>();
  shots.forEach((sh: unknown, i) => {
    const p = `shots[${i}]`;
    if (!isObj(sh)) return err(p, '객체여야 함');
    if (typeof sh.id !== 'string' || !sh.id) err(`${p}.id`, '비어 있지 않은 문자열이어야 함');
    else if (ids.has(sh.id)) err(`${p}.id`, `'${sh.id}' 중복`);
    else ids.add(sh.id);
    if (!isNum(sh.start) || !isNum(sh.end) || sh.end <= sh.start) {
      err(p, 'start < end인 숫자여야 함');
    } else {
      const prev = i === 0 ? 0 : (shots[i - 1] as Obj)?.end;
      if (isNum(prev) && Math.abs(sh.start - prev) > 1e-6) {
        err(`${p}.start`, i === 0 ? '첫 샷은 0초에서 시작해야 함' : `이전 샷 끝(${prev})과 이어져야 함 (겹침·빈 구간 금지)`);
      }
    }
    validateCamera(sh.camera, `${p}.camera`, err);
  });
  const lastIdx = shots.length - 1;
  const last = shots[lastIdx] as Obj;
  if (isObj(last) && isNum(last.end) && Number.isFinite(duration) && Math.abs(last.end - duration) > 1e-6) {
    err(`shots[${lastIdx}].end`, `마지막 샷은 meta.duration(${duration})에서 끝나야 함`);
  }
}

export function validateScene(input: unknown, types: Map<string, TypeInfo>): Issue[] {
  const issues: Issue[] = [];
  const err: Err = (path, message) => {
    issues.push({ path, message });
  };
  if (!isObj(input)) {
    err('', '장면 정의가 객체가 아님 (export default defineScene({...}) 확인)');
    return issues;
  }
  let duration = Infinity;
  const m = input.meta;
  if (!isObj(m)) err('meta', '필수 항목 누락');
  else {
    for (const k of ['width', 'height', 'fps', 'duration'] as const) {
      if (!isNum(m[k]) || m[k] <= 0) err(`meta.${k}`, '0보다 큰 숫자여야 함');
    }
    if (!Number.isInteger(m.seed)) err('meta.seed', '정수여야 함');
    if (isNum(m.width) && isNum(m.height) && (m.width % 2 !== 0 || m.height % 2 !== 0)) {
      err('meta.width', '가로·세로는 짝수여야 함 (H.264 인코딩 조건)');
    }
    if (isNum(m.duration) && m.duration > 0) duration = m.duration;
  }
  oneOf(err, 'style', input.style, STYLE_NAMES);
  validateEnvironment(input.environment, err);
  validateElements(input.elements, types, duration, err);
  validateShots(input.shots, duration, err);
  if (input.custom !== undefined && !Array.isArray(input.custom)) err('custom', '배열이어야 함');
  return issues;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: PASS (9개 테스트)

- [ ] **Step 5: Commit**

```bash
git add kit/runtime/validate.ts tests/unit/validate.test.ts
git commit -m "feat(kit): scene validator with Korean path messages"
```

---

### Task 4: 스타일 시스템 (stylized, minimal)

**Files:**
- Create: `kit/runtime/style.ts`, `kit/styles/stylized.ts`, `kit/styles/minimal.ts`, `kit/styles/index.ts`
- Test: `tests/unit/style.test.ts`

**Interfaces:**
- Consumes: `Role`, `SkyPreset`, `StyleName`, `Vec3` (Task 2)
- Produces:
  - `style.ts`: `interface SkyColors { top; horizon; bottom; sun; fog; ambient: string; sunIntensity; ambientIntensity: number; sunDir: Vec3 }`, `interface MaterialOpts { vertexColors?; transparent?; opacity?; side? }`, `interface Style { name; palette: Record<Role,string>; fogDensity; labelFont; sky(preset): SkyColors; material(role, opts?): THREE.Material }`, `FONT_STACK`, `createLights(sky, style): THREE.Light[]`
  - `styles/index.ts`: `getStyle(name: StyleName): Style`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/style.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { createLights } from '../../kit/runtime/style';
import { SKY_PRESETS } from '../../kit/runtime/types';

describe('styles', () => {
  for (const name of ['stylized', 'minimal'] as const) {
    it(`${name}: 모든 하늘 프리셋과 역할 재질`, () => {
      const s = getStyle(name);
      expect(s.name).toBe(name);
      for (const p of SKY_PRESETS) {
        const c = s.sky(p);
        expect(c.top).toMatch(/^#[0-9a-f]{6}$/i);
        expect(c.sunDir).toHaveLength(3);
      }
      const a = s.material('accent');
      const b = s.material('accent');
      expect(a).not.toBe(b);
      expect(a).toBeInstanceOf(THREE.Material);
      const w = s.material('water', { transparent: true, opacity: 0.8 });
      expect(w.transparent).toBe(true);
      expect(w.opacity).toBeCloseTo(0.8);
      a.dispose();
      b.dispose();
      w.dispose();
    });
  }
  it('stylized는 툰, minimal은 standard', () => {
    expect(getStyle('stylized').material('ground')).toBeInstanceOf(THREE.MeshToonMaterial);
    expect(getStyle('minimal').material('ground')).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
  it('조명 리그: 반구광 + 방향광', () => {
    const s = getStyle('stylized');
    const lights = createLights(s.sky('day'), s);
    expect(lights.some((l) => l instanceof THREE.HemisphereLight)).toBe(true);
    expect(lights.some((l) => l instanceof THREE.DirectionalLight)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/style.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`kit/runtime/style.ts`
```ts
import * as THREE from 'three';
import type { Role, SkyPreset, StyleName, Vec3 } from './types';

export interface SkyColors {
  top: string;
  horizon: string;
  bottom: string;
  sun: string;
  fog: string;
  ambient: string;
  sunIntensity: number;
  ambientIntensity: number;
  sunDir: Vec3;
}

export interface MaterialOpts {
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export interface Style {
  name: StyleName;
  palette: Record<Role, string>;
  fogDensity: number;
  /** CSS font-family 스택 (라벨용) */
  labelFont: string;
  sky(preset: SkyPreset): SkyColors;
  /** 호출마다 새 인스턴스. 호출자가 dispose 책임. */
  material(role: Role, opts?: MaterialOpts): THREE.Material;
}

export const FONT_STACK = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';

export function createLights(sky: SkyColors, style: Style): THREE.Light[] {
  const hemi = new THREE.HemisphereLight(sky.ambient, style.palette.ground, sky.ambientIntensity);
  const sun = new THREE.DirectionalLight(sky.sun, sky.sunIntensity);
  const d = new THREE.Vector3(...sky.sunDir).normalize().multiplyScalar(100);
  sun.position.copy(d);
  return [hemi, sun];
}
```

`kit/styles/stylized.ts`
```ts
import * as THREE from 'three';
import { FONT_STACK, type MaterialOpts, type SkyColors, type Style } from '../runtime/style';
import type { Role, SkyPreset } from '../runtime/types';

const PALETTE: Record<Role, string> = {
  ground: '#7bb661',
  foliage: '#3f8f4f',
  trunk: '#7a5236',
  water: '#4fa3c7',
  accent: '#ff7a59',
  accent2: '#ffd166',
  accent3: '#5ec2b7',
  neutral: '#f2efe9',
  label: '#2b2d42',
};

const SKIES: Record<SkyPreset, SkyColors> = {
  dawn: { top: '#7f8fd6', horizon: '#ffc4a3', bottom: '#ffe1c6', sun: '#ffd2a1', fog: '#f6c9b0', ambient: '#c9b6e4', sunIntensity: 2.2, ambientIntensity: 1.1, sunDir: [-0.6, 0.35, 0.5] },
  day: { top: '#4f9be8', horizon: '#bfe3ff', bottom: '#e8f6ff', sun: '#fff3d6', fog: '#cfe8fa', ambient: '#bcdcff', sunIntensity: 2.8, ambientIntensity: 1.2, sunDir: [0.4, 0.8, 0.3] },
  dusk: { top: '#3b3b7a', horizon: '#ff8a5c', bottom: '#ffb38a', sun: '#ff9a5c', fog: '#d98a7a', ambient: '#8a6fb3', sunIntensity: 2.0, ambientIntensity: 0.9, sunDir: [0.7, 0.2, -0.3] },
  night: { top: '#0b1030', horizon: '#26305e', bottom: '#323d73', sun: '#9fb4ff', fog: '#1e2650', ambient: '#3a4a8a', sunIntensity: 0.9, ambientIntensity: 0.7, sunDir: [-0.3, 0.6, 0.4] },
};

let gradient: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export const stylized: Style = {
  name: 'stylized',
  palette: PALETTE,
  fogDensity: 0.012,
  labelFont: FONT_STACK,
  sky: (p) => SKIES[p],
  material(role: Role, o: MaterialOpts = {}) {
    return new THREE.MeshToonMaterial({
      color: o.vertexColors ? '#ffffff' : PALETTE[role],
      gradientMap: toonGradient(),
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
  },
};
```

`kit/styles/minimal.ts`
```ts
import * as THREE from 'three';
import { FONT_STACK, type MaterialOpts, type SkyColors, type Style } from '../runtime/style';
import type { Role, SkyPreset } from '../runtime/types';

const PALETTE: Record<Role, string> = {
  ground: '#e9e6df',
  foliage: '#9fb8a5',
  trunk: '#b8a99a',
  water: '#a8c5d6',
  accent: '#2f6df6',
  accent2: '#f2a541',
  accent3: '#16a085',
  neutral: '#ffffff',
  label: '#1d1d1f',
};

const SKIES: Record<SkyPreset, SkyColors> = {
  dawn: { top: '#d9dcef', horizon: '#f6ece6', bottom: '#f7f3ef', sun: '#fff1e6', fog: '#efe9e4', ambient: '#e6e3f0', sunIntensity: 2.0, ambientIntensity: 1.4, sunDir: [-0.6, 0.4, 0.5] },
  day: { top: '#dce7f2', horizon: '#f4f6f8', bottom: '#fafafa', sun: '#ffffff', fog: '#eef1f4', ambient: '#eef2f7', sunIntensity: 2.4, ambientIntensity: 1.5, sunDir: [0.4, 0.8, 0.3] },
  dusk: { top: '#cfc8e0', horizon: '#f3dccf', bottom: '#f6e9e0', sun: '#ffe2cc', fog: '#eadbd3', ambient: '#ddd3e6', sunIntensity: 1.8, ambientIntensity: 1.3, sunDir: [0.7, 0.25, -0.3] },
  night: { top: '#1c2230', horizon: '#2c3444', bottom: '#343d4f', sun: '#c8d4ff', fog: '#2a3140', ambient: '#4a5468', sunIntensity: 1.0, ambientIntensity: 0.9, sunDir: [-0.3, 0.6, 0.4] },
};

export const minimal: Style = {
  name: 'minimal',
  palette: PALETTE,
  fogDensity: 0.008,
  labelFont: FONT_STACK,
  sky: (p) => SKIES[p],
  material(role: Role, o: MaterialOpts = {}) {
    return new THREE.MeshStandardMaterial({
      color: o.vertexColors ? '#ffffff' : PALETTE[role],
      roughness: 0.6,
      metalness: 0,
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
  },
};
```

`kit/styles/index.ts`
```ts
import type { Style } from '../runtime/style';
import type { StyleName } from '../runtime/types';
import { minimal } from './minimal';
import { stylized } from './stylized';

const STYLES: Record<StyleName, Style> = { stylized, minimal };

export function getStyle(name: StyleName): Style {
  const s = STYLES[name];
  if (!s) throw new Error(`알 수 없는 스타일: ${name}`);
  return s;
}
```

- [ ] **Step 4: 테스트 + 타입체크 통과 확인**

Run: `npx vitest run tests/unit/style.test.ts`
Expected: PASS
Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add kit/runtime/style.ts kit/styles tests/unit/style.test.ts
git commit -m "feat(kit): style system with stylized and minimal presets"
```

---

### Task 5: 환경 모듈 (sky, heightfield, terrain, poisson, trees, water)

**Files:**
- Create: `kit/modules/environment/{sky,heightfield,terrain,poisson,trees,water}.ts`
- Test: `tests/unit/environment.test.ts`

**Interfaces:**
- Consumes: `rngFor`, `createNoise2D`, `Rng` (Task 1), `smoothstep`, `clamp01` (Task 1), `Style`, `SkyColors` (Task 4), `ElementHandle`, `Quality` (Task 2)
- Produces:
  - `sky.ts`: `createSky(colors: SkyColors): ElementHandle`
  - `heightfield.ts`: `interface TerrainParams { size; height; roughness; flatRadius }`, `TERRAIN_DEFAULTS`, `createHeightField(seed, p): { heightAt(x,z) }`
  - `terrain.ts`: `createTerrain(ctx: { style; quality }, field, size): ElementHandle`
  - `poisson.ts`: `poissonDisk(rng, half, radius, maxPoints, k=20): Array<[number, number]>`
  - `trees.ts`: `interface TreesParams { count; area; avoidCenter }`, `TREES_DEFAULTS`, `interface TreePlacement { x; y; z; scale; rot; phase }`, `placeTrees(seed, p, heightAt): TreePlacement[]`, `createTrees(ctx: { style }, placements): ElementHandle`
  - `water.ts`: `createWater(ctx: { style }, p: { level; size }): ElementHandle`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/environment.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { createSky } from '../../kit/modules/environment/sky';
import { createHeightField, TERRAIN_DEFAULTS } from '../../kit/modules/environment/heightfield';
import { createTerrain } from '../../kit/modules/environment/terrain';
import { poissonDisk } from '../../kit/modules/environment/poisson';
import { placeTrees, createTrees, TREES_DEFAULTS } from '../../kit/modules/environment/trees';
import { createWater } from '../../kit/modules/environment/water';
import { mulberry32 } from '../../kit/runtime/rng';

const style = getStyle('stylized');

describe('heightfield', () => {
  it('결정적이고 중앙은 평평(0)', () => {
    const a = createHeightField(3, TERRAIN_DEFAULTS);
    const b = createHeightField(3, TERRAIN_DEFAULTS);
    expect(a.heightAt(37, -12)).toBe(b.heightAt(37, -12));
    expect(a.heightAt(0, 0)).toBe(0);
    expect(a.heightAt(5, 5)).toBe(0);
  });
  it('seed마다 다름, 높이 범위', () => {
    const a = createHeightField(1, TERRAIN_DEFAULTS);
    const b = createHeightField(2, TERRAIN_DEFAULTS);
    expect(a.heightAt(60, 40)).not.toBe(b.heightAt(60, 40));
    for (let i = 0; i < 40; i++) expect(Math.abs(a.heightAt(i * 4 - 80, 70))).toBeLessThanOrEqual(TERRAIN_DEFAULTS.height);
  });
});

describe('poissonDisk', () => {
  it('최소 거리와 경계, 결정성', () => {
    const pts = poissonDisk(mulberry32(5), 50, 6, 400);
    const again = poissonDisk(mulberry32(5), 50, 6, 400);
    expect(again).toEqual(pts);
    expect(pts.length).toBeGreaterThan(30);
    for (const [x, z] of pts) expect(Math.abs(x) <= 50 && Math.abs(z) <= 50).toBe(true);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThanOrEqual(6 - 1e-9);
      }
    }
  });
});

describe('trees', () => {
  it('개수 상한, 중앙 회피, 지형 높이', () => {
    const field = createHeightField(9, TERRAIN_DEFAULTS);
    const p = { ...TREES_DEFAULTS, count: 120 };
    const pl = placeTrees(9, p, field.heightAt);
    expect(pl.length).toBeLessThanOrEqual(120);
    expect(pl.length).toBeGreaterThan(60);
    for (const t of pl) {
      expect(Math.hypot(t.x, t.z)).toBeGreaterThanOrEqual(p.avoidCenter);
      expect(t.y).toBe(field.heightAt(t.x, t.z));
    }
    expect(placeTrees(9, p, field.heightAt)).toEqual(pl);
  });
  it('InstancedMesh 생성, update(t) 결정적, dispose', () => {
    const pl = placeTrees(1, { ...TREES_DEFAULTS, count: 20 }, () => 0);
    const h = createTrees({ style }, pl);
    const meshes: THREE.InstancedMesh[] = [];
    h.object3d.traverse((o) => { if (o instanceof THREE.InstancedMesh) meshes.push(o); });
    expect(meshes.length).toBe(3);
    expect(meshes[0].count).toBe(pl.length);
    h.update!(1.25);
    const m1 = Array.from(meshes[1].instanceMatrix.array);
    h.update!(3);
    h.update!(1.25);
    expect(Array.from(meshes[1].instanceMatrix.array)).toEqual(m1);
    h.dispose();
  });
});

describe('sky/terrain/water', () => {
  it('sky는 BackSide 셰이더 구', () => {
    const h = createSky(style.sky('dawn'));
    const mesh = h.object3d as THREE.Mesh;
    expect((mesh.material as THREE.ShaderMaterial).side).toBe(THREE.BackSide);
    h.dispose();
  });
  it('terrain 정점 높이가 heightAt과 일치', () => {
    const field = createHeightField(4, TERRAIN_DEFAULTS);
    const h = createTerrain({ style, quality: 'preview' }, field, 200);
    const geo = (h.object3d as THREE.Mesh).geometry;
    const pos = geo.attributes.position;
    for (const i of [0, 77, pos.count - 1]) expect(pos.getY(i)).toBeCloseTo(field.heightAt(pos.getX(i), pos.getZ(i)));
    expect(geo.attributes.color).toBeDefined();
    h.dispose();
  });
  it('water update(t)는 시간 순수함수', () => {
    const h = createWater({ style }, { level: -1, size: 100 });
    const pos = (h.object3d as THREE.Mesh).geometry.attributes.position;
    h.update!(2);
    const y = pos.getY(10);
    h.update!(5);
    h.update!(2);
    expect(pos.getY(10)).toBe(y);
    expect(h.object3d.position.y).toBe(-1);
    h.dispose();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/environment.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`kit/modules/environment/sky.ts`
```ts
import * as THREE from 'three';
import type { SkyColors } from '../../runtime/style';
import type { ElementHandle } from '../../runtime/types';

export function createSky(colors: SkyColors): ElementHandle {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(colors.top) },
      horizon: { value: new THREE.Color(colors.horizon) },
      bottom: { value: new THREE.Color(colors.bottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.6)) : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.5));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    object3d: mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
```

`kit/modules/environment/heightfield.ts`
```ts
import { smoothstep } from '../../runtime/easing';
import { createNoise2D, rngFor } from '../../runtime/rng';

export interface TerrainParams {
  size: number;
  height: number;
  roughness: number;
  /** 이 반경 안은 높이 0 (개념 시각화 무대) */
  flatRadius: number;
}

export const TERRAIN_DEFAULTS: TerrainParams = { size: 200, height: 10, roughness: 0.5, flatRadius: 15 };

export function createHeightField(seed: number, p: TerrainParams): { heightAt(x: number, z: number): number } {
  const noise = createNoise2D(rngFor(seed, 'terrain'));
  const base = 2.2 / p.size;
  const gain = 0.35 + 0.4 * p.roughness;
  return {
    heightAt(x: number, z: number): number {
      let amp = 1;
      let freq = base;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < 5; o++) {
        sum += amp * noise(x * freq, z * freq);
        norm += amp;
        amp *= gain;
        freq *= 2;
      }
      const h = (sum / norm) * p.height;
      if (p.flatRadius <= 0) return h;
      const f = smoothstep((Math.hypot(x, z) - p.flatRadius) / (p.flatRadius * 1.5));
      return h * f;
    },
  };
}
```

`kit/modules/environment/terrain.ts`
```ts
import * as THREE from 'three';
import type { Style } from '../../runtime/style';
import type { ElementHandle, Quality } from '../../runtime/types';

export function createTerrain(
  ctx: { style: Style; quality: Quality },
  field: { heightAt(x: number, z: number): number },
  size: number,
): ElementHandle {
  const segs = ctx.quality === 'final' ? 160 : 90;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const heights = new Float32Array(pos.count);
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const h = field.heightAt(pos.getX(i), pos.getZ(i));
    heights[i] = h;
    pos.setY(i, h);
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const base = new THREE.Color(ctx.style.palette.ground);
  const low = base.clone().multiplyScalar(0.75);
  const high = base.clone().lerp(new THREE.Color('#ffffff'), 0.25);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = maxH > minH ? (heights[i] - minH) / (maxH - minH) : 0.5;
    c.copy(low).lerp(high, k);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = ctx.style.material('ground', { vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    object3d: mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
```

`kit/modules/environment/poisson.ts`
```ts
import type { Rng } from '../../runtime/rng';

/** Bridson Poisson-disk 샘플링, 영역 [-half, half]^2. rng 소비 순서가 고정되어 결정적. */
export function poissonDisk(rng: Rng, half: number, radius: number, maxPoints: number, k = 20): Array<[number, number]> {
  const cell = radius / Math.SQRT2;
  const gw = Math.max(1, Math.ceil((2 * half) / cell));
  const grid = new Int32Array(gw * gw).fill(-1);
  const pts: Array<[number, number]> = [];
  const active: number[] = [];
  const cellOf = (x: number, z: number): [number, number] => [
    Math.min(gw - 1, Math.max(0, Math.floor((x + half) / cell))),
    Math.min(gw - 1, Math.max(0, Math.floor((z + half) / cell))),
  ];
  const add = (x: number, z: number) => {
    pts.push([x, z]);
    const [cx, cz] = cellOf(x, z);
    grid[cz * gw + cx] = pts.length - 1;
    active.push(pts.length - 1);
  };
  if (maxPoints <= 0) return pts;
  add((rng() * 2 - 1) * half, (rng() * 2 - 1) * half);
  while (active.length > 0 && pts.length < maxPoints) {
    const ai = Math.floor(rng() * active.length);
    const [px, pz] = pts[active[ai]];
    let found = false;
    for (let n = 0; n < k; n++) {
      const a = rng() * Math.PI * 2;
      const r = radius * (1 + rng());
      const x = px + Math.cos(a) * r;
      const z = pz + Math.sin(a) * r;
      if (x < -half || x > half || z < -half || z > half) continue;
      const [cx, cz] = cellOf(x, z);
      let ok = true;
      for (let dz = -2; dz <= 2 && ok; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const gx = cx + dx;
          const gz = cz + dz;
          if (gx < 0 || gz < 0 || gx >= gw || gz >= gw) continue;
          const j = grid[gz * gw + gx];
          if (j < 0) continue;
          const [qx, qz] = pts[j];
          if ((qx - x) ** 2 + (qz - z) ** 2 < radius * radius) {
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        add(x, z);
        found = true;
        if (pts.length >= maxPoints) break;
      }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}
```

`kit/modules/environment/trees.ts`
```ts
import * as THREE from 'three';
import { rngFor } from '../../runtime/rng';
import type { Style } from '../../runtime/style';
import type { ElementHandle } from '../../runtime/types';
import { poissonDisk } from './poisson';

export interface TreesParams {
  count: number;
  area: number;
  avoidCenter: number;
}
export const TREES_DEFAULTS: TreesParams = { count: 250, area: 160, avoidCenter: 18 };

export interface TreePlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  phase: number;
}

export function placeTrees(seed: number, p: TreesParams, heightAt: (x: number, z: number) => number): TreePlacement[] {
  const rng = rngFor(seed, 'trees');
  const half = p.area / 2;
  const radius = Math.max(1.5, Math.sqrt((p.area * p.area) / (Math.max(1, p.count) * 1.6)));
  const raw = poissonDisk(rng, half, radius, Math.max(0, p.count) * 3);
  const out: TreePlacement[] = [];
  for (const [x, z] of raw) {
    if (out.length >= p.count) break;
    if (Math.hypot(x, z) < p.avoidCenter) continue;
    out.push({ x, z, y: heightAt(x, z), scale: 0.7 + rng() * 0.7, rot: rng() * Math.PI * 2, phase: rng() * Math.PI * 2 });
  }
  return out;
}

export function createTrees(ctx: { style: Style }, placements: TreePlacement[]): ElementHandle {
  const n = placements.length;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
  trunkGeo.translate(0, 0.8, 0);
  const lowGeo = new THREE.ConeGeometry(1.3, 2.4, 7);
  lowGeo.translate(0, 2.4, 0);
  const highGeo = new THREE.ConeGeometry(0.95, 1.9, 7);
  highGeo.translate(0, 3.4, 0);
  const trunkMat = ctx.style.material('trunk');
  const leafMat = ctx.style.material('foliage');
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const lows = new THREE.InstancedMesh(lowGeo, leafMat, n);
  const highs = new THREE.InstancedMesh(highGeo, leafMat, n);
  const group = new THREE.Group();
  for (const m of [trunks, lows, highs]) {
    m.frustumCulled = false;
    group.add(m);
  }
  const rng = rngFor(n, 'tree-colors');
  const base = new THREE.Color(ctx.style.palette.foliage);
  const tint = new THREE.Color();
  for (let i = 0; i < n; i++) {
    tint.copy(base).multiplyScalar(0.85 + rng() * 0.3);
    lows.setColorAt(i, tint);
    highs.setColorAt(i, tint);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const update = (t: number) => {
    for (let i = 0; i < n; i++) {
      const p = placements[i];
      const sway = 0.035 * Math.sin(t * 1.4 + p.phase);
      e.set(sway, p.rot, sway * 0.6);
      q.setFromEuler(e);
      pos.set(p.x, p.y, p.z);
      scl.setScalar(p.scale);
      m4.compose(pos, q, scl);
      trunks.setMatrixAt(i, m4);
      lows.setMatrixAt(i, m4);
      highs.setMatrixAt(i, m4);
    }
    trunks.instanceMatrix.needsUpdate = true;
    lows.instanceMatrix.needsUpdate = true;
    highs.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return {
    object3d: group,
    update,
    dispose() {
      trunkGeo.dispose();
      lowGeo.dispose();
      highGeo.dispose();
      trunkMat.dispose();
      leafMat.dispose();
      trunks.dispose();
      lows.dispose();
      highs.dispose();
    },
  };
}
```

`kit/modules/environment/water.ts`
```ts
import * as THREE from 'three';
import type { Style } from '../../runtime/style';
import type { ElementHandle } from '../../runtime/types';

export function createWater(ctx: { style: Style }, p: { level: number; size: number }): ElementHandle {
  const geo = new THREE.PlaneGeometry(p.size, p.size, 64, 64);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const mat = ctx.style.material('water', { transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = p.level;
  const update = (t: number) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(i, 0.12 * Math.sin(x * 0.35 + t * 1.3) + 0.08 * Math.cos(z * 0.28 + t * 0.9));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return {
    object3d: mesh,
    update,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
```

- [ ] **Step 4: 테스트 + 타입체크 통과 확인**

Run: `npx vitest run tests/unit/environment.test.ts` → PASS
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 5: Commit**

```bash
git add kit/modules/environment tests/unit/environment.test.ts
git commit -m "feat(kit): environment modules (sky, terrain, trees, water)"
```

---

### Task 6: 개념 요소 + 레지스트리 + defineScene/defineElement

**Files:**
- Create: `kit/runtime/element.ts`, `kit/runtime/scene.ts`, `kit/runtime/registry.ts`, `kit/modules/concept/{shape,label,arrow,bars,line}.ts`, `kit/modules/concept/params.ts`
- Test: `tests/unit/concept.test.ts`

**Interfaces:**
- Consumes: `ElementType`, `ElementHandle`, `KitContext`, `Role`, `Vec3`, `SceneDef` (Task 2), `clamp01`, `ease` (Task 1), `Style` (Task 4), `TypeInfo` (Task 3)
- Produces:
  - `element.ts`: `defineElement(def: ElementType): ElementType`
  - `scene.ts`: `defineScene(def: SceneDef): SceneDef`
  - `params.ts`: `num(v, d)`, `vec3(v, d)`, `role(v, d)`
  - `label.ts`: `createLabelMesh(o: LabelOptions): { mesh: THREE.Mesh; dispose(): void }`, `label: ElementType`
  - `shape`, `arrow`, `bars`, `line`: `ElementType`
  - `registry.ts`: `BUILTIN_ELEMENTS`, `elementRegistry(custom?): Map<string, ElementType>`(이름이 겹치면 throw), `typeInfo(reg): Map<string, TypeInfo>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/concept.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { shape } from '../../kit/modules/concept/shape';
import { arrow } from '../../kit/modules/concept/arrow';
import { bars } from '../../kit/modules/concept/bars';
import { line } from '../../kit/modules/concept/line';
import { elementRegistry, typeInfo } from '../../kit/runtime/registry';
import { defineElement } from '../../kit/runtime/element';
import type { KitContext } from '../../kit/runtime/types';

const ctx: KitContext = {
  style: getStyle('minimal'),
  rng: () => () => 0.5,
  heightAt: () => 0,
  quality: 'preview',
  camera: new THREE.PerspectiveCamera(),
};

describe('concept elements', () => {
  it('shape: 종류별 생성, 잘못된 kind는 오류', () => {
    for (const kind of ['box', 'sphere', 'cylinder', 'cone', 'torus']) {
      const h = shape.create(ctx, { kind, size: 2 });
      expect((h.object3d as THREE.Mesh).geometry).toBeDefined();
      h.dispose();
    }
    expect(() => shape.create(ctx, { kind: 'star' })).toThrow(/box\|sphere/);
  });
  it('arrow: progress에 따라 길이', () => {
    const h = arrow.create(ctx, { to: [0, 4, 0] });
    const [body, head] = h.object3d.children as THREE.Mesh[];
    h.setProgress!(0.5);
    expect(head.position.y).toBeCloseTo(2);
    h.setProgress!(0);
    expect(body.visible).toBe(false);
    expect(head.visible).toBe(false);
    expect(() => arrow.create(ctx, { to: [0, 0, 0] })).toThrow();
    h.dispose();
  });
  it('bars: 값 비례 높이, 순차 성장', () => {
    const h = bars.create(ctx, { values: [1, 2, 4], maxHeight: 4 });
    const bs = h.object3d.children as THREE.Mesh[];
    expect(bs[2].scale.y).toBeCloseTo(4);
    expect(bs[0].scale.y).toBeCloseTo(1);
    h.setProgress!(0.3);
    expect(bs[0].scale.y).toBeGreaterThan(bs[2].scale.y);
    expect(() => bars.create(ctx, { values: [] })).toThrow();
    expect(() => bars.create(ctx, { values: [1, 2], labels: ['a'] })).toThrow();
    h.dispose();
  });
  it('line: drawRange가 progress를 따름', () => {
    const h = line.create(ctx, { points: [[0, 0, 0], [1, 1, 0], [2, 0, 0]] });
    const geo = (h.object3d as THREE.Mesh).geometry;
    h.setProgress!(1);
    const full = geo.drawRange.count;
    h.setProgress!(0.5);
    expect(geo.drawRange.count).toBeLessThan(full);
    expect(geo.drawRange.count).toBeGreaterThan(0);
    expect(() => line.create(ctx, { points: [[0, 0, 0]] })).toThrow();
    h.dispose();
  });
});

describe('registry', () => {
  it('내장 요소와 grow 지원 정보', () => {
    const info = typeInfo(elementRegistry());
    expect([...info.keys()].sort()).toEqual(['arrow', 'bars', 'label', 'line', 'shape']);
    expect(info.get('arrow')!.supportsGrow).toBe(true);
    expect(info.get('shape')!.supportsGrow).toBe(false);
  });
  it('커스텀 요소 추가와 이름 충돌 (Review Focus 3)', () => {
    const custom = defineElement({ type: 'spiral', supportsGrow: true, create: () => ({ object3d: new THREE.Group(), dispose() {} }) });
    expect(elementRegistry([custom]).has('spiral')).toBe(true);
    const clash = defineElement({ type: 'shape', create: () => ({ object3d: new THREE.Group(), dispose() {} }) });
    expect(() => elementRegistry([clash])).toThrow(/겹침/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/concept.test.ts` → FAIL

- [ ] **Step 3: 구현**

`kit/runtime/element.ts`
```ts
import type { ElementType } from './types';

/** 커스텀 요소 정의. create는 ElementHandle을 반환하고, 상태는 t의 순수함수여야 한다. */
export function defineElement(def: ElementType): ElementType {
  return def;
}
```

`kit/runtime/scene.ts`
```ts
import type { SceneDef } from './types';

export type { SceneDef } from './types';

/** 장면 정의. 타입 검사와 자동완성을 위한 항등 함수. */
export function defineScene(def: SceneDef): SceneDef {
  return def;
}
```

`kit/modules/concept/params.ts`
```ts
import { ELEMENT_ROLES, type Role, type Vec3 } from '../../runtime/types';

export const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function vec3(v: unknown, d: Vec3): Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? (v as Vec3) : d;
}

export function role(v: unknown, d: Role): Role {
  return ELEMENT_ROLES.includes(v as Role) ? (v as Role) : d;
}
```

`kit/modules/concept/shape.ts`
```ts
import * as THREE from 'three';
import { defineElement } from '../../runtime/element';
import { num, role } from './params';

export const shape = defineElement({
  type: 'shape',
  supportsGrow: false,
  create(ctx, params) {
    const kind = String(params.kind ?? 'box');
    const size = num(params.size, 1);
    let geo: THREE.BufferGeometry;
    switch (kind) {
      case 'box':
        geo = new THREE.BoxGeometry(size, size, size);
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(size / 2, 32, 16);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(size / 2, size / 2, size, 32);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(size / 2, size, 32);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(size / 2, size * 0.15, 16, 48);
        break;
      default:
        throw new Error(`shape.kind '${kind}'은 지원하지 않음. 가능: box|sphere|cylinder|cone|torus`);
    }
    const mat = ctx.style.material(role(params.role, 'accent'));
    const mesh = new THREE.Mesh(geo, mat);
    return {
      object3d: mesh,
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  },
});
```

`kit/modules/concept/label.ts`
```ts
import * as THREE from 'three';
import { defineElement } from '../../runtime/element';
import { num, role } from './params';

export interface LabelOptions {
  text: string;
  /** 한 줄의 월드 높이(m) */
  size: number;
  color: string;
  font: string;
  background: string | null;
}

/** 캔버스 2D로 그린 텍스트 평면. 브라우저 전용(document 필요). */
export function createLabelMesh(o: LabelOptions): { mesh: THREE.Mesh; dispose(): void } {
  const px = 128;
  const lineH = px * 1.25;
  const pad = px * 0.35;
  const lines = o.text.split('\n');
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas 2d 컨텍스트를 만들 수 없음');
  const font = `700 ${px}px ${o.font}`;
  g.font = font;
  const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lineH * lines.length + pad * 2);
  canvas.width = w;
  canvas.height = h;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (o.background) {
    const r = Math.min(h / 2, lineH * 0.6);
    g.fillStyle = o.background;
    g.beginPath();
    g.roundRect(0, 0, w, h, r);
    g.fill();
  }
  g.fillStyle = o.color;
  lines.forEach((l, i) => g.fillText(l, w / 2, pad + lineH * (i + 0.5)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const planeH = o.size * (h / lineH);
  const geo = new THREE.PlaneGeometry(planeH * (w / h), planeH);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 10;
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

export const label = defineElement({
  type: 'label',
  supportsGrow: false,
  create(ctx, params) {
    const text = typeof params.text === 'string' ? params.text : '';
    if (!text) throw new Error('label.params.text가 필요함');
    const r = role(params.role, 'label');
    const { mesh, dispose } = createLabelMesh({
      text,
      size: num(params.size, 1),
      color: ctx.style.palette[r],
      font: ctx.style.labelFont,
      background: params.background === true ? ctx.style.palette.neutral : null,
    });
    const billboard = params.billboard !== false;
    const q = new THREE.Quaternion();
    return {
      object3d: mesh,
      update() {
        if (!billboard) return;
        const parent = mesh.parent;
        if (parent) {
          parent.updateWorldMatrix(true, false);
          parent.getWorldQuaternion(q).invert();
        } else {
          q.identity();
        }
        mesh.quaternion.copy(q.multiply(ctx.camera.quaternion));
      },
      dispose,
    };
  },
});
```

`kit/modules/concept/arrow.ts`
```ts
import * as THREE from 'three';
import { clamp01 } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { num, role, vec3 } from './params';

export const arrow = defineElement({
  type: 'arrow',
  supportsGrow: true,
  create(ctx, params) {
    const to = vec3(params.to, [0, 2, 0]);
    const dir = new THREE.Vector3(...to);
    const len = dir.length();
    if (len < 1e-6) throw new Error('arrow.params.to는 [0,0,0]이 아니어야 함 (요소 위치 기준 상대 좌표)');
    const thick = num(params.thickness, 0.08);
    const headLen = Math.min(len * 0.3, thick * 5);
    const bodyGeo = new THREE.CylinderGeometry(thick, thick, 1, 16);
    bodyGeo.translate(0, 0.5, 0);
    const headGeo = new THREE.ConeGeometry(thick * 2.5, headLen, 24);
    headGeo.translate(0, -headLen / 2, 0);
    const mat = ctx.style.material(role(params.role, 'accent'));
    const body = new THREE.Mesh(bodyGeo, mat);
    const head = new THREE.Mesh(headGeo, mat);
    const group = new THREE.Group();
    group.add(body, head);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const setProgress = (p: number) => {
      const L = len * clamp01(p);
      const bodyL = Math.max(0, L - headLen);
      body.scale.set(1, Math.max(bodyL, 1e-4), 1);
      body.visible = bodyL > 1e-4;
      head.position.y = L;
      head.scale.setScalar(Math.max(1e-4, Math.min(1, L / headLen)));
      head.visible = L > 1e-4;
    };
    setProgress(1);
    return {
      object3d: group,
      setProgress,
      dispose() {
        bodyGeo.dispose();
        headGeo.dispose();
        mat.dispose();
      },
    };
  },
});
```

`kit/modules/concept/bars.ts`
```ts
import * as THREE from 'three';
import { clamp01, ease } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { ELEMENT_ROLES, type Role } from '../../runtime/types';
import { createLabelMesh } from './label';
import { num } from './params';

export const bars = defineElement({
  type: 'bars',
  supportsGrow: true,
  create(ctx, params) {
    const values = params.values;
    if (!Array.isArray(values) || values.length === 0 || !values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('bars.params.values는 숫자 배열이어야 함 (1개 이상)');
    }
    const labels = params.labels;
    if (labels !== undefined && (!Array.isArray(labels) || labels.length !== values.length)) {
      throw new Error('bars.params.labels는 values와 길이가 같은 문자열 배열이어야 함');
    }
    const roles: Role[] = Array.isArray(params.roles) && params.roles.every((r) => ELEMENT_ROLES.includes(r as Role))
      ? (params.roles as Role[])
      : ['accent', 'accent2', 'accent3'];
    const w = num(params.width, 1);
    const gap = num(params.gap, 0.4);
    const maxH = num(params.maxHeight, 5);
    const n = values.length;
    const max = Math.max(...values.map((v) => Math.abs(v)), 1e-6);
    const total = n * w + (n - 1) * gap;
    const geo = new THREE.BoxGeometry(w, 1, w);
    geo.translate(0, 0.5, 0);
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    const meshes: THREE.Mesh[] = [];
    const heights: number[] = [];
    values.forEach((v, i) => {
      const mat = ctx.style.material(roles[i % roles.length]);
      mats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.x = -total / 2 + w / 2 + i * (w + gap);
      group.add(m);
      meshes.push(m);
      heights.push(Math.max(1e-4, (Math.abs(v) / max) * maxH));
    });
    const labelParts = (labels as string[] | undefined)?.map((text, i) => {
      const l = createLabelMesh({ text: String(text), size: w * 0.45, color: ctx.style.palette.label, font: ctx.style.labelFont, background: null });
      l.mesh.position.set(meshes[i].position.x, -w * 0.4, w * 0.6);
      group.add(l.mesh);
      return l;
    }) ?? [];
    const s = n > 1 ? 0.5 / (n - 1) : 0;
    const setProgress = (p: number) => {
      meshes.forEach((b, i) => {
        const pi = clamp01(p * (1 + s * (n - 1)) - i * s);
        b.scale.y = Math.max(1e-4, heights[i] * ease('out', pi));
        b.visible = pi > 0;
      });
    };
    setProgress(1);
    return {
      object3d: group,
      setProgress,
      dispose() {
        geo.dispose();
        mats.forEach((m) => m.dispose());
        labelParts.forEach((l) => l.dispose());
      },
    };
  },
});
```

`kit/modules/concept/line.ts`
```ts
import * as THREE from 'three';
import { clamp01 } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { num, role } from './params';

export const line = defineElement({
  type: 'line',
  supportsGrow: true,
  create(ctx, params) {
    const pts = params.points;
    const ok = Array.isArray(pts) && pts.length >= 2 &&
      pts.every((p) => Array.isArray(p) && p.length === 3 && p.every((x) => typeof x === 'number' && Number.isFinite(x)));
    if (!ok) throw new Error('line.params.points는 [x,y,z] 점 2개 이상이어야 함 (요소 위치 기준 상대 좌표)');
    const curve = new THREE.CatmullRomCurve3((pts as number[][]).map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const tubular = Math.max(32, (pts as unknown[]).length * 24);
    const radial = 8;
    const geo = new THREE.TubeGeometry(curve, tubular, num(params.radius, 0.06), radial, false);
    const mat = ctx.style.material(role(params.role, 'accent'));
    const mesh = new THREE.Mesh(geo, mat);
    const perSeg = radial * 6;
    const setProgress = (p: number) => {
      const segs = Math.round(clamp01(p) * tubular);
      geo.setDrawRange(0, segs * perSeg);
      mesh.visible = segs > 0;
    };
    setProgress(1);
    return {
      object3d: mesh,
      setProgress,
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  },
});
```

`kit/runtime/registry.ts`
```ts
import { arrow } from '../modules/concept/arrow';
import { bars } from '../modules/concept/bars';
import { label } from '../modules/concept/label';
import { line } from '../modules/concept/line';
import { shape } from '../modules/concept/shape';
import type { ElementType } from './types';
import type { TypeInfo } from './validate';

export const BUILTIN_ELEMENTS: readonly ElementType[] = [shape, label, arrow, bars, line];

export function elementRegistry(custom: ElementType[] = []): Map<string, ElementType> {
  const m = new Map<string, ElementType>();
  for (const d of BUILTIN_ELEMENTS) m.set(d.type, d);
  for (const d of custom) {
    if (!d || typeof d.type !== 'string' || typeof d.create !== 'function') {
      throw new Error('custom 항목은 defineElement({ type, create })로 만든 값이어야 함');
    }
    if (m.has(d.type)) throw new Error(`커스텀 요소 type '${d.type}'이 기존 요소와 겹침`);
    m.set(d.type, d);
  }
  return m;
}

export function typeInfo(reg: Map<string, ElementType>): Map<string, TypeInfo> {
  return new Map([...reg].map(([k, d]) => [k, { supportsGrow: !!d.supportsGrow }]));
}
```

- [ ] **Step 4: 테스트 + 타입체크 통과 확인**

Run: `npx vitest run tests/unit/concept.test.ts` → PASS
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 5: Commit**

```bash
git add kit/runtime kit/modules/concept tests/unit/concept.test.ts
git commit -m "feat(kit): concept elements, registry, defineScene/defineElement"
```

---

### Task 7: 월드 런타임 (buildWorld)

**Files:**
- Create: `kit/runtime/world.ts`
- Test: `tests/unit/world.test.ts`

**Interfaces:**
- Consumes: Task 1–6의 모든 공개 함수
- Produces: `interface World { scene; camera; setTime(t): void; dispose(): void }`, `buildWorld(def: SceneDef, opts: { quality: Quality; aspect: number }): { world: World | null; issues: Issue[] }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/world.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildWorld } from '../../kit/runtime/world';
import type { SceneDef } from '../../kit/runtime/types';

const base = (): SceneDef => ({
  meta: { width: 1080, height: 1920, fps: 30, duration: 10, seed: 3 },
  style: 'stylized',
  environment: { sky: { preset: 'dusk' }, terrain: { size: 120 }, trees: { count: 30 }, water: { level: -1 } },
  elements: [
    { id: 'ball', type: 'shape', at: [0, 2, 0], params: { kind: 'sphere' }, enter: { t: 1, anim: 'fade', dur: 1 }, exit: { t: 6, anim: 'pop', dur: 1 } },
    { id: 'arr', type: 'arrow', at: [1, 0, 0], params: { to: [0, 3, 0] }, enter: { t: 2, anim: 'grow', dur: 2 },
      tracks: { 'position.x': [[2, 1], [4, 5]] } },
  ],
  shots: [
    { id: 'a', start: 0, end: 5, camera: { move: 'dolly', from: [0, 5, 30], to: [0, 5, 20], target: [0, 2, 0] } },
    { id: 'b', start: 5, end: 10, camera: { move: 'static', pos: [10, 4, 10], target: [0, 2, 0] } },
  ],
});

const holder = (w: { scene: THREE.Scene }, id: string) => w.scene.getObjectByName(id)!;

describe('buildWorld', () => {
  it('샷별 카메라', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1080 / 1920 });
    world!.setTime(0);
    expect(world!.camera.position.z).toBeCloseTo(30);
    world!.setTime(7);
    expect(world!.camera.position.toArray()).toEqual([10, 4, 10]);
    world!.dispose();
  });
  it('enter/exit 가시성과 opacity', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1 });
    const w = world!;
    w.setTime(0.5);
    expect(holder(w, 'ball').visible).toBe(false);
    w.setTime(1.5);
    const mat = ((holder(w, 'ball').children[0] as THREE.Mesh).material as THREE.Material);
    expect(holder(w, 'ball').visible).toBe(true);
    expect(mat.opacity).toBeGreaterThan(0);
    expect(mat.opacity).toBeLessThan(1);
    w.setTime(8);
    expect(holder(w, 'ball').visible).toBe(false);
    w.dispose();
  });
  it('grow progress와 tracks', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1 });
    const w = world!;
    w.setTime(3);
    expect(holder(w, 'arr').position.x).toBeCloseTo(3);
    const head = holder(w, 'arr').children[0].children[1];
    const mid = head.position.y;
    w.setTime(5);
    expect(head.position.y).toBeGreaterThan(mid);
    w.dispose();
  });
  it('시간 순서와 무관 (seekable)', () => {
    const { world } = buildWorld(base(), { quality: 'preview', aspect: 1 });
    const w = world!;
    const snap = () => JSON.stringify([w.camera.position.toArray(), holder(w, 'arr').position.toArray(), holder(w, 'ball').visible]);
    w.setTime(3.3);
    const a = snap();
    w.setTime(9);
    w.setTime(0.1);
    w.setTime(3.3);
    expect(snap()).toBe(a);
    w.dispose();
  });
  it('환경 없는 장면도 생성 (Review Focus 1)', () => {
    const def = base();
    delete def.environment;
    const { world, issues } = buildWorld(def, { quality: 'preview', aspect: 1 });
    expect(issues).toEqual([]);
    world!.setTime(2);
    world!.dispose();
  });
  it('모듈 생성 오류는 이슈로 보고', () => {
    const def = base();
    def.elements![0].params = { kind: 'star' };
    const { world, issues } = buildWorld(def, { quality: 'preview', aspect: 1 });
    expect(world).toBeNull();
    expect(issues[0].path).toBe('elements[0].params');
    expect(issues[0].message).toMatch(/star/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/world.test.ts` → FAIL

- [ ] **Step 3: 구현**

`kit/runtime/world.ts`
```ts
import * as THREE from 'three';
import { createHeightField, TERRAIN_DEFAULTS } from '../modules/environment/heightfield';
import { createSky } from '../modules/environment/sky';
import { createTerrain } from '../modules/environment/terrain';
import { createTrees, placeTrees, TREES_DEFAULTS } from '../modules/environment/trees';
import { createWater } from '../modules/environment/water';
import { getStyle } from '../styles';
import { cameraPose, DEFAULT_FOV } from './camera';
import { elementRegistry } from './registry';
import { rngFor } from './rng';
import { createLights } from './style';
import { elementState, findShot, sampleTrack } from './timeline';
import type { ElementDef, ElementHandle, KitContext, Quality, SceneDef, TrackPath } from './types';
import type { Issue } from './validate';

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 절대시간 t의 상태로 장면을 맞춘다. 호출 순서와 무관하게 같은 결과. */
  setTime(t: number): void;
  dispose(): void;
}

interface Item {
  el: ElementDef;
  h: ElementHandle;
  holder: THREE.Group;
  mats: Array<{ m: THREE.Material; base: number }>;
}

const DEG = Math.PI / 180;

function collectMaterials(obj: THREE.Object3D): THREE.Material[] {
  const set = new Set<THREE.Material>();
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (Array.isArray(m)) m.forEach((x) => set.add(x));
    else if (m) set.add(m);
  });
  return [...set];
}

export function buildWorld(def: SceneDef, opts: { quality: Quality; aspect: number }): { world: World | null; issues: Issue[] } {
  const disposables: Array<{ dispose(): void }> = [];
  const disposeAll = () => {
    for (const d of disposables) d.dispose();
  };
  const issues: Issue[] = [];
  let registry;
  try {
    registry = elementRegistry(def.custom ?? []);
  } catch (e) {
    return { world: null, issues: [{ path: 'custom', message: (e as Error).message }] };
  }

  const style = getStyle(def.style);
  const env = def.environment ?? {};
  const sky = style.sky(env.sky?.preset ?? 'day');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sky.horizon);
  scene.fog = new THREE.FogExp2(sky.fog, style.fogDensity);
  const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, opts.aspect, 0.1, 2000);
  const updaters: Array<(t: number) => void> = [];
  const addEnv = (h: ElementHandle) => {
    scene.add(h.object3d);
    disposables.push(h);
    if (h.update) updaters.push((t) => h.update!(t));
  };

  addEnv(createSky(sky));
  for (const l of createLights(sky, style)) scene.add(l);
  let heightAt = (_x: number, _z: number) => 0;
  if (env.terrain) {
    const tp = { ...TERRAIN_DEFAULTS, ...env.terrain };
    const field = createHeightField(def.meta.seed, tp);
    heightAt = field.heightAt;
    addEnv(createTerrain({ style, quality: opts.quality }, field, tp.size));
  }
  if (env.trees) {
    addEnv(createTrees({ style }, placeTrees(def.meta.seed, { ...TREES_DEFAULTS, ...env.trees }, heightAt)));
  }
  if (env.water) {
    addEnv(createWater({ style }, { level: env.water.level ?? -1, size: env.water.size ?? env.terrain?.size ?? TERRAIN_DEFAULTS.size }));
  }

  const ctx: KitContext = {
    style,
    rng: (salt) => rngFor(def.meta.seed, `el:${salt}`),
    heightAt,
    quality: opts.quality,
    camera,
  };
  const items: Item[] = [];
  (def.elements ?? []).forEach((el, i) => {
    const type = registry.get(el.type);
    if (!type) {
      issues.push({ path: `elements[${i}].type`, message: `'${el.type}'은 알 수 없는 요소` });
      return;
    }
    try {
      const h = type.create(ctx, el.params ?? {});
      disposables.push(h);
      const holder = new THREE.Group();
      holder.name = el.id;
      holder.add(h.object3d);
      scene.add(holder);
      const mats = collectMaterials(h.object3d).map((m) => {
        m.transparent = true;
        return { m, base: m.opacity };
      });
      items.push({ el, h, holder, mats });
    } catch (e) {
      issues.push({ path: `elements[${i}].params`, message: (e as Error).message });
    }
  });
  if (issues.length > 0) {
    disposeAll();
    return { world: null, issues };
  }

  const setTime = (t: number) => {
    const { shot, u } = findShot(def.shots, t);
    const pose = cameraPose(shot.camera, u);
    camera.position.set(...pose.position);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    for (const f of updaters) f(t);
    for (const it of items) {
      const st = elementState(it.el, t);
      it.holder.visible = st.visible;
      if (!st.visible) continue;
      const at = it.el.at ?? [0, 0, 0];
      const rot = it.el.rotation ?? [0, 0, 0];
      const tracks = it.el.tracks ?? {};
      const val = (p: TrackPath, d: number) => {
        const keys = tracks[p];
        return keys ? sampleTrack(keys, t) : d;
      };
      it.holder.position.set(val('position.x', at[0]), val('position.y', at[1]) + st.dy, val('position.z', at[2]));
      it.holder.rotation.set(val('rotation.x', rot[0]) * DEG, val('rotation.y', rot[1]) * DEG, val('rotation.z', rot[2]) * DEG);
      it.holder.scale.setScalar(val('scale', it.el.scale ?? 1) * st.scale);
      const op = st.opacity * val('opacity', 1);
      if (it.h.setOpacity) it.h.setOpacity(op);
      else for (const { m, base } of it.mats) m.opacity = base * op;
      if (it.h.setProgress && st.progress !== null) it.h.setProgress(st.progress);
      it.h.update?.(t);
    }
  };

  return {
    world: {
      scene,
      camera,
      setTime,
      dispose() {
        disposeAll();
        scene.clear();
      },
    },
    issues: [],
  };
}
```

- [ ] **Step 4: 전체 단위 테스트 + 타입체크**

Run: `npx vitest run` → 모든 테스트 PASS
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 5: Commit**

```bash
git add kit/runtime/world.ts tests/unit/world.test.ts
git commit -m "feat(kit): world runtime evaluating scene data at absolute time"
```

---

### Task 8: 미리보기 페이지 + 캡처 브리지 + 프로젝트 템플릿

**Files:**
- Create: `kit/preview/main.ts`, `kit/preview/sheet.ts`, `kit/preview/timeline-ui.ts`, `kit/preview/ui.css`
- Create: `template/index.html`, `template/package.json`, `template/vite.config.ts`, `template/tsconfig.json`, `template/scene.ts`, `template/gitignore` (init이 `.gitignore`로 복사. npm 패키징 관례에 따라 점 없는 이름으로 보관)

**Interfaces:**
- Consumes: `buildWorld`, `validateScene`, `elementRegistry`, `typeInfo`, `SceneDef`
- Produces:
  - `boot(def: SceneDef): void`: `window.__KIT__`을 설치한다.
  - `window.__KIT__`: `{ ready: Promise<{ ok, errors }>, info(): { width, height, fps, duration, shots: { id, start, end }[] }, renderAt(t): Promise<void>, capture(): string, sheet(times, cols): Promise<string>, gpu(): string }`
  - `composeSheet(renderAt, src, times, cols): Promise<string>`
  - `createTimelineUI(opts)`

- [ ] **Step 1: 구현 (브라우저 코드는 Task 10 E2E로 검증한다)**

`kit/preview/sheet.ts`
```ts
/** 여러 시점의 프레임을 한 장의 콘택트 시트(PNG data URL)로 합성 */
export async function composeSheet(
  renderAt: (t: number) => Promise<void>,
  src: HTMLCanvasElement,
  times: number[],
  cols: number,
): Promise<string> {
  const tw = 360;
  const th = Math.round((tw * src.height) / src.width);
  const pad = 8;
  const labelH = 28;
  const c = Math.max(1, Math.min(cols, times.length));
  const rows = Math.ceil(times.length / c);
  const out = document.createElement('canvas');
  out.width = c * tw + (c + 1) * pad;
  out.height = rows * (th + labelH) + (rows + 1) * pad;
  const g = out.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < times.length; i++) {
    await renderAt(times[i]);
    const x = pad + (i % c) * (tw + pad);
    const y = pad + Math.floor(i / c) * (th + labelH + pad);
    g.drawImage(src, x, y, tw, th);
    g.fillStyle = '#fff';
    g.font = 'bold 18px sans-serif';
    g.fillText(`t=${times[i].toFixed(2)}s`, x + 4, y + th + 20);
  }
  return out.toDataURL('image/png');
}
```

`kit/preview/timeline-ui.ts`
```ts
import type { SceneDef } from '../runtime/types';

const COLORS = ['#ff7a59', '#5ec2b7', '#ffd166', '#8e7cc3', '#4f9be8', '#e56b9f'];

/** 미리보기 전용 UI. 재생 루프만 실시간을 쓰고, 그리기는 항상 renderAt(t)로 seek한다. */
export function createTimelineUI(opts: {
  root: HTMLElement;
  stage: HTMLElement;
  def: SceneDef;
  renderAt: (t: number) => Promise<void>;
}) {
  const { duration, fps } = opts.def.meta;
  const bar = document.createElement('div');
  bar.className = 'kit-timeline';
  const track = document.createElement('div');
  track.className = 'kit-track';
  opts.def.shots.forEach((s, i) => {
    const b = document.createElement('div');
    b.className = 'kit-shot';
    b.style.left = `${(s.start / duration) * 100}%`;
    b.style.width = `${((s.end - s.start) / duration) * 100}%`;
    b.style.background = COLORS[i % COLORS.length];
    b.textContent = s.id;
    track.appendChild(b);
  });
  for (const el of opts.def.elements ?? []) {
    for (const [kind, cue] of [['enter', el.enter], ['exit', el.exit]] as const) {
      if (!cue) continue;
      const m = document.createElement('div');
      m.className = `kit-marker kit-${kind}`;
      m.style.left = `${(cue.t / duration) * 100}%`;
      m.title = `${el.id} ${kind} ${cue.t}s (${cue.anim})`;
      track.appendChild(m);
    }
  }
  const head = document.createElement('div');
  head.className = 'kit-head';
  track.appendChild(head);
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = String(duration);
  range.step = String(1 / fps);
  range.value = '0';
  const play = document.createElement('button');
  play.textContent = '▶';
  const readout = document.createElement('span');
  readout.className = 'kit-readout';
  const controls = document.createElement('div');
  controls.className = 'kit-controls';
  controls.append(play, range, readout);
  bar.append(track, controls);
  opts.root.appendChild(bar);

  let t = 0;
  let playing = false;
  let last = 0;
  const shotAt = (time: number) => {
    let id = opts.def.shots[0].id;
    for (const s of opts.def.shots) if (time >= s.start) id = s.id;
    return id;
  };
  const show = async (time: number) => {
    t = Math.min(Math.max(time, 0), duration);
    range.value = String(t);
    head.style.left = `${(t / duration) * 100}%`;
    readout.textContent = `${t.toFixed(2)} / ${duration}s · frame ${Math.round(t * fps)} · shot ${shotAt(t)}`;
    await opts.renderAt(t);
  };
  const loop = (now: number) => {
    if (!playing) return;
    const dt = (now - last) / 1000;
    last = now;
    let next = t + dt;
    if (next >= duration) next = 0;
    void show(next).then(() => requestAnimationFrame(loop));
  };
  const toggle = () => {
    playing = !playing;
    play.textContent = playing ? '❚❚' : '▶';
    if (playing) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  };
  play.addEventListener('click', toggle);
  range.addEventListener('input', () => {
    if (playing) toggle();
    void show(Number(range.value));
  });
  track.addEventListener('click', (e) => {
    const r = track.getBoundingClientRect();
    if (playing) toggle();
    void show(((e.clientX - r.left) / r.width) * duration);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      toggle();
    } else if (e.code === 'ArrowRight') void show(t + 1 / fps);
    else if (e.code === 'ArrowLeft') void show(t - 1 / fps);
  });
  void show(0);
}
```

`kit/preview/main.ts`
```ts
import * as THREE from 'three';
import { elementRegistry, typeInfo } from '../runtime/registry';
import type { SceneDef } from '../runtime/types';
import { validateScene, type Issue } from '../runtime/validate';
import { buildWorld } from '../runtime/world';
import { composeSheet } from './sheet';
import { createTimelineUI } from './timeline-ui';
import './ui.css';

export interface KitStatus {
  ok: boolean;
  errors: Issue[];
}

export interface KitBridge {
  ready: Promise<KitStatus>;
  info(): { width: number; height: number; fps: number; duration: number; shots: Array<{ id: string; start: number; end: number }> };
  renderAt(t: number): Promise<void>;
  capture(): string;
  sheet(times: number[], cols: number): Promise<string>;
  gpu(): string;
}

declare global {
  interface Window {
    __KIT__: KitBridge;
  }
}

function showErrors(errors: Issue[]) {
  const box = document.createElement('pre');
  box.className = 'kit-errors';
  box.textContent = ['장면 오류:', ...errors.map((e) => `- ${e.path || '(root)'}: ${e.message}`)].join('\n');
  document.body.appendChild(box);
}

export function boot(def: SceneDef): void {
  const qs = new URLSearchParams(location.search);
  const capture = qs.get('capture') === '1';
  const quality = qs.get('quality') === 'final' ? 'final' : 'preview';
  document.body.classList.toggle('kit-capture', capture);

  let renderer: THREE.WebGLRenderer | null = null;
  let renderAt: (t: number) => Promise<void> = async () => {
    throw new Error('장면이 준비되지 않음');
  };
  const canvas = document.createElement('canvas');

  const start = async (): Promise<KitStatus> => {
    let types;
    try {
      types = typeInfo(elementRegistry(def?.custom ?? []));
    } catch (e) {
      return { ok: false, errors: [{ path: 'custom', message: (e as Error).message }] };
    }
    const errors = validateScene(def, types);
    if (errors.length) return { ok: false, errors };
    await document.fonts.load(`700 64px ${'"Malgun Gothic"'}`).catch(() => undefined);
    await document.fonts.ready;
    const { meta } = def;
    const k = quality === 'final' ? 1 : 0.5;
    const w = Math.round((meta.width * k) / 2) * 2;
    const h = Math.round((meta.height * k) / 2) * 2;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    } catch (e) {
      return { ok: false, errors: [{ path: 'renderer', message: `WebGL 초기화 실패: ${(e as Error).message}` }] };
    }
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const built = buildWorld(def, { quality, aspect: meta.width / meta.height });
    if (!built.world) return { ok: false, errors: built.issues };
    const world = built.world;
    const r = renderer;
    renderAt = async (t: number) => {
      const tc = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), meta.duration);
      world.setTime(tc);
      r.render(world.scene, world.camera);
    };
    const stage = document.createElement('div');
    stage.className = 'kit-stage';
    stage.appendChild(canvas);
    document.body.appendChild(stage);
    if (!capture) createTimelineUI({ root: document.body, stage, def, renderAt });
    else await renderAt(0);
    return { ok: true, errors: [] };
  };

  const ready = start().catch((e: unknown) => ({
    ok: false,
    errors: [{ path: '', message: String((e as Error)?.stack ?? e) }],
  }));
  void ready.then((s) => {
    if (!s.ok) showErrors(s.errors);
  });

  window.__KIT__ = {
    ready,
    info: () => ({
      width: def.meta.width,
      height: def.meta.height,
      fps: def.meta.fps,
      duration: def.meta.duration,
      shots: def.shots.map((s) => ({ id: s.id, start: s.start, end: s.end })),
    }),
    renderAt: (t) => renderAt(t),
    capture: () => canvas.toDataURL('image/png'),
    sheet: (times, cols) => composeSheet((t) => renderAt(t), canvas, times, cols),
    gpu: () => {
      const gl = renderer?.getContext();
      if (!gl) return 'none';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    },
  };
}
```

`kit/preview/ui.css`
```css
html, body { margin: 0; background: #16171d; color: #e8e8ea; font-family: system-ui, sans-serif; }
.kit-stage { display: flex; justify-content: center; padding: 12px 0 0; }
.kit-stage canvas { max-height: 72vh; max-width: 96vw; height: auto; box-shadow: 0 6px 30px rgba(0,0,0,.5); }
.kit-capture .kit-stage { padding: 0; display: block; }
.kit-capture .kit-stage canvas { max-height: none; max-width: none; box-shadow: none; display: block; }
.kit-timeline { max-width: 900px; margin: 14px auto; padding: 0 16px; }
.kit-track { position: relative; height: 34px; background: #24252d; border-radius: 6px; overflow: hidden; cursor: pointer; }
.kit-shot { position: absolute; top: 0; bottom: 0; opacity: .55; font-size: 12px; padding: 2px 6px; box-sizing: border-box; color: #111; white-space: nowrap; overflow: hidden; border-right: 2px solid #16171d; }
.kit-marker { position: absolute; bottom: 0; width: 2px; height: 12px; background: #fff; }
.kit-exit { background: #ff6b6b; }
.kit-head { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; box-shadow: 0 0 6px #fff; }
.kit-controls { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
.kit-controls input { flex: 1; }
.kit-controls button { background: #3a3c48; color: #fff; border: 0; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
.kit-readout { font-variant-numeric: tabular-nums; font-size: 13px; min-width: 260px; text-align: right; }
.kit-errors { margin: 16px; padding: 12px; background: #3a1d22; color: #ffd7d7; border-radius: 6px; white-space: pre-wrap; }
```

`template/index.html`
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <title>scene preview</title>
  </head>
  <body>
    <script type="module">
      import scene from '/scene.ts';
      import { boot } from '/kit/preview/main.ts';
      boot(scene);
    </script>
  </body>
</html>
```

`template/package.json`
```json
{
  "name": "__NAME__",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --open"
  },
  "dependencies": {
    "three": "0.186.1"
  },
  "devDependencies": {
    "@types/three": "0.186.0",
    "playwright": "1.63.0",
    "vite": "8.3.4"
  }
}
```

`template/vite.config.ts`
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: { include: ['three'], noDiscovery: true },
});
```

`template/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["scene.ts", "custom", "kit"]
}
```

`template/gitignore`
```
node_modules/
out/
```

`template/scene.ts` (샘플: 광합성 짧은 영상, 12초, 3샷. 한글 여러 줄 라벨 포함)
```ts
import { defineScene } from './kit/runtime/scene';

export default defineScene({
  meta: { width: 1080, height: 1920, fps: 30, duration: 12, seed: 7 },
  style: 'stylized',
  environment: {
    sky: { preset: 'dawn' },
    terrain: { size: 200, height: 10, roughness: 0.5, flatRadius: 15 },
    trees: { count: 220, area: 170, avoidCenter: 18 },
    water: { level: -1.5 },
  },
  elements: [
    { id: 'title', type: 'label', at: [0, 10, 0], params: { text: '빛은 어떻게\n에너지가 될까?', size: 1.3, background: true },
      enter: { t: 0.5, anim: 'rise', dur: 0.8 }, exit: { t: 3.6, anim: 'fade', dur: 0.4 } },
    { id: 'sun', type: 'shape', at: [-5, 9, -2], params: { kind: 'sphere', size: 2.4, role: 'accent2' },
      enter: { t: 4.2, anim: 'pop', dur: 0.6 } },
    { id: 'ray', type: 'arrow', at: [-3.9, 8, -1.5], params: { to: [4.6, -5.6, 1.5], thickness: 0.1, role: 'accent2' },
      enter: { t: 4.8, anim: 'grow', dur: 1.2 } },
    { id: 'leaf', type: 'shape', at: [1.2, 1.2, 0], rotation: [0, 0, -15], params: { kind: 'cone', size: 2.6, role: 'accent3' },
      enter: { t: 5.4, anim: 'pop', dur: 0.6 } },
    { id: 'chartTitle', type: 'label', at: [0, 7.4, 2], params: { text: '시간대별 광합성량', size: 0.8 },
      enter: { t: 8.1, anim: 'fade', dur: 0.5 } },
    { id: 'chart', type: 'bars', at: [0, 0.6, 2], params: { values: [2, 5, 8], labels: ['아침', '정오', '오후'], maxHeight: 5 },
      enter: { t: 8.3, anim: 'grow', dur: 1.4 } },
  ],
  shots: [
    { id: 'open', start: 0, end: 4, camera: { move: 'dolly', from: [0, 10, 44], to: [0, 9, 26], target: [0, 7, 0] } },
    { id: 'concept', start: 4, end: 8, camera: { move: 'orbit', center: [-1, 5, 0], radius: 17, height: 2, fromDeg: -25, toDeg: 15 } },
    { id: 'chart', start: 8, end: 12, camera: { move: 'dolly', from: [0, 5, 19], to: [0, 4.6, 14], target: [0, 3.4, 2] } },
  ],
});
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: 오류 없음. 이때 `template/`는 include 대상이 아니다. `kit/preview`가 DOM 타입으로 컴파일되는지 확인한다.

- [ ] **Step 3: Commit**

```bash
git add kit/preview template
git commit -m "feat(kit): preview page, capture bridge, timeline UI, project template"
```

---

### Task 9: 스크립트 공통 라이브러리 + init + update

**Files:**
- Create: `scripts/lib/args.mjs`, `scripts/lib/output.mjs`, `scripts/lib/paths.mjs`, `scripts/lib/manifest.mjs`, `scripts/lib/project.mjs`, `scripts/init.mjs`, `scripts/update.mjs`, `.claude-plugin/plugin.json`(버전 소스)
- Test: `tests/scripts/init-update.test.mjs`

**Interfaces:**
- Produces:
  - `args.mjs`: `parseArgs(argv): { pos: string[], opts: Record<string, string|true> }`
  - `output.mjs`: `class ScriptError(errors, extra?)`, `run(fn, help)`. `fn`은 결과 객체를 반환하고, `run`이 `{ok:true,...}`를 출력한다. ScriptError나 다른 예외는 `{ok:false,errors}`와 exit 1로 바꾼다.
  - `paths.mjs`: `PLUGIN_ROOT`, `KIT_DIR`, `TEMPLATE_DIR`, `pluginVersion()`
  - `manifest.mjs`: `listFiles(dir)`, `sha256(file)`, `buildManifest(kitDir, version)`, `diffManifest(kitDir, manifest): { modified, missing, extra }`, `readManifest(kitDir)`, `writeManifest(kitDir, version)`
  - `project.mjs`: `resolveProject(dirArg, { needModules })`, `importFromProject(dir, pkg)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scripts/init-update.test.mjs`
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const runScript = (name, args) => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', name), ...args], { encoding: 'utf8' });
  const lines = r.stdout.trim().split('\n');
  return { code: r.status, out: JSON.parse(lines[lines.length - 1]) };
};

describe('init / update', () => {
  let dir;
  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'tsk-')), 'proj');
  });

  it('init: 구조, style 치환, manifest, 이름', () => {
    const { code, out } = runScript('init.mjs', [dir, '--style', 'minimal']);
    expect(code).toBe(0);
    expect(out.ok).toBe(true);
    for (const f of ['scene.ts', 'index.html', 'package.json', 'vite.config.ts', '.gitignore', 'kit/runtime/world.ts', 'kit/manifest.json']) {
      expect(existsSync(join(dir, f))).toBe(true);
    }
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toContain("style: 'minimal'");
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name).toBe('proj');
    const m = JSON.parse(readFileSync(join(dir, 'kit', 'manifest.json'), 'utf8'));
    expect(m.version).toBe(JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version);
    expect(Object.keys(m.files)).toContain('runtime/world.ts');
  });

  it('init: 비어 있지 않으면 거부, --force는 scene.ts 보존', () => {
    runScript('init.mjs', [dir]);
    writeFileSync(join(dir, 'scene.ts'), '// my scene');
    const again = runScript('init.mjs', [dir]);
    expect(again.code).toBe(1);
    expect(again.out.ok).toBe(false);
    const forced = runScript('init.mjs', [dir, '--force']);
    expect(forced.out.ok).toBe(true);
    expect(readFileSync(join(dir, 'scene.ts'), 'utf8')).toBe('// my scene');
    expect(forced.out.skipped).toContain('scene.ts');
  });

  it('init: 잘못된 style, 인자 없음', () => {
    expect(runScript('init.mjs', [dir, '--style', 'anime']).out.ok).toBe(false);
    expect(runScript('init.mjs', []).out.ok).toBe(false);
  });

  it('update: 수정된 kit 파일이 있으면 거부, --force면 갱신', () => {
    runScript('init.mjs', [dir]);
    const f = join(dir, 'kit', 'runtime', 'easing.ts');
    writeFileSync(f, readFileSync(f, 'utf8') + '\n// local edit\n');
    const refused = runScript('update.mjs', ['--project', dir]);
    expect(refused.out.ok).toBe(false);
    expect(JSON.stringify(refused.out)).toContain('runtime/easing.ts');
    const forced = runScript('update.mjs', ['--project', dir, '--force']);
    expect(forced.out.ok).toBe(true);
    expect(readFileSync(f, 'utf8')).not.toContain('local edit');
  });

  it('update: 수정 없으면 그대로 갱신', () => {
    runScript('init.mjs', [dir]);
    const r = runScript('update.mjs', ['--project', dir]);
    expect(r.out.ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('--help는 사용법 출력 후 exit 0', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'init.mjs'), '--help'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('init.mjs');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/scripts/init-update.test.mjs` → FAIL

- [ ] **Step 3: 구현**

`.claude-plugin/plugin.json`
```json
{
  "name": "threejs-scene-kit",
  "version": "0.1.0",
  "description": "대화로 연출하는 절차적 Three.js 짧은 영상(쇼츠·강의) 제작 키트: 장면 데이터 + 검증된 모듈 + 타임라인 미리보기 + 결정적 MP4 렌더",
  "author": { "name": "김용현" },
  "keywords": ["threejs", "procedural", "video", "shorts", "education", "remotion"]
}
```

`scripts/lib/args.mjs`
```js
/** --key value / --flag / 위치 인자 파서 */
export function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    } else {
      pos.push(a);
    }
  }
  return { pos, opts };
}
```

`scripts/lib/output.mjs`
```js
import { parseArgs } from './args.mjs';

/** 사용자에게 보여줄 오류. errors: string | {path,message} 배열 */
export class ScriptError extends Error {
  constructor(errors, extra = {}) {
    const list = (Array.isArray(errors) ? errors : [errors]).map((e) => (typeof e === 'string' ? { path: '', message: e } : e));
    super(list.map((e) => e.message).join('; '));
    this.errors = list;
    this.extra = extra;
  }
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/** 스크립트 진입점: --help 처리, 결과 JSON 한 줄 출력, 실패 시 exit 1 */
export async function run(fn, help) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${help.trim()}\n`);
    return;
  }
  try {
    const result = await fn(parseArgs(argv));
    print({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ScriptError) print({ ok: false, errors: e.errors, ...e.extra });
    else print({ ok: false, errors: [{ path: '', message: String(e?.stack ?? e) }] });
    process.exitCode = 1;
  }
}
```

`scripts/lib/paths.mjs`
```js
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KIT_DIR = join(PLUGIN_ROOT, 'kit');
export const TEMPLATE_DIR = join(PLUGIN_ROOT, 'template');

export function pluginVersion() {
  return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
}
```

`scripts/lib/manifest.mjs`
```js
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MANIFEST = 'manifest.json';

export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.filter((f) => f !== MANIFEST).sort();
}

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function buildManifest(kitDir, version) {
  const files = {};
  for (const rel of listFiles(kitDir)) files[rel] = sha256(join(kitDir, rel));
  return { version, files };
}

export function writeManifest(kitDir, version) {
  const m = buildManifest(kitDir, version);
  writeFileSync(join(kitDir, MANIFEST), `${JSON.stringify(m, null, 2)}\n`);
  return m;
}

export function readManifest(kitDir) {
  const p = join(kitDir, MANIFEST);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function diffManifest(kitDir, manifest) {
  const modified = [];
  const missing = [];
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const p = join(kitDir, rel);
    if (!existsSync(p)) missing.push(rel);
    else if (sha256(p) !== hash) modified.push(rel);
  }
  const extra = listFiles(kitDir).filter((rel) => !(rel in manifest.files));
  return { modified, missing, extra };
}
```

`scripts/lib/project.mjs`
```js
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ScriptError } from './output.mjs';

export function resolveProject(dirArg, { needModules = true } = {}) {
  const dir = resolve(typeof dirArg === 'string' ? dirArg : process.cwd());
  if (!existsSync(join(dir, 'scene.ts'))) {
    throw new ScriptError([{ path: 'project', message: `${dir}에 scene.ts가 없음. init.mjs로 프로젝트를 먼저 만들 것` }]);
  }
  if (!existsSync(join(dir, 'kit', 'manifest.json'))) {
    throw new ScriptError([{ path: 'project', message: `${dir}/kit/manifest.json 없음. init.mjs로 만든 프로젝트가 아님` }]);
  }
  if (needModules && !existsSync(join(dir, 'node_modules'))) {
    throw new ScriptError([{ path: 'project', message: `${dir}/node_modules 없음. 프로젝트 폴더에서 npm install을 먼저 실행할 것` }]);
  }
  return dir;
}

function pickEntry(e) {
  if (!e) return null;
  if (typeof e === 'string') return e;
  if (Array.isArray(e)) return pickEntry(e[0]);
  for (const k of ['import', 'node', 'default']) {
    if (e[k]) {
      const r = pickEntry(e[k]);
      if (r) return r;
    }
  }
  return null;
}

/** 프로젝트 node_modules의 패키지를 ESM으로 import (플러그인 자체는 의존성 없음) */
export async function importFromProject(dir, pkg) {
  const pkgDir = join(dir, 'node_modules', ...pkg.split('/'));
  const pjPath = join(pkgDir, 'package.json');
  if (!existsSync(pjPath)) {
    throw new ScriptError([{ path: 'project', message: `${pkg}가 설치되지 않음. 프로젝트 폴더에서 npm install 실행 필요` }]);
  }
  const meta = JSON.parse(readFileSync(pjPath, 'utf8'));
  const exp = meta.exports && (meta.exports['.'] ?? meta.exports);
  const entry = pickEntry(exp) ?? meta.module ?? meta.main ?? 'index.js';
  return import(pathToFileURL(join(pkgDir, entry)).href);
}
```

`scripts/init.mjs`
```js
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { writeManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { KIT_DIR, pluginVersion, TEMPLATE_DIR } from './lib/paths.mjs';

const STYLES = ['stylized', 'minimal'];
const HELP = `
사용법: node init.mjs <폴더> [--style stylized|minimal] [--force]
  새 영상 프로젝트를 만든다 (template + kit 복사, kit/manifest.json 생성).
  --force  비어 있지 않은 폴더에도 진행. 기존 scene.ts와 custom/은 보존한다.
  npm install은 하지 않는다 (출력의 next 참고).
`;

run(async ({ pos, opts }) => {
  if (!pos[0]) throw new ScriptError([{ path: 'args', message: '대상 폴더를 지정할 것: init.mjs <폴더>' }]);
  const dir = resolve(pos[0]);
  const style = typeof opts.style === 'string' ? opts.style : 'stylized';
  if (!STYLES.includes(style)) {
    throw new ScriptError([{ path: 'args.style', message: `'${style}'은 지원하지 않음. 가능: ${STYLES.join('|')}` }]);
  }
  if (existsSync(dir) && readdirSync(dir).length > 0 && !opts.force) {
    throw new ScriptError([{ path: 'args', message: `${dir}이 비어 있지 않음. 덮어쓰려면 --force (scene.ts와 custom/은 보존)` }]);
  }
  mkdirSync(dir, { recursive: true });
  const skipped = [];
  for (const name of readdirSync(TEMPLATE_DIR)) {
    const target = name === 'gitignore' ? '.gitignore' : name;
    const dst = join(dir, target);
    if (target === 'scene.ts' && existsSync(dst)) {
      skipped.push('scene.ts');
      continue;
    }
    let text = readFileSync(join(TEMPLATE_DIR, name), 'utf8');
    if (target === 'scene.ts') text = text.replace("style: 'stylized'", `style: '${style}'`);
    if (target === 'package.json') {
      const name2 = basename(dir).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'scene-project';
      text = text.replace('__NAME__', name2);
    }
    writeFileSync(dst, text);
  }
  mkdirSync(join(dir, 'custom'), { recursive: true });
  const kitDst = join(dir, 'kit');
  rmSync(kitDst, { recursive: true, force: true });
  cpSync(KIT_DIR, kitDst, { recursive: true });
  const manifest = writeManifest(kitDst, pluginVersion());
  return {
    project: dir,
    style,
    kitVersion: manifest.version,
    skipped,
    next: [`프로젝트 폴더에서 npm install`, `check.mjs --project "${dir}"`],
  };
}, HELP);
```

`scripts/update.mjs`
```js
import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { diffManifest, readManifest, writeManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { KIT_DIR, pluginVersion } from './lib/paths.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node update.mjs [--project <폴더>] [--force]
  프로젝트의 kit/을 플러그인 최신 버전으로 교체한다.
  kit 파일을 로컬에서 수정했다면 목록을 보여주고 거부한다 (--force로 덮어쓰기).
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project, { needModules: false });
  const kitDir = join(dir, 'kit');
  const manifest = readManifest(kitDir);
  const diff = diffManifest(kitDir, manifest);
  const touched = [...diff.modified, ...diff.extra];
  if (touched.length > 0 && !opts.force) {
    throw new ScriptError(
      [{ path: 'kit', message: `로컬에서 수정·추가된 kit 파일이 있음: ${touched.join(', ')}. 커스텀 코드는 custom/으로 옮긴 뒤 --force` }],
      { modified: diff.modified, extra: diff.extra },
    );
  }
  rmSync(kitDir, { recursive: true, force: true });
  cpSync(KIT_DIR, kitDir, { recursive: true });
  const next = writeManifest(kitDir, pluginVersion());
  return { project: dir, from: manifest.version, to: next.version, overwritten: touched };
}, HELP);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/scripts/init-update.test.mjs` → PASS

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin scripts tests/scripts
git commit -m "feat(scripts): init and update with kit manifest drift detection"
```

---

### Task 10: check / still / render + 실제 브라우저 E2E

**Files:**
- Create: `scripts/lib/server.mjs`, `scripts/lib/browser.mjs`, `scripts/check.mjs`, `scripts/still.mjs`, `scripts/render.mjs`, `tests/e2e/run-e2e.mjs`
- Create(생성됨): `tests/golden/t6_preview.png`

**Interfaces:**
- Consumes: `resolveProject`, `importFromProject`, `run`, `ScriptError`, `readManifest`, `diffManifest`, `pluginVersion`, `window.__KIT__` (Task 8)
- Produces:
  - `server.mjs`: `startServer(dir): Promise<{ url, close }>`
  - `browser.mjs`: `openKit(dir, { quality }): Promise<{ page, status, logs, gpu, close }>`, `captureFrame(page, t): Promise<Buffer>`
  - CLI: `check.mjs`, `still.mjs --at <t,...> [--sheet] [--cols n] [--quality preview|final]`, `render.mjs [--from s] [--to s] [--out path]`

- [ ] **Step 1: 구현**

`scripts/lib/server.mjs`
```js
import { createServer as netServer } from 'node:net';
import { importFromProject } from './project.mjs';

function freePort() {
  return new Promise((res, rej) => {
    const s = netServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

/** 프로젝트의 vite로 임시 개발 서버를 띄운다 */
export async function startServer(dir) {
  const vite = await importFromProject(dir, 'vite');
  const port = await freePort();
  const server = await vite.createServer({
    root: dir,
    logLevel: 'error',
    clearScreen: false,
    server: { port, strictPort: true, host: '127.0.0.1', open: false },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}
```

`scripts/lib/browser.mjs`
```js
import { ScriptError } from './output.mjs';
import { importFromProject } from './project.mjs';
import { startServer } from './server.mjs';

const ATTEMPTS = [
  { name: 'gpu', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  { name: 'swiftshader', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
];

/** 캡처 모드로 장면 페이지를 연다. GPU 경로가 실패하면 SwiftShader로 폴백. */
export async function openKit(dir, { quality }) {
  const { chromium } = await importFromProject(dir, 'playwright');
  const srv = await startServer(dir);
  let lastError = null;
  for (const attempt of ATTEMPTS) {
    let browser;
    try {
      browser = await chromium.launch({ args: attempt.args });
      const page = await browser.newPage();
      const logs = [];
      page.on('console', (m) => {
        if (m.type() === 'error') logs.push(m.text());
      });
      page.on('pageerror', (e) => logs.push(String(e?.message ?? e)));
      await page.goto(`${srv.url}?capture=1&quality=${quality}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => !!window.__KIT__, null, { timeout: 120000 });
      const status = await page.evaluate(() => window.__KIT__.ready);
      if (!status.ok && status.errors.some((e) => e.path === 'renderer')) {
        lastError = new ScriptError(status.errors);
        await browser.close();
        continue;
      }
      const gpu = status.ok ? await page.evaluate(() => window.__KIT__.gpu()) : 'none';
      return {
        page,
        status,
        logs,
        gpu: `${attempt.name}: ${gpu}`,
        close: async () => {
          await browser.close();
          await srv.close();
        },
      };
    } catch (e) {
      lastError = e;
      if (browser) await browser.close().catch(() => undefined);
    }
  }
  await srv.close();
  throw lastError ?? new Error('브라우저를 열 수 없음');
}

export async function captureFrame(page, t) {
  const url = await page.evaluate(async (time) => {
    await window.__KIT__.renderAt(time);
    return window.__KIT__.capture();
  }, t);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
```

`scripts/check.mjs`
```js
import { join } from 'node:path';
import { openKit } from './lib/browser.mjs';
import { diffManifest, readManifest } from './lib/manifest.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { pluginVersion } from './lib/paths.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node check.mjs [--project <폴더>]
  scene.ts를 브라우저에서 로드해 검증한다 (데이터 검증 + 모듈 생성 + 콘솔 오류).
  kit 로컬 수정 여부와 플러그인 버전 차이도 보고한다.
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  const kitDir = join(dir, 'kit');
  const manifest = readManifest(kitDir);
  const diff = diffManifest(kitDir, manifest);
  const kitInfo = { version: manifest.version, plugin: pluginVersion(), ...diff };
  const warnings = [];
  if (diff.modified.length) warnings.push(`kit 파일이 로컬에서 수정됨: ${diff.modified.join(', ')}`);
  if (manifest.version !== kitInfo.plugin) warnings.push(`kit ${manifest.version} < 플러그인 ${kitInfo.plugin}. update.mjs로 갱신 가능`);
  const kit = await openKit(dir, { quality: 'preview' });
  try {
    const errors = [...kit.status.errors];
    if (kit.status.ok) {
      await kit.page.evaluate(async () => {
        const info = window.__KIT__.info();
        for (const s of info.shots) await window.__KIT__.renderAt((s.start + s.end) / 2);
      });
    }
    for (const l of kit.logs) errors.push({ path: 'console', message: l });
    if (errors.length) throw new ScriptError(errors, { warnings, kit: kitInfo });
    const info = await kit.page.evaluate(() => window.__KIT__.info());
    return { project: dir, info, warnings, kit: kitInfo, gpu: kit.gpu };
  } finally {
    await kit.close();
  }
}, HELP);
```

`scripts/still.mjs`
```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureFrame, openKit } from './lib/browser.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node still.mjs [--project <폴더>] --at 0,3.5,8 [--sheet] [--cols 4] [--quality preview|final]
  지정 시점의 스틸 PNG를 out/stills/에 저장한다.
  --sheet  여러 시점을 콘택트 시트 한 장(out/stills/sheet.png)으로 저장 (확인용으로 권장)
  --quality 기본 preview(절반 해상도). final은 원본 해상도.
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  const times = String(opts.at ?? '0').split(',').map((s) => Number(s.trim()));
  if (times.some((t) => !Number.isFinite(t))) throw new ScriptError([{ path: 'args.at', message: '쉼표로 구분한 초 단위 숫자여야 함 (예: 0,2.5,8)' }]);
  const quality = opts.quality === 'final' ? 'final' : 'preview';
  const kit = await openKit(dir, { quality });
  try {
    if (!kit.status.ok) throw new ScriptError(kit.status.errors);
    const info = await kit.page.evaluate(() => window.__KIT__.info());
    const bad = times.filter((t) => t < 0 || t > info.duration);
    if (bad.length) throw new ScriptError([{ path: 'args.at', message: `0 ~ ${info.duration}초 범위 밖: ${bad.join(', ')}` }]);
    const outDir = join(dir, 'out', 'stills');
    mkdirSync(outDir, { recursive: true });
    if (opts.sheet) {
      const cols = Number(opts.cols ?? Math.min(times.length, 4));
      const url = await kit.page.evaluate(([ts, c]) => window.__KIT__.sheet(ts, c), [times, cols]);
      const file = join(outDir, 'sheet.png');
      writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      return { sheet: file, times, quality, warnings: kit.logs };
    }
    const files = [];
    for (const t of times) {
      const file = join(outDir, `t${t.toFixed(2).replace('.', '_')}.png`);
      writeFileSync(file, await captureFrame(kit.page, t));
      files.push(file);
    }
    return { files, quality, warnings: kit.logs };
  } finally {
    await kit.close();
  }
}, HELP);
```

`scripts/render.mjs`
```js
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { captureFrame, openKit } from './lib/browser.mjs';
import { run, ScriptError } from './lib/output.mjs';
import { resolveProject } from './lib/project.mjs';

const HELP = `
사용법: node render.mjs [--project <폴더>] [--from 초] [--to 초] [--out out/video.mp4]
  원본 해상도로 프레임(t = i/fps)을 캡처해 ffmpeg(H.264, yuv420p, crf 18)로 인코딩한다.
  프레임 수 = round((to - from) * fps). 시스템 PATH에 ffmpeg 필요.
`;

run(async ({ opts }) => {
  const dir = resolveProject(opts.project);
  const kit = await openKit(dir, { quality: 'final' });
  try {
    if (!kit.status.ok) throw new ScriptError(kit.status.errors);
    const info = await kit.page.evaluate(() => window.__KIT__.info());
    const from = opts.from !== undefined ? Number(opts.from) : 0;
    const to = opts.to !== undefined ? Number(opts.to) : info.duration;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > info.duration || to <= from) {
      throw new ScriptError([{ path: 'args', message: `0 ≤ from < to ≤ ${info.duration} 이어야 함` }]);
    }
    const f0 = Math.round(from * info.fps);
    const f1 = Math.round(to * info.fps);
    const file = typeof opts.out === 'string' ? resolve(dir, opts.out) : join(dir, 'out', 'video.mp4');
    mkdirSync(dirname(file), { recursive: true });
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', file,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', (d) => (ffErr += d));
    ff.stdin.on('error', () => undefined);
    const exited = new Promise((r) => {
      ff.on('close', r);
      ff.on('error', (e) => {
        ffErr += String(e);
        r(-1);
      });
    });
    const started = Date.now();
    for (let i = f0; i < f1; i++) {
      const buf = await captureFrame(kit.page, i / info.fps);
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    }
    ff.stdin.end();
    const code = await exited;
    if (code !== 0) throw new ScriptError([{ path: 'ffmpeg', message: `ffmpeg 실패(code ${code}): ${ffErr.trim()}` }]);
    const seconds = (Date.now() - started) / 1000;
    return { file, frames: f1 - f0, fps: info.fps, seconds, perFrameMs: Math.round((seconds * 1000) / (f1 - f0)), gpu: kit.gpu, warnings: kit.logs };
  } finally {
    await kit.close();
  }
}, HELP);
```

`tests/e2e/run-e2e.mjs`
```js
/** 실제 브라우저 E2E: init → npm install → check → still → render → 결정성 → 골든 비교 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const PROJ = join(ROOT, 'tests', '.e2e', 'proj');
const GOLDEN = join(ROOT, 'tests', 'golden', 't6_preview.png');
let failed = 0;

function step(name, fn) {
  try {
    const detail = fn();
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message}`);
  }
}
function script(name, args) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', name), ...args], { encoding: 'utf8', timeout: 900000 });
  const last = r.stdout.trim().split('\n').pop();
  let out;
  try {
    out = JSON.parse(last);
  } catch {
    throw new Error(`JSON 아님: ${r.stdout}\n${r.stderr}`);
  }
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out;
}
function meanDiff(a, b) {
  const A = PNG.sync.read(readFileSync(a));
  const B = PNG.sync.read(readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) return Infinity;
  let s = 0;
  for (let i = 0; i < A.data.length; i++) s += Math.abs(A.data[i] - B.data[i]);
  return s / A.data.length;
}

rmSync(join(PROJ, 'scene.ts'), { force: true });
step('init', () => script('init.mjs', [PROJ, '--force']).project);
step('npm install', () => {
  if (existsSync(join(PROJ, 'node_modules', 'playwright'))) return 'cached';
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: PROJ, shell: true, encoding: 'utf8', timeout: 900000 });
  if (r.status !== 0) throw new Error(r.stderr);
  return 'installed';
});
step('check', () => script('check.mjs', ['--project', PROJ]).gpu);
step('still sheet', () => {
  const out = script('still.mjs', ['--project', PROJ, '--at', '1,5,6,9.5,11.9', '--sheet', '--cols', '5']);
  if (statSync(out.sheet).size < 20000) throw new Error('시트가 너무 작음');
  return out.sheet;
});
step('still determinism', () => {
  const a = script('still.mjs', ['--project', PROJ, '--at', '6']).files[0];
  copyFileSync(a, `${a}.first.png`);
  const b = script('still.mjs', ['--project', PROJ, '--at', '6']).files[0];
  const d = meanDiff(`${a}.first.png`, b);
  if (d > 0.5) throw new Error(`두 번 캡처 차이 ${d}`);
  return `meanDiff=${d.toFixed(4)}`;
});
step('golden', () => {
  const cur = join(PROJ, 'out', 'stills', 't6_00.png');
  if (!existsSync(GOLDEN)) {
    mkdirSync(join(ROOT, 'tests', 'golden'), { recursive: true });
    copyFileSync(cur, GOLDEN);
    return '기준 이미지 생성 (눈으로 검수 후 커밋)';
  }
  const d = meanDiff(GOLDEN, cur);
  if (d > 2) throw new Error(`골든 대비 평균 차이 ${d.toFixed(3)} > 2`);
  return `meanDiff=${d.toFixed(3)}`;
});
step('render 1s', () => {
  const out = script('render.mjs', ['--project', PROJ, '--from', '5', '--to', '6', '--out', 'out/e2e.mp4']);
  const p = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'csv=p=0', out.file], { encoding: 'utf8' });
  const [w, h, n] = p.stdout.trim().split(',').map(Number);
  if (w !== 1080 || h !== 1920 || n !== 30) throw new Error(`ffprobe: ${p.stdout.trim()}`);
  return `${n} frames, ${out.perFrameMs}ms/frame, ${out.gpu}`;
});
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: E2E 실행**

Run: `npm run e2e`
Expected: 모든 단계가 PASS다. 단 golden 단계는 첫 실행에서 "기준 이미지 생성"으로 나온다.
실패하면 해당 스크립트의 JSON 오류를 보고 원인을 고친다(superpowers:systematic-debugging).

- [ ] **Step 3: 시트와 골든을 눈으로 검수**

Read: `tests/.e2e/proj/out/stills/sheet.png`
확인할 것:
- 하늘, 지형, 나무, 물이 보인다.
- t=1의 한글 두 줄 라벨이 잘리지 않는다.
- t=5와 t=6의 태양, 화살표, 원뿔이 보인다.
- t=9.5와 t=11.9의 막대와 라벨이 보인다.
- 문제가 있으면 `template/scene.ts`의 좌표나 카메라를 조정하고, 골든을 지운 뒤 재실행한다.

- [ ] **Step 4: E2E 재실행으로 골든 비교 확인 후 Commit**

Run: `npm run e2e` → ALL PASSED (golden meanDiff 출력)
```bash
git add scripts tests/e2e tests/golden
git commit -m "feat(scripts): check/still/render via headless chromium + ffmpeg, e2e with golden"
```

---

### Task 11: 스킬 문서 + README

**Files:**
- Create: `skills/scene-direct/SKILL.md`, `skills/scene-direct/references/scene-schema.md`, `skills/scene-modules/SKILL.md`, `skills/scene-modules/references/{shape,label,arrow,bars,line,environment}.md`, `skills/scene-custom/SKILL.md`, `README.md`
- Test: `tests/unit/skills.test.ts`

**Interfaces:**
- Consumes: `.claude-plugin/plugin.json`(Task 9), 스크립트 CLI(Task 9–10), 모듈 params(Task 5–6)

- [ ] **Step 1: 실패하는 테스트 작성 (frontmatter 규칙, 크기, 모듈 문서 누락)**

`tests/unit/skills.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);

function frontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('frontmatter 없음');
  const keys: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([a-zA-Z-]+):/);
    if (k) keys[k[1]] = line.slice(k[0].length).trim();
  }
  return keys;
}

describe('skills', () => {
  const skills = readdirSync(join(ROOT, 'skills'));
  it('세 스킬 존재', () => {
    expect(skills.sort()).toEqual(['scene-custom', 'scene-direct', 'scene-modules']);
  });
  for (const s of ['scene-custom', 'scene-direct', 'scene-modules']) {
    it(`${s}: 허용 키만, name 일치, 200줄 이하`, () => {
      const md = readFileSync(join(ROOT, 'skills', s, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
      const fm = frontmatter(md);
      for (const k of Object.keys(fm)) expect(ALLOWED.has(k)).toBe(true);
      expect(fm.name).toBe(s);
      expect(fm.description.length).toBeGreaterThan(50);
      expect(fm.description.length).toBeLessThanOrEqual(1024);
      expect(md.split('\n').length).toBeLessThanOrEqual(200);
    });
  }
  it('모든 내장 요소의 reference 문서 존재', () => {
    for (const t of ['shape', 'label', 'arrow', 'bars', 'line', 'environment']) {
      expect(existsSync(join(ROOT, 'skills', 'scene-modules', 'references', `${t}.md`))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/skills.test.ts` → FAIL

- [ ] **Step 3: 문서 작성**

`skills/scene-direct/SKILL.md`: frontmatter는 name, description, allowed-tools(Bash 접두사 5개) 세 가지만 쓴다. 본문 내용:
- 이 스킬을 쓰는 시점: 교육 영상이나 쇼츠용 3D 장면을 대화로 연출할 때
- 흐름: init → npm install → check → still --sheet → render
- 실행 규칙
  - 각 명령은 단독 Bash 호출로 실행한다.
  - `&&`, `|`, `;`로 명령을 잇지 않는다(사전 승인 접두사가 맞지 않게 됨).
- 금지 사항
  - `kit/` 소스를 읽거나 수정하지 않는다.
  - 출력의 JSON만 읽는다.
- 수정 범위: `scene.ts`만 고친다.
- 확인 순서
  - 수정 후 반드시 check를 실행한다.
  - 결과 확인은 `still --sheet` 한 장으로 한다(Read).
  - render는 사용자가 원할 때만 한다.
- 연출 지시 → 데이터 수정 예시 표 8행 이상: 타이밍, 색과 스타일, 카메라, 요소 추가, 등장 애니메이션, 하늘, 나무 밀도, 길이
- 오류 대응: errors[].path에 해당하는 필드를 고친다.
- 장면 형식 상세는 references/scene-schema.md에서, 요소별 params는 scene-modules 스킬에서 확인한다.

`skills/scene-direct/references/scene-schema.md`: spec 3절과 같은 내용이다. 필드 표, 기본값(enter dur 0.6, fov 40, 하늘 기본 day, terrain·trees 기본값), 시간 모델, tracks 의미(절대값, opacity는 곱), 샷 규칙을 담는다.

`skills/scene-modules/SKILL.md`: 요소 표(type | 용도 | 주요 params | grow 지원)와 환경 표, 그리고 "상세 params는 references/<type>.md" 안내를 담는다.

`skills/scene-modules/references/*.md`: 각 요소의 params 표(이름, 타입, 기본값, 설명)와 짧은 예시 1개를 담는다.

`skills/scene-custom/SKILL.md`: 데이터로 표현할 수 없을 때만 쓴다는 원칙, 규약(ElementHandle, t 순수함수, ctx.rng·ctx.style만 사용, `Math.random` 금지, dispose 필수), 템플릿 코드, scene.ts 등록 방법, check로 검증하는 방법을 담는다.

`README.md`: 플러그인 소개, 설치(로컬 마켓플레이스 또는 `--plugin-dir`), 요구사항(Node 22, ffmpeg), 개발(`npm test`, `npm run typecheck`, `npm run e2e`)을 담는다.

- [ ] **Step 4: 테스트 통과 + 전체 검증**

Run: `npx vitest run` → 모두 PASS
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 5: Commit**

```bash
git add skills README.md tests/unit/skills.test.ts
git commit -m "docs(skills): scene-direct, scene-modules, scene-custom skills and README"
```

---

### Task 12: 데모 영상 + 최종 검증 + 리뷰

- [ ] **Step 1: 데모 프로젝트를 전체 길이로 렌더**

Run: `node scripts/render.mjs --project tests/.e2e/proj`
Expected: `{"ok":true,"frames":360,...}`. perFrameMs를 기록한다.

- [ ] **Step 2: 스타일 전환 확인 (성공 기준 3)**

`tests/.e2e/proj/scene.ts`의 style을 `'minimal'`로 바꾼다.
Run: `node scripts/still.mjs --project tests/.e2e/proj --at 1,6,10 --sheet`
Read 결과 시트로 룩이 바뀌었는지 확인한 뒤, style을 원복한다.

- [ ] **Step 3: 전체 테스트**

Run: `npx vitest run` → PASS
Run: `npm run typecheck` → 오류 없음
Run: `npm run e2e` → ALL PASSED

- [ ] **Step 4: 브랜치 전체 리뷰**

새 리뷰어(코드 리뷰 에이전트)가 브랜치 diff 전체를 spec과 대조한다. 발견 사항을 반영한다.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: v0.1 verification fixes"
```
