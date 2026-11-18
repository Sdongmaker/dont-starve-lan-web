// 饥荒风格 HUD、时钟圆盘、小地图/大地图、合成科技栏与背包容器交互管理
import {
  WORLD_HALF,
  BIOME_INFO,
  EQUIP_SLOTS,
  INVENTORY_SIZE,
  SEASON_LENGTH,
  TEMP_FREEZE_WARN,
  TEMP_HEAT_WARN,
} from '../shared/constants.js';
import { CHARACTER_LIST, CHARACTERS } from '../shared/characters.js';
import { ITEMS } from '../shared/items.js';
import { CRAFT_CATEGORIES, RECIPES, CROCK_POT_GUIDE } from '../shared/recipes.js';
import { ENTITY_DEFS } from '../shared/entities.js';
import {
  drawSurvivor,
  getItemIconDataUrl,
} from './sprites.js';

export class GameUI {
  constructor(callbacks) {
    this.cb = callbacks;
    this.activeCategory = 'tools';
    this.drawerOpen = false;
    this.mapOpen = false;

    this.lastInvSig = '';
    this.lastCraftSig = '';
    this.lastContSig = '';

    this.clockCanvas = document.getElementById('clock-canvas');
    this.clockCtx = this.clockCanvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.worldmapCanvas = document.getElementById('worldmap-canvas');
    this.worldmapCtx = this.worldmapCanvas.getContext('2d');

    // 预渲染的地形底图缓存
    this.staticMapCanvas = null;

    this.tooltipEl = document.getElementById('item-tooltip');
    this.bannerTimer = null;

    this._initCraftCategories();
    this._bindGlobalModals();
  }

  // ==================== 大厅角色卡片与房间列表 ====================
  renderCharacterSelector(selectedCharId, onSelect) {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    for (const ch of CHARACTER_LIST) {
      const card = document.createElement('div');
      card.className = `char-card ${ch.id === selectedCharId ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="char-card-name">${ch.name}</div>
        <div class="char-card-sub">${ch.title}</div>
      `;
      card.addEventListener('click', () => onSelect(ch.id));
      grid.appendChild(card);
    }

    const detail = CHARACTERS[selectedCharId] || CHARACTERS.wilson;
    document.getElementById('detail-char-name').textContent = detail.name;
    document.getElementById('detail-char-title').textContent = detail.title;
    document.getElementById('detail-char-motto').textContent = detail.motto;
    document.getElementById('detail-hp').textContent = detail.hp;
    document.getElementById('detail-hunger').textContent = detail.hunger;
    document.getElementById('detail-sanity').textContent = detail.sanity;

    const ul = document.getElementById('detail-char-perks');
    ul.innerHTML = detail.perks.map((pk) => `<li>${pk}</li>`).join('');

    // 绘制角色预览立绘
    const pv = document.getElementById('char-preview-canvas');
    const pctx = pv.getContext('2d');
    pctx.clearRect(0, 0, pv.width, pv.height);
    pctx.save();
    pctx.translate(pv.width / 2, pv.height - 20);
    pctx.scale(1.32, 1.32);
    const startHand = detail.startItems?.find((s) => ITEMS[s.id]?.slot === 'hand')?.id || null;
    const startHead = detail.startItems?.find((s) => ITEMS[s.id]?.slot === 'head')?.id || null;
    drawSurvivor(pctx, {
      x: 0,
      y: 0,
      name: detail.name,
      charId: detail.id,
      facing: 1,
      hp: detail.hp,
      maxHp: detail.hp,
      hand: startHand,
      head: startHead,
      mighty: 1,
    }, 0, false);
    pctx.restore();
  }

