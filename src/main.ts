import * as THREE from 'three';
import './ui/styles.css';
import { Input } from './core/input';
import { CameraRig } from './core/camera';
import { store } from './core/store';
import { interactions } from './core/interact';
import { buildTerrain, heightAt, ISLAND2_CENTER, ISLAND2_RADIUS, nearerIsland } from './world/terrain';
import { setWorldTime, getWaterLevel, tideRising } from './world/tide';
import { Sky } from './world/sky';
import { Water } from './world/water';
import { Props, IslandTwoProps } from './world/props';
import { DriftingLeaves } from './world/leaves';
import { BeachFinds } from './world/beachfinds';
import { Player } from './entities/player';
import { HerbField } from './entities/herbs';
import { ResourceField } from './entities/resources';
import { Structures } from './entities/structures';
import { Seafloor } from './entities/seafloor';
import { Boat } from './entities/boat';
import { Sharks } from './entities/sharks';
import { Gull } from './entities/gull';
import { ShootingStar } from './world/star';
import { Hud } from './ui/hud';
import { SatchelPanel } from './ui/panel';
import { DialoguePanel } from './ui/dialogue';
import { GuideCard } from './ui/guide';
import { Cards } from './ui/cards';
import { MEET_GULL, GULL_CHATTER, LAUNCH_CEREMONY, FIRST_LANDING, SHARK_SIGHTING } from './data/dialogue';
import { GOALS, PRAISE_LINES } from './data/guidance';
import { ITEM_BY_ID, type ItemId } from './data/items';
import { FLAVOR } from './data/flavor';
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

// ---- island 2 (v3) ----
const props2 = new IslandTwoProps(toast);
scene.add(props2.group);

const herbs2 = new HerbField(() => player.setAction('gather'), toast, {
  cx: ISLAND2_CENTER.x,
  cz: ISLAND2_CENTER.y,
  radius: ISLAND2_RADIUS,
  countScale: 0.7,
});
scene.add(herbs2.group);

const resources2 = new ResourceField(props2.campfire.position, (verb) => player.setAction(verb), {
  cx: ISLAND2_CENTER.x,
  cz: ISLAND2_CENTER.y,
  radius: ISLAND2_RADIUS,
  trees: 20,
  rocks: 12,
  algae: 14,
  seed: 90210,
});
scene.add(resources2.group);

const seafloor = new Seafloor(() => player.setAction('gather'), toast);
scene.add(seafloor.group);

const structures = new Structures(toast);
scene.add(structures.group);

const gull = new Gull();
scene.add(gull.group);

const beachFinds = new BeachFinds(toast);
scene.add(beachFinds.group);

const star = new ShootingStar();
scene.add(star.group);

const rig = new CameraRig(camera);
// both islands' trees block the camera; the wrapper keeps them renderable
const camOccluders = new THREE.Group();
camOccluders.add(resources.occluders, resources2.occluders);
scene.add(camOccluders);
rig.occluders = camOccluders;
const input = new Input(canvas, uiRoot);

const panel = new SatchelPanel(uiRoot, toast);
const dialogue = new DialoguePanel(uiRoot);
const guide = new GuideCard(uiRoot);
const cards = new Cards(uiRoot);
beachFinds.onNote = (text) => {
  cards.note(text);
};

hud = new Hud(uiRoot, {
  onAction: () => triggerAction(),
  onSatchel: () => panel.toggle(),
  onCancel: () => structures.cancelPlacement(),
  onDiveHold: (held) => {
    input.diveTouch = held;
  },
});

// the boat, the sharks, and who they answer to
const boat = new Boat(props.wreck, water, player, toast);
scene.add(boat.group);
const sharks = new Sharks(player, toast);
scene.add(sharks.group);
boat.onBoardChange = (aboard) => {
  sharks.playerAboard = aboard;
};
props2.onUseKettle = () => panel.open(true);

