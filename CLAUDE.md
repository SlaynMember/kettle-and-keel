# Kettle & Keel

Cozy low-poly 3D island game. Gather herbs, craft, brew tea, befriend companions, build a boat, sail on. Full rewrite of (and successor to) Corsair Catch — do not copy code from the old repo, only its audio and its lessons.

## Stack

Three.js + TypeScript (strict) + Vite, deployed as a PWA. No React, no game framework. DOM/CSS for all UI (never canvas-drawn UI — that's how the old game's buttons broke).

- `npm run dev` / `npm run build` (tsc --noEmit + vite build) / `npm run preview`
- Deploy: `npx netlify-cli deploy --prod --dir=dist` (site `kettle-and-keel`; not yet repo-linked for auto-deploy)
- Live: https://kettle-and-keel.netlify.app

## Architecture rules (from the Corsair Catch post-mortem — non-negotiable)

1. **No god-scenes.** Systems live in small files; `main.ts` only wires them.
2. **One typed store** (`core/store.ts`) — never a stringly global registry.
3. **All animation off shared clocks** in each system's `update(dt)` — never per-object ad-hoc timers.
4. **UI is DOM** (`ui/hud.ts` + `styles.css`) — crisp, tappable, hit-area always matches visual.
5. **Content is data-driven AND reachable** (`data/items.ts`) — nothing enters the registry unless it spawns in the world in the same release.
6. **Deterministic world**: seeded PRNG only (`makeRng` in `world/terrain.ts`). No `Math.random()` in world gen — same island for every player, multiplayer depends on it.
7. **Input is abstracted** (`core/input.ts`): touch + keyboard/mouse now; gamepad (Steam) and network players plug into the same seam later.

## Layout

- `src/core/` — store, input, camera rig
- `src/world/` — terrain (heightAt/slopeAt are analytic — sample them, never raycast the mesh), sky (owns time of day), water, props
- `src/entities/` — player, herbs
- `src/data/` — content registries
- `src/audio/` — audio manager; files in `public/audio/` carried from Corsair Catch (element-attack WAVs still in the old repo if needed)
- `src/ui/` — DOM HUD + intro overlay + styles

## Playtesting (do this — it's why we chose web)

Dev server + chrome-devtools MCP. `window.__kk` exposes `{ player, rig, sky, camera, heightAt }`:
- teleport: set `__kk.player.position`
- time of day: `__kk.sky.time = 0.9` (0 midnight, 0.5 noon)
- drive: dispatch `KeyboardEvent`s (KeyW etc.) on `window`; touch via `PointerEvent` with `pointerType:'touch'` on the canvas (left 45% = joystick)
- Screenshot desktop AND a phone-landscape viewport (~844×390) before shipping visual changes.

## Roadmap

v1 crafting → v2 boat + island 2 → v3 companions + gardening/tea → v4 weather + multiplayer (WS server on non-Netlify host). Details in Obsidian: `Projects/Personal/Kettle-and-Keel.md`.