  renderLobbyLists(rooms = [], saves = [], onJoinRoom, onLoadSave) {
    const roomBox = document.getElementById('room-list');
    if (rooms.length === 0) {
      roomBox.innerHTML = `
        <div class="empty-rooms">
          🏕️ 当前暂无正在运行的房间<br/>
          请点击上方【✨ 创建新世界】建立营地，局域网好友刷新即可直接加入！
        </div>
      `;
    } else {
      roomBox.innerHTML = '';
      for (const r of rooms) {
        const div = document.createElement('div');
        div.className = 'room-item';
        const modeTag = r.pvp ? '⚔️ PvP对抗' : '🤝 合作生存';
        const diffTag = r.difficulty === 'hardcore' ? '💀 硬核' : '🛡️ 标准';
        div.innerHTML = `
          <div>
            <div class="room-item-title">🔥 ${this._esc(r.name)}</div>
            <div class="room-item-meta">第 ${r.day} 天 · ${r.seasonName} · ${modeTag} · ${diffTag} · 在线 ${r.playerCount}/${r.maxPlayers}</div>
          </div>
          <button class="btn btn-gold btn-small">立即加入</button>
        `;
        div.querySelector('button').addEventListener('click', () => onJoinRoom(r.id));
        roomBox.appendChild(div);
      }
    }

    const saveBox = document.getElementById('save-list');
    if (!saves || saves.length === 0) {
      saveBox.innerHTML = `<div class="empty-rooms">📂 暂无历史存档（游戏内房主点击【💾 存档】或每3分钟自动保存）</div>`;
    } else {
      saveBox.innerHTML = '';
      for (const sv of saves) {
        const div = document.createElement('div');
        div.className = 'room-item';
        const dateStr = new Date(sv.savedAt).toLocaleString();
        div.innerHTML = `
          <div>
            <div class="room-item-title">📜 ${this._esc(sv.roomName)}</div>
            <div class="room-item-meta">第 ${sv.day} 天 · 已记录角色 ${sv.playerCount} 人 · 保存于 ${dateStr}</div>
          </div>
          <button class="btn btn-primary btn-small">📂 读取开房</button>
        `;
        div.querySelector('button').addEventListener('click', () => onLoadSave(sv.saveId, sv.roomName));
        saveBox.appendChild(div);
      }
    }
  }

  // ==================== 预烘焙静态世界地形底图 ====================
  bakeStaticMap(worldStatic) {
    const c = document.createElement('canvas');
    c.width = 440;
    c.height = 440;
    const ctx = c.getContext('2d');
    const scale = c.width / worldStatic.worldSize;
    const cols = worldStatic.gridCols;
    const ts = worldStatic.tileSize;

    for (let r = 0; r < cols; r++) {
      for (let col = 0; col < cols; col++) {
        const bKey = worldStatic.biomeOrder[worldStatic.biomeGrid[r * cols + col] || 0];
        ctx.fillStyle = BIOME_INFO[bKey]?.mapColor || '#5c7c42';
        ctx.fillRect(
          col * ts * scale,
          r * ts * scale,
          Math.ceil(ts * scale) + 1,
          Math.ceil(ts * scale) + 1
        );
      }
    }

    // 绘制道路到地图上
    if (worldStatic.roads) {
      ctx.strokeStyle = '#c4ae86';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (const poly of worldStatic.roads) {
        if (poly.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < poly.length; i++) {
          const mx = (poly[i][0] + WORLD_HALF) * scale;
          const my = (poly[i][1] + WORLD_HALF) * scale;
          if (i === 0) ctx.moveTo(mx, my);
          else ctx.lineTo(mx, my);
        }
        ctx.stroke();
      }
    }
    this.staticMapCanvas = c;
  }