// writing pack 3: Biscuit narrates the whole boat arc through the dialogue panel
boat.onBiscuit = (lines) => {
  if (!dialogue.isOpen) void dialogue.play(lines);
};
boat.onLaunched = () => {
  if (!dialogue.isOpen) void dialogue.play(LAUNCH_CEREMONY);
};
sharks.onFirstSighting = () => {
  if (!dialogue.isOpen) void dialogue.play(SHARK_SIGHTING);
};

// placements must not smother the kettle prompt
structures.avoid.push(props.campfire.position);

// the kettle: brew station at the campfire
interactions.add({
  label: () => 'Use Kettle',
  position: props.campfire.position,
  range: 3.2,
  priority: 3,
  action: () => panel.open(true),
});

// (the wreck's interactable now lives in entities/boat.ts — it's the v3 build site)

// digging: a low-priority, always-in-range interactable gated on owning a shovel.
// position is the live player.position reference, so distance-to-player is always ~0.
let pendingDig: 'sand' | 'dirt' | null = null;
let digTimer = 0;
function digKind(): 'sand' | 'dirt' | null {
  const h = heightAt(player.position.x, player.position.z);
  if (h >= 0.75 && h < 1.7) return 'sand';
  if (h >= 2.2) return 'dirt';
  return null;
}
interactions.add({
  label: () => {
    if (structures.placing || panel.isOpen || dialogue.isOpen) return null;
    if (store.count('shovel') <= 0) return null;
    const kind = digKind();
    return kind === 'sand' ? 'Dig Sand' : kind === 'dirt' ? 'Dig Dirt' : null;
  },
  position: player.position,
  range: 999,
  priority: -1,
  action: () => {
    if (player.busy) return;
    const kind = digKind();
    if (!kind) return;
    player.setAction('gather');
    pendingDig = kind;
    digTimer = 0.45;
  },
});

// homestead guidance: nudges a new player through the core loop, never gates it
function advanceGuide() {
  let step = store.get().guideStep;
  while (step < GOALS.length - 1 && GOALS[step].done(store.get())) {
    step++;
    store.set({ guideStep: step });
    toast(`☑ ${PRAISE_LINES[(step - 1) % PRAISE_LINES.length]}`);
    audio.sfx('sfx-levelup');
  }
}
let guideCheckTimer = 0;

// discovery cards: the first time an item is ever owned earns a flavor card.
// An existing save's starting inventory must not spray cards on boot, so
// while the intro hasn't been dismissed yet this only back-fills silently.
function checkDiscoveries() {
  const s = store.get();
  const owned = Object.entries(s.inventory)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([id]) => id);
  const fresh = owned.filter((id) => !s.discovered.includes(id));
  if (fresh.length === 0) return;
  if (!started) {
    store.set({ discovered: [...s.discovered, ...fresh] });
    return;
  }
  for (const id of fresh) {
    store.set({ discovered: [...store.get().discovered, id] });
    const flavor = FLAVOR[id as ItemId];
    const item = ITEM_BY_ID.get(id as ItemId);
    if (flavor && item) cards.discovery(item, flavor);
  }
}

// the sleep sequence: a full-screen fade timed off the shared clock, not setTimeout
let sleeping = false;
let sleepTimer = 0;
let sleepWokeAtMidpoint = false;
const SLEEP_FADE_IN = 0.8;
const SLEEP_HOLD = 0.6;
const SLEEP_FADE_OUT = 0.8;
structures.getDaylight = () => sky.daylight;
structures.getTime = () => sky.time;
structures.onSleep = () => {
  if (sleeping) return;
  sleeping = true;
  sleepTimer = 0;
  sleepWokeAtMidpoint = false;
};

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

function stopWatchingStar() {
  star.stopWatching();
  rig.lookTarget = null;
}

