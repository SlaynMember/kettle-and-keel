/**
 * The sailor: a little primitive-built character with procedural walk bob,
 * punch/gather action animations, and surface swimming.
 * All animation is driven by one clock here — no per-sprite timer drift.
 */
import * as THREE from 'three';
import { heightAt } from '../world/terrain';
import { SEA_LEVEL } from '../world/terrain';
import type { Input } from '../core/input';

const SPEED = 7;
const SWIM_SPEED = 3.6;
const TURN_LERP = 12;
const SWIM_START = -0.8; // terrain below this = swimming
const SWIM_Y = SEA_LEVEL - 0.85; // body sits low in the water

export type PlayerAction = 'none' | 'punch' | 'gather';

export class Player {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  /** multiplier from tea buffs */
  speedMult = 1;
  swimming = false;

  /** facing angle; placement ghosts and future companions read it */
  heading = 0;

  private moving = 0;
  private walkClock = 0;
  private action: PlayerAction = 'none';
  private actionTimer = 0;

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

    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.55, 7), pantsMat);
    hips.position.y = 0.45;
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.85, 7), shirt);
    this.body.position.y = 1.1;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 6, 10), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.55;
    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), skin);
    this.head.position.y = 1.95;
    this.hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.07, 9), strawMat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.28, 9), strawMat);
    crown.position.y = 0.16;
    this.hat.add(brim, crown);
    this.hat.position.y = 2.2;
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

  /** play a short action animation (punch swings the arm, gather crouches) */
  setAction(action: PlayerAction) {
    this.action = action;
    this.actionTimer = 0;
  }

  get busy(): boolean {
    return this.action !== 'none';
  }

  update(dt: number, input: Input, cameraYaw: number) {
    const mx = input.move.x;
    const my = input.move.y;
    const intent = Math.min(1, Math.hypot(mx, my));

    const groundHere = heightAt(this.position.x, this.position.z);
    this.swimming = groundHere < SWIM_START;
    const speed = (this.swimming ? SWIM_SPEED : SPEED) * this.speedMult;

    if (intent > 0.05) {
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const dirX = mx * cos - my * sin;
      const dirZ = -my * cos - mx * sin;

      const nx = this.position.x + dirX * speed * intent * dt;
      const nz = this.position.z + dirZ * speed * intent * dt;
      // soft world-edge clamp; swimming allows deep water
      if (Math.hypot(nx, nz) < 95) {
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

    // vertical: walk the terrain, or float at the surface
    const ground = heightAt(this.position.x, this.position.z);
    this.position.y = this.swimming ? SWIM_Y : Math.max(ground, SWIM_START);

    // procedural animation, all off one clock
    this.walkClock += dt * (4 + 6 * this.moving);
    let bob: number;
    let swing: number;
    if (this.swimming) {
      bob = Math.sin(this.walkClock * 1.2) * 0.12;
      swing = Math.sin(this.walkClock * 1.6) * 1.15; // paddle
      this.group.rotation.x = 0.85; // lean forward in the water
    } else {
      bob = Math.sin(this.walkClock * 2) * 0.06 * this.moving + Math.sin(this.walkClock * 0.6) * 0.012 * (1 - this.moving);
      swing = Math.sin(this.walkClock * 2) * 0.7 * this.moving;
      this.group.rotation.x = this.moving * 0.06;
    }

    // action animation overrides arms briefly
    if (this.action !== 'none') {
      this.actionTimer += dt;
      const t = this.actionTimer / 0.45;
      if (t >= 1) {
        this.action = 'none';
      } else if (this.action === 'punch') {
        const jab = Math.sin(Math.min(1, t) * Math.PI); // out and back
        this.armR.rotation.x = -1.6 * jab;
        this.armL.rotation.x = swing * 0.3;
        this.group.rotation.x += jab * 0.12;
      } else {
        // gather: crouch and reach down
        const dip = Math.sin(Math.min(1, t) * Math.PI);
        this.group.scale.y = 1 - dip * 0.22;
        this.armR.rotation.x = 1.4 * dip;
        this.armL.rotation.x = 1.4 * dip;
      }
    }
    if (this.action === 'none') {
      this.group.scale.y = THREE.MathUtils.lerp(this.group.scale.y, 1, Math.min(1, 12 * dt));
      this.armL.rotation.x = swing;
      this.armR.rotation.x = -swing;
    }

    this.group.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.group.rotation.y = this.heading;
    this.hat.rotation.z = Math.sin(this.walkClock) * 0.04 * this.moving;
  }
}
