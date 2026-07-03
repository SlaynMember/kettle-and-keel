import * as THREE from 'three';
import './ui/styles.css';
import { Input } from './core/input';
import { CameraRig } from './core/camera';
import { store } from './core/store';
import { buildTerrain, heightAt } from './world/terrain';
import { Sky } from './world/sky';
import { Water } from './world/water';
import { Props } from './world/props';
import { Player } from './entities/player';
import { HerbField } from './entities/herbs';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1100);

// ---- world ----
scene.add(buildTerrain());
const sky = new Sky(scene);
const water = new Water();
scene.add(water.mesh);

// spawn: walk south from center until we hit the beach band
function findSpawn(): THREE.Vector3 {
  for (let r = 0; r < 90; r += 0.5) {
    const h = heightAt(0, r);
    if (h < 1.6 && h > 0.7) return new THREE.Vector3(0, h, r - 2);
  }
  return new THREE.Vector3(0, heightAt(0, 0), 0);
}
const spawn = findSpawn();

const props = new Props(spawn.clone().add(new THREE.Vector3(3.5, 0, -3)));
scene.add(props.group);

const herbs = new HerbField();
scene.add(herbs.group);

const player = new Player(spawn);
scene.add(player.group);

const rig = new CameraRig(camera);
rig.occluders = props.group;
const input = new Input(canvas, uiRoot);

const hud = new Hud(uiRoot, () => gather());
input.onInteract(() => gather());

function gather() {
  const target = herbs.target;
  if (target && herbs.tryGather()) {
    hud.toast(`+1 ${target.name}`);
  }
}

// ---- loop ----
let started = false;
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!started) {
    // slow establishing orbit behind the intro overlay
    rig.yaw += dt * 0.05;
  }
  input.update();
  player.update(dt, started ? input : ({ move: { x: 0, y: 0 } } as Input), rig.yaw);
  rig.update(dt, input, player.position);
  sky.update(dt, player.position);
  water.update(dt);
  props.update(dt, sky.daylight);
  herbs.update(dt, player.position);
  hud.setGatherTarget(started ? herbs.target : null);
  hud.setTime(sky.time, store.get().day);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

hud.showIntro().then(() => {
  started = true;
});

// dev/debug handle (also how automated playtests drive the game)
Object.assign(window, { __kk: { player, rig, sky, camera, heightAt } });

tick();
