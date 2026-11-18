// 权威游戏房间核心模拟引擎（20 TPS）
import {
  TICK_MS,
  WORLD_HALF,
  DAY_DURATION,
  SEASON_LENGTH,
  SEASON_ORDER,
  SEASONS,
  PHASES,
  EQUIP_SLOTS,
  INVENTORY_SIZE,
  CHEST_SIZE,
  TEMP_FREEZING,
  TEMP_OVERHEAT,
  VIEW_RADIUS,
  INTERACT_RANGE,
  TECH_RANGE,
} from '../shared/constants.js';
import { CHARACTERS } from '../shared/characters.js';
import { ITEMS } from '../shared/items.js';
import { RECIPES, evaluateCrockPot } from '../shared/recipes.js';
import { ENTITY_DEFS, MOB_DEFS } from '../shared/entities.js';
import { generateWorld, distToRoads } from './worldGen.js';
import { saveWorldToDisk } from './saveManager.js';

const RECIPE_MAP = new Map(RECIPES.map((r) => [r.id, r]));

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class GameRoom {
  constructor(options = {}) {
    this.id = options.id || `room_${Date.now().toString(36)}`;
    this.name = options.name || '荒野求生营地';
    this.hostClientId = options.hostClientId || null;
    this.pvp = Boolean(options.pvp);
    this.difficulty = options.difficulty === 'hardcore' ? 'hardcore' : 'standard';
    this.maxPlayers = options.maxPlayers || 8;
    this.saveId = options.saveId || `${this.name}_${this.id.slice(-4)}`;
    this.onEmpty = options.onEmpty || null;
    this.onSummaryChange = options.onSummaryChange || null;

    this.clients = new Map(); // clientId -> WSClient
    this.players = new Map(); // clientId -> PlayerState
    this.savedPlayers = {};   // playerKey -> serialized PlayerState
    this.projectiles = new Map(); // projId -> Projectile
    this.exploredTiles = new Set(); // 团队共享已探索地块索引
    this.newlyExplored = [];
    this.fxEvents = [];       // 本帧待广播瞬时特效与音效事件

    if (options.loadedSnapshot) {
      this._restoreFromSnapshot(options.loadedSnapshot);
    } else {
      const world = generateWorld(options.seed || `${this.name}_${Date.now()}`);
      this.seed = world.seed;
      this.seedNum = world.seedNum;
      this.worldSize = world.worldSize;
      this.tileSize = world.tileSize;
      this.gridCols = world.gridCols;
      this.biomeOrder = world.biomeOrder;
      this.biomeGrid = world.biomeGrid;
      this.roads = world.roads;
      this.entities = world.entities;
      this.mobs = world.mobs;
      this.groundItems = world.groundItems;
      this.nextId = world.nextId;

      const startSeason = SEASONS[options.startSeason] ? options.startSeason : 'autumn';
      this.startSeasonIdx = SEASON_ORDER.indexOf(startSeason);
      this.worldTime = 12; // 从第1天清晨开始
      this.isRaining = false;
      this.weatherTimer = 85;
      this.nextHoundTime = DAY_DURATION * 3.35; // 第4天猎犬初袭
      this.houndWarned = false;
      this.deerclopsSpawnedSeasons = {};
      this.pendingBossTimer = 0;
    }

    this.tickCount = 0;
    this.autoSaveTimer = 0;
    this.emptySeconds = 0;
    this.closed = false;

    this.loopHandle = setInterval(() => this._tick(TICK_MS / 1000), TICK_MS);
  }

  allocId(prefix = 'x') {
    return `${prefix}_${this.nextId++}`;
  }

  getDayInfo() {
    const day = Math.floor(this.worldTime / DAY_DURATION) + 1;
    const dayProgress = (this.worldTime % DAY_DURATION) / DAY_DURATION;
    const seasonIndex = (this.startSeasonIdx + Math.floor((day - 1) / SEASON_LENGTH)) % SEASON_ORDER.length;
    const seasonId = SEASON_ORDER[seasonIndex];
    const seasonCfg = SEASONS[seasonId];
    const dayInSeason = ((day - 1) % SEASON_LENGTH) + 1;

    const dayEnd = seasonCfg.segments.day / 16;
    const duskEnd = (seasonCfg.segments.day + seasonCfg.segments.dusk) / 16;
    let phase = PHASES.NIGHT;
    if (dayProgress < dayEnd) phase = PHASES.DAY;
    else if (dayProgress < duskEnd) phase = PHASES.DUSK;

    const isFullMoon = phase === PHASES.NIGHT && day % 8 === 0;

    // 环境基础温度插值
    const middayFactor = Math.sin(dayProgress * Math.PI);
    const ambientTemp = seasonCfg.tempNight + (seasonCfg.tempDay - seasonCfg.tempNight) * middayFactor;

    return {
      day,
      dayProgress,
      phase,
      isFullMoon,
      season: seasonId,
      seasonName: seasonCfg.name,
      dayInSeason,
      segments: seasonCfg.segments,
      ambientTemp,
    };
  }

  getSummary() {
    const info = this.getDayInfo();
    return {
      id: this.id,
      name: this.name,
      day: info.day,
      season: info.season,
      seasonName: info.seasonName,
      pvp: this.pvp,
      difficulty: this.difficulty,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
    };
  }

  addPlayer(client, joinData = {}) {
    if (this.players.size >= this.maxPlayers) {
      client.send({ type: 'error', message: '该房间人数已满！' });
      return false;
    }

    const clientId = client.clientId;
    const rawName = String(joinData.name || '幸存者').trim().slice(0, 14) || '幸存者';
    const charId = CHARACTERS[joinData.charId] ? joinData.charId : 'wilson';
    const charDef = CHARACTERS[charId];
    const playerKey = String(joinData.playerToken || rawName).slice(0, 36);

    let player;
    const saved = this.savedPlayers[playerKey];
    if (saved) {
      player = {
        ...saved,
        id: clientId,
        playerKey,
        name: rawName,
        moveX: 0,
        moveY: 0,
        walkTarget: null,
        interactTargetId: null,
        attackTargetId: null,
        actionCooldown: 0,
        attackCooldown: 0,
        darkTimer: 0,
        openContainerId: null,
      };
    } else {
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = 58 + Math.random() * 42;
      const inventory = Array(INVENTORY_SIZE).fill(null);
      const equip = {
        [EQUIP_SLOTS.HAND]: null,
        [EQUIP_SLOTS.BODY]: null,
        [EQUIP_SLOTS.HEAD]: null,
      };

      player = {
        id: clientId,
        playerKey,
        name: rawName,
        charId,
        x: Math.cos(spawnAngle) * spawnDist,
        y: 25 + Math.sin(spawnAngle) * spawnDist,
        facing: 1,
        hp: charDef.hp,
        maxHp: charDef.hp,
        hunger: charDef.hunger,
        maxHunger: charDef.hunger,
        sanity: charDef.sanity,
        maxSanity: charDef.sanity,
        bodyTemp: 25,
        moisture: 0,
        beardDays: 0,
        gearUpgrades: 0,
        isGhost: false,
        ghostSince: 0,
        inventory,
        equip,
        unlockedRecipes: [],
        abigailId: null,
        moveX: 0,
        moveY: 0,
        walkTarget: null,
        interactTargetId: null,
        attackTargetId: null,
        actionCooldown: 0,
        attackCooldown: 0,
        swingAnim: 0,
        hurtAnim: 0,
        darkTimer: 0,
        openContainerId: null,
      };

      // 发放初始物品（若为女武神装备自动穿戴更贴心！）
      for (const st of charDef.startItems || []) {
        const def = ITEMS[st.id];
        if (def?.slot && !player.equip[def.slot] && (st.id === 'battle_spear' || st.id === 'battle_helm' || st.id === 'lighter')) {
          player.equip[def.slot] = {
            id: st.id,
            count: 1,
            durability: def.maxDurability ?? null,
          };
        } else {
          this._addItemToPlayer(player, st.id, st.count);
        }
      }
    }

    if (!this.hostClientId || !this.players.has(this.hostClientId)) {
      this.hostClientId = clientId;
    }

    this.clients.set(clientId, client);
    this.players.set(clientId, player);
    this.emptySeconds = 0;

    // 发送完整世界静态地形数据包
    client.send({
      type: 'joined_room',
      roomId: this.id,
      roomName: this.name,
      selfId: clientId,
      isHost: this.hostClientId === clientId,
      pvp: this.pvp,
      difficulty: this.difficulty,
      worldStatic: {
        worldSize: this.worldSize,
        tileSize: this.tileSize,
        gridCols: this.gridCols,
        biomeOrder: this.biomeOrder,
        biomeGrid: this.biomeGrid,
        roads: this.roads,
      },
      mapLandmarks: this._buildMapLandmarks(),
      explored: [...this.exploredTiles],
    });

    this.broadcastChat('系统', `🌟 ${player.name}（${CHARACTERS[player.charId]?.name || ''}）进入了荒野！`, '#f2c138');
    this.onSummaryChange?.();
    return true;
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (player) {
      // 保存角色进度以便断线重连与存档恢复
      this.savedPlayers[player.playerKey] = this._serializePlayerForSave(player);
      if (player.abigailId && this.mobs.has(player.abigailId)) {
        this.mobs.delete(player.abigailId);
      }
      this.players.delete(clientId);
      this.clients.delete(clientId);
      this.broadcastChat('系统', `💨 ${player.name} 暂时离开了世界（进度已保留）`, '#a8a296');
    } else {
      this.clients.delete(clientId);
    }

    if (this.hostClientId === clientId) {
      const nextHost = this.players.keys().next().value || null;
      this.hostClientId = nextHost;
      if (nextHost) {
        const hc = this.clients.get(nextHost);
        hc?.send({ type: 'host_changed', isHost: true });
      }
    }
    this.onSummaryChange?.();
  }

  handleAction(clientId, msg) {
    const player = this.players.get(clientId);
    if (!player || !msg) return;

    switch (msg.type) {
      case 'input': {
        const mx = Number(msg.moveX) || 0;
        const my = Number(msg.moveY) || 0;
        const len = Math.hypot(mx, my);
        if (len > 0.01) {
          player.moveX = mx / Math.max(1, len);
          player.moveY = my / Math.max(1, len);
          player.walkTarget = null;
          player.interactTargetId = null;
          player.attackTargetId = null;
          if (Math.abs(mx) > 0.05) player.facing = mx > 0 ? 1 : -1;
        } else {
          player.moveX = 0;
          player.moveY = 0;
        }
        break;
      }

      case 'click_ground': {
        const tx = clamp(Number(msg.x) || 0, -WORLD_HALF + 45, WORLD_HALF - 45);
        const ty = clamp(Number(msg.y) || 0, -WORLD_HALF + 45, WORLD_HALF - 45);
        player.walkTarget = { x: tx, y: ty };
        player.interactTargetId = null;
        player.attackTargetId = null;
        player.openContainerId = null;
        if (Math.abs(tx - player.x) > 4) player.facing = tx > player.x ? 1 : -1;
        break;
      }

      case 'interact_target': {
        player.interactTargetId = String(msg.targetId || '');
        player.altInteract = false;
        player.attackTargetId = null;
        break;
      }

      case 'alt_interact_target': {
        player.interactTargetId = String(msg.targetId || '');
        player.altInteract = true;
        player.attackTargetId = null;
        break;
      }

      case 'attack_target': {
        player.attackTargetId = String(msg.targetId || '');
        player.interactTargetId = null;
        player.altInteract = false;
        break;
      }

      case 'swap_slot': {
        const fromIdx = Number(msg.fromIdx);
        const toIdx = Number(msg.toIdx);
        if (
          fromIdx >= 0 && fromIdx < INVENTORY_SIZE &&
          toIdx >= 0 && toIdx < INVENTORY_SIZE &&
          fromIdx !== toIdx
        ) {
          const a = player.inventory[fromIdx];
          const b = player.inventory[toIdx];
          if (a && b && a.id === b.id && (ITEMS[a.id]?.stack || 1) > 1) {
            const maxStack = ITEMS[a.id].stack;
            const add = Math.min(a.count, maxStack - b.count);
            b.count += add;
            a.count -= add;
            if (a.count <= 0) player.inventory[fromIdx] = null;
          } else {
            player.inventory[fromIdx] = b;
            player.inventory[toIdx] = a;
          }
        }
        break;
      }

      case 'map_ping': {
        const now = Date.now();
        if (!player.lastPingAt || now - player.lastPingAt > 1200) {
          player.lastPingAt = now;
          const px = clamp(Math.round(Number(msg.x) || 0), -WORLD_HALF, WORLD_HALF);
          const py = clamp(Math.round(Number(msg.y) || 0), -WORLD_HALF, WORLD_HALF);
          this.broadcast({
            type: 'map_ping',
            sender: player.name,
            x: px,
            y: py,
          });
          this.broadcastChat('地图标记', `📍 ${player.name} 标记了坐标 (${px}, ${py})！`, '#7ee3a2');
        }
        break;
      }

      case 'quick_gather': {
        this._assignNearestGatherTarget(player);
        break;
      }

      case 'quick_attack': {
        this._assignNearestAttackTarget(player);
        break;
      }

      case 'use_slot': {
        this._handleUseInventorySlot(player, Number(msg.slotIndex), Boolean(msg.secondary));
        break;
      }

      case 'unequip': {
        const slot = msg.slot;
        if (player.equip[slot]) {
          const item = player.equip[slot];
          player.equip[slot] = null;
          this._addItemToPlayer(player, item.id, item.count, item.durability, item.extra);
        }
        break;
      }

      case 'drop_slot': {
        const idx = Number(msg.slotIndex);
        if (idx >= 0 && idx < INVENTORY_SIZE && player.inventory[idx]) {
          const it = player.inventory[idx];
          const dropCount = msg.one ? 1 : it.count;
          this._spawnGroundItem(it.id, dropCount, player.x + player.facing * 24, player.y + 12, it.durability, it.extra);
          it.count -= dropCount;
          if (it.count <= 0) player.inventory[idx] = null;
        }
        break;
      }

      case 'craft': {
        this._handleCraft(player, String(msg.recipeId || ''));
        break;
      }

      case 'place_structure': {
        this._handlePlaceStructure(player, String(msg.recipeId || ''), Number(msg.x), Number(msg.y));
        break;
      }

      case 'container_transfer': {
        this._handleContainerTransfer(player, String(msg.entityId || ''), String(msg.from || ''), Number(msg.index));
        break;
      }

      case 'cook_pot_start': {
        this._handleStartCooking(player, String(msg.entityId || ''));
        break;
      }

      case 'chat': {
        const text = String(msg.text || '').trim().slice(0, 120);
        if (text) {
          this.broadcastChat(player.name, text, player.isGhost ? '#9be0ff' : '#f5ebd6');
          this._pushFx({ kind: 'speech', x: player.x, y: player.y - 54, playerId: player.id, text });
        }
        break;
      }

      case 'toggle_pvp': {
        if (clientId === this.hostClientId) {
          this.pvp = !this.pvp;
          this.broadcast({ type: 'room_config', pvp: this.pvp });
          this.broadcastChat('系统', this.pvp ? '⚔️ 房主已开启 PvP 对抗模式！' : '🛡️ 房主已切换为纯合作模式！', '#ff9642');
          this.onSummaryChange?.();
        }
        break;
      }

      case 'save_world': {
        if (clientId === this.hostClientId) {
          const savedId = this.saveNow();
          this.broadcastChat('系统', `💾 世界已存档（${savedId}）！随时可在大厅读取继续游玩。`, '#78e0a8');
        }
        break;
      }

      default:
        break;
    }
  }

  broadcast(packet) {
    const raw = JSON.stringify(packet);
    for (const c of this.clients.values()) {
      c.send(raw);
    }
  }

  broadcastChat(sender, text, color = '#f5ebd6') {
    this.broadcast({
      type: 'chat',
      sender,
      text,
      color,
      time: Date.now(),
    });
  }

  broadcastBanner(text, tone = 'warning') {
    this.broadcast({
      type: 'banner',
      text,
      tone,
    });
  }

  _pushFx(fx) {
    this.fxEvents.push(fx);
  }

  // ==================== 主游戏循环 (20 TPS) ====================
  _tick(dt) {
    if (this.closed) return;
    this.tickCount++;

    // 空房间保留120秒后自动存档回收，防止局域网误刷网页丢房间
    if (this.players.size === 0) {
      this.emptySeconds += dt;
      if (this.emptySeconds >= 120) {
        this.saveNow();
        this.destroy();
      }
      return;
    }

    const prevInfo = this.getDayInfo();
    this.worldTime += dt;
    const dayInfo = this.getDayInfo();

    // 跨天与季节切换播报
    if (dayInfo.day > prevInfo.day) {
      this.broadcastBanner(`🌅 第 ${dayInfo.day} 天破晓 · ${dayInfo.seasonName} (${dayInfo.dayInSeason}/${SEASON_LENGTH})`, 'info');
      for (const p of this.players.values()) {
        if (!p.isGhost && p.charId === 'wilson') {
          p.beardDays = Math.min(16, (p.beardDays || 0) + 1);
        }
      }
      this.onSummaryChange?.();
    }
    if (dayInfo.phase !== prevInfo.phase) {
      if (dayInfo.phase === PHASES.DUSK) {
        this.broadcastBanner('🌆 黄昏降临，阴影蠢蠢欲动，准备生火吧！', 'dusk');
      } else if (dayInfo.phase === PHASES.NIGHT) {
        if (dayInfo.isFullMoon) {
          this.broadcastBanner('🌕 满月之夜！银色月光照亮大地，小心狂暴的生物！', 'moon');
        } else {
          this.broadcastBanner('🌑 漫漫黑夜！千万不要离开火光，查理在黑暗中潜伏！', 'danger');
        }
      }
    }

    // 天气（降雨/降雪）动态切换
    this._updateWeather(dt, dayInfo);

    // 周期猎犬袭击与冬季巨鹿 Boss 事件
    this._updateWorldEvents(dt, dayInfo);

    // 更新世界静态实体（营火燃烧、植物再生、烹饪锅倒计时、陷阱检测）
    this._updateEntities(dt, dayInfo);

    // 更新所有玩家移动、交互、战斗、三维、温度与黑夜查理检测
    for (const p of this.players.values()) {
      this._updatePlayer(p, dt, dayInfo);
    }

    // 更新所有生物 AI 与战斗结算
    this._updateMobs(dt, dayInfo);

    // 更新远程飞行弹体（吹箭、回旋镖、发条主教闪电球）
    this._updateProjectiles(dt);

    // 更新团队战争迷雾探索区块
    this._updateTeamExploration();

    // 定时自动存档（每 180 秒一次）
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 180) {
      this.autoSaveTimer = 0;
      this.saveNow();
    }

    // 推送 20Hz AOI 视野状态包给每个客户端
    this._sendSnapshots(dayInfo);
    this.fxEvents.length = 0;
    this.newlyExplored.length = 0;
  }

  _updateWeather(dt, dayInfo) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const cfg = SEASONS[dayInfo.season];
      this.isRaining = Math.random() < cfg.rainChance;
      this.weatherTimer = this.isRaining ? (35 + Math.random() * 45) : (55 + Math.random() * 65);
      if (this.isRaining) {
        const msg = dayInfo.season === 'winter'
          ? '❄️ 寒风暴雪飘落，注意篝火与保暖！'
          : '🌧️ 天空下起了雨，注意打伞防潮！';
        this.broadcastBanner(msg, 'info');
      }
    }
  }

  _updateWorldEvents(dt, dayInfo) {
    const alivePlayers = [...this.players.values()].filter((p) => !p.isGhost);
    if (alivePlayers.length === 0) return;

    // 1. 猎犬波次
    if (!this.houndWarned && this.worldTime >= this.nextHoundTime - 24) {
      this.houndWarned = true;
      this.broadcastBanner('🐺 远处传来猎犬群刺耳的嚎叫声！24秒后袭来！', 'danger');
      this._pushFx({ kind: 'sfx_global', sfx: 'hound_warn' });
    }
    if (this.worldTime >= this.nextHoundTime) {
      this.houndWarned = false;
      this.nextHoundTime = this.worldTime + DAY_DURATION * (3.6 + Math.random() * 0.8);
      const waveCount = Math.min(9, 2 + Math.floor(dayInfo.day / 4) + alivePlayers.length);
      this.broadcastBanner(`🐺 猎犬群（${waveCount}只）发动突袭！`, 'danger');
      this._pushFx({ kind: 'sfx_global', sfx: 'hound_attack' });

      for (let i = 0; i < waveCount; i++) {
        const target = alivePlayers[i % alivePlayers.length];
        const ang = Math.random() * Math.PI * 2;
        const sx = clamp(target.x + Math.cos(ang) * 440, -WORLD_HALF + 80, WORLD_HALF - 80);
        const sy = clamp(target.y + Math.sin(ang) * 440, -WORLD_HALF + 80, WORLD_HALF - 80);
        let hType = 'hound';
        if ((dayInfo.season === 'summer' || dayInfo.season === 'autumn') && dayInfo.day >= 7 && Math.random() < 0.35) {
          hType = 'fire_hound';
        } else if ((dayInfo.season === 'winter' || dayInfo.season === 'spring') && dayInfo.day >= 6 && Math.random() < 0.4) {
          hType = 'ice_hound';
        }
        this._spawnMob(hType, sx, sy, { targetId: target.id, state: 'chase' });
      }
    }

    // 2. 冬季第3天夜晚自动触发独眼巨鹿来袭（每季最多1次）
    const winterKey = `year_${Math.floor((dayInfo.day - 1) / 20)}`;
    if (
      dayInfo.season === 'winter' &&
      dayInfo.dayInSeason >= 3 &&
      dayInfo.phase === PHASES.DUSK &&
      !this.deerclopsSpawnedSeasons[winterKey] &&
      this.pendingBossTimer <= 0
    ) {
      this.deerclopsSpawnedSeasons[winterKey] = true;
      this.pendingBossTimer = 18;
      this.broadcastBanner('❄️ 大地在剧烈颤抖……巨型独眼巨鹿即将降临！！', 'danger');
      this._pushFx({ kind: 'sfx_global', sfx: 'boss_roar' });
    }

    if (this.pendingBossTimer > 0) {
      this.pendingBossTimer -= dt;
      if (this.pendingBossTimer <= 0) {
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const ang = Math.random() * Math.PI * 2;
        const bx = clamp(target.x + Math.cos(ang) * 520, -WORLD_HALF + 120, WORLD_HALF - 120);
        const by = clamp(target.y + Math.sin(ang) * 520, -WORLD_HALF + 120, WORLD_HALF - 120);
        const boss = this._spawnMob('deerclops', bx, by, { targetId: target.id, state: 'chase' });
        if (boss) {
          // 多人血量弹性微调
          const mult = 1 + Math.max(0, alivePlayers.length - 1) * 0.35;
          boss.maxHp = Math.round(boss.maxHp * mult);
          boss.hp = boss.maxHp;
        }
        this.broadcastBanner('👁️ 【冬季霸主·独眼巨鹿】已现身！保护营地建筑！', 'danger');
        this._pushFx({ kind: 'shake', power: 14 });
      }
    }
  }

  _updateEntities(dt, dayInfo) {
    const springGrowthMult = dayInfo.season === 'spring' ? 1.5 : (dayInfo.season === 'winter' ? 0.45 : 1.0);

    for (const [id, ent] of this.entities.entries()) {
      const def = ENTITY_DEFS[ent.type];
      if (!def) continue;

      // 营火与火坑燃料消耗
      if (def.isFire && ent.fuel > 0) {
        const rainPenalty = this.isRaining && dayInfo.season !== 'winter' ? 1.35 : 1.0;
        const rate = def.isTempFire ? 1.0 : 0.78;
        ent.fuel = Math.max(0, ent.fuel - dt * rate * rainPenalty);
        if (ent.fuel <= 0 && def.isTempFire) {
          this._spawnGroundItem('ash', 1, ent.x, ent.y);
          this.entities.delete(id);
          continue;
        }
      }

      // 树苗长大为大树
      if (def.growInto) {
        ent.growElapsed = (ent.growElapsed || 0) + dt * springGrowthMult;
        if (ent.growElapsed >= def.growTime) {
          const grownDef = ENTITY_DEFS[def.growInto];
          ent.type = def.growInto;
          ent.radius = grownDef.radius;
          ent.hitsLeft = grownDef.workHits;
          delete ent.growElapsed;
          this._pushFx({ kind: 'pop', x: ent.x, y: ent.y, color: '#78e0a8' });
        }
      }

      // 可采集植物自然再生
      if (!ent.ready && ent.regrowAt > 0 && this.worldTime >= ent.regrowAt) {
        ent.ready = true;
        ent.regrowAt = 0;
      }

      // 高脚鸟巢自动产蛋与补充高脚鸟
      if (ent.type === 'tallbird_nest') {
        if (!ent.hasEgg) {
          ent.eggTimer = (ent.eggTimer || 0) + dt;
          if (ent.eggTimer >= 260) {
            ent.hasEgg = true;
            ent.eggTimer = 0;
          }
        }
      }

      // 兔子洞与猪房、蜘蛛巢定时补充生物
      if (ent.type === 'rabbit_hole' || ent.type === 'pig_house' || ent.type === 'spider_den') {
        ent.spawnTimer = (ent.spawnTimer || 0) + dt;
        const interval = ent.type === 'rabbit_hole' ? 140 : (ent.type === 'pig_house' ? 220 : 125);
        if (ent.spawnTimer >= interval) {
          ent.spawnTimer = 0;
          const existing = [...this.mobs.values()].filter((m) => m.homeEntityId === ent.id);
          const cap = ent.type === 'spider_den' ? (ent.tier || 1) + 1 : 1;
          if (existing.length < cap) {
            const mobType = ent.type === 'rabbit_hole' ? 'rabbit' : (ent.type === 'pig_house' ? 'pigman' : 'spider');
            this._spawnMob(mobType, ent.x + 26, ent.y + 22, { homeEntityId: ent.id, homeX: ent.x, homeY: ent.y });
          }
        }
      }

      // 烹饪锅计时
      if (def.isCrockPot && ent.cooking) {
        ent.cookTimer -= dt;
        if (ent.cookTimer <= 0) {
          ent.cooking = false;
          ent.cookTimer = 0;
          ent.resultItem = ent.pendingResult || 'wet_goop';
          ent.pendingResult = null;
          this._pushFx({ kind: 'cook_done', x: ent.x, y: ent.y });
        }
      }

      // 燃烧中的树木或灌木结算（烧完转化为焦黑木炭树或灰烬！）
      if (ent.burning && ent.burning > 0) {
        const burnDecay = this.isRaining && dayInfo.season !== 'winter' ? 2.2 : 1.0;
        ent.burning -= dt * burnDecay;
        if (ent.burning <= 0) {
          delete ent.burning;
          if (ent.type === 'pine_tree' || ent.type === 'birch_tree' || ent.type === 'spiky_tree') {
            ent.type = 'burnt_tree';
            ent.radius = 16;
            ent.hitsLeft = 1;
          } else {
            this._spawnGroundItem('ash', 1, ent.x, ent.y);
            this.entities.delete(id);
          }
          continue;
        }
      }

      // 晾肉架风干倒计时（雨天暂停风干）
      if (def.isDryingRack && ent.dryingItem && !ent.driedItem) {
        if (!this.isRaining || dayInfo.season === 'winter') {
          ent.dryTimer = (ent.dryTimer || 0) - dt;
          if (ent.dryTimer <= 0) {
            ent.driedItem = ent.dryResult || 'jerky';
            ent.dryingItem = null;
            ent.dryTimer = 0;
            this._pushFx({ kind: 'cook_done', x: ent.x, y: ent.y });
          }
        }
      }

      // 犬牙陷阱检测敌对生物踩踏
      if (def.isToothTrap && !ent.sprung) {
        for (const mob of this.mobs.values()) {
          if (mob.type === 'rabbit' || mob.type === 'abigail') continue;
          if (mob.type === 'pigman' && mob.leaderId) continue;
          if (Math.hypot(mob.x - ent.x, mob.y - ent.y) < 28) {
            ent.sprung = true;
            ent.durability = Math.max(0, (ent.durability ?? 10) - 1);
            this._pushFx({ kind: 'trap_snap', x: ent.x, y: ent.y });
            this._damageMob(mob, 60, null);
            if (ent.durability <= 0) {
              this.entities.delete(id);
            }
            break;
          }
        }
      }

      // 捕兽草笼检测周围小型生物
      if (def.isTrap && !ent.caughtItem) {
        for (const [mId, mob] of this.mobs.entries()) {
          const mDef = MOB_DEFS[mob.type];
          if (mDef?.trappable && Math.hypot(mob.x - ent.x, mob.y - ent.y) < 26) {
            ent.caughtItem = mob.type === 'rabbit' ? 'morsel' : 'monster_meat';
            ent.durability = Math.max(0, (ent.durability ?? 8) - 1);
            this.mobs.delete(mId);
            this._pushFx({ kind: 'trap_snap', x: ent.x, y: ent.y });
            break;
          }
        }
      }
    }
  }

  // 计算坐标点的光照强度 (0.0 ~ 1.0)
  getLightAt(x, y, dayInfo) {
    if (dayInfo.phase === PHASES.DAY) return 1.0;
    if (dayInfo.phase === PHASES.DUSK) return 0.55;
    if (dayInfo.isFullMoon) return 0.65;

    let maxLight = 0;
    // 1. 建筑、燃烧物、流萤与地标光源
    for (const ent of this.entities.values()) {
      const def = ENTITY_DEFS[ent.type];
      if (!def) continue;
      let r = def.lightRadius || def.nightLightRadius || 0;
      if (ent.burning && ent.burning > 0) {
        r = Math.max(r, 200);
      } else if (def.isFire && ent.fuel > 0) {
        const ratio = clamp(ent.fuel / def.maxFuel, 0.15, 1);
        r = 125 + ratio * 185;
      }
      if (r > 0) {
        const d = Math.hypot(ent.x - x, ent.y - y);
        if (d < r) {
          maxLight = Math.max(maxLight, 1 - (d / r) * 0.85);
        }
      }
    }

    // 2. 玩家手持火把/打火机/提灯、矿工头灯或鬼魂微光
    for (const p of this.players.values()) {
      let pr = p.isGhost ? 68 : 0;
      if (!p.isGhost) {
        const hand = p.equip[EQUIP_SLOTS.HAND];
        const head = p.equip[EQUIP_SLOTS.HEAD];
        if (hand && ITEMS[hand.id]?.lightRadius && (hand.durability === null || hand.durability > 0)) {
          pr = Math.max(pr, ITEMS[hand.id].lightRadius);
        }
        if (head && ITEMS[head.id]?.lightRadius && (head.durability === null || head.durability > 0)) {
          pr = Math.max(pr, ITEMS[head.id].lightRadius);
        }
      }
      if (pr > 0) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < pr) maxLight = Math.max(maxLight, 1 - (d / pr) * 0.85);
      }
    }

    // 3. 丢在地上的亮着的炼金提灯
    for (const gi of this.groundItems.values()) {
      if (gi.itemId === 'lantern' && (gi.durability === null || gi.durability > 0)) {
        const d = Math.hypot(gi.x - x, gi.y - y);
        if (d < 245) maxLight = Math.max(maxLight, 1 - (d / 245) * 0.85);
      }
    }

    // 4. 阿比盖尔幽灵微光
    for (const m of this.mobs.values()) {
      const mDef = MOB_DEFS[m.type];
      if (mDef?.lightRadius) {
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < mDef.lightRadius) maxLight = Math.max(maxLight, 0.7);
      }
    }

    return maxLight;
  }

  _updatePlayer(p, dt, dayInfo) {
    p.actionCooldown = Math.max(0, p.actionCooldown - dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    p.swingAnim = Math.max(0, (p.swingAnim || 0) - dt);
    p.hurtAnim = Math.max(0, (p.hurtAnim || 0) - dt);

    // 校验打开的储物箱/烹饪锅距离
    if (p.openContainerId) {
      const cont = this.entities.get(p.openContainerId);
      if (!cont || Math.hypot(cont.x - p.x, cont.y - p.y) > INTERACT_RANGE + 55) {
        p.openContainerId = null;
      }
    }

    // 计算移动方向与自动寻路目标
    let vx = p.moveX;
    let vy = p.moveY;

    if (vx === 0 && vy === 0) {
      if (p.interactTargetId) {
        this._stepPlayerInteractTarget(p);
      } else if (p.attackTargetId) {
        this._stepPlayerAttackTarget(p);
      } else if (p.walkTarget) {
        const dx = p.walkTarget.x - p.x;
        const dy = p.walkTarget.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) {
          p.walkTarget = null;
        } else {
          vx = dx / d;
          vy = dy / d;
          p.facing = dx >= 0 ? 1 : -1;
        }
      }
    }

    if (vx !== 0 || vy !== 0) {
      const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;
      let speed = 178 * (charDef.speedMult || 1.0);
      if (p.isGhost) {
        speed *= 1.12;
      } else {
        const hand = p.equip[EQUIP_SLOTS.HAND];
        if (hand && ITEMS[hand.id]?.speedBonus) {
          speed *= 1 + ITEMS[hand.id].speedBonus;
        }
        if (distToRoads(p.x, p.y, this.roads) < 38) {
          speed *= 1.28; // 鹅卵石大道加速
        }
      }

      p.x = clamp(p.x + vx * speed * dt, -WORLD_HALF + 32, WORLD_HALF - 32);
      p.y = clamp(p.y + vy * speed * dt, -WORLD_HALF + 32, WORLD_HALF - 32);

      if (!p.isGhost) {
        this._resolveSolidCollisions(p, 16);
      }
    }

    // 若为鬼魂状态，不结算饥饿/温度/查理，但可作祟试金石等
    if (p.isGhost) {
      return;
    }

    const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;

    // 1. 装备自然损耗（火把、提灯、头灯、服装）
    for (const slot of Object.values(EQUIP_SLOTS)) {
      const eq = p.equip[slot];
      if (!eq) continue;
      const itemDef = ITEMS[eq.id];
      if (!itemDef || eq.durability === null || eq.durability === undefined) continue;

      let drain = 0;
      if (itemDef.burnRate) drain = itemDef.burnRate * dt;
      else if (itemDef.wearRate) drain = itemDef.wearRate * dt;

      if (drain > 0) {
        eq.durability = Math.max(0, eq.durability - drain);
        if (eq.durability <= 0 && !itemDef.refuelable) {
          p.equip[slot] = null;
          this.clients.get(p.id)?.send({ type: 'toast', text: `⚠️ 你的【${itemDef.name}】已耗尽损坏！` });
        }
      }
    }
    // 地面提灯耐久消耗
    // (已在照明使用，统一轻度消耗)

    // 2. 潮湿度与防雨计算
    let rainProt = 0;
    for (const slot of Object.values(EQUIP_SLOTS)) {
      const eq = p.equip[slot];
      if (eq && ITEMS[eq.id]?.rainProtect) {
        rainProt = Math.min(1, rainProt + ITEMS[eq.id].rainProtect);
      }
    }
    if (this.isRaining && dayInfo.season !== 'winter') {
      p.moisture = clamp(p.moisture + (1 - rainProt) * 1.6 * dt, 0, 100);
      if (charDef.gearUpgrade && rainProt < 0.8 && p.moisture > 35 && this.tickCount % 60 === 0) {
        // WX-78 潮湿漏电微损
        this._damagePlayer(p, 2, '淋雨短路', true);
      }
    } else {
      // 靠近营火快速烘干
      let nearWarmFire = false;
      for (const ent of this.entities.values()) {
        if (ENTITY_DEFS[ent.type]?.isFire && !ENTITY_DEFS[ent.type]?.isColdFire && ent.fuel > 0) {
          if (Math.hypot(ent.x - p.x, ent.y - p.y) < 180) nearWarmFire = true;
        }
      }
      p.moisture = clamp(p.moisture - (nearWarmFire ? 4.5 : 1.2) * dt, 0, 100);
    }

    // 3. 体温与四季冷热模拟（含保暖石蓄热蓄冷！）
    this._updatePlayerTemperature(p, dt, dayInfo, charDef);

    // 4. 饥饿消耗
    const hungerPerSec = (9.5 / 60) * (charDef.hungerDrainMult || 1.0);
    p.hunger = Math.max(0, p.hunger - hungerPerSec * dt);
    if (p.hunger <= 0) {
      this._damagePlayer(p, 1.4 * dt, '饥饿', true);
    }

    // 5. 光照、黑夜查理袭击与理智变化
    const light = this.getLightAt(p.x, p.y, dayInfo);
    p.inDarkness = dayInfo.phase === PHASES.NIGHT && !dayInfo.isFullMoon && light <= 0.05;

    if (p.inDarkness) {
      p.darkTimer += dt;
      if (p.darkTimer >= 2.6 && p.darkTimer - dt < 2.6) {
        this.clients.get(p.id)?.send({ type: 'toast', text: '👁️ 黑暗中有什么东西靠近了！快点燃火把或靠近营火！' });
        this._pushFx({ kind: 'charlie_warn', x: p.x, y: p.y, playerId: p.id });
      }
      if (p.darkTimer >= 4.8) {
        p.darkTimer = 1.1; // 每3.7秒再次袭击
        p.sanity = Math.max(0, p.sanity - 18);
        this._pushFx({ kind: 'charlie_hit', x: p.x, y: p.y, playerId: p.id });
        this._damagePlayer(p, 58, '黑夜查理', false);
        if (p.isGhost) return;
      }
    } else {
      p.darkTimer = Math.max(0, p.darkTimer - dt * 2.5);
    }

    // 理智速率汇总（每分钟换算为每秒）
    let sanityPerMin = 0;
    if (dayInfo.phase === PHASES.DUSK) sanityPerMin -= 3.0 * charDef.sanityDrainMult;
    else if (dayInfo.phase === PHASES.NIGHT) {
      sanityPerMin -= (p.inDarkness ? 36.0 : 5.5) * charDef.sanityDrainMult;
    }
    if (p.moisture > 30) {
      sanityPerMin -= (p.moisture - 30) * 0.12;
    }

    // 装备理智光环
    for (const slot of Object.values(EQUIP_SLOTS)) {
      const eq = p.equip[slot];
      if (eq && ITEMS[eq.id]?.sanityAura) {
        sanityPerMin += ITEMS[eq.id].sanityAura;
      }
    }

    // 薇洛靠近营火回理智
    if (charDef.fireSanityAura) {
      for (const ent of this.entities.values()) {
        if (ENTITY_DEFS[ent.type]?.isFire && !ENTITY_DEFS[ent.type]?.isColdFire && ent.fuel > 0) {
          if (Math.hypot(ent.x - p.x, ent.y - p.y) < 190) {
            sanityPerMin += charDef.fireSanityAura;
            break;
          }
        }
      }
    }

    // 附近怪物恐吓光环
    for (const mob of this.mobs.values()) {
      const mDef = MOB_DEFS[mob.type];
      if (mDef?.sanityAura && Math.hypot(mob.x - p.x, mob.y - p.y) < 210) {
        sanityPerMin += mDef.sanityAura * charDef.sanityDrainMult;
      }
    }

    // 鬼魂队友轻微悲伤光环
    for (const other of this.players.values()) {
      if (other.id !== p.id && other.isGhost) {
        sanityPerMin -= 2.5;
      }
    }

    p.sanity = clamp(p.sanity + (sanityPerMin / 60) * dt, 0, p.maxSanity);

    // 低理智刷新暗影梦魇怪（< 32% 理智）
    if (p.sanity / p.maxSanity < 0.32) {
      p.shadowTimer = (p.shadowTimer || 0) + dt;
      if (p.shadowTimer >= 34) {
        p.shadowTimer = 0;
        const nearbyShadows = [...this.mobs.values()].filter(
          (m) => MOB_DEFS[m.type]?.isShadow && Math.hypot(m.x - p.x, m.y - p.y) < 550
        );
        if (nearbyShadows.length < 2) {
          const sType = p.sanity / p.maxSanity < 0.16 ? 'shadow_beak' : 'shadow_crawler';
          const ang = Math.random() * Math.PI * 2;
          this._spawnMob(sType, p.x + Math.cos(ang) * 260, p.y + Math.sin(ang) * 260, {
            targetId: p.id,
            state: 'chase',
          });
          this._pushFx({ kind: 'shadow_spawn', x: p.x, y: p.y, playerId: p.id });
        }
      }
    }
  }

  _updatePlayerTemperature(p, dt, dayInfo, charDef) {
    let fireInfluence = 0; // 正为升温火，负为吸热冷火
    for (const ent of this.entities.values()) {
      const def = ENTITY_DEFS[ent.type];
      if (ent.burning && ent.burning > 0) {
        const d = Math.hypot(ent.x - p.x, ent.y - p.y);
        if (d < 210) fireInfluence += 34 * (1 - d / 210) * 1.3;
      } else if (def?.isFire && ent.fuel > 0) {
        const d = Math.hypot(ent.x - p.x, ent.y - p.y);
        if (d < 220) {
          const factor = 1 - d / 220;
          fireInfluence += def.heatOutput * factor * 1.4;
        }
      }
    }

    // 更新背包中保暖石温度
    let stoneEffect = 0;
    for (const it of p.inventory) {
      if (it && it.id === 'thermal_stone') {
        if (!it.extra) it.extra = { temp: 25 };
        const stTarget = fireInfluence !== 0
          ? clamp(25 + fireInfluence * 0.95, -12, 60)
          : dayInfo.ambientTemp;
        const stRate = fireInfluence !== 0 ? 0.25 : 0.02;
        it.extra.temp += (stTarget - it.extra.temp) * stRate * dt;
        stoneEffect = (it.extra.temp - 25) * 0.55;
      }
    }

    // 计算服装保暖与隔热系数
    let winterWarmth = p.charId === 'wilson' ? Math.min(10, (p.beardDays || 0) * 0.8) : 0;
    let summerCool = 0;
    for (const slot of Object.values(EQUIP_SLOTS)) {
      const eq = p.equip[slot];
      if (!eq) continue;
      const def = ITEMS[eq.id];
      if (def?.winterWarmth) winterWarmth += def.winterWarmth;
      if (def?.summerCool) summerCool += def.summerCool;
      if (def?.warmth) winterWarmth += def.warmth;
    }

    let targetTemp = dayInfo.ambientTemp - p.moisture * 0.08 + fireInfluence + stoneEffect;
    if (targetTemp < 20) {
      targetTemp = Math.min(24, targetTemp + winterWarmth);
    } else if (targetTemp > 28) {
      targetTemp = Math.max(25, targetTemp - summerCool);
    }

    const changeSpeed = fireInfluence !== 0 ? 0.28 : 0.065;
    p.bodyTemp = clamp(p.bodyTemp + (targetTemp - p.bodyTemp) * changeSpeed * dt, -15, 82);

    if (p.bodyTemp < TEMP_FREEZING) {
      this._damagePlayer(p, 2.0 * dt, '严寒冻伤', true);
    } else if (p.bodyTemp > TEMP_OVERHEAT) {
      const dmg = charDef.fireImmune ? 0.8 * dt : 2.0 * dt;
      this._damagePlayer(p, dmg, '酷暑中暑', true);
    }
  }

  _resolveSolidCollisions(entity, radius) {
    for (const obs of this.entities.values()) {
      const def = ENTITY_DEFS[obs.type];
      if (!def?.solid) continue;
      const minD = radius + (obs.radius || 20);
      const dx = entity.x - obs.x;
      const dy = entity.y - obs.y;
      const d = Math.hypot(dx, dy);
      if (d < minD && d > 0.001) {
        const push = minD - d;
        entity.x += (dx / d) * push;
        entity.y += (dy / d) * push;
      }
    }
  }

  // ==================== 交互、采集、砍树、挖矿与战斗 ====================
  _assignNearestGatherTarget(p) {
    if (p.isGhost) {
      // 鬼魂按空格自动寻找最近的试金石、重生护符或绚丽之门复活！
      let bestId = null;
      let bestD = 320;
      for (const ent of this.entities.values()) {
        if (ent.type === 'touch_stone' || (ent.type === 'portal' && this.difficulty !== 'hardcore')) {
          const d = Math.hypot(ent.x - p.x, ent.y - p.y);
          if (d < bestD) { bestD = d; bestId = ent.id; }
        }
      }
      for (const gi of this.groundItems.values()) {
        if (gi.itemId === 'life_amulet') {
          const d = Math.hypot(gi.x - p.x, gi.y - p.y);
          if (d < bestD) { bestD = d; bestId = gi.id; }
        }
      }
      if (bestId) p.interactTargetId = bestId;
      return;
    }

    let bestId = null;
    let bestDist = 260;

    // 优先捡身边掉落物
    for (const gi of this.groundItems.values()) {
      const d = Math.hypot(gi.x - p.x, gi.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = gi.id;
      }
    }
    if (bestId && bestDist < 120) {
      p.interactTargetId = bestId;
      return;
    }

    const handId = p.equip[EQUIP_SLOTS.HAND]?.id;
    const handDef = handId ? ITEMS[handId] : null;

    for (const ent of this.entities.values()) {
      const def = ENTITY_DEFS[ent.type];
      if (!def) continue;
      const d = Math.hypot(ent.x - p.x, ent.y - p.y);
      if (d >= bestDist) continue;

      let canAct = false;
      if (def.category === 'pickable' && ent.ready) canAct = true;
      else if (ent.type === 'tallbird_nest' && ent.hasEgg) canAct = true;
      else if (def.isTrap && ent.caughtItem) canAct = true;
      else if (def.isToothTrap && ent.sprung) canAct = true;
      else if (def.isCrockPot && ent.resultItem) canAct = true;
      else if (def.isDryingRack && ent.driedItem) canAct = true;
      else if (def.workType === 'chop' && handDef?.chopPower) canAct = true;
      else if (def.workType === 'mine' && handDef?.minePower) canAct = true;
      else if (def.workType === 'dig' && handDef?.digPower) canAct = true;
      else if (def.workType === 'net' && handDef?.netPower) canAct = true;

      if (canAct) {
        bestDist = d;
        bestId = ent.id;
      }
    }

    if (bestId) {
      p.interactTargetId = bestId;
      p.altInteract = false;
    }
  }

  _assignNearestAttackTarget(p) {
    if (p.isGhost) return;
    let bestId = null;
    let bestDist = 300;
    for (const mob of this.mobs.values()) {
      if (mob.type === 'abigail') continue;
      if (mob.type === 'pigman' && mob.leaderId === p.id) continue;
      const mDef = MOB_DEFS[mob.type];
      if (mDef?.isShadow && p.sanity / p.maxSanity > 0.55) continue;
      const d = Math.hypot(mob.x - p.x, mob.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = mob.id;
      }
    }
    if (!bestId && this.pvp) {
      for (const other of this.players.values()) {
        if (other.id !== p.id && !other.isGhost) {
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < bestDist) {
            bestDist = d;
            bestId = other.id;
          }
        }
      }
    }
    if (bestId) p.attackTargetId = bestId;
  }

  _stepPlayerInteractTarget(p) {
    const tid = p.interactTargetId;

    // 1. 地面物品拾取（或鬼魂作祟重生护符）
    if (this.groundItems.has(tid)) {
      const gi = this.groundItems.get(tid);
      const d = Math.hypot(gi.x - p.x, gi.y - p.y);
      if (d > 54) {
        this._moveToward(p, gi.x, gi.y);
        return;
      }
      if (p.isGhost) {
        if (gi.itemId === 'life_amulet') {
          this.groundItems.delete(tid);
          this._revivePlayer(p, '重生护符');
        }
        p.interactTargetId = null;
        return;
      }
      const leftover = this._addItemToPlayer(p, gi.itemId, gi.count, gi.durability, gi.extra, false);
      if (leftover <= 0) {
        this.groundItems.delete(tid);
        this._pushFx({ kind: 'pickup', x: gi.x, y: gi.y, playerId: p.id });
      } else {
        gi.count = leftover;
        this.clients.get(p.id)?.send({ type: 'toast', text: '🎒 背包已满！' });
      }
      p.interactTargetId = null;
      return;
    }

    // 2. 猪人投喂互动
    if (this.mobs.has(tid)) {
      const mob = this.mobs.get(tid);
      if (mob.type === 'pigman' && !p.isGhost) {
        const d = Math.hypot(mob.x - p.x, mob.y - p.y);
        if (d > 75) {
          this._moveToward(p, mob.x, mob.y);
          return;
        }
        this._feedPigman(p, mob);
      }
      p.interactTargetId = null;
      return;
    }

    // 3. 世界实体交互
    const ent = this.entities.get(tid);
    if (!ent) {
      p.interactTargetId = null;
      return;
    }
    const def = ENTITY_DEFS[ent.type];
    const d = Math.hypot(ent.x - p.x, ent.y - p.y);
    const reach = (ent.radius || 20) + 52;
    if (d > reach) {
      this._moveToward(p, ent.x, ent.y);
      return;
    }

    p.facing = ent.x >= p.x ? 1 : -1;

    // 鬼魂交互复活判定
    if (p.isGhost) {
      if (ent.type === 'touch_stone') {
        ent.usedBy = ent.usedBy || [];
        if (ent.usedBy.includes(p.playerKey)) {
          this.clients.get(p.id)?.send({ type: 'toast', text: '⚡ 这座试金石你已经使用过了，寻找其他试金石吧！' });
        } else {
          ent.usedBy.push(p.playerKey);
          this._spawnGroundItem('pig_skin', 2, ent.x, ent.y + 30);
          this._revivePlayer(p, '远古试金石');
        }
      } else if (ent.type === 'portal') {
        if (this.difficulty === 'hardcore') {
          this.clients.get(p.id)?.send({ type: 'toast', text: '💀 硬核模式下无法通过绚丽之门复活！请使用试金石或救赎之心！' });
        } else if (this.worldTime - (p.ghostSince || 0) < 12) {
          const wait = Math.ceil(12 - (this.worldTime - (p.ghostSince || 0)));
          this.clients.get(p.id)?.send({ type: 'toast', text: `⏳ 灵魂凝聚中，还需 ${wait} 秒可通过绚丽之门重生` });
        } else {
          this._revivePlayer(p, '绚丽之门', 0.55);
        }
      }
      p.interactTargetId = null;
      return;
    }

    if (p.actionCooldown > 0) return;

    // 进阶交互（Ctrl+左键：铁锤拆建返料、铁铲移植果苗、火把引燃烧炭！）
    if (p.altInteract) {
      p.altInteract = false;
      p.interactTargetId = null;
      const hand = p.equip[EQUIP_SLOTS.HAND];
      const handDef = hand ? ITEMS[hand.id] : null;

      // 1) 大铁锤拆毁建筑或猪人房
      if (handDef?.hammerPower && (def.category === 'structure' || ent.type === 'pig_house' || ent.type === 'skeleton')) {
        p.actionCooldown = 0.45;
        p.swingAnim = 0.32;
        this._consumeHandToolDurability(p, 1);
        this._pushFx({ kind: 'mine', x: ent.x, y: ent.y });

        if (ent.type === 'pig_house') {
          this._spawnGroundItem('boards', 2, ent.x, ent.y);
          this._spawnGroundItem('cut_stone', 1, ent.x + 14, ent.y);
          this._spawnGroundItem('pig_skin', 2, ent.x - 14, ent.y + 8);
        } else if (ent.type === 'skeleton') {
          this._spawnGroundItem('rocks', 2, ent.x, ent.y);
        } else {
          // 返还建筑配方 50%（向上取整）材料，且掉出容器内物品！
          const matchedRecipe = RECIPES.find((r) => r.structure === ent.type);
          if (matchedRecipe) {
            for (const c of matchedRecipe.cost) {
              const refund = Math.max(1, Math.ceil(c.count * 0.5));
              this._spawnGroundItem(c.id, refund, ent.x + (Math.random() - 0.5) * 24, ent.y + (Math.random() - 0.5) * 24);
            }
          }
          if (ent.slots) {
            for (const s of ent.slots) {
              if (s) this._spawnGroundItem(s.id, s.count, ent.x, ent.y, s.durability, s.extra);
            }
          }
          if (ent.driedItem) this._spawnGroundItem(ent.driedItem, 1, ent.x, ent.y);
          if (ent.resultItem) this._spawnGroundItem(ent.resultItem, 1, ent.x, ent.y);
        }
        this.entities.delete(ent.id);
        return;
      }

      // 2) 铁铲连根挖起浆果丛/干草丛/树枝苗用于基地移植！
      if (handDef?.digPower && def.transplantItem) {
        p.actionCooldown = 0.42;
        p.swingAnim = 0.30;
        this._consumeHandToolDurability(p, 1);
        if (ent.ready && def.yieldItem) {
          this._spawnGroundItem(def.yieldItem, def.yieldCount || 1, ent.x + 12, ent.y);
        }
        this._spawnGroundItem(def.transplantItem, 1, ent.x, ent.y);
        this.entities.delete(ent.id);
        this._pushFx({ kind: 'dig', x: ent.x, y: ent.y });
        return;
      }

      // 3) 火把/打火机点燃树木烧制木炭！
      if (handDef?.fireWeapon && def.flammable && !ent.burning) {
        p.actionCooldown = 0.4;
        p.swingAnim = 0.28;
        ent.burning = 7.5;
        this._pushFx({ kind: 'fire_burst', x: ent.x, y: ent.y });
        this.clients.get(p.id)?.send({ type: 'toast', text: `🔥 已点燃【${def.name}】，燃尽后可砍伐获取木炭！` });
        return;
      }
    }

    // 猪王换金块
    if (ent.type === 'pig_king') {
      this._tradeWithPigKing(p, ent);
      p.interactTargetId = null;
      return;
    }

    // 晾肉架挂肉与收取肉干
    if (def.isDryingRack) {
      if (ent.driedItem) {
        this._addItemToPlayer(p, ent.driedItem, 1);
        ent.driedItem = null;
        ent.dryResult = null;
        this._pushFx({ kind: 'pickup', x: ent.x, y: ent.y, playerId: p.id });
      } else if (ent.dryingItem) {
        const sec = Math.ceil(ent.dryTimer || 0);
        this.clients.get(p.id)?.send({ type: 'toast', text: `🥩 正在风干【${ITEMS[ent.dryingItem]?.name}】，还需约 ${sec} 秒...` });
      } else {
        const meatIdx = p.inventory.findIndex((it) => it && ITEMS[it.id]?.dryResult);
        if (meatIdx >= 0) {
          const it = p.inventory[meatIdx];
          ent.dryingItem = it.id;
          ent.dryResult = ITEMS[it.id].dryResult;
          ent.dryTimer = 48;
          this._consumeSlotCount(p, meatIdx, 1);
          this._pushFx({ kind: 'rustle', x: ent.x, y: ent.y });
        } else {
          this.clients.get(p.id)?.send({ type: 'toast', text: '🥩 携带生【大肉 / 小肉 / 怪物肉】点击晾肉架即可悬挂风干！' });
        }
      }
      p.interactTargetId = null;
      return;
    }

    // 犬牙陷阱重置或收回
    if (def.isToothTrap) {
      if (ent.sprung) {
        ent.sprung = false;
        this._pushFx({ kind: 'craft', x: ent.x, y: ent.y });
      } else {
        this._addItemToPlayer(p, 'tooth_trap_item', 1, ent.durability ?? 10);
        this.entities.delete(ent.id);
      }
      p.interactTargetId = null;
      return;
    }

    // 储物箱、冰箱、烹饪锅打开面板或收菜
    if (def.isContainer || def.isCrockPot) {
      if (def.isCrockPot && ent.resultItem) {
        this._addItemToPlayer(p, ent.resultItem, 1);
        this._pushFx({ kind: 'pickup', x: ent.x, y: ent.y, playerId: p.id });
        ent.resultItem = null;
        ent.slots = [null, null, null, null];
        p.interactTargetId = null;
        return;
      }
      p.openContainerId = ent.id;
      p.interactTargetId = null;
      return;
    }

    // 营火与火坑：优先烤熟手中/快捷食材或添柴
    if (def.isFire) {
      this._interactFire(p, ent, def);
      p.interactTargetId = null;
      return;
    }

    // 露营帐篷小睡
    if (def.isTent) {
      const info = this.getDayInfo();
      if (info.phase === PHASES.DAY) {
        this.clients.get(p.id)?.send({ type: 'toast', text: '☀️ 大白天太亮了睡不着，黄昏或夜晚再来休息吧！' });
      } else if (p.hunger < 30) {
        this.clients.get(p.id)?.send({ type: 'toast', text: '🍖 肚子太饿无法入睡（需至少 30 饱食度）！' });
      } else {
        p.hunger = Math.max(0, p.hunger - 32);
        p.hp = Math.min(p.maxHp, p.hp + 50);
        p.sanity = Math.min(p.maxSanity, p.sanity + 50);
        p.bodyTemp = clamp(p.bodyTemp + 15, 20, 40);
        ent.uses = (ent.uses ?? 8) - 1;
        this._pushFx({ kind: 'heal', x: p.x, y: p.y, text: '💤 精神焕发！' });
        if (ent.uses <= 0) this.entities.delete(ent.id);
      }
      p.interactTargetId = null;
      return;
    }

    // 捕兽笼收获猎物或回收笼子
    if (def.isTrap) {
      if (ent.caughtItem) {
        this._addItemToPlayer(p, ent.caughtItem, 1);
        ent.caughtItem = null;
        if ((ent.durability ?? 8) <= 0) {
          this.entities.delete(ent.id);
        }
      } else {
        this._addItemToPlayer(p, 'trap', 1, ent.durability ?? 8);
        this.entities.delete(ent.id);
      }
      p.interactTargetId = null;
      return;
    }

    // 高脚鸟巢偷蛋
    if (ent.type === 'tallbird_nest' && ent.hasEgg) {
      ent.hasEgg = false;
      this._addItemToPlayer(p, 'tallbird_egg', 1);
      // 激怒周围高脚鸟！
      for (const mob of this.mobs.values()) {
        if (mob.type === 'tallbird' && Math.hypot(mob.x - ent.x, mob.y - ent.y) < 380) {
          mob.targetId = p.id;
          mob.state = 'chase';
        }
      }
      p.interactTargetId = null;
      return;
    }

    // 徒手采集植物
    if (def.category === 'pickable') {
      if (ent.ready) {
        ent.ready = false;
        ent.regrowAt = this.worldTime + (def.regrowTime || 240);
        this._addItemToPlayer(p, def.yieldItem, def.yieldCount || 1);
        if (def.sanityBonus) {
          p.sanity = Math.min(p.maxSanity, p.sanity + def.sanityBonus);
        }
        p.actionCooldown = 0.35;
        p.swingAnim = 0.25;
        this._pushFx({ kind: 'rustle', x: ent.x, y: ent.y });
      }
      p.interactTargetId = null;
      return;
    }

    // 工具作业（砍树 / 挖矿 / 挖树桩）
    if (def.workType) {
      this._performWorkOnEntity(p, ent, def);
    } else {
      p.interactTargetId = null;
    }
  }

  _consumeHandToolDurability(p, cost = 1) {
    const hand = p.equip[EQUIP_SLOTS.HAND];
    if (!hand) return;
    const handDef = ITEMS[hand.id];
    if (hand.durability !== null && hand.durability !== undefined) {
      hand.durability -= cost;
      if (hand.durability <= 0) {
        p.equip[EQUIP_SLOTS.HAND] = null;
        this.clients.get(p.id)?.send({ type: 'toast', text: `⚠️ 你的【${handDef?.name || '工具'}】用坏了！` });
      }
    }
  }

  _performWorkOnEntity(p, ent, def) {
    const hand = p.equip[EQUIP_SLOTS.HAND];
    const handDef = hand ? ITEMS[hand.id] : null;
    let power = 0;
    if (def.workType === 'chop') power = handDef?.chopPower || 0;
    else if (def.workType === 'mine') power = handDef?.minePower || 0;
    else if (def.workType === 'dig') power = handDef?.digPower || 0;
    else if (def.workType === 'net') power = handDef?.netPower || 0;

    if (power <= 0) {
      const needMap = { chop: '斧头', mine: '鹤嘴锄', dig: '铁铲', net: '捕虫网' };
      this.clients.get(p.id)?.send({ type: 'toast', text: `🛠️ 需要装备【${needMap[def.workType]}】才能作业！` });
      p.interactTargetId = null;
      return;
    }

    // 沃尔夫冈强壮形态加速作业
    if (p.charId === 'wolfgang' && p.hunger > 180) power *= 1.4;

    p.actionCooldown = 0.42;
    p.swingAnim = 0.32;
    ent.hitsLeft -= power;
    this._pushFx({ kind: def.workType === 'net' ? 'rustle' : def.workType, x: ent.x, y: ent.y });

    // 雇佣的猪人小弟帮忙一起砍树！
    if (def.workType === 'chop') {
      for (const mob of this.mobs.values()) {
        if (mob.type === 'pigman' && mob.leaderId === p.id && Math.hypot(mob.x - ent.x, mob.y - ent.y) < 150) {
          ent.hitsLeft -= 0.8;
          mob.facing = ent.x >= mob.x ? 1 : -1;
        }
      }
    }

    this._consumeHandToolDurability(p, 1);

    if (ent.hitsLeft <= 0) {
      this._harvestDestroyedResource(p, ent);
      p.interactTargetId = null;
    }
  }

  _harvestDestroyedResource(p, ent) {
    const { x, y, type } = ent;
    const dayInfo = this.getDayInfo();

    if (type === 'fireflies') {
      this._addItemToPlayer(p, 'fireflies_item', 1);
      this.entities.delete(ent.id);
      this._pushFx({ kind: 'pickup', x, y, playerId: p.id });
      return;
    }
    if (type === 'pine_tree') {
      this._spawnGroundItem('log', 3, x, y);
      this._spawnGroundItem('pinecone', 2, x + 14, y + 8);
      ent.type = 'stump';
      ent.radius = 14;
      ent.hitsLeft = 1;
      // 第3天后砍树有概率唤醒树精守卫！
      if (dayInfo.day >= 3 && Math.random() < 0.08) {
        this._spawnMob('treeguard', x + 38, y - 20, { targetId: p.id, state: 'chase' });
        this.broadcastBanner('🌲 森林的愤怒！一棵常青松树苏醒化作了【树精守卫】！（种植松果可安抚它）', 'danger');
      }
      return;
    }
    if (type === 'birch_tree') {
      this._spawnGroundItem('log', 3, x, y);
      if (dayInfo.season !== 'winter') {
        this._spawnGroundItem('birchnut', 2, x - 12, y + 10);
      }
      ent.type = 'stump';
      ent.radius = 14;
      ent.hitsLeft = 1;
      return;
    }
    if (type === 'spiky_tree') {
      this._spawnGroundItem('log', 1, x, y);
      this._spawnGroundItem('twigs', 2, x + 10, y);
      this.entities.delete(ent.id);
      return;
    }
    if (type === 'burnt_tree') {
      this._spawnGroundItem('charcoal', 2, x, y);
      if (Math.random() < 0.35) this._spawnGroundItem('pinecone', 1, x + 8, y);
      this.entities.delete(ent.id);
      return;
    }
    if (type === 'stump') {
      this._spawnGroundItem('log', 1, x, y);
      this.entities.delete(ent.id);
      return;
    }
    if (type === 'rock_plain') {
      this._spawnGroundItem('rocks', 3, x, y);
      this._spawnGroundItem('flint', 2, x + 12, y);
      this._spawnGroundItem('nitre', 1, x - 12, y + 8);
      this.entities.delete(ent.id);
      return;
    }
    if (type === 'rock_gold') {
      this._spawnGroundItem('rocks', 3, x, y);
      this._spawnGroundItem('gold', 2, x + 12, y - 6);
      this._spawnGroundItem('flint', 1, x - 10, y + 10);
      this.entities.delete(ent.id);
      return;
    }
    if (type === 'ice_glacier') {
      this._spawnGroundItem('ice', 3, x, y);
      this._spawnGroundItem('rocks', 1, x + 10, y);
      this.entities.delete(ent.id);
      return;
    }
    if (type === 'skeleton') {
      this._spawnGroundItem('rocks', 1, x, y);
      this.entities.delete(ent.id);
    }
  }

  _stepPlayerAttackTarget(p) {
    if (p.isGhost) {
      p.attackTargetId = null;
      return;
    }
    const tid = p.attackTargetId;
    let target = this.mobs.get(tid);
    let isPlayerTarget = false;
    let isEntityTarget = false;

    if (!target && this.pvp && this.players.has(tid) && tid !== p.id) {
      const op = this.players.get(tid);
      if (!op.isGhost) {
        target = op;
        isPlayerTarget = true;
      }
    }
    if (!target && this.entities.has(tid)) {
      const ent = this.entities.get(tid);
      const eDef = ENTITY_DEFS[ent.type];
      if (eDef?.category === 'spawner' || eDef?.isWall) {
        target = ent;
        isEntityTarget = true;
      }
    }

    if (!target) {
      p.attackTargetId = null;
      return;
    }

    const hand = p.equip[EQUIP_SLOTS.HAND];
    const handDef = hand ? ITEMS[hand.id] : null;
    const isRangedWeapon = Boolean(handDef?.rangedDamage);
    const reach = isRangedWeapon
      ? (handDef.rangedRange || 265)
      : (target.radius || 18) + 52;

    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d > reach) {
      this._moveToward(p, target.x, target.y);
      return;
    }

    if (p.attackCooldown > 0) return;

    p.facing = target.x >= p.x ? 1 : -1;
    p.attackCooldown = isRangedWeapon ? 0.58 : 0.48;
    p.swingAnim = 0.30;

    // 计算玩家攻击力
    const baseDmg = isRangedWeapon ? handDef.rangedDamage : (handDef?.damage || 10);
    const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;
    let mult = charDef.damageMult || 1.0;
    if (!isRangedWeapon && p.charId === 'wolfgang') {
      if (p.hunger > 180) mult = 1.55;
      else if (p.hunger < 60) mult = 0.75;
    }
    const dmg = Math.round(baseDmg * mult);

    // 远程武器发射投射物（吹箭消耗数量，回旋镖消耗耐久）
    if (isRangedWeapon) {
      this._spawnProjectile({
        kind: handDef.isBoomerang ? 'boomerang' : 'dart',
        x: p.x,
        y: p.y - 16,
        tx: target.x,
        ty: target.y - 14,
        speed: handDef.isBoomerang ? 380 : 540,
        damage: dmg,
        ownerPlayerId: p.id,
        targetId: target.id,
      });

      if (handDef.consumeOnShot) {
        hand.count = (hand.count || 1) - 1;
        if (hand.count <= 0) p.equip[EQUIP_SLOTS.HAND] = null;
      } else {
        this._consumeHandToolDurability(p, 1);
      }
      p.attackTargetId = null;
      return;
    }

    // 消耗近战武器耐久
    if (hand && hand.durability !== null && hand.durability !== undefined && !handDef.burnRate) {
      this._consumeHandToolDurability(p, 1);
    }

    if (isPlayerTarget) {
      this._damagePlayer(target, dmg, p.name, false);
    } else if (isEntityTarget) {
      target.hp -= dmg;
      this._pushFx({ kind: 'hit', x: target.x, y: target.y, dmg });
      if (target.type === 'spider_den') {
        if ((target.tier || 1) >= 3 && target.hp < target.maxHp * 0.55 && Math.random() < 0.35) {
          // 三级蜘蛛巢受创概率蜕变为【蜘蛛女王 Boss】！
          this.entities.delete(target.id);
          this._spawnMob('spider_queen', target.x, target.y, { targetId: p.id, state: 'chase' });
          this.broadcastBanner('🕷️ 三级蜘蛛巢剧烈蠕动，【巢穴母皇·蜘蛛女王】破茧而出！！', 'danger');
          p.attackTargetId = null;
          return;
        }
        if ((target.tier || 1) >= 2 && Math.random() < 0.35) {
          this._spawnMob('spider_warrior', target.x + 24, target.y + 24, { targetId: p.id, state: 'chase' });
        }
      }
      if (target.hp <= 0) {
        if (target.type === 'spider_den') {
          this._spawnGroundItem('silk', 3 * (target.tier || 1), target.x, target.y);
          this._spawnGroundItem('spider_gland', 2, target.x + 12, target.y);
        }
        this.entities.delete(target.id);
        p.attackTargetId = null;
      }
    } else {
      this._damageMob(target, dmg, p);
      const wearingSpiderHat = ITEMS[p.equip[EQUIP_SLOTS.HEAD]?.id]?.spiderFriend;
      // 玩家随从猪人、阿比盖尔或女王帽臣服蜘蛛锁定同一目标协助战斗！
      for (const ally of this.mobs.values()) {
        if (ally.id === target.id) continue;
        if (
          (ally.type === 'pigman' && ally.leaderId === p.id) ||
          (ally.type === 'abigail' && ally.ownerId === p.id) ||
          (wearingSpiderHat && (ally.type === 'spider' || ally.type === 'spider_warrior') && Math.hypot(ally.x - p.x, ally.y - p.y) < 260)
        ) {
          ally.targetId = target.id;
          ally.state = 'chase';
        }
      }
    }
  }

  _moveToward(p, tx, ty) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;
    let speed = 178 * (charDef.speedMult || 1.0);
    if (p.isGhost) speed *= 1.12;
    else {
      const hand = p.equip[EQUIP_SLOTS.HAND];
      if (hand && ITEMS[hand.id]?.speedBonus) speed *= 1 + ITEMS[hand.id].speedBonus;
      if (distToRoads(p.x, p.y, this.roads) < 38) speed *= 1.28;
    }
    const step = Math.min(d, speed * (TICK_MS / 1000));
    p.x = clamp(p.x + (dx / d) * step, -WORLD_HALF + 32, WORLD_HALF - 32);
    p.y = clamp(p.y + (dy / d) * step, -WORLD_HALF + 32, WORLD_HALF - 32);
    p.facing = dx >= 0 ? 1 : -1;
    if (!p.isGhost) this._resolveSolidCollisions(p, 16);
  }

  // ==================== 生物 AI 与战斗行为 ====================
  _spawnMob(type, x, y, extra = {}) {
    const def = MOB_DEFS[type];
    if (!def) return null;
    const id = this.allocId('mob');
    const mob = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      homeX: Math.round(x),
      homeY: Math.round(y),
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius || 18,
      state: 'idle',
      targetId: null,
      stateTimer: 1 + Math.random() * 2,
      attackCooldown: 0,
      windupTimer: 0,
      facing: 1,
      leaderId: null,
      followUntil: 0,
      ...extra,
    };
    this.mobs.set(id, mob);
    return mob;
  }

  _updateMobs(dt, dayInfo) {
    for (const [mId, mob] of this.mobs.entries()) {
      const def = MOB_DEFS[mob.type];
      if (!def) continue;

      mob.attackCooldown = Math.max(0, (mob.attackCooldown || 0) - dt);

      // 满月之夜户外猪人狂暴变疯猪！
      if (mob.type === 'pigman' && dayInfo.isFullMoon) {
        mob.type = 'werepig';
        mob.maxHp = MOB_DEFS.werepig.hp;
        mob.hp = mob.maxHp;
        mob.leaderId = null;
        mob.state = 'chase';
        continue;
      }

      // 猪人跟随契约到期检查
      if (mob.leaderId && this.worldTime >= mob.followUntil) {
        mob.leaderId = null;
      }

      // 阿比盖尔幽灵守护温蒂逻辑
      if (mob.type === 'abigail') {
        this._updateAbigail(mob, dt, dayInfo);
        continue;
      }

      // 攻击前摇判定（还原饥荒走A机制：前摇结束时如果目标已跑出攻击圈则落空！）
      if (mob.windupTimer > 0) {
        mob.windupTimer -= dt;
        if (mob.windupTimer <= 0) {
          this._executeMobStrike(mob, def);
        }
        continue;
      }

      // 兔子受惊逃跑
      if (def.behavior === 'prey') {
        let threat = null;
        let minD = 165;
        for (const p of this.players.values()) {
          if (p.isGhost) continue;
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < minD) { minD = d; threat = p; }
        }
        if (threat) {
          const dx = mob.x - threat.x;
          const dy = mob.y - threat.y;
          const len = Math.hypot(dx, dy) || 1;
          mob.x = clamp(mob.x + (dx / len) * def.speed * dt, -WORLD_HALF + 40, WORLD_HALF - 40);
          mob.y = clamp(mob.y + (dy / len) * def.speed * dt, -WORLD_HALF + 40, WORLD_HALF - 40);
          mob.facing = dx >= 0 ? 1 : -1;
        } else {
          this._wanderMob(mob, def.speed * 0.45, dt);
        }
        continue;
      }

      // 校验或索敌目标
      this._acquireMobTarget(mob, def, dayInfo);

      const target = this._resolveTargetEntity(mob.targetId);
      if (target) {
        const dx = target.x - mob.x;
        const dy = target.y - mob.y;
        const d = Math.hypot(dx, dy);
        mob.facing = dx >= 0 ? 1 : -1;

        // 脱战距离检测（猎犬与Boss永不轻易脱战）
        const maxChase = (def.behavior === 'hound' || def.isBoss || def.isShadow) ? 1400 : 460;
        if (d > maxChase) {
          mob.targetId = null;
          mob.state = 'idle';
          continue;
        }

        const atkRange = (def.attackRange || 48) + (target.radius || 16);
        if (d <= atkRange) {
          if (mob.attackCooldown <= 0) {
            mob.windupTimer = def.windup || 0.4;
            mob.attackCooldown = def.cooldown || 1.5;
            this._pushFx({ kind: 'windup', mobId: mob.id, x: mob.x, y: mob.y });
          }
        } else if (def.speed > 0) {
          // 独眼巨鹿直线推进如果撞到墙体则直接挥击拆墙！
          if (def.smashStructures) {
            for (const ent of this.entities.values()) {
              if (ENTITY_DEFS[ent.type]?.isWall && Math.hypot(ent.x - mob.x, ent.y - mob.y) < 68) {
                if (mob.attackCooldown <= 0) {
                  mob.windupTimer = def.windup;
                  mob.attackCooldown = def.cooldown;
                }
                break;
              }
            }
          }
          mob.x = clamp(mob.x + (dx / d) * def.speed * dt, -WORLD_HALF + 40, WORLD_HALF - 40);
          mob.y = clamp(mob.y + (dy / d) * def.speed * dt, -WORLD_HALF + 40, WORLD_HALF - 40);
          this._resolveSolidCollisions(mob, mob.radius * 0.8);
        }
      } else {
        // 无战斗目标时：猪人跟随主人，其他生物在领地漫步
        if (mob.leaderId && this.players.has(mob.leaderId)) {
          const leader = this.players.get(mob.leaderId);
          const d = Math.hypot(leader.x - mob.x, leader.y - mob.y);
          if (d > 85) {
            const dx = leader.x - mob.x;
            const dy = leader.y - mob.y;
            mob.x += (dx / d) * def.speed * 1.08 * dt;
            mob.y += (dy / d) * def.speed * 1.08 * dt;
            mob.facing = dx >= 0 ? 1 : -1;
          }
        } else if (def.speed > 0 && mob.state !== 'pacified') {
          this._wanderMob(mob, def.speed * 0.42, dt);
        }
      }
    }
  }

  _updateAbigail(abigail, dt, dayInfo) {
    const owner = this.players.get(abigail.ownerId);
    if (!owner || owner.isGhost) {
      this.mobs.delete(abigail.id);
      return;
    }

    let target = abigail.targetId ? this.mobs.get(abigail.targetId) : null;
    if (!target || target.type === 'abigail') {
      abigail.targetId = null;
      // 自动守护周围靠近温蒂的敌对生物
      for (const m of this.mobs.values()) {
        if (m.id === abigail.id || m.type === 'rabbit' || (m.type === 'pigman' && m.targetId !== owner.id)) continue;
        if (Math.hypot(m.x - owner.x, m.y - owner.y) < 190 && (m.targetId === owner.id || MOB_DEFS[m.type]?.behavior === 'hound' || MOB_DEFS[m.type]?.behavior === 'spider')) {
          target = m;
          abigail.targetId = m.id;
          break;
        }
      }
    }

    const destX = target ? target.x : owner.x - owner.facing * 48;
    const destY = target ? target.y : owner.y - 18;
    const dx = destX - abigail.x;
    const dy = destY - abigail.y;
    const d = Math.hypot(dx, dy);
    if (d > 24) {
      abigail.x += (dx / d) * 165 * dt;
      abigail.y += (dy / d) * 165 * dt;
      abigail.facing = dx >= 0 ? 1 : -1;
    }

    if (target && abigail.attackCooldown <= 0 && d < 95) {
      abigail.attackCooldown = 1.15;
      // 阿比盖尔黄昏 1.5 倍、黑夜 2.2 倍群体幽冥伤害（还原原版设定！）
      const phaseMult = dayInfo.phase === PHASES.NIGHT ? 2.2 : (dayInfo.phase === PHASES.DUSK ? 1.5 : 1.0);
      const aoeDmg = Math.round(16 * phaseMult);
      this._pushFx({ kind: 'abigail_pulse', x: abigail.x, y: abigail.y });
      for (const m of this.mobs.values()) {
        if (m.id === abigail.id || m.type === 'rabbit' || (m.type === 'pigman' && m.leaderId)) continue;
        if (Math.hypot(m.x - abigail.x, m.y - abigail.y) < 105) {
          this._damageMob(m, aoeDmg, owner);
        }
      }
    }
  }

  _wanderMob(mob, speed, dt) {
    mob.stateTimer -= dt;
    if (mob.stateTimer <= 0) {
      mob.stateTimer = 1.8 + Math.random() * 3.0;
      if (Math.random() < 0.45) {
        mob.vx = 0;
        mob.vy = 0;
      } else {
        // 偏向回家周围漫步
        const toHomeX = (mob.homeX || mob.x) - mob.x;
        const toHomeY = (mob.homeY || mob.y) - mob.y;
        const hd = Math.hypot(toHomeX, toHomeY);
        const ang = hd > 220 ? Math.atan2(toHomeY, toHomeX) : Math.random() * Math.PI * 2;
        mob.vx = Math.cos(ang);
        mob.vy = Math.sin(ang);
        mob.facing = mob.vx >= 0 ? 1 : -1;
      }
    }
    if (mob.vx || mob.vy) {
      mob.x = clamp(mob.x + mob.vx * speed * dt, -WORLD_HALF + 45, WORLD_HALF - 45);
      mob.y = clamp(mob.y + mob.vy * speed * dt, -WORLD_HALF + 45, WORLD_HALF - 45);
    }
  }

  _acquireMobTarget(mob, def, dayInfo) {
    const cur = this._resolveTargetEntity(mob.targetId);
    if (cur) return;
    mob.targetId = null;

    if (mob.state === 'pacified') return;

    // 猪人主动攻击视野内的蜘蛛、猎犬、触手！
    if (def.behavior === 'pig') {
      for (const other of this.mobs.values()) {
        if (['spider', 'spider_warrior', 'hound', 'fire_hound', 'ice_hound', 'tentacle', 'werepig'].includes(other.type)) {
          if (Math.hypot(other.x - mob.x, other.y - mob.y) < 220) {
            mob.targetId = other.id;
            return;
          }
        }
      }
      return;
    }

    // 暗影怪只追击低理智玩家
    if (def.isShadow) {
      for (const p of this.players.values()) {
        if (!p.isGhost && p.sanity / p.maxSanity < 0.45 && Math.hypot(p.x - mob.x, p.y - mob.y) < 420) {
          mob.targetId = p.id;
          return;
        }
      }
      return;
    }

    const aggroRange = def.behavior === 'hound' || def.isBoss
      ? 680
      : def.behavior === 'ambush'
        ? 98
        : def.behavior === 'spider'
          ? (dayInfo.phase === PHASES.DAY ? 120 : 210)
          : 175;

    // 沼泽触手与蜘蛛、猪人也会互相混战！（经典饥荒生态大乱斗）
    for (const p of this.players.values()) {
      if (p.isGhost) continue;
      // 佩戴蜘蛛女王帽的玩家不会被小蜘蛛与蜘蛛战士主动敌视！
      if ((mob.type === 'spider' || mob.type === 'spider_warrior') && ITEMS[p.equip[EQUIP_SLOTS.HEAD]?.id]?.spiderFriend) {
        continue;
      }
      if (Math.hypot(p.x - mob.x, p.y - mob.y) < aggroRange) {
        mob.targetId = p.id;
        return;
      }
    }

    for (const other of this.mobs.values()) {
      if (other.id === mob.id) continue;
      if (def.behavior === 'ambush' && other.type !== 'tentacle') {
        if (Math.hypot(other.x - mob.x, other.y - mob.y) < aggroRange) {
          mob.targetId = other.id;
          return;
        }
      } else if ((def.behavior === 'spider' || def.behavior === 'hound') && (other.type === 'pigman' || other.type === 'abigail')) {
        if (Math.hypot(other.x - mob.x, other.y - mob.y) < aggroRange) {
          mob.targetId = other.id;
          return;
        }
      }
    }
  }

  _resolveTargetEntity(tid) {
    if (!tid) return null;
    if (this.players.has(tid)) {
      const p = this.players.get(tid);
      return p.isGhost ? null : p;
    }
    if (this.mobs.has(tid)) return this.mobs.get(tid);
    return null;
  }

  _executeMobStrike(mob, def) {
    const reach = (def.attackRange || 50) + 26;

    // 蜘蛛女王召唤蜘蛛护卫！
    if (mob.type === 'spider_queen') {
      const nearbyMinions = [...this.mobs.values()].filter(
        (m) => (m.type === 'spider' || m.type === 'spider_warrior') && Math.hypot(m.x - mob.x, m.y - mob.y) < 350
      );
      if (nearbyMinions.length < 3 && Math.random() < 0.35) {
        const childType = Math.random() < 0.3 ? 'spider_warrior' : 'spider';
        this._spawnMob(childType, mob.x + mob.facing * 32, mob.y + 18, { targetId: mob.targetId, state: 'chase' });
      }
    }

    // 发条主教远程紫电能量球发射（可横向走位躲避！）
    if (def.isRanged) {
      const target = this._resolveTargetEntity(mob.targetId);
      if (!target) return;
      this._spawnProjectile({
        kind: 'bishop_orb',
        x: mob.x + mob.facing * 18,
        y: mob.y - 26,
        tx: target.x,
        ty: target.y - 12,
        speed: 295,
        damage: def.damage,
        ownerMobId: mob.id,
        ownerName: def.name,
      });
      this._pushFx({ kind: 'sizzle', x: mob.x, y: mob.y - 26 });
      return;
    }

    // 独眼巨鹿范围冰刺震击（伤害周围敌人 + 拆毁墙体建筑 + 冰冻降温！）
    if (mob.type === 'deerclops') {
      const cx = mob.x + mob.facing * 52;
      const cy = mob.y;
      this._pushFx({ kind: 'ice_slam', x: cx, y: cy });
      this._pushFx({ kind: 'shake', power: 10 });

      for (const p of this.players.values()) {
        if (!p.isGhost && Math.hypot(p.x - cx, p.y - cy) < 110) {
          p.bodyTemp = Math.max(-10, p.bodyTemp - 10);
          this._damagePlayer(p, def.damage, def.name, false);
        }
      }
      for (const other of this.mobs.values()) {
        if (other.id !== mob.id && Math.hypot(other.x - cx, other.y - cy) < 110) {
          this._damageMob(other, def.damage, null);
        }
      }
      for (const [eId, ent] of this.entities.entries()) {
        const eDef = ENTITY_DEFS[ent.type];
        if (eDef?.category === 'structure' && Math.hypot(ent.x - cx, ent.y - cy) < 105) {
          ent.hp = (ent.hp || 200) - 140;
          if (ent.hp <= 0) {
            this._pushFx({ kind: 'mine', x: ent.x, y: ent.y });
            this.entities.delete(eId);
          }
        }
      }
      return;
    }

    const target = this._resolveTargetEntity(mob.targetId);
    if (!target) return;
    const d = Math.hypot(target.x - mob.x, target.y - mob.y);
    if (d > reach + (target.radius || 16)) {
      // 玩家成功走位躲开了攻击！
      return;
    }

    if (this.players.has(target.id)) {
      this._damagePlayer(target, def.damage, def.name, false);
    } else if (this.mobs.has(target.id)) {
      this._damageMob(target, def.damage, null);
    }
  }

  _damageMob(mob, dmg, attackerPlayer) {
    mob.hp -= dmg;
    if (mob.state === 'pacified') mob.state = 'chase';
    if (attackerPlayer) {
      mob.targetId = attackerPlayer.id;
      // 女武神战斗吸血与回理智被动！
      if (attackerPlayer.charId === 'wigfrid' && !attackerPlayer.isGhost) {
        attackerPlayer.hp = Math.min(attackerPlayer.maxHp, attackerPlayer.hp + 2.5);
        attackerPlayer.sanity = Math.min(attackerPlayer.maxSanity, attackerPlayer.sanity + 2.5);
      }
    }
    this._pushFx({ kind: 'hit', x: mob.x, y: mob.y, dmg });

    // 同巢蜘蛛群体仇恨联动
    if (mob.type === 'spider' && attackerPlayer) {
      for (const other of this.mobs.values()) {
        if (other.type === 'spider' && Math.hypot(other.x - mob.x, other.y - mob.y) < 190 && !other.targetId) {
          other.targetId = attackerPlayer.id;
        }
      }
    }

    if (mob.hp <= 0) {
      const def = MOB_DEFS[mob.type];
      this.mobs.delete(mob.id);
      this._pushFx({ kind: 'death', x: mob.x, y: mob.y, mobType: mob.type });

      if (def?.drops) {
        for (const dr of def.drops) {
          if (Math.random() <= (dr.chance ?? 1)) {
            this._spawnGroundItem(dr.id, dr.count, mob.x + (Math.random() - 0.5) * 28, mob.y + (Math.random() - 0.5) * 28);
          }
        }
      }

      // 击杀暗影怪恢复大量理智！
      if (def?.sanityKillReward && attackerPlayer && !attackerPlayer.isGhost) {
        attackerPlayer.sanity = Math.min(attackerPlayer.maxSanity, attackerPlayer.sanity + def.sanityKillReward);
        this._pushFx({ kind: 'heal', x: attackerPlayer.x, y: attackerPlayer.y, text: `+${def.sanityKillReward} 理智` });
      }

      // 女武神击杀额外激励
      if (attackerPlayer?.charId === 'wigfrid' && !attackerPlayer.isGhost) {
        attackerPlayer.hp = Math.min(attackerPlayer.maxHp, attackerPlayer.hp + 5);
        attackerPlayer.sanity = Math.min(attackerPlayer.maxSanity, attackerPlayer.sanity + 5);
      }

      // 火猎犬/冰猎犬阵亡特效
      if (def?.deathEffect === 'ice') {
        this._pushFx({ kind: 'ice_slam', x: mob.x, y: mob.y });
        for (const p of this.players.values()) {
          if (!p.isGhost && Math.hypot(p.x - mob.x, p.y - mob.y) < 110) {
            p.bodyTemp -= 12;
          }
        }
      } else if (def?.deathEffect === 'fire') {
        this._pushFx({ kind: 'fire_burst', x: mob.x, y: mob.y });
        for (const p of this.players.values()) {
          if (!p.isGhost && p.charId !== 'willow' && Math.hypot(p.x - mob.x, p.y - mob.y) < 90) {
            this._damagePlayer(p, 14, '赤焰猎犬余烬', true);
          }
        }
      }

      if (def?.isBoss) {
        this.broadcastBanner(`🏆 捷报！【${def.name}】已被幸存者团队讨伐！`, 'success');
      }
    }
  }

  _damagePlayer(p, rawDmg, sourceName, bypassArmor = false) {
    if (p.isGhost || rawDmg <= 0) return;
    let dmg = rawDmg;

    if (!bypassArmor) {
      const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;
      let maxAbsorb = charDef.defenseBonus || 0;

      // 身体护甲与头部头盔取最高减伤并分摊耐久（饥荒经典护甲结算）
      const armorSlots = [EQUIP_SLOTS.BODY, EQUIP_SLOTS.HEAD].filter((s) => {
        const eq = p.equip[s];
        return eq && ITEMS[eq.id]?.absorb;
      });

      for (const s of armorSlots) {
        const eq = p.equip[s];
        const def = ITEMS[eq.id];
        if (def.absorb > maxAbsorb) maxAbsorb = def.absorb;
        if (eq.durability !== null) {
          eq.durability -= rawDmg * 0.65;
          if (eq.durability <= 0) {
            p.equip[s] = null;
            this.clients.get(p.id)?.send({ type: 'toast', text: `🛡️ 你的【${def.name}】破碎了！` });
          }
        }
      }

      dmg = Math.max(1, rawDmg * (1 - Math.min(0.92, maxAbsorb)));
      p.hurtAnim = 0.28;
      this._pushFx({ kind: 'player_hit', x: p.x, y: p.y, playerId: p.id, dmg: Math.round(dmg) });
    }

    p.hp = Math.max(0, p.hp - dmg);
    if (p.hp <= 0) {
      this._handlePlayerDeath(p, sourceName);
    }
  }

  _handlePlayerDeath(p, killerName) {
    // 检查身体栏是否佩戴了【重生护符】
    const bodyEq = p.equip[EQUIP_SLOTS.BODY];
    if (bodyEq && ITEMS[bodyEq.id]?.autoRevive) {
      p.equip[EQUIP_SLOTS.BODY] = null;
      p.hp = Math.min(p.maxHp, 85);
      p.hunger = Math.max(p.hunger, 60);
      p.sanity = Math.min(p.maxSanity, p.sanity + 35);
      p.bodyTemp = 25;
      this._pushFx({ kind: 'revive', x: p.x, y: p.y, playerId: p.id });
      this.broadcastChat('系统', `🔥 ${p.name} 触发身上的【重生护符】，浴火重生！`, '#ff9642');
      return;
    }

    p.isGhost = true;
    p.ghostSince = this.worldTime;
    p.hp = 0;
    p.openContainerId = null;
    p.attackTargetId = null;
    p.interactTargetId = null;

    if (p.abigailId && this.mobs.has(p.abigailId)) {
      this.mobs.delete(p.abigailId);
      p.abigailId = null;
    }

    // 留下遗骸并将身上物资散落在遗骸旁（阿比盖尔之花保留在包内）
    const skId = this.allocId('ent');
    this.entities.set(skId, {
      id: skId,
      type: 'skeleton',
      x: Math.round(p.x),
      y: Math.round(p.y),
      radius: 18,
      hitsLeft: 2,
      ready: true,
    });

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const it = p.inventory[i];
      if (!it || it.id === 'abigail_flower') continue;
      const ang = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 35;
      this._spawnGroundItem(it.id, it.count, p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, it.durability, it.extra);
      p.inventory[i] = null;
    }
    for (const s of Object.values(EQUIP_SLOTS)) {
      const eq = p.equip[s];
      if (!eq) continue;
      this._spawnGroundItem(eq.id, 1, p.x + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 40, eq.durability, eq.extra);
      p.equip[s] = null;
    }

    this.broadcastBanner(`👻 ${p.name} 死于【${killerName || '荒野未知危险'}】化作了鬼魂！可用救赎之心或试金石复活！`, 'danger');
  }

  _revivePlayer(p, method, ratio = 0.7) {
    p.isGhost = false;
    p.hp = Math.round(p.maxHp * ratio);
    p.hunger = Math.round(p.maxHunger * Math.max(0.55, ratio));
    p.sanity = Math.round(p.maxSanity * Math.max(0.55, ratio));
    p.bodyTemp = 25;
    p.moisture = 0;
    p.darkTimer = 0;
    this._pushFx({ kind: 'revive', x: p.x, y: p.y, playerId: p.id });
    this.broadcastBanner(`⚡ ${p.name} 借助【${method}】重返人间！`, 'success');
  }

  // ==================== 背包物品使用、烤肉、合成与建造 ====================
  _handleUseInventorySlot(p, slotIndex, secondary) {
    if (slotIndex < 0 || slotIndex >= INVENTORY_SIZE) return;
    const slot = p.inventory[slotIndex];
    if (!slot) return;
    const def = ITEMS[slot.id];
    if (!def) return;

    // 如果当前正打开储物箱或烹饪锅，点击背包直接快速放入容器！
    if (p.openContainerId && !secondary) {
      this._handleContainerTransfer(p, p.openContainerId, 'inv', slotIndex);
      return;
    }

    if (p.isGhost) return;

    // 1. 若站在营火旁（或手持打火机）且该食物可烤熟，右键或使用优先烤肉（若 secondary 或生怪肉等）
    if (def.cookResult && secondary) {
      if (this._tryRoastItemAtSlot(p, slotIndex)) return;
    }

    // 2. 装备穿戴切换
    if (def.slot) {
      const prev = p.equip[def.slot];
      p.equip[def.slot] = { ...slot };
      p.inventory[slotIndex] = prev || null;
      this._pushFx({ kind: 'equip', x: p.x, y: p.y, playerId: p.id });
      return;
    }

    // 3. 救赎之心复活附近鬼魂队友！
    if (def.reviveItem) {
      let targetGhost = null;
      let bestD = 200;
      for (const other of this.players.values()) {
        if (other.isGhost) {
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < bestD) { bestD = d; targetGhost = other; }
        }
      }
      if (!targetGhost) {
        this.clients.get(p.id)?.send({ type: 'toast', text: '👻 附近 200 范围内没有阵亡队友的鬼魂！请走近队友鬼魂再使用。' });
        return;
      }
      this._consumeSlotCount(p, slotIndex, 1);
      this._revivePlayer(targetGhost, `${p.name} 的救赎之心`, 0.75);
      p.sanity = Math.min(p.maxSanity, p.sanity + 20);
      return;
    }

    // 4. 阿比盖尔之花召唤/收回
    if (def.summonAbigail) {
      if (p.charId !== 'wendy') {
        this.clients.get(p.id)?.send({ type: 'toast', text: '🌸 只有温蒂能听懂阿比盖尔的呼唤。' });
        return;
      }
      if (p.abigailId && this.mobs.has(p.abigailId)) {
        this.mobs.delete(p.abigailId);
        p.abigailId = null;
        this.clients.get(p.id)?.send({ type: 'toast', text: '🌸 阿比盖尔回到了花朵中休息。' });
      } else {
        const ab = this._spawnMob('abigail', p.x + 36, p.y - 16, { ownerId: p.id });
        p.abigailId = ab.id;
        this._pushFx({ kind: 'revive', x: ab.x, y: ab.y });
        this.clients.get(p.id)?.send({ type: 'toast', text: '👻 幽灵姐姐【阿比盖尔】已现身守护你！' });
      }
      return;
    }

    // 5. 敌意信号弹召唤 Boss
    if (def.summonBoss) {
      this._consumeSlotCount(p, slotIndex, 1);
      this.pendingBossTimer = 8;
      this.broadcastBanner(`🚨 ${p.name} 发射了敌意信号弹！独眼巨鹿将于 8 秒后降临！`, 'danger');
      this._pushFx({ kind: 'sfx_global', sfx: 'boss_roar' });
      return;
    }

    // 6. 放置捕兽笼或犬牙陷阱
    if (def.placeEntity === 'trap_placed' || def.placeEntity === 'tooth_trap') {
      const id = this.allocId('ent');
      const isTooth = def.placeEntity === 'tooth_trap';
      this.entities.set(id, {
        id,
        type: def.placeEntity,
        x: Math.round(p.x + p.facing * 32),
        y: Math.round(p.y + 8),
        radius: 16,
        durability: slot.durability ?? (isTooth ? 10 : 8),
        caughtItem: null,
        sprung: false,
      });
      this._consumeSlotCount(p, slotIndex, 1);
      this._pushFx({ kind: 'build', x: p.x + p.facing * 32, y: p.y + 8 });
      return;
    }

    // 6.5 萤火虫右键放生在营地作夜间微光 / 冰块右键扑灭附近火灾！
    if (def.releaseEntity && secondary) {
      const px = Math.round(p.x + p.facing * 26);
      const py = Math.round(p.y + 6);
      const id = this.allocId('ent');
      this.entities.set(id, {
        id,
        type: def.releaseEntity,
        x: px,
        y: py,
        radius: 12,
        hitsLeft: 1,
        ready: true,
      });
      this._consumeSlotCount(p, slotIndex, 1);
      this._pushFx({ kind: 'heal', x: px, y: py, text: '✨ 放生流萤' });
      return;
    }

    if (slot.id === 'ice' && secondary) {
      let extinguished = 0;
      for (const ent of this.entities.values()) {
        if (ent.burning && Math.hypot(ent.x - p.x, ent.y - p.y) < 155) {
          delete ent.burning;
          extinguished++;
        }
      }
      if (extinguished > 0) {
        this._consumeSlotCount(p, slotIndex, 1);
        this._pushFx({ kind: 'sizzle', x: p.x, y: p.y });
        this.clients.get(p.id)?.send({ type: 'toast', text: `❄️ 用冰块成功扑灭了周围 ${extinguished} 处火焰！` });
        return;
      }
    }

    // 7. 松果、桦木果与连根灌木移植种植（右键种植；连根苗左键也直接种植更顺手！）
    if (def.plantAs && (secondary || slot.id.startsWith('dug_'))) {
      const px = Math.round(p.x + p.facing * 36);
      const py = Math.round(p.y + 10);
      const pDef = ENTITY_DEFS[def.plantAs];
      const id = this.allocId('ent');
      const isDugBush = slot.id.startsWith('dug_');
      this.entities.set(id, {
        id,
        type: def.plantAs,
        x: px,
        y: py,
        radius: pDef?.radius || 12,
        ready: !isDugBush,
        regrowAt: isDugBush ? this.worldTime + 120 : 0,
      });
      this._consumeSlotCount(p, slotIndex, 1);
      this._pushFx({ kind: 'rustle', x: px, y: py });

      // 饥荒经典彩蛋：种树安抚附近的发怒树精！
      for (const mob of this.mobs.values()) {
        if (mob.type === 'treeguard' && Math.hypot(mob.x - px, mob.y - py) < 250) {
          if (Math.random() < 0.5) {
            mob.targetId = null;
            mob.state = 'pacified';
            this.clients.get(p.id)?.send({ type: 'toast', text: '🌲 树精守卫看到你种下树苗，怒火平息了！' });
          }
        }
      }
      return;
    }

    // 8. 剃刀刮胡子
    if (def.usableShave) {
      if (p.charId === 'wilson' && (p.beardDays || 0) >= 3) {
        const count = p.beardDays >= 9 ? 3 : 1;
        p.beardDays = 0;
        p.sanity = Math.min(p.maxSanity, p.sanity + 10);
        this._addItemToPlayer(p, 'beard_hair', count);
        this.clients.get(p.id)?.send({ type: 'toast', text: `🪒 清爽刮完胡须，获得胡须 x${count} 且 +10 理智！` });
      } else {
        this.clients.get(p.id)?.send({ type: 'toast', text: '🪒 还没有长出足够浓密的胡须呢！' });
      }
      return;
    }

    // 9. 治疗药膏与蜘蛛腺体回血
    if (def.usableHeal) {
      this._consumeSlotCount(p, slotIndex, 1);
      p.hp = Math.min(p.maxHp, p.hp + def.usableHeal);
      this._pushFx({ kind: 'heal', x: p.x, y: p.y, text: `+${def.usableHeal} 生命` });
      return;
    }

    // 10. 噩梦燃料给矿工头灯或提灯充能
    if (def.lanternFuel) {
      for (const eqSlot of [EQUIP_SLOTS.HAND, EQUIP_SLOTS.HEAD]) {
        const eq = p.equip[eqSlot];
        if (eq && ITEMS[eq.id]?.refuelable && eq.durability < ITEMS[eq.id].maxDurability) {
          eq.durability = Math.min(ITEMS[eq.id].maxDurability, eq.durability + def.lanternFuel);
          this._consumeSlotCount(p, slotIndex, 1);
          this.clients.get(p.id)?.send({ type: 'toast', text: `✨ 已为【${ITEMS[eq.id].name}】补充燃料！` });
          return;
        }
      }
    }

    // 11. WX-78 吃精密齿轮永久升级三维上限！
    if (def.wxFood) {
      if (p.charId === 'wx78') {
        this._consumeSlotCount(p, slotIndex, 1);
        if ((p.gearUpgrades || 0) < 10) {
          p.gearUpgrades = (p.gearUpgrades || 0) + 1;
          p.maxHp += 12;
          p.maxHunger += 8;
          p.maxSanity += 10;
        }
        p.hp = Math.min(p.maxHp, p.hp + def.wxFood.hp);
        p.hunger = Math.min(p.maxHunger, p.hunger + def.wxFood.hunger);
        p.sanity = Math.min(p.maxSanity, p.sanity + def.wxFood.sanity);
        this._pushFx({ kind: 'heal', x: p.x, y: p.y, text: '⚙️ 机体升级！' });
      } else {
        this.clients.get(p.id)?.send({ type: 'toast', text: '⚙️ 人类可嚼不动金属齿轮（只有 WX-78 能吃它升级）！' });
      }
      return;
    }

    // 12. 食用食物
    if (def.food) {
      const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;
      if (charDef.carnivore && !def.food.isMeat) {
        this.clients.get(p.id)?.send({ type: 'toast', text: '🥩 女武神只吃肉类、蛋类与荤菜料理！（试试靠近营火右键烤肉或做肉丸）' });
        return;
      }

      this._consumeSlotCount(p, slotIndex, 1);
      let { hp = 0, hunger = 0, sanity = 0, tempDelta = 0 } = def.food;
      if (charDef.ironStomach && def.food.isMonster) {
        if (hp < 0) hp *= 0.25;
        if (sanity < 0) sanity *= 0.25;
      }
      if (hp >= 0) p.hp = Math.min(p.maxHp, p.hp + hp);
      else this._damagePlayer(p, -hp, `误食${def.name}`, true);

      if (!p.isGhost) {
        p.hunger = clamp(p.hunger + hunger, 0, p.maxHunger);
        p.sanity = clamp(p.sanity + sanity, 0, p.maxSanity);
        if (tempDelta) p.bodyTemp = clamp(p.bodyTemp + tempDelta, -10, 75);
        this._pushFx({ kind: 'eat', x: p.x, y: p.y, playerId: p.id });
      }
    }
  }

  _tryRoastItemAtSlot(p, slotIndex) {
    const slot = p.inventory[slotIndex];
    if (!slot) return false;
    const def = ITEMS[slot.id];
    if (!def?.cookResult) return false;

    // 判断是否靠近燃烧中的普通营火/火坑，或者手持薇洛打火机
    let canRoast = p.equip[EQUIP_SLOTS.HAND]?.id === 'lighter';
    if (!canRoast) {
      for (const ent of this.entities.values()) {
        const eDef = ENTITY_DEFS[ent.type];
        if (eDef?.isFire && !eDef.isColdFire && ent.fuel > 0 && Math.hypot(ent.x - p.x, ent.y - p.y) < 125) {
          canRoast = true;
          break;
        }
      }
    }

    if (!canRoast) {
      this.clients.get(p.id)?.send({ type: 'toast', text: '🔥 请靠近燃烧的营火或火坑才能烤熟食材！' });
      return true;
    }

    this._consumeSlotCount(p, slotIndex, 1);
    this._addItemToPlayer(p, def.cookResult, 1);
    this._pushFx({ kind: 'sizzle', x: p.x, y: p.y });
    return true;
  }

  _interactFire(p, fireEnt, fireDef) {
    // 1. 若火不是吸热冷火，先看看背包里有没有可烤的生食，或者优先添柴？
    // 更直观的策略：如果是吸热冷火，添硝石/冰块；如果是普通火坑/营火，若燃料不足 75% 且包里有燃料，先添1份燃料；否则若包里有生食自动烤1份！
    if (fireDef.isColdFire) {
      const fuelIdx = p.inventory.findIndex((it) => it && ITEMS[it.id]?.endothermicFuel);
      if (fuelIdx >= 0) {
        const it = p.inventory[fuelIdx];
        fireEnt.fuel = Math.min(fireDef.maxFuel, (fireEnt.fuel || 0) + ITEMS[it.id].endothermicFuel);
        this._consumeSlotCount(p, fuelIdx, 1);
        this._pushFx({ kind: 'sizzle', x: fireEnt.x, y: fireEnt.y });
        this.clients.get(p.id)?.send({ type: 'toast', text: `❄️ 已为吸热冷火添加【${ITEMS[it.id].name}】！` });
      } else {
        this.clients.get(p.id)?.send({ type: 'toast', text: '❄️ 需要【硝石】或【冰块】来为吸热冷火坑补充燃料！' });
      }
      return;
    }

    const needFuel = (fireEnt.fuel || 0) < fireDef.maxFuel * 0.72;
    const fuelPriority = ['log', 'charcoal', 'boards', 'pinecone', 'twigs', 'grass'];
    let bestFuelIdx = -1;
    for (const fid of fuelPriority) {
      const idx = p.inventory.findIndex((it) => it && it.id === fid);
      if (idx >= 0) { bestFuelIdx = idx; break; }
    }

    const rawFoodIdx = p.inventory.findIndex((it) => it && ITEMS[it.id]?.cookResult);

    if ((needFuel || rawFoodIdx < 0) && bestFuelIdx >= 0 && (fireEnt.fuel || 0) < fireDef.maxFuel - 8) {
      const it = p.inventory[bestFuelIdx];
      fireEnt.fuel = Math.min(fireDef.maxFuel, (fireEnt.fuel || 0) + ITEMS[it.id].fuel);
      this._consumeSlotCount(p, bestFuelIdx, 1);
      this._pushFx({ kind: 'fire_burst', x: fireEnt.x, y: fireEnt.y });
      return;
    }

    if (rawFoodIdx >= 0 && (fireEnt.fuel || 0) > 0) {
      this._tryRoastItemAtSlot(p, rawFoodIdx);
      return;
    }

    if (bestFuelIdx >= 0) {
      const it = p.inventory[bestFuelIdx];
      fireEnt.fuel = Math.min(fireDef.maxFuel, (fireEnt.fuel || 0) + ITEMS[it.id].fuel);
      this._consumeSlotCount(p, bestFuelIdx, 1);
      this._pushFx({ kind: 'fire_burst', x: fireEnt.x, y: fireEnt.y });
    } else {
      this.clients.get(p.id)?.send({ type: 'toast', text: '🔥 携带木头/干草点击火堆可添柴，携带生食点击火堆或右键背包可烤熟！' });
    }
  }

  _tradeWithPigKing(p, pigKingEnt) {
    const idx = p.inventory.findIndex((it) => it && ITEMS[it.id]?.givePigGold);
    if (idx < 0) {
      this.clients.get(p.id)?.send({ type: 'toast', text: '👑 猪王摸着肚皮：“拿小肉、大肉或高脚鸟蛋来换金块吧！”' });
      return;
    }
    const it = p.inventory[idx];
    const goldCount = ITEMS[it.id].givePigGold;
    this._consumeSlotCount(p, idx, 1);
    for (let i = 0; i < goldCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      this._spawnGroundItem('gold', 1, pigKingEnt.x + Math.cos(ang) * 58, pigKingEnt.y + 42 + Math.sin(ang) * 24);
    }
    this._pushFx({ kind: 'gold_toss', x: pigKingEnt.x, y: pigKingEnt.y });
    this.clients.get(p.id)?.send({ type: 'toast', text: `👑 猪王眉开眼笑，抛出了 ${goldCount} 块黄金！` });
  }

  _feedPigman(p, mob) {
    const idx = p.inventory.findIndex((it) => it && ITEMS[it.id]?.food?.isMeat);
    if (idx < 0) {
      this.clients.get(p.id)?.send({ type: 'toast', text: '🐷 送给猪人一块肉（小肉/大肉/怪物肉）可雇佣它帮你砍树打怪！' });
      return;
    }
    const it = p.inventory[idx];
    const isMonster = ITEMS[it.id]?.food?.isMonster;
    this._consumeSlotCount(p, idx, 1);

    if (isMonster) {
      mob.fedMonster = (mob.fedMonster || 0) + 1;
      if (mob.fedMonster >= 4) {
        mob.type = 'werepig';
        mob.maxHp = MOB_DEFS.werepig.hp;
        mob.hp = mob.maxHp;
        mob.leaderId = null;
        mob.targetId = p.id;
        this.clients.get(p.id)?.send({ type: 'toast', text: '🐺 糟糕！猪人吃下4块怪物肉狂化成了【疯猪】！' });
        return;
      }
    }

    mob.leaderId = p.id;
    mob.followUntil = this.worldTime + 320;
    this._pushFx({ kind: 'speech', x: mob.x, y: mob.y - 45, text: '你真好！猪人跟随你！' });
  }

  getPlayerTechLevel(p) {
    let lv = 0;
    for (const ent of this.entities.values()) {
      const def = ENTITY_DEFS[ent.type];
      if (def?.techLevel && Math.hypot(ent.x - p.x, ent.y - p.y) <= TECH_RANGE) {
        lv = Math.max(lv, def.techLevel);
      }
    }
    return lv;
  }

  _canCraftRecipe(p, recipe) {
    if (!recipe || p.isGhost) return { ok: false, reason: '鬼魂状态无法制作物品' };
    if (recipe.characterOnly && recipe.characterOnly !== p.charId) {
      return { ok: false, reason: '该配方为特定角色专属' };
    }
    const learned = p.unlockedRecipes.includes(recipe.id);
    const techLv = this.getPlayerTechLevel(p);
    if (!learned && techLv < recipe.tech) {
      const needName = recipe.tech === 1 ? '科学机器（一本）' : '炼金引擎（二本）';
      return { ok: false, reason: `需靠近【${needName}】解锁配方！` };
    }
    if (recipe.hpCost && p.hp <= recipe.hpCost + 2) {
      return { ok: false, reason: `生命值不足（制作需消耗 ${recipe.hpCost} 生命）！` };
    }
    for (const req of recipe.cost) {
      if (this._countPlayerItem(p, req.id) < req.count) {
        return { ok: false, reason: `缺少材料：${ITEMS[req.id]?.name || req.id}` };
      }
    }
    return { ok: true, learned };
  }

  _handleCraft(p, recipeId) {
    const recipe = RECIPE_MAP.get(recipeId);
    if (!recipe || recipe.structure) return;

    const check = this._canCraftRecipe(p, recipe);
    if (!check.ok) {
      this.clients.get(p.id)?.send({ type: 'toast', text: `❌ ${check.reason}` });
      return;
    }

    for (const req of recipe.cost) {
      this._consumePlayerItem(p, req.id, req.count);
    }
    if (recipe.hpCost) {
      p.hp = Math.max(1, p.hp - recipe.hpCost);
    }

    // 首次研发解锁新科技奖励理智！
    if (recipe.tech > 0 && !check.learned) {
      p.unlockedRecipes.push(recipe.id);
      const bonus = p.charId === 'wilson' ? 20 : 15;
      p.sanity = Math.min(p.maxSanity, p.sanity + bonus);
      this._pushFx({ kind: 'heal', x: p.x, y: p.y, text: `💡 研发新配方 +${bonus}理智` });
    }

    const resDef = ITEMS[recipe.result.id];
    // 若制作的是手持/穿戴装备且对应槽位为空，自动装备！
    if (resDef?.slot && !p.equip[resDef.slot]) {
      p.equip[resDef.slot] = {
        id: resDef.id,
        count: recipe.result.count || 1,
        durability: resDef.maxDurability ?? null,
      };
    } else {
      this._addItemToPlayer(p, recipe.result.id, recipe.result.count, resDef?.maxDurability ?? null);
    }
    this._pushFx({ kind: 'craft', x: p.x, y: p.y, playerId: p.id });
  }

  _handlePlaceStructure(p, recipeId, x, y) {
    const recipe = RECIPE_MAP.get(recipeId);
    if (!recipe || !recipe.structure) return;

    const check = this._canCraftRecipe(p, recipe);
    if (!check.ok) {
      this.clients.get(p.id)?.send({ type: 'toast', text: `❌ ${check.reason}` });
      return;
    }

    const tx = clamp(Math.round(x), -WORLD_HALF + 55, WORLD_HALF - 55);
    const ty = clamp(Math.round(y), -WORLD_HALF + 55, WORLD_HALF - 55);
    if (Math.hypot(tx - p.x, ty - p.y) > 250) {
      this.clients.get(p.id)?.send({ type: 'toast', text: '📏 放置位置太远了，请走近一点再建造！' });
      return;
    }

    const sDef = ENTITY_DEFS[recipe.structure];
    if (!sDef) return;

    // 碰撞检查（墙体允许紧凑并排建造）
    for (const ent of this.entities.values()) {
      const eDef = ENTITY_DEFS[ent.type];
      if (!eDef?.solid && !eDef?.isFire) continue;
      const reqDist = sDef.isWall
        ? (eDef?.isWall ? 28 : (ent.radius || 20) + 14)
        : (ent.radius || 20) + (sDef.radius || 20);
      if (Math.hypot(ent.x - tx, ent.y - ty) < reqDist) {
        this.clients.get(p.id)?.send({ type: 'toast', text: '🚧 此处已有障碍物，换个空地放置吧！' });
        return;
      }
    }

    for (const req of recipe.cost) {
      this._consumePlayerItem(p, req.id, req.count);
    }

    if (recipe.tech > 0 && !check.learned) {
      p.unlockedRecipes.push(recipe.id);
      const bonus = p.charId === 'wilson' ? 20 : 15;
      p.sanity = Math.min(p.maxSanity, p.sanity + bonus);
    }

    const id = this.allocId('ent');
    const ent = {
      id,
      type: recipe.structure,
      x: tx,
      y: ty,
      radius: sDef.radius || 22,
      hp: sDef.maxHp || 250,
      maxHp: sDef.maxHp || 250,
      ready: true,
    };
    if (sDef.isFire) ent.fuel = sDef.startFuel;
    if (sDef.isContainer) ent.slots = Array(sDef.slots || CHEST_SIZE).fill(null);
    if (sDef.isCrockPot) {
      ent.slots = [null, null, null, null];
      ent.cooking = false;
      ent.cookTimer = 0;
      ent.resultItem = null;
    }
    if (sDef.isTent) ent.uses = sDef.uses || 8;

    this.entities.set(id, ent);
    this._pushFx({ kind: 'build', x: tx, y: ty });
  }

  _handleContainerTransfer(p, entityId, from, index) {
    if (p.isGhost) return;
    const ent = this.entities.get(entityId);
    if (!ent || Math.hypot(ent.x - p.x, ent.y - p.y) > INTERACT_RANGE + 55) return;
    const eDef = ENTITY_DEFS[ent.type];
    if (!eDef?.isContainer && !eDef?.isCrockPot) return;
    if (eDef.isCrockPot && (ent.cooking || ent.resultItem)) return;

    if (from === 'inv') {
      if (index < 0 || index >= INVENTORY_SIZE || !p.inventory[index]) return;
      const src = p.inventory[index];
      const itemDef = ITEMS[src.id];

      if (eDef.isCrockPot) {
        if (!itemDef?.potTags) {
          this.clients.get(p.id)?.send({ type: 'toast', text: '🍲 该物品不能放进烹饪锅！（只接受肉、蛋、果蔬、冰块或树枝）' });
          return;
        }
        const emptyIdx = ent.slots.findIndex((s) => s === null);
        if (emptyIdx < 0) return;
        ent.slots[emptyIdx] = { id: src.id, count: 1 };
        this._consumeSlotCount(p, index, 1);
      } else {
        // 储物箱/冰箱：支持堆叠合并或放入空格
        const maxStack = itemDef?.stack || 1;
        let remain = src.count;
        if (maxStack > 1) {
          for (let i = 0; i < ent.slots.length && remain > 0; i++) {
            const cs = ent.slots[i];
            if (cs && cs.id === src.id && cs.count < maxStack) {
              const add = Math.min(remain, maxStack - cs.count);
              cs.count += add;
              remain -= add;
            }
          }
        }
        for (let i = 0; i < ent.slots.length && remain > 0; i++) {
          if (!ent.slots[i]) {
            ent.slots[i] = { id: src.id, count: remain, durability: src.durability, extra: src.extra };
            remain = 0;
          }
        }
        if (remain <= 0) p.inventory[index] = null;
        else src.count = remain;
      }
    } else if (from === 'container') {
      if (!ent.slots || index < 0 || index >= ent.slots.length || !ent.slots[index]) return;
      const cs = ent.slots[index];
      const leftover = this._addItemToPlayer(p, cs.id, cs.count, cs.durability, cs.extra, false);
      if (leftover <= 0) ent.slots[index] = null;
      else cs.count = leftover;
    }
  }

  _handleStartCooking(p, entityId) {
    if (p.isGhost) return;
    const ent = this.entities.get(entityId);
    if (!ent || ENTITY_DEFS[ent.type]?.isCrockPot !== true) return;
    if (ent.cooking || ent.resultItem) return;
    if (Math.hypot(ent.x - p.x, ent.y - p.y) > INTERACT_RANGE + 55) return;

    if (!ent.slots || ent.slots.some((s) => !s)) {
      this.clients.get(p.id)?.send({ type: 'toast', text: '🍲 烹饪锅必须放满 4 格食材才能点火开煮！' });
      return;
    }

    const ids = ent.slots.map((s) => s.id);
    ent.pendingResult = evaluateCrockPot(ids);
    ent.slots = [null, null, null, null];
    ent.cooking = true;
    ent.cookTimer = 6.5;
    this._pushFx({ kind: 'sizzle', x: ent.x, y: ent.y });
  }

  // ==================== 物品栏工具方法 ====================
  _addItemToPlayer(p, itemId, count = 1, durability = null, extra = null, dropOverflow = true) {
    const def = ITEMS[itemId];
    if (!def) return 0;
    const maxStack = def.stack || 1;
    let remain = count;

    if (maxStack > 1) {
      for (let i = 0; i < INVENTORY_SIZE && remain > 0; i++) {
        const s = p.inventory[i];
        if (s && s.id === itemId && s.count < maxStack) {
          const add = Math.min(remain, maxStack - s.count);
          s.count += add;
          remain -= add;
        }
      }
    }

    for (let i = 0; i < INVENTORY_SIZE && remain > 0; i++) {
      if (!p.inventory[i]) {
        const put = Math.min(remain, maxStack);
        p.inventory[i] = {
          id: itemId,
          count: put,
          durability: durability !== null ? durability : (def.maxDurability ?? null),
          extra: extra ? { ...extra } : (def.isThermalStone ? { temp: 25 } : null),
        };
        remain -= put;
      }
    }

    if (remain > 0 && dropOverflow) {
      this._spawnGroundItem(itemId, remain, p.x + 15, p.y + 15, durability, extra);
      return 0;
    }
    return remain;
  }

  _countPlayerItem(p, itemId) {
    let total = 0;
    for (const s of p.inventory) {
      if (s && s.id === itemId) total += s.count;
    }
    for (const eq of Object.values(p.equip)) {
      if (eq && eq.id === itemId) total += eq.count || 1;
    }
    return total;
  }

  _consumePlayerItem(p, itemId, count) {
    let need = count;
    for (let i = 0; i < INVENTORY_SIZE && need > 0; i++) {
      const s = p.inventory[i];
      if (s && s.id === itemId) {
        const take = Math.min(need, s.count);
        s.count -= take;
        need -= take;
        if (s.count <= 0) p.inventory[i] = null;
      }
    }
    if (need > 0) {
      for (const slot of Object.values(EQUIP_SLOTS)) {
        if (need > 0 && p.equip[slot]?.id === itemId) {
          p.equip[slot] = null;
          need -= 1;
        }
      }
    }
  }

  _consumeSlotCount(p, idx, count) {
    const s = p.inventory[idx];
    if (!s) return;
    s.count -= count;
    if (s.count <= 0) p.inventory[idx] = null;
  }

  _spawnGroundItem(itemId, count, x, y, durability = null, extra = null) {
    if (!ITEMS[itemId] || count <= 0) return;
    const id = this.allocId('itm');
    this.groundItems.set(id, {
      id,
      itemId,
      count,
      x: clamp(Math.round(x), -WORLD_HALF + 35, WORLD_HALF - 35),
      y: clamp(Math.round(y), -WORLD_HALF + 35, WORLD_HALF - 35),
      durability,
      extra,
    });
  }

  // ==================== 远程投射物与团队战争迷雾探索 ====================
  _spawnProjectile(cfg) {
    const id = this.allocId('prj');
    const dx = cfg.tx - cfg.x;
    const dy = cfg.ty - cfg.y;
    const len = Math.hypot(dx, dy) || 1;
    this.projectiles.set(id, {
      id,
      kind: cfg.kind || 'dart',
      x: cfg.x,
      y: cfg.y,
      vx: (dx / len) * (cfg.speed || 420),
      vy: (dy / len) * (cfg.speed || 420),
      damage: cfg.damage || 30,
      ownerPlayerId: cfg.ownerPlayerId || null,
      ownerMobId: cfg.ownerMobId || null,
      ownerName: cfg.ownerName || '远程攻击',
      life: 1.35,
    });
  }

  _updateProjectiles(dt) {
    for (const [id, prj] of this.projectiles.entries()) {
      prj.life -= dt;
      prj.x += prj.vx * dt;
      prj.y += prj.vy * dt;
      if (prj.life <= 0 || Math.abs(prj.x) > WORLD_HALF || Math.abs(prj.y) > WORLD_HALF) {
        this.projectiles.delete(id);
        continue;
      }

      if (prj.ownerPlayerId) {
        const attacker = this.players.get(prj.ownerPlayerId) || null;
        let hitDone = false;
        for (const mob of this.mobs.values()) {
          if (mob.type === 'abigail') continue;
          if (mob.type === 'pigman' && mob.leaderId === prj.ownerPlayerId) continue;
          if (Math.hypot(mob.x - prj.x, (mob.y - 14) - prj.y) < (mob.radius || 16) + 14) {
            this._damageMob(mob, prj.damage, attacker);
            hitDone = true;
            break;
          }
        }
        if (!hitDone && this.pvp) {
          for (const op of this.players.values()) {
            if (op.id !== prj.ownerPlayerId && !op.isGhost && Math.hypot(op.x - prj.x, (op.y - 16) - prj.y) < 24) {
              this._damagePlayer(op, prj.damage, attacker?.name || '吹箭', false);
              hitDone = true;
              break;
            }
          }
        }
        if (hitDone) this.projectiles.delete(id);
      } else if (prj.ownerMobId) {
        for (const p of this.players.values()) {
          if (!p.isGhost && Math.hypot(p.x - prj.x, (p.y - 16) - prj.y) < 24) {
            this._damagePlayer(p, prj.damage, prj.ownerName, false);
            this.projectiles.delete(id);
            break;
          }
        }
      }
    }
  }

  _updateTeamExploration() {
    const ts = this.tileSize;
    const cols = this.gridCols;
    const radTiles = 5; // 周围 ~400px 视野点亮地图
    for (const p of this.players.values()) {
      const pc = Math.floor((p.x + WORLD_HALF) / ts);
      const pr = Math.floor((p.y + WORLD_HALF) / ts);
      for (let dr = -radTiles; dr <= radTiles; dr++) {
        const r = pr + dr;
        if (r < 0 || r >= cols) continue;
        for (let dc = -radTiles; dc <= radTiles; dc++) {
          if (dr * dr + dc * dc > radTiles * radTiles + 2) continue;
          const c = pc + dc;
          if (c < 0 || c >= cols) continue;
          const idx = r * cols + c;
          if (!this.exploredTiles.has(idx)) {
            this.exploredTiles.add(idx);
            this.newlyExplored.push(idx);
          }
        }
      }
    }
  }

  // ==================== 视野同步与存档 ====================
  _buildMapLandmarks() {
    const marks = [];
    for (const ent of this.entities.values()) {
      const def = ENTITY_DEFS[ent.type];
      if (def?.mapIcon) {
        marks.push({
          id: ent.id,
          type: ent.type,
          x: ent.x,
          y: ent.y,
        });
      }
    }
    return marks;
  }

  _sendSnapshots(dayInfo) {
    // 所有在线玩家全局摘要（供大地图与左上角队友栏实时显示位置与生命状态！）
    const allPlayersBrief = [];
    for (const p of this.players.values()) {
      allPlayersBrief.push({
        id: p.id,
        name: p.name,
        charId: p.charId,
        x: Math.round(p.x),
        y: Math.round(p.y),
        facing: p.facing,
        hp: Math.round(p.hp),
        maxHp: p.maxHp,
        isGhost: p.isGhost,
        hand: p.equip[EQUIP_SLOTS.HAND]?.id || null,
        body: p.equip[EQUIP_SLOTS.BODY]?.id || null,
        head: p.equip[EQUIP_SLOTS.HEAD]?.id || null,
        swing: p.swingAnim > 0 ? 1 : 0,
        hurt: p.hurtAnim > 0 ? 1 : 0,
        mighty: p.charId === 'wolfgang' ? (p.hunger > 180 ? 2 : (p.hunger < 60 ? 0 : 1)) : 1,
        beard: p.beardDays >= 6 ? 1 : 0,
      });
    }

    const sendMapUpdate = this.tickCount % 30 === 0;
    const mapLandmarks = sendMapUpdate ? this._buildMapLandmarks() : undefined;
    const exploredDelta = this.newlyExplored.length > 0 ? [...this.newlyExplored] : undefined;

    for (const [cid, client] of this.clients.entries()) {
      const me = this.players.get(cid);
      if (!me) continue;

      const nearbyEntities = [];
      for (const ent of this.entities.values()) {
        if (Math.abs(ent.x - me.x) > VIEW_RADIUS || Math.abs(ent.y - me.y) > VIEW_RADIUS) continue;
        const item = {
          id: ent.id,
          t: ent.type,
          x: ent.x,
          y: ent.y,
        };
        if (ent.ready === false) item.r = 0;
        if (ent.fuel !== undefined) item.f = Math.round(ent.fuel);
        if (ent.burning > 0) item.b = 1;
        if (ent.tier) item.tr = ent.tier;
        if (ent.hasEgg) item.egg = 1;
        if (ent.caughtItem) item.ci = ent.caughtItem;
        if (ent.sprung) item.sp = 1;
        if (ent.dryingItem) item.di = ent.dryingItem;
        if (ent.driedItem) item.dr = ent.driedItem;
        if (ent.cooking) item.ck = Math.ceil(ent.cookTimer);
        if (ent.resultItem) item.ri = ent.resultItem;
        if (ent.usedBy?.includes(me.playerKey)) item.used = 1;
        if (ent.hp !== undefined && ent.maxHp && ent.hp < ent.maxHp) item.hp = Math.round(ent.hp);
        nearbyEntities.push(item);
      }

      const nearbyMobs = [];
      for (const mob of this.mobs.values()) {
        if (Math.abs(mob.x - me.x) > VIEW_RADIUS || Math.abs(mob.y - me.y) > VIEW_RADIUS) continue;
        nearbyMobs.push({
          id: mob.id,
          t: mob.type,
          x: Math.round(mob.x),
          y: Math.round(mob.y),
          f: mob.facing,
          hp: Math.round(mob.hp),
          mhp: mob.maxHp,
          w: mob.windupTimer > 0 ? 1 : 0,
          ally: mob.leaderId ? 1 : 0,
        });
      }

      const nearbyItems = [];
      for (const gi of this.groundItems.values()) {
        if (Math.abs(gi.x - me.x) > VIEW_RADIUS || Math.abs(gi.y - me.y) > VIEW_RADIUS) continue;
        nearbyItems.push({
          id: gi.id,
          i: gi.itemId,
          c: gi.count,
          x: gi.x,
          y: gi.y,
        });
      }

      const nearbyProjectiles = [];
      for (const prj of this.projectiles.values()) {
        if (Math.abs(prj.x - me.x) > VIEW_RADIUS || Math.abs(prj.y - me.y) > VIEW_RADIUS) continue;
        nearbyProjectiles.push({
          id: prj.id,
          k: prj.kind,
          x: Math.round(prj.x),
          y: Math.round(prj.y),
          vx: Math.round(prj.vx),
          vy: Math.round(prj.vy),
        });
      }

      let openContainer = null;
      if (me.openContainerId && this.entities.has(me.openContainerId)) {
        const ce = this.entities.get(me.openContainerId);
        openContainer = {
          id: ce.id,
          type: ce.type,
          slots: ce.slots,
          cooking: Boolean(ce.cooking),
          cookTimer: Math.ceil(ce.cookTimer || 0),
          resultItem: ce.resultItem || null,
        };
      }

      const nearbyFx = this.fxEvents.filter(
        (fx) => fx.kind === 'sfx_global' || fx.kind === 'shake' || (Math.abs((fx.x || 0) - me.x) < VIEW_RADIUS && Math.abs((fx.y || 0) - me.y) < VIEW_RADIUS)
      );

      client.send({
        type: 'state',
        world: {
          day: dayInfo.day,
          dayProgress: Number(dayInfo.dayProgress.toFixed(4)),
          phase: dayInfo.phase,
          isFullMoon: dayInfo.isFullMoon,
          season: dayInfo.season,
          seasonName: dayInfo.seasonName,
          dayInSeason: dayInfo.dayInSeason,
          segments: dayInfo.segments,
          isRaining: this.isRaining,
          ambientTemp: Math.round(dayInfo.ambientTemp),
        },
        self: {
          hp: Number(me.hp.toFixed(1)),
          maxHp: me.maxHp,
          hunger: Number(me.hunger.toFixed(1)),
          maxHunger: me.maxHunger,
          sanity: Number(me.sanity.toFixed(1)),
          maxSanity: me.maxSanity,
          bodyTemp: Number(me.bodyTemp.toFixed(1)),
          moisture: Math.round(me.moisture),
          isGhost: me.isGhost,
          inDarkness: Boolean(me.inDarkness),
          techLevel: this.getPlayerTechLevel(me),
          unlockedRecipes: me.unlockedRecipes,
          inventory: me.inventory,
          equip: me.equip,
          openContainer,
        },
        players: allPlayersBrief,
        entities: nearbyEntities,
        mobs: nearbyMobs,
        items: nearbyItems,
        projectiles: nearbyProjectiles.length > 0 ? nearbyProjectiles : undefined,
        fx: nearbyFx.length > 0 ? nearbyFx : undefined,
        mapLandmarks,
        exploredDelta,
      });
    }
  }

  _serializePlayerForSave(p) {
    return {
      charId: p.charId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      facing: p.facing,
      hp: p.hp,
      maxHp: p.maxHp,
      hunger: p.hunger,
      maxHunger: p.maxHunger,
      sanity: p.sanity,
      maxSanity: p.maxSanity,
      bodyTemp: p.bodyTemp,
      moisture: p.moisture,
      beardDays: p.beardDays || 0,
      gearUpgrades: p.gearUpgrades || 0,
      isGhost: p.isGhost,
      ghostSince: p.ghostSince || 0,
      inventory: p.inventory,
      equip: p.equip,
      unlockedRecipes: p.unlockedRecipes,
    };
  }

  saveNow() {
    for (const p of this.players.values()) {
      this.savedPlayers[p.playerKey] = this._serializePlayerForSave(p);
    }
    const info = this.getDayInfo();
    const snapshot = {
      saveVersion: 2,
      savedAt: Date.now(),
      roomName: this.name,
      pvp: this.pvp,
      difficulty: this.difficulty,
      seed: this.seed,
      seedNum: this.seedNum,
      worldSize: this.worldSize,
      tileSize: this.tileSize,
      gridCols: this.gridCols,
      biomeOrder: this.biomeOrder,
      biomeGrid: this.biomeGrid,
      roads: this.roads,
      exploredTiles: [...this.exploredTiles],
      nextId: this.nextId,
      startSeasonIdx: this.startSeasonIdx,
      worldTime: this.worldTime,
      day: info.day,
      season: info.season,
      isRaining: this.isRaining,
      weatherTimer: this.weatherTimer,
      nextHoundTime: this.nextHoundTime,
      deerclopsSpawnedSeasons: this.deerclopsSpawnedSeasons,
      entities: [...this.entities.values()],
      mobs: [...this.mobs.values()].filter((m) => m.type !== 'abigail'),
      groundItems: [...this.groundItems.values()],
      savedPlayers: this.savedPlayers,
    };
    return saveWorldToDisk(this.saveId, snapshot);
  }

  _restoreFromSnapshot(snap) {
    this.name = snap.roomName || this.name;
    this.pvp = Boolean(snap.pvp);
    this.difficulty = snap.difficulty || 'standard';
    this.seed = snap.seed || 'loaded';
    this.seedNum = snap.seedNum || 12345;
    this.worldSize = snap.worldSize;
    this.tileSize = snap.tileSize;
    this.gridCols = snap.gridCols;
    this.biomeOrder = snap.biomeOrder;
    this.biomeGrid = snap.biomeGrid;
    this.roads = snap.roads || [];
    this.exploredTiles = new Set(snap.exploredTiles || []);
    this.nextId = snap.nextId || 5000;
    this.startSeasonIdx = snap.startSeasonIdx || 0;
    this.worldTime = snap.worldTime || 12;
    this.isRaining = Boolean(snap.isRaining);
    this.weatherTimer = snap.weatherTimer || 60;
    this.nextHoundTime = snap.nextHoundTime || this.worldTime + DAY_DURATION * 2;
    this.houndWarned = false;
    this.deerclopsSpawnedSeasons = snap.deerclopsSpawnedSeasons || {};
    this.pendingBossTimer = 0;

    this.entities = new Map((snap.entities || []).map((e) => [e.id, e]));
    this.mobs = new Map((snap.mobs || []).map((m) => [m.id, m]));
    this.groundItems = new Map((snap.groundItems || []).map((g) => [g.id, g]));
    this.savedPlayers = snap.savedPlayers || {};
  }

  destroy() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.loopHandle);
    this.onEmpty?.(this.id);
  }
}
