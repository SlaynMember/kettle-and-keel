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
    new THREE.MeshLambertMaterial({ color: 0xa4bd6e, flatShading: true })
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

export interface Wreck {
  group: THREE.Group;
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

/**
 * Deterministic beach-band scan for the wreck: walk outward ring by ring from
 * a target point (~18 west of the campfire) until a cell lands in the sand
 * height band. No rng — same wreck spot every load, like the terrain itself.
 */
function findWreckSpot(near: THREE.Vector3): THREE.Vector3 | null {
  const targetX = near.x - 18;
  const targetZ = near.z;
  const step = 1.5;
  for (let ring = 0; ring < 14; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue; // only the new ring's cells
        const x = targetX + dx * step;
        const z = targetZ + dz * step;
        const h = heightAt(x, z);
        if (h >= 0.8 && h <= 1.5) return new THREE.Vector3(x, h, z);
      }
    }
  }
  return null;
}

const WRECK_WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4226, flatShading: true });
const WRECK_DARK = new THREE.MeshLambertMaterial({ color: 0x54341e, flatShading: true });

function buildWreck(pos: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();

  // a bow section listing in the sand: keel line, two hull sides, the stern gone
  const keel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 0.24), WRECK_DARK);
  keel.position.y = 0.1;
  keel.rotation.z = 0.1; // bow end noses upward
  g.add(keel);

  // port side survives as three strakes climbing toward the bow
  for (let i = 0; i < 3; i++) {
    const len = 4.0 - i * 0.7;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.34, 0.09), i % 2 ? WRECK_DARK : WRECK_WOOD);
    plank.position.set(-(4.4 - len) / 2 + 0.15, 0.28 + i * 0.3, 0.34 + i * 0.12);
    plank.rotation.x = -0.5; // flares outward like a hull side
    plank.rotation.z = 0.1;
    g.add(plank);
  }
  // starboard side is torn open: only one low strake left
  const sb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.34, 0.09), WRECK_WOOD);
  sb.position.set(-0.5, 0.3, -0.36);
  sb.rotation.x = 0.5;
  sb.rotation.z = 0.1;
  g.add(sb);

  // bow post where the sides meet, proud of the sand
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.26), WRECK_DARK);
  bow.position.set(2.15, 0.6, 0);
  bow.rotation.z = -0.35;
  g.add(bow);

  // exposed ribs past the torn end — the skeleton the sea kept
  const ribGeo = new THREE.BoxGeometry(0.13, 1.0, 0.13);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(ribGeo, WRECK_DARK);
    rib.position.set(-2.5 - i * 0.55, 0.28 - i * 0.09, i % 2 ? 0.3 : -0.3);
    rib.rotation.z = i % 2 ? 0.5 : -0.4;
    rib.rotation.x = i % 2 ? -0.25 : 0.3;
    g.add(rib);
  }

  // snapped mast fallen across the hull
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.3, 6), WRECK_WOOD);
  mast.position.set(0.2, 0.75, 0.5);
  mast.rotation.z = THREE.MathUtils.degToRad(62);
  mast.rotation.x = THREE.MathUtils.degToRad(14);
  g.add(mast);

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  g.position.copy(pos);
  g.position.y -= 0.12; // keel buried, hull proud of the sand line
  g.rotation.y = 0.4; // fixed tilt — reads as random without touching Math.random
  g.rotation.x = 0.06; // slight list into the beach
  return g;
}

export class Props {
  readonly group = new THREE.Group();
  readonly campfire: Campfire;
  readonly wreck: Wreck | null;
  private clock = 0;

  constructor(spawn: THREE.Vector3) {
    for (let i = 0; i < 55; i++) {
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

    const wreckSpot = findWreckSpot(fp);
    if (wreckSpot) {
      const wreckGroup = buildWreck(wreckSpot);
      this.group.add(wreckGroup);
      this.wreck = { group: wreckGroup, position: wreckSpot.clone() };
    } else {
      this.wreck = null;
    }
  }

  update(dt: number, daylight: number) {
    this.clock += dt;
    const flicker = 0.85 + Math.sin(this.clock * 11) * 0.1 + Math.sin(this.clock * 23.7) * 0.05;
    this.campfire.flame.scale.set(flicker, flicker * (1 + Math.sin(this.clock * 7) * 0.12), flicker);
    this.campfire.light.intensity = (0.35 + (1 - daylight) * 2.2) * flicker;
  }
}
