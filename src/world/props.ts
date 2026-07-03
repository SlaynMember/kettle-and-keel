/**
 * Island dressing: grass tufts and the spawn-point campfire with its kettle
 * (the game is named after it — it gets a light and a brew prompt).
 * Trees and rocks live in entities/resources.ts now — they're harvestable.
 */
import * as THREE from 'three';
import { heightAt, slopeAt, makeRng, ISLAND_RADIUS } from './terrain';

const rng = makeRng(9042);

function scatterPoint(minH: number, maxH: number, maxSlope: number): THREE.Vector3 | null {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * ISLAND_RADIUS * 0.92;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h >= minH && h <= maxH && slopeAt(x, z) <= maxSlope) {
      return new THREE.Vector3(x, h, z);
    }
  }
  return null;
}

function grassTuft(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.55 + rng() * 0.3, 5),
    new THREE.MeshLambertMaterial({ color: 0x97c368, flatShading: true })
  );
  m.rotation.z = (rng() - 0.5) * 0.35;
  return m;
}

export interface Campfire {
  group: THREE.Group;
  flame: THREE.Mesh;
  light: THREE.PointLight;
  position: THREE.Vector3;
}

function buildCampfire(pos: THREE.Vector3): Campfire {
  const g = new THREE.Group();
  const logMat = new THREE.MeshLambertMaterial({ color: 0x6b4226, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 5), logMat);
    log.rotation.z = Math.PI / 2.4;
    log.rotation.y = (i / 4) * Math.PI * 2;
    log.position.y = 0.16;
    g.add(log);
  }
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x7d766b, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stoneMat);
    const a = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75);
    g.add(s);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.75, 6),
    new THREE.MeshBasicMaterial({ color: 0xffa432, transparent: true, opacity: 0.92 })
  );
  flame.position.y = 0.55;
  g.add(flame);

  // the kettle
  const kettleMat = new THREE.MeshLambertMaterial({ color: 0xe8623d, flatShading: true });
  const kettle = new THREE.Group();
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), kettleMat);
  belly.scale.y = 0.8;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.35, 5), kettleMat);
  spout.position.set(0.32, 0.1, 0);
  spout.rotation.z = -Math.PI / 3;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshLambertMaterial({ color: 0xf4b860 }));
  lid.position.y = 0.26;
  kettle.add(belly, spout, lid);
  kettle.position.set(0.9, 0.3, 0.4);
  g.add(kettle);

  const light = new THREE.PointLight(0xff9840, 0, 14, 1.8);
  light.position.y = 1;
  g.add(light);

  g.position.copy(pos);
  return { group: g, flame, light, position: pos.clone() };
}

export class Props {
  readonly group = new THREE.Group();
  readonly campfire: Campfire;
  private clock = 0;

  constructor(spawn: THREE.Vector3) {
    for (let i = 0; i < 40; i++) {
      const p = scatterPoint(1.5, 8, 0.5);
      if (!p) continue;
      const gr = grassTuft();
      gr.position.copy(p);
      gr.position.y += 0.2;
      this.group.add(gr);
    }
    const fp = spawn.clone();
    fp.y = heightAt(fp.x, fp.z);
    this.campfire = buildCampfire(fp);
    this.group.add(this.campfire.group);
  }

  update(dt: number, daylight: number) {
    this.clock += dt;
    const flicker = 0.85 + Math.sin(this.clock * 11) * 0.1 + Math.sin(this.clock * 23.7) * 0.05;
    this.campfire.flame.scale.set(flicker, flicker * (1 + Math.sin(this.clock * 7) * 0.12), flicker);
    this.campfire.light.intensity = (0.35 + (1 - daylight) * 2.2) * flicker;
  }
}
