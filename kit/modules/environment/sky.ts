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
