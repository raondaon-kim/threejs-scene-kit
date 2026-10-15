import { defineConfig } from 'vite';

// three와 kit이 쓰는 addons를 미리 묶어 둔다 (첫 로드 중 재최적화·중복 인스턴스 방지)
export default defineConfig({
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'p5',
      'three',
      'three/addons/geometries/RoundedBoxGeometry.js',
      'three/addons/utils/BufferGeometryUtils.js',
      'three/addons/environments/RoomEnvironment.js',
      'three/addons/postprocessing/EffectComposer.js',
      'three/addons/postprocessing/RenderPass.js',
      'three/addons/postprocessing/GTAOPass.js',
      'three/addons/postprocessing/UnrealBloomPass.js',
      'three/addons/postprocessing/OutputPass.js',
      'three/addons/postprocessing/Pass.js',
    ],
  },
});
