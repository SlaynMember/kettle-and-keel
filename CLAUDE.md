# Kettle & Keel

Cozy low-poly 3D island game. Gather herbs, craft, brew tea, befriend companions, build a boat, sail on. Full rewrite of (and successor to) Corsair Catch — do not copy code from the old repo, only its audio and its lessons.

## Stack

Three.js + TypeScript (strict) + Vite, deployed as a PWA. No React, no game framework. DOM/CSS for all UI (never canvas-drawn UI — that's how the old game's buttons broke).

- `npm run dev` / `npm run build` (tsc --noEmit + vite build) / `npm run preview`
- Deploy: `git push origin main` — Netlify auto-deploys (repo-linked since 2026-07-03). No CLI deploys.
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

- `src/core/` — store (typed save: inventory/structures/buffs), input, camera rig, interact (unified proximity-prompt system — register anything usable here)
- `src/world/` — terrain (heightAt/slopeAt are analytic — sample them, never raycast the mesh), sky (owns time of day), water, props (grass + campfire/kettle)
- `src/entities/` — player (walk/swim/punch/gather animations), herbs, resources (harvestable trees/rocks/algae), structures (drying rack + placement-ghost flow; shack building extends this)
- `src/data/` — content registries (items, recipes, herbs)
- `src/audio/` — audio manager (resuming music playlist); files in `public/audio/` carried from Corsair Catch (element-attack WAVs still in the old repo if needed)
- `src/ui/` — DOM HUD, satchel/kettle panel, intro overlay, styles (Fredoka, self-hosted in `public/fonts/`)

## Playtesting (do this — it's why we chose web)

Dev server + chrome-devtools MCP. `window.__kk` exposes `{ player, rig, sky, camera, heightAt }`:
- teleport: set `__kk.player.position`
- time of day: `__kk.sky.time = 0.9` (0 midnight, 0.5 noon)
- drive: dispatch `KeyboardEvent`s (KeyW etc.) on `window`; touch via `PointerEvent` with `pointerType:'touch'` on the canvas (left 45% = joystick)
- Screenshot desktop AND a phone-landscape viewport (~844×390) before shipping visual changes.
- **Synthetic `dispatchEvent` bypasses hit-testing** — it "worked" while an invisible overlay ate every real touch (the v1 phone-movement bug). After ANY overlay/UI change, verify with `document.elementFromPoint(x, y)` that the canvas (or intended element) is what a real finger hits at: left thumb zone, right thumb zone, center, and each button. Any new full-screen overlay must get `#ui > .thing.hidden { pointer-events: none; }` — the `#ui > *` rule outranks bare class selectors.

## Roadmap

v1 crafting → v2 boat + island 2 → v3 companions + gardening/tea → v4 weather + multiplayer (WS server on non-Netlify host). Details in Obsidian: `Projects/Personal/Kettle-and-Keel.md`.
