/**
 * 브라우저 전용 렌더 파이프라인: 그림자 · IBL · GTAO · 블룸 · OutputPass(톤매핑) · SSAA.
 * 시간 누적 효과는 쓰지 않는다(어느 프레임이든 seekable).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Look } from './style';
import type { Quality } from './types';
import { OVERLAY_LAYER, type World } from './world';

/** 오버레이 레이어(라벨)를 현재 버퍼 위에 덮어 그린다. 배경을 지우지 않고 깊이만 초기화한다. */
class OverlayPass extends Pass {
  constructor(private scene: THREE.Scene, private cam: THREE.Camera) {
    super();
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const bg = this.scene.background;
    const autoClear = renderer.autoClear;
    this.scene.background = null;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
    renderer.autoClear = autoClear;
    this.scene.background = bg;
  }
}

export interface Pipeline {
  /** 캡처 대상 캔버스 (width × height) */
  canvas: HTMLCanvasElement;
  render(): void;
  gpu(): string;
  dispose(): void;
}

export function createPipeline(o: { world: World; look: Look; quality: Quality; width: number; height: number; ss: number }): Pipeline {
  const W = Math.round(o.width * o.ss);
  const H = Math.round(o.height * o.ss);
  const glCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = o.look.toneMapping === 'neutral' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
  renderer.shadowMap.enabled = o.look.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const { scene, sun, focus, camera } = o.world;
  let envTex: THREE.Texture | null = null;
  if (o.look.envIntensity > 0) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = o.look.envIntensity;
    pmrem.dispose();
  }
  if (o.look.shadows) {
    const [cx, cy, cz] = focus.center;
    const dir = sun.position.clone().normalize();
    sun.position.set(cx, cy, cz).addScaledVector(dir, 150);
    sun.target.position.set(cx, cy, cz);
    scene.add(sun.target);
    sun.castShadow = true;
    const ms = o.quality === 'final' ? 4096 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    const r = focus.radius;
    const sc = sun.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 1;
    sc.far = 400;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.06;
  }

  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: o.ss > 1 ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  if (o.look.ao) {
    const ao = new GTAOPass(scene, camera, W, H);
    ao.updateGtaoMaterial({
      radius: o.look.ao.radius,
      distanceExponent: 1,
      thickness: 1,
      scale: 1,
      samples: o.quality === 'final' ? 16 : 8,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    });
    ao.blendIntensity = o.look.ao.intensity;
    composer.addPass(ao);
  }
  if (o.look.bloom) {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), o.look.bloom.strength, o.look.bloom.radius, o.look.bloom.threshold));
  }
  // 라벨(오버레이 레이어)은 AO·블룸 영향을 받지 않도록 마지막에 덮어 그린다
  const overlayCam = camera.clone();
  composer.addPass(new OverlayPass(scene, overlayCam));
  composer.addPass(new OutputPass());

  let out = glCanvas;
  let g2: CanvasRenderingContext2D | null = null;
  if (o.ss !== 1) {
    out = document.createElement('canvas');
    out.width = o.width;
    out.height = o.height;
    g2 = out.getContext('2d');
    if (!g2) throw new Error('2d 컨텍스트를 만들 수 없음 (SSAA 축소용)');
    g2.imageSmoothingEnabled = true;
    g2.imageSmoothingQuality = 'high';
  }

  return {
    canvas: out,
    render() {
      overlayCam.copy(camera as never, false);
      overlayCam.layers.set(OVERLAY_LAYER);
      composer.render();
      if (g2) {
        g2.clearRect(0, 0, o.width, o.height);
        g2.drawImage(glCanvas, 0, 0, o.width, o.height);
      }
    },
    gpu() {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    },
    dispose() {
      composer.dispose();
      target.dispose();
      envTex?.dispose();
      renderer.dispose();
    },
  };
}
