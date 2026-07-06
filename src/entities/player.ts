/**
 * The sailor: a little primitive-built character with procedural walk bob,
 * punch/gather action animations, and surface swimming.
 * All animation is driven by one clock here — no per-sprite timer drift.
 */
import * as THREE from 'three';
import { heightAt, insideWorld } from '../world/terrain';
import { getWaterLevel } from '../world/tide';
import type { Input } from '../core/input';

const SPEED = 7;
const SWIM_SPEED = 3.6;
const TURN_LERP = 12;
const SWIM_START = 0.8; // terrain this far under the water line = swimming
const SWIM_DRAFT = 0.85; // body sits this far below the surface — the surface cap, never exceeded
const JUMP_SPEED = 5.2;
const GRAVITY = 14;
const PADDLE_UP_RATE = 3.2; // holding Space while swimming
const BUOYANCY_RATE = 1.1; // natural rise back to the surface otherwise
const DIVE_RATE = 2.6; // holding C/Shift/dive button: swim down
const DIVE_FLOOR_GAP = 0.45; // never sink into the seafloor
const HEAD_UNDER = 1.3; // submerged this far below the surface = breath ticks
const BREATH_BASE = 12; // seconds of air; kelp tea raises it
const BREATH_KELP = 26;
const BREATH_REFILL = 6; // refill rate at the surface (seconds of air per second)
const TREAD_LEAN = 0.22; // idle in water: mostly upright, slight forward lean
const PRONE_ANGLE = 1.4; // ~80deg forward pitch while swimming and moving
const PRONE_EASE = 4; // ~0.25s ease into/out of the prone swim pose

export type PlayerAction = 'none' | 'punch' | 'gather';

export class Player {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  /** multiplier from tea buffs */
  speedMult = 1;
  swimming = false;
  /** kelp-tea buff active: deeper lungs (main.ts sets this each frame) */
  kelpLungs = false;
  /** seconds of air left; only drains while the head is under */
  breath = BREATH_BASE;
  /** true while fully submerged (breath draining) */
  underwater = false;
  /** breath ran out — buoyancy overrides the dive until the surface */
  gasping = false;

  /** facing angle; placement ghosts and future companions read it */
  heading = 0;

  private moving = 0;
  private walkClock = 0;
  private action: PlayerAction = 'none';
  private actionTimer = 0;

  private vy = 0;
  private airborne = false;
  private submerge = 0; // how far fall-momentum has pulled the player below SWIM_Y; paddling/buoyancy floats it back up
  private proneAmount = 0; // 0 = upright tread, 1 = fully prone travel pose; eased

  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private hat: THREE.Group;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;

  constructor(spawn: THREE.Vector3) {
    this.group = new THREE.Group();
    // yaw (Y) applied before pitch (X) so the swim/walk forward-lean always
    // composes with the current heading instead of tilting on a fixed world axis
    this.group.rotation.order = 'YXZ';
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

  /** current lung capacity in seconds (kelp tea deepens it) */
  get breathMax(): number {
    return this.kelpLungs ? BREATH_KELP : BREATH_BASE;
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

    const water = getWaterLevel();
    const groundHere = heightAt(this.position.x, this.position.z);
    this.swimming = groundHere < water - SWIM_START;
    const speed = (this.swimming ? SWIM_SPEED : SPEED) * this.speedMult;

    if (intent > 0.05) {
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const dirX = mx * cos - my * sin;
      const dirZ = -my * cos - mx * sin;

      const nx = this.position.x + dirX * speed * intent * dt;
      const nz = this.position.z + dirZ * speed * intent * dt;
      // soft world-edge clamp; the bound is a disc covering both islands
      if (insideWorld(nx, nz)) {
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

    // vertical: walk the terrain with a jump arc, or swim at (or below) the surface
    const ground = heightAt(this.position.x, this.position.z);
    const swimY = water - SWIM_DRAFT; // the surface cap — never exceeded
    if (this.swimming) {
      if (this.airborne) {
        // hit the water mid-jump — carry a little fall momentum under the surface
        this.submerge = Math.max(this.submerge, Math.min(1.2, -this.vy * 0.1));
        this.airborne = false;
        this.vy = 0;
      }
      // dive down toward the seafloor, or float/paddle back up
      const floorCap = Math.max(0, swimY - (ground + DIVE_FLOOR_GAP));
      if (input.dive && !this.gasping) {
        this.submerge = Math.min(floorCap, this.submerge + DIVE_RATE * dt);
      } else {
        // paddling up (or gasping for air) beats natural buoyancy
        const rising = input.jump || this.gasping ? PADDLE_UP_RATE : BUOYANCY_RATE;
        this.submerge = Math.max(0, this.submerge - rising * dt);
      }
      this.submerge = Math.min(this.submerge, floorCap); // floor rose under us — never clip in
      this.position.y = swimY - this.submerge;
    } else {
      if (!this.airborne && input.jump) {
        this.airborne = true;
        this.vy = JUMP_SPEED;
      }
      if (this.airborne) {
        this.vy -= GRAVITY * dt;
        this.position.y += this.vy * dt;
        if (this.position.y <= ground) {
          this.position.y = ground;
          this.airborne = false;
          this.vy = 0;
          this.submerge = 0;
        }
      } else {
        this.position.y = Math.max(ground, swimY);
      }
    }

    // breath: drains while the head is under, refills fast at the surface.
    // Running dry never hurts — buoyancy just wins until the next gulp of air.
    this.underwater = this.swimming && this.position.y < water - HEAD_UNDER;
    const breathMax = this.breathMax;
    if (this.underwater) {
      this.breath = Math.max(0, this.breath - dt);
      if (this.breath <= 0) this.gasping = true;
    } else {
      this.breath = Math.min(breathMax, this.breath + BREATH_REFILL * dt);
      if (this.submerge < 0.2) this.gasping = false;
    }
    this.breath = Math.min(this.breath, breathMax); // kelp tea wore off mid-dive

    // procedural animation, all off one clock
    this.walkClock += dt * (4 + 6 * this.moving);
    let bob: number;
    let swing: number;
    if (this.swimming) {
      // ease between upright treading and a fully prone travel pose
      this.proneAmount = THREE.MathUtils.lerp(this.proneAmount, this.moving, Math.min(1, PRONE_EASE * dt));
      bob = THREE.MathUtils.lerp(Math.sin(this.walkClock * 0.9) * 0.05, Math.sin(this.walkClock * 1.3) * 0.1, this.proneAmount);
      swing = THREE.MathUtils.lerp(
        Math.sin(this.walkClock * 1.0) * 0.3, // idle tread: gentle arm sway
        Math.sin(this.walkClock * 1.6) * 1.1, // moving: alternate paddle
        this.proneAmount
      );
      // whole-body pitch composes with heading (rotation.order = 'YXZ'): head stays
      // toward travel at the surface, hips trail low and behind as the pitch grows
      this.group.rotation.x = THREE.MathUtils.lerp(TREAD_LEAN, PRONE_ANGLE, this.proneAmount);
    } else {
      this.proneAmount = THREE.MathUtils.lerp(this.proneAmount, 0, Math.min(1, PRONE_EASE * dt));
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
