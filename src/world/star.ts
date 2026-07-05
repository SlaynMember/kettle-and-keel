/**
 * The first-night shooting star: a once-per-save event (see store.starSeen).
 * main.ts begins it the moment night first falls, offers a "Watch star" HUD
 * prompt, and hands the camera's lookAt to getPosition() while watching (see
 * CameraRig.lookTarget). Path is a fixed arc computed once in begin() — no
 * Math.random, per the world-gen convention; the only "randomness" is where
 * the player happened to be standing.
 */
import * as THREE from 'three';

const DURATION = 30; // seconds, full crossing
const RADIUS = 420; // inside the 520 sky dome
const START_BEARING = THREE.MathUtils.degToRad(100); // east-ish
const END_BEARING = THREE.MathUtils.degToRad(260); // west-ish
const START_ELEVATION = THREE.MathUtils.degToRad(55);
const END_ELEVATION = THREE.MathUtils.degToRad(25);
const BRIGHTEN_SECONDS = 2;
const FADE_SECONDS = 4;
const TRAIL_LENGTH = 16;
const UP = new THREE.Vector3(0, 1, 0);

export class ShootingStar {
  readonly group: THREE.Group;
  active = false;
  watching = false;

  private t = 0; // 0..1 progress across the arc
  private origin = new THREE.Vector3();
  private head: THREE.Mesh;
  private trail: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff6da, transparent: true })
    );
    this.group.add(this.head);

    // tapered trail: wide base at the head, fading to a point behind it
    this.trail = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, TRAIL_LENGTH, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff6da,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.group.add(this.trail);
  }

  /** kick off the once-ever crossing, arced relative to where the player is standing now */
  begin(playerPos: THREE.Vector3) {
    this.origin.copy(playerPos);
    this.t = 0;
    this.active = true;
    this.watching = false;
    this.group.visible = true;
  }

  stopWatching() {
    this.watching = false;
  }

  private pointAt(t: number): THREE.Vector3 {
    const eased = THREE.MathUtils.smoothstep(t, 0, 1);
    const bearing = THREE.MathUtils.lerp(START_BEARING, END_BEARING, eased);
    const elevation = THREE.MathUtils.lerp(START_ELEVATION, END_ELEVATION, eased);
    const cosE = Math.cos(elevation);
    return this.origin.clone().add(
      new THREE.Vector3(Math.sin(bearing) * cosE * RADIUS, Math.sin(elevation) * RADIUS, Math.cos(bearing) * cosE * RADIUS)
    );
  }

  update(dt: number, _playerPos: THREE.Vector3) {
    if (!this.active) return;
    this.t += dt / DURATION;
    if (this.t >= 1) {
      this.active = false;
      this.watching = false;
      this.group.visible = false;
      return;
    }

    const pos = this.pointAt(this.t);
    this.group.position.copy(pos);

    // orient the trail to point back along the direction of travel
    const ahead = this.pointAt(Math.min(1, this.t + 0.01));
    const backDir = pos.clone().sub(ahead).normalize();
    this.trail.position.copy(backDir).multiplyScalar(TRAIL_LENGTH / 2);
    this.trail.quaternion.setFromUnitVectors(UP, backDir);

    // brighten in over the first BRIGHTEN_SECONDS, fade out over the last FADE_SECONDS
    let alpha = 1;
    if (this.t < BRIGHTEN_SECONDS / DURATION) alpha = this.t / (BRIGHTEN_SECONDS / DURATION);
    const fadeStart = 1 - FADE_SECONDS / DURATION;
    if (this.t > fadeStart) alpha = Math.min(alpha, 1 - (this.t - fadeStart) / (FADE_SECONDS / DURATION));
    (this.head.material as THREE.MeshBasicMaterial).opacity = alpha;
    (this.trail.material as THREE.MeshBasicMaterial).opacity = alpha * 0.5;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position;
  }
}
