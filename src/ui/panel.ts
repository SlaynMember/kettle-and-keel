/**
 * The Satchel: inventory grid + hand-crafting. Opened with Tab/I or the
 * mobile satchel button. At the kettle it opens in brew mode with the
 * kettle recipes unlocked.
 */
import { store } from '../core/store';
import { ITEMS, RECIPES, ITEM_BY_ID, type ItemDef } from '../data/items';
import { audio } from '../audio/audio';

export class SatchelPanel {
  private el: HTMLDivElement;
  private grid: HTMLDivElement;
  private recipeBox: HTMLDivElement;
  private title: HTMLDivElement;
  private kettleMode = false;

  onPlace: ((kind: 'drying_rack' | 'bird_bath') => void) | null = null;
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

    // inventory grid
    this.grid.innerHTML = '';
    const owned = ITEMS.filter((i) => (inv[i.id] ?? 0) > 0);
    if (owned.length === 0) {
      this.grid.innerHTML = '<div class="satchel-empty">Nothing yet — go gather!</div>';
    }
    for (const item of owned) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.innerHTML = `<span class="inv-emoji">${item.emoji}</span><span class="inv-count">${inv[item.id]}</span><span class="inv-name">${item.name}</span>`;
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
      const row = document.createElement('div');
      row.className = 'recipe-row';
      const atStation = r.station === 'hand' || this.kettleMode;
      const affordable = Object.entries(r.inputs).every(([id, q]) => (inv[id] ?? 0) >= (q ?? 0));
      const costs = Object.entries(r.inputs)
        .map(([id, q]) => {
          const def = ITEM_BY_ID.get(id as never)!;
          const have = inv[id] ?? 0;
          return `<span class="cost ${have >= (q ?? 0) ? 'ok' : 'short'}">${def.emoji}${q}</span>`;
        })
        .join('');
      row.innerHTML = `
        <span class="recipe-out">${out.emoji} <b>${out.name}</b>${r.station === 'kettle' ? '<span class="station-tag">kettle</span>' : ''}</span>
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
