/**
 * Low-poly sea: a big Lambert plane with gentle sine-wave vertex displacement
 * injected via onBeforeCompile, so it keeps fog and lighting for free.
 */
import * as THREE from 'three';
import { SEA_LEVEL } from './terrain';

export class Water {
  readonly mesh: THREE.Mesh;
  private shader: THREE.WebGLProgramParametersWithUniforms | null = null;

  constructor() {
    const geo = new THREE.PlaneGeometry(1400, 1400, 96, 96);
    geo.rotateX(-Math.PI / 2);
    // opaque: semi-transparent water lets the seafloor silhouette through
    // and it reads as dark phantom mesas on the horizon
    const mat = new THREE.MeshLambertMaterial({
      color: 0x2f7f9e,
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

  update(dt: number) {
    if (this.shader) this.shader.uniforms.uTime.value += dt;
  }
}
