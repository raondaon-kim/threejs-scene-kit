import * as THREE from 'three';
import type { TextureDef } from '../textures/types';
import type { Style } from './style';
import type { LookDef, Role, SurfaceRef } from './types';

export interface ResolvedSurface {
  texture: string;
  tile: number;
  strength: number;
  flow: [number, number];
}

const DEFAULT_STRENGTH = 0.35;

/** 스타일 기본 → look.surfaces 덮어쓰기('none'이면 끔). 세기: 개별 > look.strength > 스타일 > 0.35 */
export function resolveSurfaces(style: Style, look: LookDef | undefined, defs: Map<string, TextureDef>): Map<Role, ResolvedSurface> {
  const merged: Partial<Record<Role, SurfaceRef>> = { ...(style.surfaces ?? {}), ...(look?.surfaces ?? {}) };
  const base = look?.strength ?? style.surfaceStrength ?? DEFAULT_STRENGTH;
  const out = new Map<Role, ResolvedSurface>();
  for (const [role, ref] of Object.entries(merged) as Array<[Role, SurfaceRef | undefined]>) {
    if (ref === undefined || ref === 'none') continue;
    const spec = typeof ref === 'string' ? { texture: ref } : ref;
    const def = defs.get(spec.texture);
    if (!def) continue; // 검증기가 먼저 막는다
    out.set(role, { texture: spec.texture, tile: spec.tile ?? def.tile, strength: spec.strength ?? base, flow: spec.flow ?? [0, 0] });
  }
  return out;
}

const VERT_DECL = /* glsl */ `
varying vec3 vSurfPos;
varying vec3 vSurfNrm;`;
const VERT_BODY = /* glsl */ `
{
  mat4 surfModel = modelMatrix;
  #ifdef USE_INSTANCING
    surfModel = modelMatrix * instanceMatrix;
  #endif
  vSurfPos = (surfModel * vec4(transformed, 1.0)).xyz;
  vSurfNrm = normalize(mat3(surfModel) * objectNormal);
}`;
const FRAG_DECL = /* glsl */ `
uniform sampler2D uSurf;
uniform float uSurfTile;
uniform float uSurfStrength;
uniform vec2 uSurfFlow;
uniform float uSurfTime;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;`;
const FRAG_BODY = /* glsl */ `
{
  vec3 sw = pow(abs(normalize(vSurfNrm)), vec3(4.0));
  sw /= (sw.x + sw.y + sw.z + 1e-5);
  vec2 sflow = uSurfFlow * uSurfTime;
  float sx = texture2D(uSurf, vSurfPos.zy * uSurfTile).r;
  float sy = texture2D(uSurf, (vSurfPos.xz - sflow) * uSurfTile).r;
  float sz = texture2D(uSurf, vSurfPos.xy * uSurfTile).r;
  float sd = sx * sw.x + sy * sw.y + sz * sw.z;
  diffuseColor.rgb *= 1.0 + (sd - 0.5) * 2.0 * uSurfStrength;
}`;

/**
 * 재질에 월드 좌표 투영(triplanar) 질감을 곱한다. UV가 없는 형상에도 동작.
 * 대상: MeshStandardMaterial / MeshToonMaterial. 적용하면 true.
 */
export function applySurface(mat: THREE.Material, tex: THREE.Texture, s: ResolvedSurface, time: { value: number }): boolean {
  const ok = (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial || (mat as THREE.MeshToonMaterial).isMeshToonMaterial;
  if (!ok) return false;
  const uniforms = {
    uSurf: { value: tex },
    uSurfTile: { value: 1 / s.tile },
    uSurfStrength: { value: s.strength },
    uSurfFlow: { value: new THREE.Vector2(s.flow[0], s.flow[1]) },
    uSurfTime: time,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_DECL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${FRAG_BODY}`);
  };
  mat.customProgramCacheKey = () => 'kit-surface-v1';
  mat.userData.surface = s.texture;
  mat.userData.surfaceTime = time;
  mat.needsUpdate = true;
  return true;
}