function triggerAction() {
  if (sleeping) return;
  if (cards.noteOpen) {
    cards.closeNote();
    return;
  }
  if (dialogue.isOpen) {
    dialogue.advance();
    return;
  }
  if (boat.sailing) {
    boat.disembark();
    return;
  }
  if (structures.placing) {
    structures.confirmPlacement();
    return;
  }
  if (panel.isOpen || player.busy) return;
  if (star.watching) {
    stopWatchingStar();
    return;
  }
  if (star.active) {
    star.watching = true;
    return;
  }
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
let starWasActive = false; // edge-detects the shooting star ending, for the "Make a wish." toast
let wasGasping = false; // edge-detects running out of breath, for the surfacing toast
const clock = new THREE.Clock();
const idleInput = { move: { x: 0, y: 0 } } as Input;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!started) {
    rig.yaw += dt * 0.05; // slow establishing orbit behind the intro overlay
  }
  input.update();
  setWorldTime(sky.time); // stamp the tide before anything samples the water

  const inputLive = started && !panel.isOpen && !dialogue.isOpen && !sleeping && !cards.noteOpen;
  if (boat.sailing) {
    // aboard: the boat consumes movement, the player just rides the deck
    boat.update(dt, inputLive ? input.move : idleInput.move);
  } else {
    player.update(dt, inputLive ? input : idleInput, rig.yaw);
    boat.update(dt, idleInput.move); // still bobs at its mooring
  }

  // buffs
  buffs.speed = Math.max(0, buffs.speed - dt);
  buffs.glow = Math.max(0, buffs.glow - dt);
  buffs.breath = Math.max(0, buffs.breath - dt);
  player.speedMult = buffs.speed > 0 ? 1.3 : 1;
  player.kelpLungs = buffs.breath > 0;
  glowLight.intensity = buffs.glow > 0 ? 1.4 + Math.sin(clock.elapsedTime * 3) * 0.2 : 0;
  buffPersistTimer += dt;
  if (buffPersistTimer > 5) {
    buffPersistTimer = 0;
    store.set({ buffs: { ...buffs } });
  }

  // digging: award the pending item once the gather animation's had time to land
  if (pendingDig && digTimer > 0) {
    digTimer -= dt;
    if (digTimer <= 0) {
      store.addItem(pendingDig, 1);
      audio.sfx('sfx-pickup');
      toast(pendingDig === 'sand' ? '+1 Sand' : '+1 Dirt');
      pendingDig = null;
    }
  }

  // homestead guidance + discovery tracking: cheap checks, not every frame
  guideCheckTimer += dt;
  if (guideCheckTimer >= 0.5) {
    guideCheckTimer = 0;
    advanceGuide();
    checkDiscoveries();
  }
  guide.setGoal(!started || dialogue.isOpen ? null : GOALS[store.get().guideStep].text);
  cards.update(dt);

  // morning washed-ashore find: spawns once at dawn, then sits until collected or the tide takes it
  beachFinds.spawnIfDue(store.get().day, sky.time, spawn);
  beachFinds.update(dt);

  // sleep sequence: fade to black, jump the clock, fade back — timed off dt, no setTimeout chains
  if (sleeping) {
    sleepTimer += dt;
    let fade: number;
    if (sleepTimer < SLEEP_FADE_IN) {
      fade = sleepTimer / SLEEP_FADE_IN;
    } else if (sleepTimer < SLEEP_FADE_IN + SLEEP_HOLD) {
      fade = 1;
      if (!sleepWokeAtMidpoint) {
        sleepWokeAtMidpoint = true;
        sky.sleepToMorning();
        toast('You wake with the sun.');
      }
    } else if (sleepTimer < SLEEP_FADE_IN + SLEEP_HOLD + SLEEP_FADE_OUT) {
      fade = 1 - (sleepTimer - SLEEP_FADE_IN - SLEEP_HOLD) / SLEEP_FADE_OUT;
    } else {
      fade = 0;
      sleeping = false;
    }
    hud.setSleepFade(fade);
  }

  // soundtrack: Beat the Drum aboard the boat; otherwise the nearer island's
  // day playlist, or Hazy Tea Drift at night — nothing else touches it
  if (nightMusic ? sky.daylight > 0.32 : sky.daylight < 0.2) nightMusic = !nightMusic;
  const musicCtx: MusicContext = boat.sailing
    ? 'sailing'
    : nightMusic
      ? 'night'
      : nearerIsland(player.position.x, player.position.z) === 2
        ? 'day2'
        : 'day';
  audio.setContext(musicCtx, dt);
  audio.update(dt);

  sky.update(dt, player.position);
  water.update(dt);
  props.update(dt, sky.daylight);
  props2.update(dt, sky.daylight);
  leaves.update(dt, player.position);
  herbs.update(dt);
  herbs2.update(dt);
  resources.update(dt);
  resources2.update(dt);
  seafloor.update(dt);
  sharks.update(dt);
  structures.update(dt, player.position, player.heading);
  gull.update(dt, player.position);
  star.update(dt, player.position);
  interactions.update(player.position);

  // first footfall on the far shore
  if (
    started &&
    !store.get().visitedIsland2 &&
    !player.swimming &&
    !boat.sailing &&
    Math.hypot(player.position.x - ISLAND2_CENTER.x, player.position.z - ISLAND2_CENTER.y) < ISLAND2_RADIUS
  ) {
    store.set({ visitedIsland2: true });
    audio.sfx('sfx-levelup');
    if (!dialogue.isOpen) void dialogue.play(FIRST_LANDING);
  }

  // breath + underwater dressing
  const waterLevel = getWaterLevel();
  const camUnder = camera.position.y < waterLevel;
  hud.setUnderwater(camUnder ? 1 : player.underwater ? 0.5 : 0);
  const fog = scene.fog as THREE.Fog;
  if (camUnder) {
    fog.near = 3;
    fog.far = 58;
    fog.color.setHex(0x14536a);
  } else {
    fog.near = 70;
    fog.far = 320;
  }
  hud.setDiveVisible(started && player.swimming && !boat.sailing && !panel.isOpen && !dialogue.isOpen);
  const breathRelevant = player.swimming && (player.underwater || player.breath < player.breathMax - 0.5);
  hud.setBreath(breathRelevant ? player.breath / player.breathMax : null);
  if (player.gasping && !wasGasping) toast('You bob up, lungs burning.');
  wasGasping = player.gasping;

  // first-night shooting star: once ever per save, fires the moment night first falls
  if (started && sky.daylight < 0.15 && !store.get().starSeen && !dialogue.isOpen) {
    star.begin(player.position);
    store.set({ starSeen: true });
  }
  if (starWasActive && !star.active) toast('Make a wish.');
  starWasActive = star.active;
  if (star.watching) {
    const moveMag = Math.hypot(input.move.x, input.move.y);
    if (moveMag > 0.2 || !star.active) stopWatchingStar();
    else rig.lookTarget = star.getPosition();
  } else if (rig.lookTarget && !star.active) {
    rig.lookTarget = null; // star finished mid-gaze — release the camera
  }

  rig.update(dt, input, player.position);

  // context button: sailing wins, then placement, then the star prompt, then the nearest interactable
  if (!started || panel.isOpen || dialogue.isOpen || sleeping || cards.noteOpen) {
    hud.setAction(null);
  } else if (boat.sailing) {
    hud.setAction(boat.disembarkLabel());
  } else if (structures.placing) {
    hud.setAction(structures.placementLabel(), { danger: !structures.placementLabel().startsWith('Place'), cancelable: true });
  } else if (star.watching) {
    hud.setAction('Look away');
  } else if (star.active) {
    hud.setAction('✨ Watch star');
  } else {
    hud.setAction(interactions.active?.label() ?? null);
  }
  hud.setTime(sky.time, store.get().day, tideRising(sky.time));
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
Object.assign(window, {
  __kk: {
    player,
    rig,
    sky,
    camera,
    heightAt,
    getWaterLevel,
    store,
    structures,
    gull,
    star,
    buffs,
    audio,
    panel,
    dialogue,
    cards,
    beachFinds,
    boat,
    sharks,
    seafloor,
  },
});
