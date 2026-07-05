/**
 * Biscuit, the first companion. Flies in from seaward when tea hits the bird
 * bath, lands on the rim, and idles there — a proximity-prompt like anything
 * else in interact.ts. All animation off this system's own clock (flightT for
 * the arrival swoop, clock for perched idle), same pattern as player.ts.
 */
import * as THREE from 'three';
import { interactions } from '../core/interact';
import { store } from '../core/store';
import { makeRng } from '../world/terrain';

const FLY_SECONDS = 4.5;
const SEAWARD_DIST = 35;
const START_HEIGHT = 15;

export type GullState = 'away' | 'flying' | 'perched';

export class Gull {
  readonly group: THREE.Group;
  state: GullState = 'away';
  onChat: () => void = () => {};

  private clock = 0;
  private flightT = 0;
  private curve: THREE.QuadraticBezierCurve3 | null = null;
  private restHeading = 0;
  private interactRemove: (() => void) | null = null;

  private wingL: THREE.Object3D;
  private wingR: THREE.Object3D;
  private head: THREE.Group;

  // fixed-phase variety (no Math.random — deterministic per the world-gen rule)
  private flutterPhase: number;
  private turnPhase: number;

  constructor() {
    const rng = makeRng(90210);
    this.flutterPhase = rng() * 4.5;
    this.turnPhase = rng() * Math.PI * 2;

    this.group = new THREE.Group();
    this.group.visible = false;

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf0f2ee, flatShading: true });
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xe8a13d, flatShading: true });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x262223, flatShading: true });
    const wingTipMat = new THREE.MeshLambertMaterial({ color: 0xb9bdb7, flatShading: true });

    // body: flattened icosahedron
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), bodyMat);
    body.scale.set(1.05, 0.72, 1.35);
    body.position.y = 0.3;

    // head: forward and up off the body
    const headGroup = new THREE.Group();
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), bodyMat);
    headGroup.add(headMesh);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 5), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.01, 0.18);
    headGroup.add(beak);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), eyeMat);
    eyeL.position.set(-0.09, 0.03, 0.1);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.09;
    headGroup.add(eyeL, eyeR);
    headGroup.position.set(0, 0.5, 0.14);
    this.head = headGroup;

    // wings: flat rounded boxes at the sides, grey tips
    const wingBase = new THREE.BoxGeometry(0.4, 0.045, 0.2);
    const wingTip = new THREE.BoxGeometry(0.16, 0.035, 0.15);
    const buildWing = (side: number) => {
      const wing = new THREE.Group();
      const base = new THREE.Mesh(wingBase, bodyMat);
      base.position.x = side * 0.2;
      const tip = new THREE.Mesh(wingTip, wingTipMat);
      tip.position.x = side * 0.44;
      wing.add(base, tip);
      wing.position.set(side * 0.16, 0.36, 0);
      return wing;
    };
    const wingLGroup = buildWing(-1);
    const wingRGroup = buildWing(1);
    this.wingL = wingLGroup;
    this.wingR = wingRGroup;

    // tail: small wedge
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 3), bodyMat);
    tail.rotation.z = Math.PI / 2;
    tail.rotation.y = Math.PI / 6;
    tail.scale.y = 0.55;
    tail.position.set(0, 0.32, -0.3);

    // legs: stubs
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5);
    const legL = new THREE.Mesh(legGeo, beakMat);
    legL.position.set(-0.08, 0.1, 0.02);
    const legR = new THREE.Mesh(legGeo, beakMat);
    legR.position.set(0.08, 0.1, 0.02);

    this.group.add(body, headGroup, wingLGroup, wingRGroup, tail, legL, legR);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  /** kick off the arrival swoop toward a perch (the bird bath rim) */
  flyTo(perch: THREE.Vector3) {
    const dir = new THREE.Vector3(perch.x, 0, perch.z);
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1);
    dir.normalize();
    const start = new THREE.Vector3(
      perch.x + dir.x * SEAWARD_DIST,
      perch.y + START_HEIGHT,
      perch.z + dir.z * SEAWARD_DIST
    );
    const control = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, perch.x, 0.5),
      Math.max(start.y, perch.y + 4),
      THREE.MathUtils.lerp(start.z, perch.z, 0.5)
    );
    this.curve = new THREE.QuadraticBezierCurve3(start, control, perch.clone());
    this.flightT = 0;
    this.state = 'flying';
    this.group.visible = true;
    this.group.position.copy(start);
  }

  private landAt(perch: THREE.Vector3) {
    this.state = 'perched';
    this.group.position.copy(perch);
    this.group.rotation.z = 0;
    this.wingL.rotation.z = 0;
    this.wingR.rotation.z = 0;
    this.restHeading = this.group.rotation.y;
    if (!this.interactRemove) {
      this.interactRemove = interactions.add({
        label: () => (store.get().gullMet ? 'Chat with Biscuit' : 'Talk to the seagull'),
        position: this.group.position,
        range: 3,
        priority: 2,
        action: () => this.onChat(),
      });
    }
  }

  update(dt: number, playerPos: THREE.Vector3) {
    if (this.state === 'away') return;
    this.clock += dt;

    if (this.state === 'flying' && this.curve) {
      this.flightT = Math.min(1, this.flightT + dt / FLY_SECONDS);
      const pos = this.curve.getPoint(this.flightT);
      this.group.position.copy(pos);
      const tangent = this.curve.getTangent(Math.min(0.999, this.flightT));
      this.group.rotation.y = Math.atan2(tangent.x, tangent.z);
      this.group.rotation.z = THREE.MathUtils.lerp(0.32, 0, this.flightT); // bank, level out for landing
      const flap = Math.sin(this.clock * 18);
      this.wingL.rotation.z = flap * 0.55;
      this.wingR.rotation.z = -flap * 0.55;
      if (this.flightT >= 1) {
        this.landAt(this.curve.getPoint(1));
      }
      return;
    }

    if (this.state === 'perched') {
      // head bob
      this.head.position.y = 0.5 + Math.sin(this.clock * 2.2) * 0.015;

      // face the player when close, otherwise a slow idle turn
      const dx = playerPos.x - this.group.position.x;
      const dz = playerPos.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading =
        dist < 4 ? Math.atan2(dx, dz) : this.restHeading + Math.sin(this.clock * 0.15 + this.turnPhase) * 0.5;
      let d = targetHeading - this.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.group.rotation.y += d * Math.min(1, 3 * dt);

      // occasional single-wing flutter, timed off the clock (fixed phase, not Math.random)
      const cyclePos = (this.clock + this.flutterPhase) % 4.5;
      const flutter = cyclePos < 0.5 ? Math.sin((cyclePos / 0.5) * Math.PI) * 0.45 : 0;
      this.wingR.rotation.z = -flutter;
      this.wingL.rotation.z = 0;
    }
  }
}
