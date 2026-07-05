import * as THREE from 'three';
import './ui/styles.css';
import { Input } from './core/input';
import { CameraRig } from './core/camera';
import { store } from './core/store';
import { interactions } from './core/interact';
import { buildTerrain, heightAt } from './world/terrain';
import { Sky } from './world/sky';
import { Water } from './world/water';
import { Props } from './world/props';
import { DriftingLeaves } from './world/leaves';
import { Player } from './entities/player';
import { HerbField } from './entities/herbs';
import { ResourceField } from './entities/resources';
import { Structures } from './entities/structures';
import { Gull } from './entities/gull';
import { Hud } from './ui/hud';
import { SatchelPanel } from './ui/panel';
import { DialoguePanel } from './ui/dialogue';
import { MEET_GULL, GULL_CHATTER } from './data/dialogue';
import { audio, type MusicContext } from './audio/audio';

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

// campfire sits east of spawn, out of the default camera line
const props = new Props(spawn.clone().add(new THREE.Vector3(6.5, 0, 1.5)));
scene.add(props.group);

const leaves = new DriftingLeaves();
scene.add(leaves.group);

const player = new Player(spawn);
scene.add(player.group);

// ---- ui ----
let hud: Hud; // assigned below; toast() closures need the reference
const toast = (msg: string) => hud.toast(msg);

const herbs = new HerbField(() => player.setAction('gather'), toast);
scene.add(herbs.group);

const resources = new ResourceField(spawn, (verb) => player.setAction(verb));
scene.add(resources.group);

const structures = new Structures(toast);
scene.add(structures.group);

const gull = new Gull();
scene.add(gull.group);

const rig = new CameraRig(camera);
rig.occluders = resources.occluders;
const input = new Input(canvas, uiRoot);

const panel = new SatchelPanel(uiRoot, toast);
const dialogue = new DialoguePanel(uiRoot);

hud = new Hud(uiRoot, {
  onAction: () => triggerAction(),
  onSatchel: () => panel.toggle(),
  onCancel: () => structures.cancelPlacement(),
});

// the kettle: brew station at the campfire
interactions.add({
  label: () => 'Use Kettle',
  position: props.campfire.position,
  range: 3.2,
  priority: 3,
  action: () => panel.open(true),
});

// tea buffs: ticked here, persisted with the save
const buffs = { ...store.get().buffs };
let buffPersistTimer = 0;
const glowLight = new THREE.PointLight(0xffc37a, 0, 7, 1.6);
player.group.add(glowLight);
glowLight.position.y = 1.6;

panel.onDrink = (buff, seconds) => {
  buffs[buff] = Math.max(buffs[buff], seconds);
};
panel.onPlace = (kind) => structures.startPlacement(kind);

// the bird bath's rim, where the gull lands
const GULL_PERCH_OFFSET = new THREE.Vector3(0.4, 1.0, 0);
structures.onTeaPoured = (pos) => gull.flyTo(pos.clone().add(GULL_PERCH_OFFSET));

let chatterIndex = 0;
gull.onChat = async () => {
  if (!store.get().gullMet) {
    await dialogue.play(MEET_GULL);
    store.set({ gullMet: true });
    toast('Admiral Biscuit will stick around the bath now');
  } else {
    await dialogue.play(GULL_CHATTER[chatterIndex % GULL_CHATTER.length]);
    chatterIndex++;
  }
};

function triggerAction() {
  if (dialogue.isOpen) {
    dialogue.advance();
    return;
  }
  if (structures.placing) {
    structures.confirmPlacement();
    return;
  }
  if (panel.isOpen || player.busy) return;
  interactions.trigger();
}
input.onInteract(() => triggerAction());
input.onTogglePanel(() => {
  if (structures.placing) return;
  panel.toggle();
});
input.onEscape(() => {
  if (structures.placing) structures.cancelPlacement();
  else panel.close();
});

// ---- loop ----
let started = false;
let nightMusic = false; // hysteresis so the soundtrack doesn't flap at dusk
const clock = new THREE.Clock();
const idleInput = { move: { x: 0, y: 0 } } as Input;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!started) {
    rig.yaw += dt * 0.05; // slow establishing orbit behind the intro overlay
  }
  input.update();
  player.update(dt, started && !panel.isOpen && !dialogue.isOpen ? input : idleInput, rig.yaw);

  // buffs
  buffs.speed = Math.max(0, buffs.speed - dt);
  buffs.glow = Math.max(0, buffs.glow - dt);
  player.speedMult = buffs.speed > 0 ? 1.3 : 1;
  glowLight.intensity = buffs.glow > 0 ? 1.4 + Math.sin(clock.elapsedTime * 3) * 0.2 : 0;
  buffPersistTimer += dt;
  if (buffPersistTimer > 5) {
    buffPersistTimer = 0;
    store.set({ buffs: { ...buffs } });
  }

  // contextual soundtrack: workshop while crafting/placing, Hazy Tea Drift at night
  if (nightMusic ? sky.daylight > 0.32 : sky.daylight < 0.2) nightMusic = !nightMusic;
  const musicCtx: MusicContext =
    panel.isOpen || structures.placing ? 'workshop' : nightMusic ? 'risk' : 'explore';
  audio.setContext(musicCtx, dt);
  audio.update(dt);

  rig.update(dt, input, player.position);
  sky.update(dt, player.position);
  water.update(dt);
  props.update(dt, sky.daylight);
  leaves.update(dt, player.position);
  herbs.update(dt);
  resources.update(dt);
  structures.update(dt, player.position, player.heading);
  gull.update(dt, player.position);
  interactions.update(player.position);

  // context button: placement mode wins, then nearest interactable
  if (!started || panel.isOpen || dialogue.isOpen) {
    hud.setAction(null);
  } else if (structures.placing) {
    hud.setAction(structures.placementLabel(), { danger: !structures.placementLabel().startsWith('Place'), cancelable: true });
  } else {
    hud.setAction(interactions.active?.label() ?? null);
  }
  hud.setTime(sky.time, store.get().day);
  hud.setBuffs(buffs);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

hud.showIntro().then(() => {
  started = true;
  // reload with a brewed bath already sitting out: the gull flies in after a beat
  const savedBath = store.get().structures.find((s) => s.type === 'bird_bath' && s.teaLoaded);
  if (savedBath) {
    const pos = new THREE.Vector3(savedBath.x, heightAt(savedBath.x, savedBath.z), savedBath.z);
    setTimeout(() => gull.flyTo(pos.add(GULL_PERCH_OFFSET)), 6000);
  }
});

tick();

// dev/debug handle (also how automated playtests drive the game)
Object.assign(window, { __kk: { player, rig, sky, camera, heightAt, store, structures, gull, buffs, audio, panel, dialogue } });
