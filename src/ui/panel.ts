/**
 * The Satchel: inventory grid + hand-crafting. Opened with Tab/I or the
 * mobile satchel button. At the kettle it opens in brew mode with the
 * kettle recipes unlocked.
 */
import { store, type Inventory } from '../core/store';
import { ITEMS, RECIPES, ITEM_BY_ID, itemGlyph, type ItemDef, type RecipeDef } from '../data/items';
import { audio } from '../audio/audio';

export class SatchelPanel {
  private el: HTMLDivElement;
  private grid: HTMLDivElement;
  private recipeBox: HTMLDivElement;
  private title: HTMLDivElement;
  private kettleMode = false;

  onPlace: ((kind: NonNullable<ItemDef['placeable']>) => void) | null = null;
  onDrink: ((buff: 'speed' | 'glow', seconds: number) => void) | null = null;
  private onToast: (msg: string) => void;

  constructor(root: HTMLElement, toast: (msg: string) => void) {
    this.onToast = toast;
    this.el = document.createElement('div');
    this.el.className = 'satchel hidden';
    this.el.innerHTML = `
      <div class="satchel-card">
        <div class="satchel-head">
          <div class="satchel-title">Satchel</div>
          <button class="satchel-close">✕</button>
        </div>
        <div class="satchel-grid"></div>
        <div class="satchel-sub">Crafting</div>
        <div class="satchel-recipes"></div>
      </div>`;
    root.appendChild(this.el);
    this.grid = this.el.querySelector('.satchel-grid')!;
    this.recipeBox = this.el.querySelector('.satchel-recipes')!;
    this.title = this.el.querySelector('.satchel-title')!;
    this.el.querySelector('.satchel-close')!.addEventListener('click', () => this.close());
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close(); // tap backdrop to close
    });
    store.subscribe(() => {
      if (this.isOpen) this.render();
    });
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  open(kettleMode = false) {
    this.kettleMode = kettleMode;
    this.title.textContent = kettleMode ? 'The Kettle' : 'Satchel';
    this.el.classList.remove('hidden');
    this.render();
    audio.sfx('sfx-ui-click');
  }

  close() {
    this.el.classList.add('hidden');
  }

  toggle() {
    this.isOpen ? this.close() : this.open(false);
  }

  private render() {
    const inv = store.get().inventory;
    const discovered = store.get().discovered;

    // inventory grid
    this.grid.innerHTML = '';
    const owned = ITEMS.filter((i) => (inv[i.id] ?? 0) > 0);
    if (owned.length === 0) {
      this.grid.innerHTML = '<div class="satchel-empty">Nothing yet — go gather!</div>';
    }
    for (const item of owned) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.innerHTML = `${itemGlyph(item, 'inv-emoji')}<span class="inv-count">${inv[item.id]}</span><span class="inv-name">${item.name}</span>`;
      const action = this.itemAction(item);
      if (action) {
        const btn = document.createElement('button');
        btn.className = 'inv-action';
        btn.textContent = action.label;
        btn.addEventListener('click', action.fn);
        cell.appendChild(btn);
      }
      cell.title = item.desc;
      this.grid.appendChild(cell);
    }

    // recipes
    this.recipeBox.innerHTML = '';
    const recipes = RECIPES.filter((r) => (this.kettleMode ? true : r.station === 'hand'));
    for (const r of recipes) {
      const out = ITEM_BY_ID.get(r.output)!;

      // mystery gating: the rack/bath/garden/lean-to kits are guidance-goal targets
      // (hiding them would strand the guide chain), so hand recipes that place them
      // always render normally. Everything else — kettle brews, plus the non-placeable
      // hand recipes (loam, shovel) — is masked until its ingredients are all known.
      const isGuidanceKit = r.station === 'hand' && !!out.placeable;
      if (!isGuidanceKit) {
        const inputIds = Object.keys(r.inputs);
        const knownCount = inputIds.filter((id) => discovered.includes(id)).length;
        if (knownCount === 0) continue; // nothing known yet — don't even tease it
        if (knownCount < inputIds.length) {
          this.renderMysteryRow(r, inv, discovered);
          continue;
        }
      }

      const row = document.createElement('div');
      row.className = 'recipe-row';
      const atStation = r.station === 'hand' || this.kettleMode;
      const affordable = Object.entries(r.inputs).every(([id, q]) => (inv[id] ?? 0) >= (q ?? 0));
      const costs = Object.entries(r.inputs)
        .map(([id, q]) => {
          const def = ITEM_BY_ID.get(id as never)!;
          const have = inv[id] ?? 0;
          return `<span class="cost ${have >= (q ?? 0) ? 'ok' : 'short'}">${itemGlyph(def, 'cost-glyph')}${q}</span>`;
        })
        .join('');
      row.innerHTML = `
        <span class="recipe-out">${itemGlyph(out, 'recipe-glyph')} <b>${out.name}</b>${r.station === 'kettle' ? '<span class="station-tag">kettle</span>' : ''}</span>
        <span class="recipe-costs">${costs}</span>`;
      const btn = document.createElement('button');
      btn.className = 'recipe-btn';
      btn.textContent = r.station === 'kettle' && !this.kettleMode ? 'At kettle' : 'Craft';
      btn.disabled = !affordable || !atStation;
      btn.addEventListener('click', () => {
        if (store.spend(r.inputs)) {
          store.addItem(r.output, r.outputQty);
          audio.sfx('sfx-levelup');
          this.onToast(`Crafted ${out.name} ${out.emoji}`);
        }
      });
      row.appendChild(btn);
      this.recipeBox.appendChild(row);
    }
  }

  /** at least one input known, but not all — output and unmet inputs stay masked */
  private renderMysteryRow(r: RecipeDef, inv: Inventory, discovered: string[]) {
    const row = document.createElement('div');
    row.className = 'recipe-row recipe-row-mystery';
    row.title = "You haven't met every ingredient yet.";
    const costs = Object.entries(r.inputs)
      .map(([id, q]) => {
        if (!discovered.includes(id)) return '<span class="cost unknown">?</span>';
        const def = ITEM_BY_ID.get(id as never)!;
        const have = inv[id] ?? 0;
        return `<span class="cost ${have >= (q ?? 0) ? 'ok' : 'short'}">${itemGlyph(def, 'cost-glyph')}${q}</span>`;
      })
      .join('');
    row.innerHTML = `
      <span class="recipe-out"><span class="recipe-mystery">?</span> <b>????</b></span>
      <span class="recipe-costs">${costs}</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-btn';
    btn.textContent = 'Unknown';
    btn.disabled = true;
    row.appendChild(btn);
    this.recipeBox.appendChild(row);
  }

  private itemAction(item: ItemDef): { label: string; fn: () => void } | null {
    if (item.drinkable) {
      return {
        label: 'Drink',
        fn: () => {
          if (store.spend({ [item.id]: 1 })) {
            this.onDrink?.(item.drinkable!.buff, item.drinkable!.seconds);
            audio.sfx('sfx-levelup');
            this.onToast(item.drinkable!.buff === 'speed' ? 'Light steps! (speed up)' : 'A warm glow surrounds you');
          }
        },
      };
    }
    if (item.placeable) {
      const kind = item.placeable;
      return {
        label: 'Place',
        fn: () => {
          this.close();
          this.onPlace?.(kind);
        },
      };
    }
    return null;
  }
}
