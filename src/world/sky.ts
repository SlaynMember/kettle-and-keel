/**
 * Day/night cycle: gradient sky dome, orbiting sun + counter-orbiting moon,
 * hemisphere ambient, stars that fade in at night. Owns world time.
 */
import * as THREE from 'three';
import { makeRng } from './terrain';
import { store } from '../core/store';

const DAY_LENGTH = 360; // seconds for a full cycle

interface SkyKey {
  t: number;
  zenith: number;
  horizon: number;
  sun: number;
  ambient: number;
}

// t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
const KEYS: SkyKey[] = [
  { t: 0.0, zenith: 0x0b1026, horizon: 0x1a2f38, sun: 0.0, ambient: 0.25 },
  { t: 0.22, zenith: 0x1a2f4f, horizon: 0x5a4a58, sun: 0.05, ambient: 0.3 },
  { t: 0.28, zenith: 0x4d7ea8, horizon: 0xf4a26b, sun: 0.55, ambient: 0.55 },
  { t: 0.4, zenith: 0x5aa9d6, horizon: 0xbfe3ef, sun: 1.0, ambient: 0.8 },
  { t: 0.6, zenith: 0x5aa9d6, horizon: 0xbfe3ef, sun: 1.0, ambient: 0.8 },
  { t: 0.72, zenith: 0x4d6ea8, horizon: 0xf49b5b, sun: 0.55, ambient: 0.55 },
  { t: 0.78, zenith: 0x1c2447, horizon: 0xb35a4a, sun: 0.05, ambient: 0.3 },
  { t: 1.0, zenith: 0x0b1026, horizon: 0x1a2f38, sun: 0.0, ambient: 0.25 },
];

export class Sky {
  /** 0..1 time of day; starts mid-morning */
  time = 0.34;
  readonly sun: THREE.DirectionalLight;
  private readonly moon: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly dome: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
  };

  constructor(private scene: THREE.Scene) {
    const domeGeo = new THREE.SphereGeometry(520, 24, 16);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying vec3 vDir;
        void main() {
          float f = pow(smoothstep(-0.05, 0.5, vDir.y), 0.75);
          gl_FragColor = vec4(mix(uHorizon, uZenith, f), 1.0);
        }
      `,
    });
    this.dome = new THREE.Mesh(domeGeo, domeMat);
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 90;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun, this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8ea6c8, 0.0);
    scene.add(this.moon, this.moon.target);

    this.hemi = new THREE.HemisphereLight(0xbfe3ef, 0x6da24d, 0.8);
    scene.add(this.hemi);

    // stars
    const rng = makeRng(77);
    const N = 700;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.95); // upper hemisphere
      const r = 500;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    scene.add(this.stars);

    scene.fog = new THREE.Fog(0xbfe3ef, 70, 320);
  }

  /** 0 = full night, 1 = full day */
  get daylight(): number {
    return THREE.MathUtils.smoothstep(this.sample().sun, 0.02, 0.6);
  }

  private sample(): { zenith: THREE.Color; horizon: THREE.Color; sun: number; ambient: number } {
    const t = this.time % 1;
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    return {
      zenith: new THREE.Color(a.zenith).lerp(new THREE.Color(b.zenith), f),
      horizon: new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), f),
      sun: THREE.MathUtils.lerp(a.sun, b.sun, f),
      ambient: THREE.MathUtils.lerp(a.ambient, b.ambient, f),
    };
  }

  update(dt: number, focus: THREE.Vector3) {
    const prev = this.time;
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    if (this.time < prev) store.set({ day: store.get().day + 1 });

    const k = this.sample();
    this.uniforms.uZenith.value.copy(k.zenith);
    this.uniforms.uHorizon.value.copy(k.horizon);

    // sun travels a tilted arc; angle 0 at midnight (below horizon)
    const ang = (this.time - 0.25) * Math.PI * 2; // sunrise at east horizon
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    this.sun.position.copy(focus).addScaledVector(sunDir, 160);
    this.sun.target.position.copy(focus);
    this.sun.intensity = k.sun * 1.25;
    this.sun.castShadow = k.sun > 0.05;

    this.moon.position.copy(focus).addScaledVector(sunDir.clone().negate(), 160);
    this.moon.target.position.copy(focus);
    this.moon.intensity = (1 - this.daylight) * 0.22;

    this.hemi.intensity = k.ambient;
    this.hemi.color.copy(k.zenith).lerp(new THREE.Color(0xffffff), 0.4);

    (this.stars.material as THREE.PointsMaterial).opacity = (1 - this.daylight) * 0.9;
    this.stars.rotation.y += dt * 0.004;

    (this.scene.fog as THREE.Fog).color.copy(k.horizon);
    this.dome.position.copy(focus);
  }
}
