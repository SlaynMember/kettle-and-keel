/**
 * Harvestable nodes: trees (wood), boulders (stone), algae (shallows).
 * Each node takes hits (punch/gather), yields per hit, depletes, regrows.
 * All animation runs off this system's single clock.
 */
import * as THREE from 'three';
import { heightAt, slopeAt, makeRng, ISLAND_RADIUS } from '../world/terrain';
import { interactions } from '../core/interact';
import { store } from '../core/store';
import { audio } from '../audio/audio';

const rng = makeRng(48151);

type NodeKind = 'tree' | 'rock' | 'algae';

interface HarvestNode {
  kind: NodeKind;
  group: THREE.Group;
  basePos: THREE.Vector3;
  baseScale: number;
  hitsLeft: number;
  state: 'alive' | 'falling' | 'gone';
  timer: number;
  shake: number;
  remove: () => void;
}

const NODE_CFG: Record<NodeKind, { hits: number; yields: string; respawn: number; label: string; verb: string }> = {
  tree: { hits: 3, yields: 'wood', respawn: 120, label: 'Chop Tree', verb: 'punch' },
  rock: { hits: 3, yields: 'stone', respawn: 150, label: 'Mine Stone', verb: 'punch' },
  algae: { hits: 1, yields: 'algae', respawn: 45, label: 'Gather Algae', verb: 'gather' },
};

function scatterPoint(minH: number, maxH: number, maxSlope: number): THREE.Vector3 | null {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * ISLAND_RADIUS * 1.02;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h >= minH && h <= maxH && slopeAt(x, z) <= maxSlope) return new THREE.Vector3(x, h, z);
  }
  return null;
}

function puffTree(): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b, flatShading: true });
  const canopyMat = new THREE.MeshLambertMaterial({
    color: rng() > 0.5 ? 0x5f9e4f : 0x74ad58,
    flatShading: true,
  });
  const h = 1.6 + rng() * 1.4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 6), trunkMat);
  trunk.position.y = h / 2;
  g.add(trunk);
  const puffs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < puffs; i++) {
    const s = 1.1 + rng() * 0.9;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), canopyMat);
    puff.position.set((rng() - 0.5) * 1.2, h + s * 0.5 + i * 0.55, (rng() - 0.5) * 1.2);
    puff.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
    g.add(puff);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

function boulder(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.7 + rng() * 1.0, 0),
    new THREE.MeshLambertMaterial({ color: rng() > 0.5 ? 0x8d8577 : 0x7d766b, flatShading: true })
  );
  m.scale.y = 0.6 + rng() * 0.3;
  m.rotation.y = rng() * Math.PI;
  m.castShadow = true;
  g.add(m);
  return g;
}

function algaeTuft(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x3d9970, flatShading: true });
  const strands = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < strands; i++) {
    const h = 0.5 + rng() * 0.6;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.09, h, 4), mat);
    s.position.set((rng() - 0.5) * 0.7, h / 2, (rng() - 0.5) * 0.7);
    s.rotation.z = (rng() - 0.5) * 0.6;
    g.add(s);
  }
  return g;
}

export class ResourceField {
  readonly group = new THREE.Group();
  /** tall props that should block the camera */
  readonly occluders = new THREE.Group();
  private nodes: HarvestNode[] = [];
  private clock = 0;

  constructor(spawn: THREE.Vector3, private onHarvest: (verb: 'punch' | 'gather') => void) {
    this.group.add(this.occluders);
    const clearOfSpawn = (p: THREE.Vector3, r: number) => Math.hypot(p.x - spawn.x, p.z - spawn.z) >= r;

    for (let i = 0; i < 26; i++) {
      const p = scatterPoint(1.8, 11, 0.6);
      if (!p || !clearOfSpawn(p, 14)) continue;
      this.addNode('tree', puffTree(), p, this.occluders);
    }
    for (let i = 0; i < 16; i++) {
      const p = scatterPoint(0.6, 14, 1.2);
      if (!p || !clearOfSpawn(p, 6)) continue;
      this.addNode('rock', boulder(), p, this.group);
    }
    for (let i = 0; i < 22; i++) {
      const p = scatterPoint(-1.8, -0.45, 2);
      if (!p) continue;
      this.addNode('algae', algaeTuft(), p, this.group);
    }
  }

  private addNode(kind: NodeKind, mesh: THREE.Group, p: THREE.Vector3, parent: THREE.Group) {
    if (kind === 'tree') p.y -= 0.1;
    mesh.position.copy(p);
    parent.add(mesh);
    const cfg = NODE_CFG[kind];
    const node: HarvestNode = {
      kind,
      group: mesh,
      basePos: p.clone(),
      baseScale: 1,
      hitsLeft: cfg.hits,
      state: 'alive',
      timer: 0,
      shake: 0,
      remove: () => {},
    };
    node.remove = interactions.add({
      label: () => (node.state === 'alive' ? cfg.label : null),
      position: node.basePos,
      range: kind === 'tree' ? 3.2 : 2.8,
      priority: kind === 'algae' ? 0 : 1,
      action: () => this.hit(node),
    });
    this.nodes.push(node);
  }

  private hit(node: HarvestNode) {
    if (node.state !== 'alive') return;
    const cfg = NODE_CFG[node.kind];
    this.onHarvest(cfg.verb as 'punch' | 'gather');
    node.shake = 1;
    node.hitsLeft -= 1;
    store.addItem(cfg.yields);
    audio.sfx(node.kind === 'algae' ? 'sfx-pickup' : 'sfx-cast');
    if (node.hitsLeft <= 0) {
      node.state = 'falling';
      node.timer = 0;
    }
  }

  update(dt: number) {
    this.clock += dt;
    for (const n of this.nodes) {
      if (n.shake > 0) {
        n.shake = Math.max(0, n.shake - dt * 4);
        const s = Math.sin(this.clock * 40) * 0.06 * n.shake;
        n.group.rotation.z = s;
        n.group.rotation.x = s * 0.6;
      }
      if (n.state === 'falling') {
        n.timer += dt;
        const t = Math.min(1, n.timer / 0.5);
        if (n.kind === 'tree') {
          // tip over and sink
          n.group.rotation.z = t * 1.2;
          n.group.position.y = n.basePos.y - t * 1.5;
        } else {
          n.group.scale.setScalar(Math.max(0.01, 1 - t));
        }
        if (t >= 1) {
          n.state = 'gone';
          n.timer = 0;
          n.group.visible = false;
        }
      } else if (n.state === 'gone') {
        n.timer += dt;
        if (n.timer >= NODE_CFG[n.kind].respawn) {
          n.state = 'alive';
          n.hitsLeft = NODE_CFG[n.kind].hits;
          n.group.visible = true;
          n.group.rotation.set(0, n.group.rotation.y, 0);
          n.group.position.copy(n.basePos);
          n.group.scale.setScalar(0.01);
        }
      } else if (n.group.scale.x < 1) {
        n.group.scale.setScalar(Math.min(1, n.group.scale.x + dt * 1.2));
      }
      // algae sways underwater
      if (n.kind === 'algae' && n.state === 'alive') {
        n.group.rotation.z = Math.sin(this.clock * 1.8 + n.basePos.x) * 0.12;
      }
    }
  }
}
