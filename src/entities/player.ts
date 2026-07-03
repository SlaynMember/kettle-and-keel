/**
 * The sailor: a little primitive-built character with procedural walk bob.
 * All animation is driven by one clock here — no per-sprite timer drift.
 */
import * as THREE from 'three';
import { heightAt } from '../world/terrain';
import type { Input } from '../core/input';

const SPEED = 7;
const TURN_LERP = 12;
const WADE_LIMIT = -0.55; // deepest water you can wade into

export class Player {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  /** current planar speed 0..1 for animation */
  private moving = 0;
  private walkClock = 0;
  private heading = 0;

  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private hat: THREE.Group;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;

  constructor(spawn: THREE.Vector3) {
    this.group = new THREE.Group();
    this.position = spawn.clone();

    const shirt = new THREE.MeshLambertMaterial({ color: 0xf2e9d8, flatShading: true });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69, flatShading: true });
    const scarfMat = new THREE.MeshLambertMaterial({ color: 0xe8623d, flatShading: true });
    const strawMat = new THREE.MeshLambertMaterial({ color: 0xf4b860, flatShading: true });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x4a6670, flatShading: true });

    // legs / lower body
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.55, 7), pantsMat);
    hips.position.y = 0.45;
    // torso
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.85, 7), shirt);
    this.body.position.y = 1.1;
    // scarf
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 6, 10), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.55;
    // head
    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), skin);
    this.head.position.y = 1.95;
    // straw hat
    this.hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.07, 9), strawMat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.28, 9), strawMat);
    crown.position.y = 0.16;
    this.hat.add(brim, crown);
    this.hat.position.y = 2.2;
    // arms
    const armGeo = new THREE.CapsuleGeometry(0.11, 0.55, 3, 6);
    this.armL = new THREE.Mesh(armGeo, shirt);
    this.armR = new THREE.Mesh(armGeo, shirt);
    this.armL.position.set(-0.55, 1.25, 0);
    this.armR.position.set(0.55, 1.25, 0);

    this.group.add(hips, this.body, scarf, this.head, this.hat, this.armL, this.armR);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.group.position.copy(this.position);
  }

  update(dt: number, input: Input, cameraYaw: number) {
    const mx = input.move.x;
    const my = input.move.y;
    const intent = Math.min(1, Math.hypot(mx, my));

    if (intent > 0.05) {
      // camera-relative movement
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const dirX = mx * cos - my * sin;
      const dirZ = -my * cos - mx * sin;

      const nx = this.position.x + dirX * SPEED * intent * dt;
      const nz = this.position.z + dirZ * SPEED * intent * dt;
      // can wade, can't swim (v0); also soft world-edge clamp
      if (heightAt(nx, nz) > WADE_LIMIT && Math.hypot(nx, nz) < 95) {
        this.position.x = nx;
        this.position.z = nz;
      }
      const targetHeading = Math.atan2(dirX, dirZ);
      let d = targetHeading - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, TURN_LERP * dt);
    }

    this.moving = THREE.MathUtils.lerp(this.moving, intent > 0.05 ? intent : 0, Math.min(1, 10 * dt));

    const ground = Math.max(heightAt(this.position.x, this.position.z), WADE_LIMIT);
    this.position.y = ground;

    // procedural animation, all off one clock
    this.walkClock += dt * (4 + 6 * this.moving);
    const bob = Math.sin(this.walkClock * 2) * 0.06 * this.moving;
    const breathe = Math.sin(this.walkClock * 0.6) * 0.012 * (1 - this.moving);
    const swing = Math.sin(this.walkClock * 2) * 0.7 * this.moving;

    this.group.position.set(this.position.x, this.position.y + bob + breathe, this.position.z);
    this.group.rotation.y = this.heading;
    this.group.rotation.x = this.moving * 0.06; // slight forward lean
    this.armL.rotation.x = swing;
    this.armR.rotation.x = -swing;
    this.hat.rotation.z = Math.sin(this.walkClock) * 0.04 * this.moving;
  }
}
