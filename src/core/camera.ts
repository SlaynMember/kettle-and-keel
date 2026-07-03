/**
 * Third-person orbit-follow rig. Right thumb / mouse drag orbits, camera
 * eases after the player, never dips below the terrain.
 */
import * as THREE from 'three';
import { heightAt } from '../world/terrain';
import type { Input } from './input';

const DIST = 9;
const HEIGHT = 3.2;
const LOOK_SPEED = 0.0042;
const PITCH_MIN = -0.15;
const PITCH_MAX = 1.05;

export class CameraRig {
  yaw = Math.PI; // behind the player facing island center at spawn
  pitch = 0.38;
  /** props the camera should not sit inside; set once at boot */
  occluders: THREE.Object3D | null = null;
  private target = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  update(dt: number, input: Input, playerPos: THREE.Vector3) {
    const look = input.consumeLook();
    this.yaw -= look.dx * LOOK_SPEED;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy * LOOK_SPEED, PITCH_MIN, PITCH_MAX);

    // follow point eases toward the player's shoulders
    const focus = playerPos.clone().add(new THREE.Vector3(0, 1.7, 0));
    this.target.lerp(focus, Math.min(1, 8 * dt));

    const cosP = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosP * DIST,
      Math.sin(this.pitch) * DIST + HEIGHT * 0.4,
      Math.cos(this.yaw) * cosP * DIST
    );
    const desired = this.target.clone().add(offset);

    // pull in when a prop (tree, rock) blocks the line to the player
    if (this.occluders) {
      const dir = desired.clone().sub(this.target);
      const dist = dir.length();
      dir.normalize();
      this.raycaster.set(this.target, dir);
      this.raycaster.far = dist;
      const hits = this.raycaster.intersectObject(this.occluders, true);
      if (hits.length > 0) {
        desired.copy(this.target).addScaledVector(dir, Math.max(2.2, hits[0].distance * 0.88));
      }
    }

    // keep the camera above the ground
    const groundY = heightAt(desired.x, desired.z) + 0.7;
    if (desired.y < groundY) desired.y = groundY;

    this.camera.position.lerp(desired, Math.min(1, 10 * dt));
    this.camera.lookAt(this.target);
  }
}
