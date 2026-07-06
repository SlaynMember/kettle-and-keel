/**
 * Low-poly sea: a big Lambert plane with gentle sine-wave vertex displacement
 * injected via onBeforeCompile, so it keeps fog and lighting for free.
 * v3: the whole plane rides the tide (world/tide.ts), and waveAt() mirrors
 * the shader's displacement in JS so the boat can bob on the same water.
 */
import * as THREE from 'three';
import { SEA_LEVEL } from './terrain';
import { getWaterLevel } from './tide';

export class Water {
  readonly mesh: THREE.Mesh;
  private shader: THREE.WebGLProgramParametersWithUniforms | null = null;
  private time = 0;

  constructor() {
    const geo = new THREE.PlaneGeometry(1400, 1400, 96, 96);
    geo.rotateX(-Math.PI / 2);
    // transparent so shallows show the sand and swimmers sink into it;
    // safe now that the distant seafloor is a constant depth (terrain.ts)
    const mat = new THREE.MeshLambertMaterial({
      color: 0x2f7f9e,
      transparent: true,
      opacity: 0.82,
      flatShading: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           transformed.y += sin(position.x * 0.14 + uTime * 1.1) * 0.22
                          + cos(position.z * 0.11 + uTime * 0.7) * 0.18
                          + sin((position.x + position.z) * 0.05 + uTime * 0.4) * 0.12;`
        );
      this.shader = shader;
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = SEA_LEVEL;
  }

  /** the shader's wave displacement, mirrored in JS — what the boat bobs on.
   *  (plane geometry is world-aligned and origin-centered, so world x/z ARE
   *  the shader's position.x/z) */
  waveAt(x: number, z: number): number {
    const t = this.time;
    return (
      Math.sin(x * 0.14 + t * 1.1) * 0.22 + Math.cos(z * 0.11 + t * 0.7) * 0.18 + Math.sin((x + z) * 0.05 + t * 0.4) * 0.12
    );
  }

  update(dt: number) {
    this.time += dt;
    if (this.shader) this.shader.uniforms.uTime.value = this.time;
    this.mesh.position.y = getWaterLevel();
  }
}
