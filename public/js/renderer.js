// 2.5D 饥荒场景渲染器：镜头缩放、自然群落过渡、粒子系统、弹道、多光源黑夜与屏幕方位指引
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
  drawProjectile,
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
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.shakePower = 0;

    // 客户端平滑插值表
    this.interpPlayers = new Map();
    this.interpMobs = new Map();
    this.interpProjectiles = new Map();
    this.hitShakes = []; // { x, y, until } 被砍伐/挖掘实体的受击抖动

    // 飘字、冲击环、粒子、地图Ping与气泡池
    this.floatingTexts = [];
    this.rings = [];
    this.particles = [];
    this.speeches = new Map();
    this.weatherParticles = [];
    this.mapPings = []; // { sender, x, y, until }

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

    // 半分辨率光照缓冲，兼顾柔和光晕与极高帧率
    this.lightScale = 0.5;
    this.lightCanvas.width = Math.max(1, Math.floor(this.width * this.lightScale));
    this.lightCanvas.height = Math.max(1, Math.floor(this.height * this.lightScale));
  }

  adjustZoom(delta) {
    this.targetZoom = Math.max(0.68, Math.min(1.42, this.targetZoom + delta));
  }

  resetZoom() {
    this.targetZoom = 1.0;
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.zoom + this.camX,
      y: (sy - this.height / 2) / this.zoom + this.camY,
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.camX) * this.zoom + this.width / 2,
      y: (wy - this.camY) * this.zoom + this.height / 2,
    };
  }

  addMapPing(sender, x, y, nowSec) {
    this.mapPings.push({ sender, x, y, until: nowSec + 10 });
    this.rings.push({
      x,
      y,
      r: 8,
      maxR: 90,
      color: 'rgba(126, 227, 162, 0.9)',
      life: 0.9,
      maxLife: 0.9,
    });
  }

  _spawnBurstParticles(x, y, count, colors, speed = 85, gravity = 180, size = 3.2) {
    if (this.particles.length > 260) return;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y - 10 + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - speed * 0.45,
        g: gravity,
        r: size * (0.7 + Math.random() * 0.6),
        color: colors[i % colors.length],
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }
  }

  ingestFx(fxList, nowSec) {
    if (!fxList) return;
    for (const fx of fxList) {
      if (fx.kind === 'shake') {
        this.shakePower = Math.max(this.shakePower, fx.power || 10);
      } else if (fx.kind === 'chop') {
        this.hitShakes.push({ x: fx.x, y: fx.y, until: nowSec + 0.22 });
        this._spawnBurstParticles(fx.x, fx.y, 7, ['#9c6839', '#cfa472', '#396330'], 95, 230, 3.2);
      } else if (fx.kind === 'mine') {
        this.hitShakes.push({ x: fx.x, y: fx.y, until: nowSec + 0.22 });
        this._spawnBurstParticles(fx.x, fx.y, 8, ['#b8b5ad', '#ffd24d', '#ffffff'], 110, 260, 2.8);
      } else if (fx.kind === 'dig' || fx.kind === 'rustle') {
        this._spawnBurstParticles(fx.x, fx.y, 6, ['#6ca84f', '#ab8352', '#d4be63'], 70, 170, 3.0);
      } else if (fx.kind === 'hit' || fx.kind === 'player_hit' || fx.kind === 'trap_snap') {
        this._spawnBurstParticles(fx.x, fx.y, 7, ['#ff5252', '#ffcf5c', '#ffffff'], 105, 220, 3.0);
        if (fx.dmg) {
          this.floatingTexts.push({
            x: fx.x + (Math.random() - 0.5) * 16,
            y: fx.y - 28,
            text: `-${fx.dmg}`,
            color: fx.kind === 'player_hit' ? '#ff4d4d' : '#ffdf6e',
            life: 0.85,
            maxLife: 0.85,
          });
        }
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

    // 平滑缩放插值
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);

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

    // 清理过期受击抖动与Ping
    this.hitShakes = this.hitShakes.filter((h) => h.until > nowSec);
    this.mapPings = this.mapPings.filter((p) => p.until > nowSec);

    ctx.save();
    ctx.fillStyle = '#14222e';
    ctx.fillRect(0, 0, this.width, this.height);

    const effCamX = this.camX - shakeX;
    const effCamY = this.camY - shakeY;
    const halfWorldW = (this.width / 2) / this.zoom;
    const halfWorldH = (this.height / 2) / this.zoom;
    const viewLeft = effCamX - halfWorldW;
    const viewTop = effCamY - halfWorldH;

    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-effCamX, -effCamY);

    // 2. 绘制生态群落地块、自然边界过渡、海岸波浪与鹅卵石道路
    this._drawTerrainAndRoads(ctx, worldStatic, latestState.world, viewLeft, viewTop, halfWorldW * 2, halfWorldH * 2, nowSec);

    // 生成营火火星与浓烟粒子
    this._emitAmbientWorldParticles(latestState, dt);

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
    for (const prj of this.interpProjectiles.values()) {
      drawList.push({ y: prj.y + 12, kind: 'prj', data: prj });
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
        // 被砍树/挖矿时产生物理晃动反馈！
        const shaking = this.hitShakes.some((h) => Math.abs(h.x - obj.data.x) < 6 && Math.abs(h.y - obj.data.y) < 6);
        if (shaking) {
          ctx.save();
          ctx.translate(Math.sin(nowSec * 65) * 3.5, 0);
          drawWorldEntity(ctx, obj.data, nowSec, season);
          ctx.restore();
        } else {
          drawWorldEntity(ctx, obj.data, nowSec, season);
        }
      } else if (obj.kind === 'mob') {
        if (obj.data.id === hoverTargetId) {
          this._drawSelectionHalo(ctx, obj.data.x, obj.data.y, 24, '#ff6659');
        }
        drawMob(ctx, obj.data, nowSec);
      } else if (obj.kind === 'player') {
        drawSurvivor(ctx, obj.data, nowSec, obj.data.id === selfId);
      } else if (obj.kind === 'prj') {
        drawProjectile(ctx, obj.data, nowSec);
      }
    }

    // 4. 建筑选址预览虚影
    if (placementMode && mouseWorld && me) {
      this._drawPlacementPreview(ctx, placementMode, mouseWorld, me, latestState.entities);
    }

    // 5. 地面冲击波环、环境粒子、伤害飘字与头顶聊天气泡
    this._drawWorldEffects(ctx, dt, nowSec);

    ctx.restore();

    // 6. 昼/黄昏/黑夜动态多光源遮罩层（完美适配镜头缩放！）
    this._renderDynamicLighting(latestState, effCamX, effCamY, nowSec);

    // 7. 季节滤镜、雨雪/落叶粒子、体温过冷过热、低理智幻觉与屏外队友/标记箭头
    this._renderScreenOverlays(latestState, selfId, dt, nowSec);
  }

  _stepInterpolation(state, dt) {
    const blend = Math.min(1, dt * 15);

    const seenP = new Set();
    for (const sp of state.players) {
      seenP.add(sp.id);
      const cur = this.interpPlayers.get(sp.id);
      if (!cur || Math.hypot(sp.x - cur.x, sp.y - cur.y) > 240) {
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
      if (!cur || Math.hypot(sm.x - cur.x, sm.y - cur.y) > 240) {
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

    const seenPrj = new Set();
    for (const sp of state.projectiles || []) {
      seenPrj.add(sp.id);
      const cur = this.interpProjectiles.get(sp.id);
      if (!cur) {
        this.interpProjectiles.set(sp.id, { ...sp });
      } else {
        cur.x += (sp.x - cur.x) * 0.45 + sp.vx * dt * 0.55;
        cur.y += (sp.y - cur.y) * 0.45 + sp.vy * dt * 0.55;
        cur.vx = sp.vx;
        cur.vy = sp.vy;
      }
    }
    for (const id of this.interpProjectiles.keys()) {
      if (!seenPrj.has(id)) this.interpProjectiles.delete(id);
    }
  }

  _emitAmbientWorldParticles(state, dt) {
    if (this.particles.length > 220) return;
    for (const ent of state.entities) {
      const def = ENTITY_DEFS[ent.t];
      const isLitFire = def?.isFire && (ent.f || 0) > 0;
      if ((isLitFire || ent.b) && Math.random() < dt * 11) {
        const isCold = def?.isColdFire;
        this.particles.push({
          x: ent.x + (Math.random() - 0.5) * 16,
          y: ent.y - 14,
          vx: (Math.random() - 0.5) * 18,
          vy: -36 - Math.random() * 28,
          g: -8,
          r: isCold ? 2.4 : 2.6,
          color: isCold ? '#8ce3ff' : (Math.random() < 0.35 ? 'rgba(120,115,110,0.45)' : '#ffad42'),
          life: 0.7 + Math.random() * 0.4,
          maxLife: 1.1,
        });
      }
    }
  }

  _drawTerrainAndRoads(ctx, ws, worldInfo, viewLeft, viewTop, viewW, viewH, nowSec) {
    const ts = ws.tileSize;
    const cols = ws.gridCols;
    const startCol = Math.max(0, Math.floor((viewLeft + WORLD_HALF) / ts) - 1);
    const endCol = Math.min(cols - 1, Math.ceil((viewLeft + viewW + WORLD_HALF) / ts) + 1);
    const startRow = Math.max(0, Math.floor((viewTop + WORLD_HALF) / ts) - 1);
    const endRow = Math.min(cols - 1, Math.ceil((viewTop + viewH + WORLD_HALF) / ts) + 1);

    const isWinter = worldInfo.season === 'winter';
    const tileColor = (bIdx) => {
      const bKey = ws.biomeOrder[bIdx] || 'grass';
      let c = BIOME_INFO[bKey]?.color || '#5c7c42';
      if (isWinter && bKey !== 'swamp' && bKey !== 'rocky') {
        c = bKey === 'forest' ? '#587066' : '#8da39e';
      }
      return c;
    };

    // 海岸泡沫波浪动态线
    const waveOffset = 10 + Math.sin(nowSec * 2.2) * 5;
    ctx.strokeStyle = 'rgba(195, 232, 248, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-WORLD_HALF - waveOffset, -WORLD_HALF - waveOffset, ws.worldSize + waveOffset * 2, ws.worldSize + waveOffset * 2);

    for (let r = startRow; r <= endRow; r++) {
      const wy = -WORLD_HALF + r * ts;
      for (let c = startCol; c <= endCol; c++) {
        const wx = -WORLD_HALF + c * ts;
        const bIdx = ws.biomeGrid[r * cols + c] || 0;
        ctx.fillStyle = tileColor(bIdx);
        ctx.fillRect(wx, wy, ts + 1, ts + 1);

        // 群落交界处绘制圆润草皮斑块，消除网格生硬锯齿感！
        if (c < cols - 1) {
          const rightIdx = ws.biomeGrid[r * cols + c + 1] || 0;
          if (rightIdx !== bIdx) {
            ctx.fillStyle = tileColor(rightIdx);
            ctx.beginPath();
            ctx.arc(wx + ts, wy + ts * 0.32, 13, 0, Math.PI * 2);
            ctx.arc(wx + ts, wy + ts * 0.74, 15, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (r < cols - 1) {
          const downIdx = ws.biomeGrid[(r + 1) * cols + c] || 0;
          if (downIdx !== bIdx) {
            ctx.fillStyle = tileColor(downIdx);
            ctx.beginPath();
            ctx.arc(wx + ts * 0.35, wy + ts, 14, 0, Math.PI * 2);
            ctx.arc(wx + ts * 0.78, wy + ts, 12, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 手绘地表肌理点缀
        const hash = ((c * 73856093) ^ (r * 19349663)) >>> 0;
        if (hash % 3 === 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.beginPath();
          ctx.arc(wx + (hash % 55) + 12, wy + ((hash >> 5) % 55) + 12, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 世界海岸岩滩边框
    ctx.strokeStyle = '#c9b489';
    ctx.lineWidth = 9;
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
    // 粒子更新与绘制
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.vy += pt.g * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 地图标记光柱绘制
    for (const mp of this.mapPings) {
      ctx.save();
      ctx.strokeStyle = '#7ee3a2';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y, 20 + Math.sin(nowSec * 6) * 4, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a8ffc4';
      ctx.fillText(`📍 ${mp.sender}`, mp.x, mp.y - 26);
      ctx.restore();
    }

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

  _renderDynamicLighting(state, effCamX, effCamY, nowSec) {
    const phase = state.world.phase;
    if (phase === PHASES.DAY) return;

    const lctx = this.lightCtx;
    const lw = this.lightCanvas.width;
    const lh = this.lightCanvas.height;
    const s = this.lightScale;
    const z = this.zoom;

    lctx.save();
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);

    if (phase === PHASES.DUSK) {
      lctx.fillStyle = 'rgba(38, 25, 48, 0.48)';
    } else if (state.world.isFullMoon) {
      lctx.fillStyle = 'rgba(22, 38, 68, 0.50)';
    } else {
      lctx.fillStyle = 'rgba(4, 4, 9, 0.965)';
    }
    lctx.fillRect(0, 0, lw, lh);

    const lights = [];
    const flicker = 1 + Math.sin(nowSec * 15) * 0.035;

    for (const ent of state.entities) {
      const def = ENTITY_DEFS[ent.t];
      if (!def) continue;
      let r = def.lightRadius || def.nightLightRadius || 0;
      let tint = ent.t === 'fireflies' ? 'rgba(200, 255, 110, 0.14)' : 'rgba(255, 165, 70, 0.16)';
      if (ent.b) {
        r = Math.max(r, 205 * flicker);
      } else if (def.isFire && (ent.f || 0) > 0) {
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

    for (const prj of this.interpProjectiles.values()) {
      if (prj.k === 'bishop_orb') {
        lights.push({ x: prj.x, y: prj.y, r: 85, tint: 'rgba(215, 95, 255, 0.22)' });
      }
    }

    const toScreenX = (wx) => (wx - effCamX) * z + this.width / 2;
    const toScreenY = (wy) => (wy - effCamY) * z + this.height / 2;

    lctx.globalCompositeOperation = 'destination-out';
    for (const lt of lights) {
      const sx = toScreenX(lt.x) * s;
      const sy = toScreenY(lt.y) * s;
      const sr = lt.r * z * s;
      const g = lctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.65, 'rgba(0,0,0,0.86)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      ctx.lineWidth = 1;
      lctx.arc(sx, sy, sr, 0, Math.PI * 2);
      lctx.fill();
    }
    lctx.restore();

    this.ctx.drawImage(this.lightCanvas, 0, 0, this.width, this.height);

    // 叠加温暖篝火色晕
    this.ctx.save();
    for (const lt of lights) {
      const sx = toScreenX(lt.x);
      const sy = toScreenY(lt.y);
      const sr = lt.r * z * 0.85;
      const g = this.ctx.createRadialGradient(sx, sy, 4, sx, sy, sr);
      g.addColorStop(0, lt.tint);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _renderScreenOverlays(state, selfId, dt, nowSec) {
    const ctx = this.ctx;
    const seasonCfg = SEASONS[state.world.season];
    if (seasonCfg?.tint) {
      ctx.fillStyle = seasonCfg.tint;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 降雨 / 暴雪 / 秋叶粒子
    const showAutumnLeaves = !state.world.isRaining && state.world.season === 'autumn';
    if (state.world.isRaining || showAutumnLeaves) {
      const isSnow = state.world.season === 'winter';
      const cap = showAutumnLeaves ? 18 : 95;
      while (this.weatherParticles.length < cap) {
        this.weatherParticles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          s: 0.7 + Math.random() * 0.7,
        });
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(180, 215, 255, 0.42)';
      ctx.lineWidth = 1.3;
      const count = Math.min(cap, this.weatherParticles.length);
      for (let i = 0; i < count; i++) {
        const wp = this.weatherParticles[i];
        if (showAutumnLeaves) {
          wp.y += 45 * wp.s * dt;
          wp.x += Math.sin(nowSec * 1.6 + i) * 38 * dt;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(215, 115, 40, 0.65)' : 'rgba(225, 175, 55, 0.6)';
          ctx.beginPath();
          ctx.ellipse(wp.x, wp.y, 4 * wp.s, 2.2 * wp.s, nowSec + i, 0, Math.PI * 2);
          ctx.fill();
        } else if (isSnow) {
          ctx.fillStyle = 'rgba(235, 246, 255, 0.75)';
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

    // 屏外队友鬼魂求救与地图标记方向指针！
    this._drawOffscreenIndicators(ctx, state, selfId);

    const self = state.self;
    if (!self || self.isGhost) return;

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

    const sanityRatio = self.sanity / self.maxSanity;
    if (sanityRatio < 0.38 || self.inDarkness) {
      const pulse = 0.25 + Math.abs(Math.sin(nowSec * 3.2)) * 0.22;
      const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.28, this.width / 2, this.height / 2, this.width * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(32, 8, 48, ${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);

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

  _drawOffscreenIndicators(ctx, state, selfId) {
    const me = this.interpPlayers.get(selfId);
    if (!me) return;

    const targets = [];
    for (const pl of state.players) {
      if (pl.id === selfId) continue;
      const sp = this.worldToScreen(pl.x, pl.y);
      if (sp.x < 40 || sp.x > this.width - 40 || sp.y < 40 || sp.y > this.height - 40) {
        targets.push({
          x: pl.x,
          y: pl.y,
          label: `${pl.isGhost ? '👻求救:' : '🧭'}${pl.name}`,
          color: pl.isGhost ? '#85dbff' : '#ffd875',
        });
      }
    }
    for (const mp of this.mapPings) {
      const sp = this.worldToScreen(mp.x, mp.y);
      if (sp.x < 30 || sp.x > this.width - 30 || sp.y < 30 || sp.y > this.height - 30) {
        targets.push({
          x: mp.x,
          y: mp.y,
          label: `📍${mp.sender}`,
          color: '#7ee3a2',
        });
      }
    }

    for (const t of targets) {
      const dx = t.x - me.x;
      const dy = t.y - me.y;
      const ang = Math.atan2(dy, dx);
      const distMeters = Math.round(Math.hypot(dx, dy) / 25);
      const margin = 82;
      const rx = this.width / 2 - margin;
      const ry = this.height / 2 - margin;
      const px = this.width / 2 + Math.cos(ang) * rx;
      const py = this.height / 2 + Math.sin(ang) * ry;

      ctx.save();
      ctx.fillStyle = 'rgba(20, 16, 13, 0.85)';
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.5;
      const text = `${t.label} (${distMeters}m)`;
      ctx.font = 'bold 11.5px "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(text).width + 14;
      ctx.beginPath();
      ctx.roundRect(px - tw / 2, py - 12, tw, 22, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.fillText(text, px, py + 3);
      ctx.restore();
    }
  }
}