  // ==================== 游戏内实时 HUD 刷新 ====================
  updateHUD(state, selfId, worldStatic, landmarks) {
    if (!state || !state.self) return;
    const { world, self } = state;

    // 1. 绘制饥荒经典 16 格昼/黄昏/黑夜扇形时钟
    this._drawClockDial(world);

    const seasonIcon = { autumn: '🍂', winter: '❄️', spring: '🌱', summer: '☀️' }[world.season] || '🍂';
    document.getElementById('hud-season-text').textContent = `${seasonIcon} ${world.seasonName} ${world.dayInSeason}/${SEASON_LENGTH}`;
    document.getElementById('hud-weather-text').textContent = world.isRaining
      ? (world.season === 'winter' ? '❄️ 降雪' : '🌧️ 降雨')
      : (world.isFullMoon ? '🌕 满月' : '☀️ 晴');

    // 2. 三维仪表盘
    document.getElementById('num-hunger').textContent = Math.ceil(self.hunger);
    document.getElementById('num-sanity').textContent = Math.ceil(self.sanity);
    document.getElementById('num-hp').textContent = Math.ceil(self.hp);

    document.getElementById('fill-hunger').style.height = `${Math.max(0, Math.min(100, (self.hunger / self.maxHunger) * 100))}%`;
    document.getElementById('fill-sanity').style.height = `${Math.max(0, Math.min(100, (self.sanity / self.maxSanity) * 100))}%`;
    document.getElementById('fill-hp').style.height = `${Math.max(0, Math.min(100, (self.hp / self.maxHp) * 100))}%`;

    // 3. 体温与潮湿度
    const tempPill = document.getElementById('pill-temp');
    const tVal = Math.round(self.bodyTemp);
    tempPill.textContent = `🌡️ ${tVal}℃`;
    tempPill.className = `env-pill ${tVal < TEMP_FREEZE_WARN ? 'cold' : (tVal > TEMP_HEAT_WARN ? 'hot' : '')}`;

    document.getElementById('pill-wet').textContent = `💧 ${self.moisture}%`;

    // 鬼魂提示横条
    document.getElementById('ghost-bar').classList.toggle('hidden', !self.isGhost);

    // 4. 仅在物品或装备变化时重绘底部背包栏（防闪烁！）
    const invSig = JSON.stringify({ i: self.inventory, e: self.equip });
    if (invSig !== this.lastInvSig) {
      this.lastInvSig = invSig;
      this._renderInventoryAndEquip(self);
    }

    // 5. 仅在材料/科技等级变化时刷新打开的合成面板
    if (this.drawerOpen) {
      const craftSig = JSON.stringify({
        cat: this.activeCategory,
        tech: self.techLevel,
        u: self.unlockedRecipes,
        inv: self.inventory.map((x) => (x ? `${x.id}:${x.count}` : '')),
        hp: Math.floor(self.hp / 5),
      });
      if (craftSig !== this.lastCraftSig) {
        this.lastCraftSig = craftSig;
        this._renderRecipeDrawer(self);
      }
    }

    // 6. 打开的容器 / 烹饪锅面板更新
    const contSig = JSON.stringify(self.openContainer);
    if (contSig !== this.lastContSig) {
      this.lastContSig = contSig;
      this._renderContainerPanel(self.openContainer);
    }

    // 7. 绘制右上角小地图（以及展开状态下的大地图）
    this._drawMaps(state, selfId, worldStatic, landmarks);
  }

  _drawClockDial(world) {
    const ctx = this.clockCtx;
    const w = this.clockCanvas.width;
    const h = this.clockCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.44;

    ctx.clearRect(0, 0, w, h);

    const segs = world.segments || { day: 9, dusk: 5, night: 2 };
    for (let i = 0; i < 16; i++) {
      const a0 = -Math.PI / 2 + (i / 16) * Math.PI * 2;
      const a1 = -Math.PI / 2 + ((i + 1) / 16) * Math.PI * 2;
      let color = '#211d30'; // Night
      if (i < segs.day) color = '#e8b643'; // Day
      else if (i < segs.day + segs.dusk) color = '#bd5b38'; // Dusk
      else if (world.isFullMoon) color = '#587da8';

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // 外表圈铜框
    ctx.strokeStyle = '#9c7b49';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // 旋转指针
    const handAngle = -Math.PI / 2 + world.dayProgress * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(handAngle);
    ctx.strokeStyle = '#fff5dc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(r - 7, 0);
    ctx.stroke();
    ctx.restore();

    // 中心天数圆章
    ctx.fillStyle = '#241c16';
    ctx.strokeStyle = '#b89458';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f5e8cc';
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`第${world.day}天`, cx, cy);
  }

