// 2.5D 饥荒场景渲染器：地表群落、Y轴景深排序、动态多光源黑夜遮罩、天气与理智特效
import {
  WORLD_HALF,
  BIOME_INFO,
  PHASES,
  SEASONS,
  TEMP_FREEZE_WARN,
  TEMP_HEAT_WARN,
} from '../shared/constants.js';
import { ITEMS } from '../shared/items.js';
import { ENTITY_DEFS } from '../shared/entities.js';
import {
  drawSurvivor,
  drawWorldEntity,
  drawMob,
  getItemIconCanvas,
} from './sprites.js';

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    this.camX = 0;
    this.camY = 0;
    this.shakePower = 0;

    // 客户端平滑插值表
    this.interpPlayers = new Map();
    this.interpMobs = new Map();

    // 飘字、粒子与气泡特效池
    this.floatingTexts = [];
    this.rings = [];
    this.speeches = new Map(); // playerId/key -> { text, x, y, until }
    this.weatherParticles = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 半分辨率光照缓冲，兼顾柔和边缘与极高性能
    this.lightScale = 0.5;
    this.lightCanvas.width = Math.max(1, Math.floor(this.width * this.lightScale));
    this.lightCanvas.height = Math.max(1, Math.floor(this.height * this.lightScale));
  }

  screenToWorld(sx, sy) {
    return {
      x: sx - this.width / 2 + this.camX,
      y: sy - this.height / 2 + this.camY,
    };
  }

  ingestFx(fxList, nowSec) {
    if (!fxList) return;
    for (const fx of fxList) {
      if (fx.kind === 'shake') {
        this.shakePower = Math.max(this.shakePower, fx.power || 10);
      } else if (fx.kind === 'hit' || fx.kind === 'player_hit') {
        this.floatingTexts.push({
          x: fx.x + (Math.random() - 0.5) * 16,
          y: fx.y - 28,
          text: `-${fx.dmg}`,
          color: fx.kind === 'player_hit' ? '#ff4d4d' : '#ffdf6e',
          life: 0.85,
          maxLife: 0.85,
        });
      } else if (fx.kind === 'heal') {
        this.floatingTexts.push({
          x: fx.x,
          y: fx.y - 38,
          text: fx.text || '+HP',
          color: '#7ee392',
          life: 1.2,
          maxLife: 1.2,
        });
      } else if (fx.kind === 'speech') {
        this.speeches.set(fx.playerId || `${fx.x}_${fx.y}`, {
          text: fx.text,
          playerId: fx.playerId,
          x: fx.x,
          y: fx.y,
          until: nowSec + 4.2,
        });
      } else if (fx.kind === 'ice_slam' || fx.kind === 'abigail_pulse' || fx.kind === 'revive' || fx.kind === 'fire_burst') {
        const colorMap = {
          ice_slam: 'rgba(135, 220, 255, 0.85)',
          abigail_pulse: 'rgba(255, 165, 200, 0.75)',
          revive: 'rgba(255, 230, 110, 0.92)',
          fire_burst: 'rgba(255, 120, 40, 0.85)',
        };
        this.rings.push({
          x: fx.x,
          y: fx.y,
          r: 12,
          maxR: fx.kind === 'ice_slam' ? 115 : 95,
          color: colorMap[fx.kind],
          life: 0.45,
          maxLife: 0.45,
        });
      } else if (fx.kind === 'charlie_hit') {
        this.shakePower = 14;
        this.floatingTexts.push({
          x: fx.x,
          y: fx.y - 45,
          text: '👁️ 查理暗影袭击！',
          color: '#ff3b5c',
          life: 1.3,
          maxLife: 1.3,
        });
      }
    }
  }

  render(gameState, dt, nowSec) {
    const ctx = this.ctx;
    const { worldStatic, latestState, selfId, hoverTargetId, placementMode, mouseWorld } = gameState;
    if (!worldStatic || !latestState) {
      ctx.fillStyle = '#14110f';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    // 1. 更新平滑插值坐标
    this._stepInterpolation(latestState, dt);

    const me = this.interpPlayers.get(selfId);
    if (me) {
      this.camX += (me.x - this.camX) * Math.min(1, dt * 10);
      this.camY += (me.y - this.camY) * Math.min(1, dt * 10);
    }

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakePower > 0.2) {
      shakeX = (Math.random() - 0.5) * this.shakePower * 2;
      shakeY = (Math.random() - 0.5) * this.shakePower * 2;
      this.shakePower *= Math.pow(0.04, dt);
    } else {
      this.shakePower = 0;
    }

    ctx.save();
    ctx.fillStyle = '#18242e';
    ctx.fillRect(0, 0, this.width, this.height);

    const viewLeft = this.camX - this.width / 2 - shakeX;
    const viewTop = this.camY - this.height / 2 - shakeY;
    ctx.translate(-viewLeft, -viewTop);

    // 2. 绘制生态群落地块与鹅卵石道路
    this._drawTerrainAndRoads(ctx, worldStatic, latestState.world, viewLeft, viewTop);

    // 3. 收集并按 Y 坐标排序所有可见对象（经典 2.5D 遮挡）
    const drawList = [];

    for (const gi of latestState.items) {
      drawList.push({ y: gi.y, kind: 'item', data: gi });
    }
    for (const ent of latestState.entities) {
      drawList.push({ y: ent.y, kind: 'ent', data: ent });
    }
    for (const mob of this.interpMobs.values()) {
      drawList.push({ y: mob.y, kind: 'mob', data: mob });
    }
    for (const pl of this.interpPlayers.values()) {
      drawList.push({ y: pl.y, kind: 'player', data: pl });
    }

    drawList.sort((a, b) => a.y - b.y);

    const season = latestState.world.season;
    for (const obj of drawList) {
      if (obj.kind === 'item') {
        this._drawGroundItem(ctx, obj.data, nowSec, obj.data.id === hoverTargetId);
      } else if (obj.kind === 'ent') {
        if (obj.data.id === hoverTargetId) {
          this._drawSelectionHalo(ctx, obj.data.x, obj.data.y, 26, '#ffe078');
        }
        drawWorldEntity(ctx, obj.data, nowSec, season);
      } else if (obj.kind === 'mob') {
        if (obj.data.id === hoverTargetId) {
          this._drawSelectionHalo(ctx, obj.data.x, obj.data.y, 24, '#ff6659');
        }
        drawMob(ctx, obj.data, nowSec);
      } else if (obj.kind === 'player') {
        drawSurvivor(ctx, obj.data, nowSec, obj.data.id === selfId);
      }
    }

    // 4. 建筑选址预览虚影
    if (placementMode && mouseWorld && me) {
      this._drawPlacementPreview(ctx, placementMode, mouseWorld, me, latestState.entities);
    }

    // 5. 地面冲击波环、伤害飘字与头顶聊天气泡
    this._drawWorldEffects(ctx, dt, nowSec);

    ctx.restore();

    // 6. 昼/黄昏/黑夜动态多光源遮罩层（饥荒灵魂视觉！）
    this._renderDynamicLighting(latestState, viewLeft, viewTop, nowSec);

    // 7. 季节滤镜、雨雪粒子、体温过冷过热与低理智幻觉边缘特效
    this._renderScreenOverlays(latestState, dt, nowSec);
  }

  _stepInterpolation(state, dt) {
    const blend = Math.min(1, dt * 15);

    const seenP = new Set();
    for (const sp of state.players) {
      seenP.add(sp.id);
      const cur = this.interpPlayers.get(sp.id);
      if (!cur || Math.hypot(sp.x - cur.x, sp.y - cur.y) > 220) {
        this.interpPlayers.set(sp.id, { ...sp, _moving: false });
      } else {
        const dx = sp.x - cur.x;
        const dy = sp.y - cur.y;
        cur._moving = Math.hypot(dx, dy) > 1.2;
        cur.x += dx * blend;
        cur.y += dy * blend;
        cur.facing = sp.facing;
        cur.hp = sp.hp;
        cur.maxHp = sp.maxHp;
        cur.isGhost = sp.isGhost;
        cur.hand = sp.hand;
        cur.body = sp.body;
        cur.head = sp.head;
        cur.swing = sp.swing;
        cur.hurt = sp.hurt;
        cur.mighty = sp.mighty;
        cur.beard = sp.beard;
        cur.name = sp.name;
        cur.charId = sp.charId;
      }
    }
    for (const id of this.interpPlayers.keys()) {
      if (!seenP.has(id)) this.interpPlayers.delete(id);
    }

    const seenM = new Set();
    for (const sm of state.mobs) {
      seenM.add(sm.id);
      const cur = this.interpMobs.get(sm.id);
      if (!cur || Math.hypot(sm.x - cur.x, sm.y - cur.y) > 220) {
        this.interpMobs.set(sm.id, { ...sm });
      } else {
        cur.x += (sm.x - cur.x) * blend;
        cur.y += (sm.y - cur.y) * blend;
        cur.f = sm.f;
        cur.hp = sm.hp;
        cur.mhp = sm.mhp;
        cur.w = sm.w;
        cur.ally = sm.ally;
        cur.t = sm.t;
      }
    }
    for (const id of this.interpMobs.keys()) {
      if (!seenM.has(id)) this.interpMobs.delete(id);
    }
  }

  _drawTerrainAndRoads(ctx, ws, worldInfo, viewLeft, viewTop) {
    const ts = ws.tileSize;
    const cols = ws.gridCols;
    const startCol = Math.max(0, Math.floor((viewLeft + WORLD_HALF) / ts) - 1);
    const endCol = Math.min(cols - 1, Math.ceil((viewLeft + this.width + WORLD_HALF) / ts) + 1);
    const startRow = Math.max(0, Math.floor((viewTop + WORLD_HALF) / ts) - 1);
    const endRow = Math.min(cols - 1, Math.ceil((viewTop + this.height + WORLD_HALF) / ts) + 1);

    const isWinter = worldInfo.season === 'winter';

    for (let r = startRow; r <= endRow; r++) {
      const wy = -WORLD_HALF + r * ts;
      for (let c = startCol; c <= endCol; c++) {
        const wx = -WORLD_HALF + c * ts;
        const bIdx = ws.biomeGrid[r * cols + c] || 0;
        const bKey = ws.biomeOrder[bIdx];
        let color = BIOME_INFO[bKey]?.color || '#5c7c42';

        if (isWinter && bKey !== 'swamp' && bKey !== 'rocky') {
          color = bKey === 'forest' ? '#587066' : '#8da39e';
        }
        ctx.fillStyle = color;
        ctx.fillRect(wx, wy, ts + 1, ts + 1);

        // 手绘地表碎草/石纹肌理点缀
        const hash = ((c * 73856093) ^ (r * 19349663)) >>> 0;
        if (hash % 3 === 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.beginPath();
          ctx.arc(wx + (hash % 55) + 12, wy + ((hash >> 5) % 55) + 12, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 世界海洋边界框
    ctx.strokeStyle = '#d4c39b';
    ctx.lineWidth = 8;
    ctx.strokeRect(-WORLD_HALF, -WORLD_HALF, ws.worldSize, ws.worldSize);

    // 绘制鹅卵石加速道路
    if (ws.roads) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const poly of ws.roads) {
        if (poly.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
        ctx.strokeStyle = '#4a3d2f';
        ctx.lineWidth = 42;
        ctx.stroke();

        ctx.strokeStyle = '#99876e';
        ctx.lineWidth = 34;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawGroundItem(ctx, gi, time, hovered) {
    const bob = Math.sin(time * 3.5 + gi.x) * 2.2;
    ctx.save();
    ctx.translate(gi.x, gi.y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 3, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (hovered) {
      this._drawSelectionHalo(ctx, 0, 0, 16, '#9be890');
    }
    const ic = getItemIconCanvas(gi.i, 30);
    ctx.drawImage(ic, -15, -20 + bob);
    if (gi.c > 1) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.strokeText(`x${gi.c}`, 6, 4);
      ctx.fillText(`x${gi.c}`, 6, 4);
    }
    ctx.restore();
  }

  _drawSelectionHalo(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawPlacementPreview(ctx, placementMode, mw, me, entities) {
    const sDef = ENTITY_DEFS[placementMode.structure];
    if (!sDef) return;
    const dist = Math.hypot(mw.x - me.x, mw.y - me.y);
    let valid = dist <= 250;
    const baseR = sDef.radius || 20;
    if (valid) {
      for (const ent of entities) {
        const eDef = ENTITY_DEFS[ent.t];
        if (!eDef?.solid && !eDef?.isFire) continue;
        const eRadius = eDef?.radius || 20;
        const reqDist = sDef.isWall
          ? (eDef?.isWall ? 28 : eRadius + 14)
          : eRadius + baseR;
        if (Math.hypot(ent.x - mw.x, ent.y - mw.y) < reqDist) {
          valid = false;
          break;
        }
      }
    }

    ctx.save();
    ctx.globalAlpha = 0.68;
    drawWorldEntity(ctx, { t: placementMode.structure, x: mw.x, y: mw.y, f: 120 }, 0, 'autumn');
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = valid ? '#6ee878' : '#ff5252';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(mw.x, mw.y + 3, baseR + 6, (baseR + 6) * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawWorldEffects(ctx, dt, nowSec) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const rg = this.rings[i];
      rg.life -= dt;
      if (rg.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const p = 1 - rg.life / rg.maxLife;
      const rad = rg.r + (rg.maxR - rg.r) * p;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(rg.x, rg.y, rad, rad * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 28 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    for (const [key, sp] of this.speeches.entries()) {
      if (nowSec > sp.until) {
        this.speeches.delete(key);
        continue;
      }
      let sx = sp.x;
      let sy = sp.y;
      if (sp.playerId && this.interpPlayers.has(sp.playerId)) {
        const pl = this.interpPlayers.get(sp.playerId);
        sx = pl.x;
        sy = pl.y - 74;
      }
      ctx.save();
      ctx.font = '12.5px "Microsoft YaHei", sans-serif';
      const tw = Math.min(220, ctx.measureText(sp.text).width + 18);
      ctx.fillStyle = 'rgba(20, 16, 13, 0.88)';
      ctx.strokeStyle = '#c4a468';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(sx - tw / 2, sy - 18, tw, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff5df';
      ctx.textAlign = 'center';
      ctx.fillText(sp.text, sx, sy - 2);
      ctx.restore();
    }
  }

  _renderDynamicLighting(state, viewLeft, viewTop, nowSec) {
    const phase = state.world.phase;
    if (phase === PHASES.DAY) return;

    const lctx = this.lightCtx;
    const lw = this.lightCanvas.width;
    const lh = this.lightCanvas.height;
    const s = this.lightScale;

    lctx.save();
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);

    if (phase === PHASES.DUSK) {
      lctx.fillStyle = 'rgba(38, 25, 48, 0.48)';
    } else if (state.world.isFullMoon) {
      lctx.fillStyle = 'rgba(22, 38, 68, 0.50)';
    } else {
      // 纯正伸手不见五指饥荒黑夜！
      lctx.fillStyle = 'rgba(4, 4, 9, 0.965)';
    }
    lctx.fillRect(0, 0, lw, lh);

    // 收集所有光源并挖出柔和渐变光圈
    const lights = [];
    const flicker = 1 + Math.sin(nowSec * 15) * 0.035;

    for (const ent of state.entities) {
      const def = ENTITY_DEFS[ent.t];
      if (!def) continue;
      let r = def.lightRadius || 0;
      let tint = 'rgba(255, 165, 70, 0.16)';
      if (def.isFire && (ent.f || 0) > 0) {
        const ratio = Math.max(0.18, Math.min(1, ent.f / def.maxFuel));
        r = (135 + ratio * 190) * flicker;
        if (def.isColdFire) tint = 'rgba(85, 200, 255, 0.18)';
      }
      if (r > 0) {
        lights.push({ x: ent.x, y: ent.y - 8, r, tint });
      }
    }

    for (const pl of this.interpPlayers.values()) {
      let r = pl.isGhost ? 78 : 0;
      let tint = pl.isGhost ? 'rgba(130, 210, 255, 0.12)' : 'rgba(255, 175, 75, 0.14)';
      if (!pl.isGhost) {
        if (pl.hand && ITEMS[pl.hand]?.lightRadius) r = Math.max(r, ITEMS[pl.hand].lightRadius * flicker);
        if (pl.head && ITEMS[pl.head]?.lightRadius) r = Math.max(r, ITEMS[pl.head].lightRadius);
      }
      if (r > 0) lights.push({ x: pl.x, y: pl.y - 16, r, tint });
    }

    for (const gi of state.items) {
      if (gi.i === 'lantern') {
        lights.push({ x: gi.x, y: gi.y - 6, r: 245, tint: 'rgba(255, 225, 120, 0.14)' });
      }
    }

    for (const m of this.interpMobs.values()) {
      if (m.t === 'abigail') {
        lights.push({ x: m.x, y: m.y - 14, r: 100, tint: 'rgba(255, 180, 210, 0.12)' });
      }
    }

    lctx.globalCompositeOperation = 'destination-out';
    for (const lt of lights) {
      const sx = (lt.x - viewLeft) * s;
      const sy = (lt.y - viewTop) * s;
      const sr = lt.r * s;
      const g = lctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.65, 'rgba(0,0,0,0.86)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(sx, sy, sr, 0, Math.PI * 2);
      lctx.fill();
    }
    lctx.restore();

    // 叠加黑夜遮罩到主画布
    this.ctx.drawImage(this.lightCanvas, 0, 0, this.width, this.height);

    // 叠加温暖篝火色晕
    this.ctx.save();
    for (const lt of lights) {
      const sx = lt.x - viewLeft;
      const sy = lt.y - viewTop;
      const g = this.ctx.createRadialGradient(sx, sy, 4, sx, sy, lt.r * 0.85);
      g.addColorStop(0, lt.tint);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, lt.r * 0.85, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _renderScreenOverlays(state, dt, nowSec) {
    const ctx = this.ctx;
    const seasonCfg = SEASONS[state.world.season];
    if (seasonCfg?.tint) {
      ctx.fillStyle = seasonCfg.tint;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 降雨 / 暴雪粒子
    if (state.world.isRaining) {
      const isSnow = state.world.season === 'winter';
      while (this.weatherParticles.length < 95) {
        this.weatherParticles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          s: 0.7 + Math.random() * 0.7,
        });
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(180, 215, 255, 0.42)';
      ctx.fillStyle = 'rgba(235, 246, 255, 0.75)';
      ctx.lineWidth = 1.3;
      for (const wp of this.weatherParticles) {
        if (isSnow) {
          wp.y += 85 * wp.s * dt;
          wp.x += Math.sin(nowSec * 2 + wp.y * 0.02) * 28 * dt;
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 2.2 * wp.s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          wp.y += 540 * wp.s * dt;
          wp.x -= 90 * wp.s * dt;
          ctx.beginPath();
          ctx.moveTo(wp.x, wp.y);
          ctx.lineTo(wp.x + 4, wp.y - 15 * wp.s);
          ctx.stroke();
        }
        if (wp.y > this.height) {
          wp.y = -10;
          wp.x = Math.random() * this.width;
        }
        if (wp.x < 0) wp.x = this.width;
      }
      ctx.restore();
    }

    const self = state.self;
    if (!self || self.isGhost) return;

    // 过冷冰霜边框 / 过热热浪边框
    if (self.bodyTemp < TEMP_FREEZE_WARN) {
      const alpha = Math.min(0.55, (TEMP_FREEZE_WARN - self.bodyTemp) / 14);
      const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.32, this.width / 2, this.height / 2, this.width * 0.65);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(110, 205, 255, ${alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (self.bodyTemp > TEMP_HEAT_WARN) {
      const alpha = Math.min(0.52, (self.bodyTemp - TEMP_HEAT_WARN) / 14);
      const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.32, this.width / 2, this.height / 2, this.width * 0.65);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(255, 95, 30, ${alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 低理智暗影触须与诡异凝视特效
    const sanityRatio = self.sanity / self.maxSanity;
    if (sanityRatio < 0.38 || self.inDarkness) {
      const pulse = 0.25 + Math.abs(Math.sin(nowSec * 3.2)) * 0.22;
      const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.28, this.width / 2, this.height / 2, this.width * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(32, 8, 48, ${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);

      // 黑暗中发光的查理窥视双瞳
      if (self.inDarkness) {
        ctx.fillStyle = '#fff5b8';
        const ex = this.width * 0.5 + Math.sin(nowSec * 1.7) * 190;
        const ey = this.height * 0.35;
        ctx.beginPath();
        ctx.arc(ex - 9, ey, 3.5, 0, Math.PI * 2);
        ctx.arc(ex + 9, ey, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