  _initCraftCategories() {
    const box = document.getElementById('craft-categories');
    box.innerHTML = '';
    for (const cat of CRAFT_CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = cat.id;
      const imgUrl = getItemIconDataUrl(cat.icon === 'chest' ? 'boards' : cat.icon, 26);
      btn.innerHTML = `<img src="${imgUrl}" width="22" height="22" alt="" /><span>${cat.name}</span>`;
      btn.addEventListener('click', () => {
        if (this.drawerOpen && this.activeCategory === cat.id) {
          this.drawerOpen = false;
          document.getElementById('craft-drawer').classList.add('hidden');
          btn.classList.remove('active');
        } else {
          this.activeCategory = cat.id;
          this.drawerOpen = true;
          this.lastCraftSig = '';
          document.querySelectorAll('.cat-btn').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat.id));
          document.getElementById('drawer-title').textContent = `${cat.name}合成`;
          document.getElementById('craft-drawer').classList.remove('hidden');
          this.cb.onRequestCraftRefresh?.();
        }
      });
      box.appendChild(btn);
    }

    document.getElementById('btn-close-drawer').addEventListener('click', () => {
      this.drawerOpen = false;
      document.getElementById('craft-drawer').classList.add('hidden');
      document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
    });
  }

  _countSelfItem(self, itemId) {
    let n = 0;
    for (const s of self.inventory) {
      if (s && s.id === itemId) n += s.count;
    }
    for (const eq of Object.values(self.equip || {})) {
      if (eq && eq.id === itemId) n += eq.count || 1;
    }
    return n;
  }

  _renderRecipeDrawer(self) {
    const techNames = ['徒手科技', '🔬 一本科学', '⚗️ 二本炼金'];
    document.getElementById('tech-indicator').textContent = techNames[self.techLevel] || '徒手科技';

    const listEl = document.getElementById('recipe-list');
    listEl.innerHTML = '';

    const meChar = this.cb.getSelfCharId?.() || 'wilson';
    const filtered = RECIPES.filter(
      (r) => r.category === this.activeCategory && (!r.characterOnly || r.characterOnly === meChar)
    );

    for (const r of filtered) {
      const learned = self.unlockedRecipes.includes(r.id);
      const techOk = learned || self.techLevel >= r.tech;
      let matOk = true;
      const costHtml = r.cost.map((c) => {
        const have = this._countSelfItem(self, c.id);
        const enough = have >= c.count;
        if (!enough) matOk = false;
        const ic = getItemIconDataUrl(c.id, 20);
        return `<span class="cost-chip ${enough ? 'ok' : 'lack'}"><img src="${ic}" width="14" height="14" style="vertical-align:-2px"/> ${ITEMS[c.id]?.name || c.id} ${have}/${c.count}</span>`;
      }).join('');

      const hpOk = !r.hpCost || self.hp > r.hpCost + 2;
      const canMake = techOk && matOk && hpOk && !self.isGhost;

      const card = document.createElement('div');
      card.className = `recipe-card ${canMake ? 'craftable' : ''} ${!techOk ? 'locked' : ''}`;
      const lockLabel = !techOk
        ? (r.tech === 1 ? '🔒 需靠近一本科学机器' : '🔒 需靠近二本炼金引擎')
        : (r.structure ? '🔨 选址建造' : '✨ 立即制作');

      card.innerHTML = `
        <div class="recipe-top">
          <span class="recipe-name">${r.name}</span>
          <button class="btn btn-small ${canMake ? 'btn-gold' : ''}" ${canMake ? '' : 'disabled'}>${lockLabel}</button>
        </div>
        <div class="recipe-desc">${r.desc}</div>
        <div class="recipe-costs">${costHtml}${r.hpCost ? `<span class="cost-chip ${hpOk ? 'ok' : 'lack'}">❤️ 耗血 ${r.hpCost}</span>` : ''}</div>
      `;

      const actionBtn = card.querySelector('button');
      actionBtn.addEventListener('click', () => {
        if (r.structure) {
          this.cb.onStartPlacement?.(r);
        } else {
          this.cb.onCraft?.(r.id);
        }
      });

      listEl.appendChild(card);
    }
  }

  _renderInventoryAndEquip(self) {
    const invBox = document.getElementById('inventory-slots');
    invBox.innerHTML = '';

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const it = self.inventory[i];
      const slotEl = this._createSlotElement(it, i < 9 ? String(i + 1) : (i === 9 ? '0' : ''));
      slotEl.addEventListener('click', (ev) => {
        if (ev.shiftKey) {
          this.cb.onDropSlot?.(i, false);
        } else {
          this.cb.onUseSlot?.(i, false);
        }
      });
      slotEl.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        this.cb.onUseSlot?.(i, true);
      });
      invBox.appendChild(slotEl);
    }

    const eqBox = document.getElementById('equip-slots');
    eqBox.innerHTML = '';
    const slotMeta = [
      { key: EQUIP_SLOTS.HAND, label: '手部' },
      { key: EQUIP_SLOTS.BODY, label: '身体' },
      { key: EQUIP_SLOTS.HEAD, label: '头部' },
    ];
    for (const sm of slotMeta) {
      const eq = self.equip?.[sm.key] || null;
      const el = this._createSlotElement(eq, '', sm.label, true);
      el.addEventListener('click', () => {
        if (eq) this.cb.onUnequip?.(sm.key);
      });
      eqBox.appendChild(el);
    }
  }

  _createSlotElement(item, hotkey = '', placeholder = '', isEquip = false) {
    const div = document.createElement('div');
    div.className = `item-slot ${isEquip ? 'equip-bg' : ''}`;
    if (hotkey) {
      const hk = document.createElement('span');
      hk.className = 'slot-hotkey';
      hk.textContent = hotkey;
      div.appendChild(hk);
    }

    if (!item) {
      if (placeholder) {
        const sp = document.createElement('span');
        sp.className = 'slot-placeholder';
        sp.textContent = placeholder;
        div.appendChild(sp);
      }
      return div;
    }

    const def = ITEMS[item.id];
    const img = document.createElement('img');
    img.src = getItemIconDataUrl(item.id, 36);
    img.width = 34;
    img.height = 34;
    div.appendChild(img);

    if (item.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = item.count;
      div.appendChild(cnt);
    }

    // 保暖石温度角标提示
    if (item.id === 'thermal_stone' && item.extra?.temp !== undefined) {
      const st = Math.round(item.extra.temp);
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.style.color = st > 38 ? '#ff944d' : (st < 8 ? '#80d8ff' : '#e0d6c3');
      cnt.textContent = `${st}℃`;
      div.appendChild(cnt);
    }

    if (item.durability !== null && item.durability !== undefined && def?.maxDurability) {
      const pct = Math.max(0, Math.min(100, (item.durability / def.maxDurability) * 100));
      const barWrap = document.createElement('div');
      barWrap.className = 'slot-dura';
      const bar = document.createElement('div');
      bar.className = 'slot-dura-bar';
      bar.style.width = `${pct}%`;
      bar.style.background = pct > 50 ? '#6ee07c' : (pct > 22 ? '#f2ba49' : '#eb4646');
      barWrap.appendChild(bar);
      div.appendChild(barWrap);
    }

    div.addEventListener('mouseenter', (ev) => this._showTooltip(item, ev.clientX, ev.clientY));
    div.addEventListener('mousemove', (ev) => this._moveTooltip(ev.clientX, ev.clientY));
    div.addEventListener('mouseleave', () => this.hideTooltip());

    return div;
  }

  _renderContainerPanel(cont) {
    const panel = document.getElementById('container-panel');
    if (!cont) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    const body = document.getElementById('container-body');
    body.innerHTML = '';

    const eDef = ENTITY_DEFS[cont.type];
    document.getElementById('container-title').textContent = `📦 ${eDef?.name || '容器'}`;

    if (cont.type === 'crock_pot') {
      document.getElementById('container-title').textContent = '🍲 烹饪锅（放入4份食材炖煮）';
      const row = document.createElement('div');
      row.className = 'pot-slots-row';
      for (let i = 0; i < 4; i++) {
        const s = cont.slots?.[i] || null;
        const el = this._createSlotElement(s, '', '食材');
        el.addEventListener('click', () => {
          if (s && !cont.cooking) this.cb.onContainerTransfer?.(cont.id, 'container', i);
        });
        row.appendChild(el);
      }
      body.appendChild(row);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.width = '100%';
      if (cont.cooking) {
        btn.textContent = `🔥 咕嘟咕嘟炖煮中... (${cont.cookTimer}s)`;
        btn.disabled = true;
      } else {
        const full = cont.slots && cont.slots.every(Boolean);
        btn.textContent = full ? '🍲 立即点火烹饪！' : '请从下方背包点击放入 4 份食材';
        btn.disabled = !full;
        btn.addEventListener('click', () => this.cb.onStartCooking?.(cont.id));
      }
      body.appendChild(btn);

      // 内置食谱速查表！
      const guide = document.createElement('div');
      guide.className = 'pot-guide-box';
      guide.innerHTML = `<div style="color:#ebba49;font-weight:bold;">📖 经典食谱速查：</div>` +
        CROCK_POT_GUIDE.map((g) => `
          <div class="pot-guide-item">
            <b>${g.name}</b> <span style="color:#8de892">(${g.stats})</span><br/>
            <span style="color:#b5a78e">${g.formula}</span>
          </div>
        `).join('');
      body.appendChild(guide);
    } else {
      const grid = document.createElement('div');
      grid.className = 'container-grid';
      const slots = cont.slots || [];
      for (let i = 0; i < slots.length; i++) {
        const el = this._createSlotElement(slots[i]);
        el.addEventListener('click', () => {
          if (slots[i]) this.cb.onContainerTransfer?.(cont.id, 'container', i);
        });
        grid.appendChild(el);
      }
      body.appendChild(grid);
    }
  }

  _drawMaps(state, selfId, worldStatic, landmarks) {
    if (!this.staticMapCanvas || !worldStatic) return;

    // 1. 右上角局部雷达小地图
    const mctx = this.minimapCtx;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    mctx.clearRect(0, 0, mw, mh);

    const me = state.players.find((p) => p.id === selfId);
    if (me) {
      const srcScale = this.staticMapCanvas.width / worldStatic.worldSize;
      const viewSpan = 1350;
      const sx = (me.x - viewSpan / 2 + WORLD_HALF) * srcScale;
      const sy = (me.y - viewSpan / 2 + WORLD_HALF) * srcScale;
      const sw = viewSpan * srcScale;
      mctx.fillStyle = '#18242e';
      mctx.fillRect(0, 0, mw, mh);
      mctx.drawImage(this.staticMapCanvas, sx, sy, sw, sw, 0, 0, mw, mh);

      const toMini = (wx, wy) => ({
        x: ((wx - (me.x - viewSpan / 2)) / viewSpan) * mw,
        y: ((wy - (me.y - viewSpan / 2)) / viewSpan) * mh,
      });

      if (landmarks) {
        for (const lm of landmarks) {
          const pt = toMini(lm.x, lm.y);
          if (pt.x < 0 || pt.x > mw || pt.y < 0 || pt.y > mh) continue;
          mctx.fillStyle = ENTITY_DEFS[lm.type]?.mapColor || '#ffd257';
          mctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
        }
      }

      for (const pl of state.players) {
        const pt = toMini(pl.x, pl.y);
        mctx.fillStyle = pl.id === selfId ? '#7eff7a' : '#57d4ff';
        mctx.beginPath();
        mctx.arc(pt.x, pt.y, pl.id === selfId ? 4.2 : 3.5, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#000';
        mctx.lineWidth = 1.2;
        mctx.stroke();
      }
    }

    // 2. 全屏世界舆图（打开时绘制全部地标与所有局域网队友姓名！）
    if (this.mapOpen) {
      const wctx = this.worldmapCtx;
      const ww = this.worldmapCanvas.width;
      const wh = this.worldmapCanvas.height;
      wctx.clearRect(0, 0, ww, wh);
      wctx.drawImage(this.staticMapCanvas, 0, 0, ww, wh);

      const toMap = (wx, wy) => ({
        x: ((wx + WORLD_HALF) / worldStatic.worldSize) * ww,
        y: ((wy + WORLD_HALF) / worldStatic.worldSize) * wh,
      });

      if (landmarks) {
        for (const lm of landmarks) {
          const pt = toMap(lm.x, lm.y);
          const def = ENTITY_DEFS[lm.type];
          wctx.fillStyle = def?.mapColor || '#ffe078';
          wctx.strokeStyle = '#120e0b';
          wctx.lineWidth = 1.5;
          wctx.beginPath();
          if (lm.type === 'portal' || lm.type === 'pig_king' || lm.type === 'touch_stone') {
            wctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            wctx.fill();
            wctx.stroke();
            wctx.fillStyle = '#fff3d6';
            wctx.font = '11px "Microsoft YaHei", sans-serif';
            wctx.textAlign = 'center';
            wctx.fillText(def.name, pt.x, pt.y - 9);
          } else {
            wctx.fillRect(pt.x - 3.5, pt.y - 3.5, 7, 7);
            wctx.strokeRect(pt.x - 3.5, pt.y - 3.5, 7, 7);
          }
        }
      }

      for (const pl of state.players) {
        const pt = toMap(pl.x, pl.y);
        wctx.fillStyle = pl.isGhost ? '#9be0ff' : (pl.id === selfId ? '#6eff78' : '#ffcf4d');
        wctx.strokeStyle = '#000';
        wctx.lineWidth = 2;
        wctx.beginPath();
        wctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        wctx.fill();
        wctx.stroke();

        wctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
        wctx.textAlign = 'center';
        wctx.strokeText(pl.name, pt.x, pt.y + 17);
        wctx.fillText(pl.name, pt.x, pt.y + 17);
      }
    }
  }

  // ==================== 提示框、横幅与模态框 ====================
  _showTooltip(item, cx, cy) {
    const def = ITEMS[item.id];
    if (!def) return;
    let actionHint = '左键点击使用';
    if (def.slot) actionHint = '左键穿戴装备 | Shift+点击丢弃';
    else if (def.food) {
      const f = def.food;
      actionHint = `食用效果: ❤️${f.hp >= 0 ? '+' : ''}${f.hp}  🍖+${f.hunger}  🧠${f.sanity >= 0 ? '+' : ''}${f.sanity}`;
      if (def.cookResult) actionHint += '<br/>🔥 靠近火堆【右键点击】可烤熟！';
    } else if (def.plantAs) {
      actionHint = '🌱 右键点击可在地面种树！';
    }

    this.tooltipEl.innerHTML = `
      <div class="tt-title">${def.name}${item.count > 1 ? ` (x${item.count})` : ''}</div>
      <div class="tt-desc">${def.desc || ''}</div>
      <div class="tt-sub">${actionHint}</div>
    `;
    this.tooltipEl.classList.remove('hidden');
    this._moveTooltip(cx, cy);
  }

  _moveTooltip(cx, cy) {
    const x = Math.min(window.innerWidth - 260, cx + 14);
    const y = Math.max(12, cy - 88);
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
  }

  hideTooltip() {
    this.tooltipEl.classList.add('hidden');
  }

  showBanner(text, tone = 'info') {
    const el = document.getElementById('event-banner');
    el.textContent = text;
    el.className = `event-banner ${tone}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, 5200);
  }

  showToast(text) {
    const box = document.getElementById('toast-container');
    const item = document.createElement('div');
    item.className = 'toast-msg';
    item.textContent = text;
    box.appendChild(item);
    setTimeout(() => item.remove(), 3400);
  }

  appendChat(sender, text, color = '#f5ebd6') {
    const box = document.getElementById('chat-messages');
    const line = document.createElement('div');
    line.innerHTML = `<b style="color:${color}">[${this._esc(sender)}]</b> ${this._esc(text)}`;
    box.appendChild(line);
    while (box.children.length > 35) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  toggleMap(force) {
    this.mapOpen = force !== undefined ? force : !this.mapOpen;
    document.getElementById('map-modal').classList.toggle('hidden', !this.mapOpen);
  }

  _bindGlobalModals() {
    document.getElementById('btn-close-container').addEventListener('click', () => {
      this.cb.onCloseContainer?.();
    });
    document.getElementById('minimap-box').addEventListener('click', () => this.toggleMap());
    document.getElementById('btn-map').addEventListener('click', () => this.toggleMap());
    document.getElementById('btn-close-map').addEventListener('click', () => this.toggleMap(false));

    const guideModal = document.getElementById('guide-modal');
    document.getElementById('btn-guide').addEventListener('click', () => guideModal.classList.remove('hidden'));
    document.getElementById('btn-close-guide').addEventListener('click', () => guideModal.classList.add('hidden'));
  }

  _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
