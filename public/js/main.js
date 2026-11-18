// 客户端总控入口：大厅交互、网络同步、键鼠操作、智能交互提示与 60FPS 渲染调度
import { NetClient } from './net.js';
import { WorldRenderer } from './renderer.js';
import { GameUI } from './ui.js';
import { sound } from './audio.js';
import { ENTITY_DEFS, MOB_DEFS } from '../shared/entities.js';
import { ITEMS } from '../shared/items.js';

function getOrCreatePlayerToken() {
  let tk = localStorage.getItem('starve_player_token');
  if (!tk) {
    tk = `tk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('starve_player_token', tk);
  }
  return tk;
}

const app = {
  playerToken: getOrCreatePlayerToken(),
  selectedCharId: localStorage.getItem('starve_char_id') || 'wilson',
  lanUrls: [],
  inGame: false,
  isHost: false,
  pvp: false,
  selfId: null,
  worldStatic: null,
  latestState: null,
  mapLandmarks: [],
  placementMode: null,
  mouseScreen: { x: 0, y: 0 },
  mouseWorld: { x: 0, y: 0 },
  hoverTarget: null,
  keys: new Set(),
  lastMoveSent: { x: 0, y: 0 },
};

const canvas = document.getElementById('game-canvas');
const renderer = new WorldRenderer(canvas);

const ui = new GameUI({
  getSelfCharId: () => {
    const me = app.latestState?.players?.find((p) => p.id === app.selfId);
    return me?.charId || app.selectedCharId;
  },
  getWorldStatic: () => app.worldStatic,
  onCraft: (recipeId) => {
    net.send({ type: 'craft', recipeId });
  },
  onStartPlacement: (recipe) => {
    app.placementMode = { recipeId: recipe.id, structure: recipe.structure, name: recipe.name };
    document.getElementById('placement-bar').classList.remove('hidden');
    document.getElementById('placement-text').textContent =
      `🔨 正在选址建造【${recipe.name}】：左键地面放置（按住 Shift 连续建造），右键或 Esc 取消`;
  },
  onUseSlot: (slotIndex, secondary) => {
    net.send({ type: 'use_slot', slotIndex, secondary });
  },
  onSwapSlot: (fromIdx, toIdx) => {
    net.send({ type: 'swap_slot', fromIdx, toIdx });
  },
  onDropSlot: (slotIndex, one) => {
    net.send({ type: 'drop_slot', slotIndex, one });
  },
  onUnequip: (slot) => {
    net.send({ type: 'unequip', slot });
  },
  onContainerTransfer: (entityId, from, index) => {
    net.send({ type: 'container_transfer', entityId, from, index });
  },
  onStartCooking: (entityId) => {
    net.send({ type: 'cook_pot_start', entityId });
  },
  onMapPing: (x, y) => {
    net.send({ type: 'map_ping', x, y });
  },
  onCloseContainer: () => {
    if (app.latestState?.self) {
      net.send({ type: 'click_ground', x: renderer.camX, y: renderer.camY });
    }
  },
  onRequestCraftRefresh: () => {
    if (app.latestState) {
      ui.updateHUD(app.latestState, app.selfId, app.worldStatic, app.mapLandmarks, renderer.mapPings);
    }
  },
});

const net = new NetClient({
  onOpen: () => {
    net.send({ type: 'refresh_lobby' });
  },
  onPing: (ms) => {
    document.getElementById('hud-ping').textContent = `${ms} ms`;
  },
  onClose: () => {
    if (app.inGame) {
      ui.showToast('⚠️ 与局域网主机连接断开，正在尝试自动重连...');
    }
  },
  onMessage: (msg) => handleServerMessage(msg),
});

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'welcome':
    case 'lobby_update': {
      if (msg.lanUrls) {
        app.lanUrls = msg.lanUrls;
        document.getElementById('lan-url-text').textContent = msg.lanUrls[0] || window.location.origin;
      }
      ui.renderLobbyLists(
        msg.rooms || [],
        msg.saves || [],
        (roomId) => joinRoom(roomId),
        (saveId, roomName) => createRoomFromSave(saveId, roomName)
      );
      break;
    }

    case 'joined_room': {
      app.inGame = true;
      app.selfId = msg.selfId;
      app.isHost = Boolean(msg.isHost);
      app.pvp = Boolean(msg.pvp);
      app.worldStatic = msg.worldStatic;
      app.mapLandmarks = msg.mapLandmarks || [];
      app.latestState = null;
      app.placementMode = null;

      ui.bakeStaticMap(msg.worldStatic, msg.explored || []);
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      document.getElementById('hud-room-title').textContent = `🏕️ ${msg.roomName}`;
      updateHostButtons();
      renderer.resize();
      renderer.resetZoom();
      break;
    }

    case 'left_room': {
      app.inGame = false;
      app.latestState = null;
      ui.updateCursorHint(null, 0, 0);
      document.getElementById('game-screen').classList.add('hidden');
      document.getElementById('lobby-screen').classList.remove('hidden');
      ui.renderLobbyLists(
        msg.rooms || [],
        msg.saves || [],
        (roomId) => joinRoom(roomId),
        (saveId, roomName) => createRoomFromSave(saveId, roomName)
      );
      break;
    }

    case 'host_changed': {
      app.isHost = Boolean(msg.isHost);
      updateHostButtons();
      if (app.isHost) ui.showToast('👑 你已成为当前房间的新房主！');
      break;
    }

    case 'room_config': {
      app.pvp = Boolean(msg.pvp);
      updateHostButtons();
      break;
    }

    case 'map_ping': {
      renderer.addMapPing(msg.sender, msg.x, msg.y, performance.now() / 1000);
      sound.play('ping');
      break;
    }

    case 'state': {
      app.latestState = msg;
      if (msg.mapLandmarks) {
        app.mapLandmarks = msg.mapLandmarks;
      }
      if (msg.fx) {
        renderer.ingestFx(msg.fx, performance.now() / 1000);
        for (const fx of msg.fx) {
          if (fx.kind === 'sfx_global') sound.play(fx.sfx);
          else sound.play(fx.kind);
        }
      }
      ui.updateHUD(msg, app.selfId, app.worldStatic, app.mapLandmarks, renderer.mapPings);
      break;
    }

    case 'chat': {
      ui.appendChat(msg.sender, msg.text, msg.color);
      break;
    }

    case 'banner': {
      ui.showBanner(msg.text, msg.tone);
      break;
    }

    case 'toast': {
      ui.showToast(msg.text);
      break;
    }

    case 'error': {
      alert(msg.message);
      break;
    }

    default:
      break;
  }
}

function updateHostButtons() {
  document.querySelectorAll('.host-only').forEach((el) => {
    el.classList.toggle('hidden', !app.isHost);
  });
  const pvpBtn = document.getElementById('btn-toggle-pvp');
  pvpBtn.textContent = app.pvp ? '⚔️ PvP开' : '🛡️ 合作';
}

function getPlayerName() {
  const input = document.getElementById('player-name-input');
  const val = input.value.trim() || `幸存者${Math.floor(100 + Math.random() * 899)}`;
  input.value = val;
  localStorage.setItem('starve_player_name', val);
  return val;
}

function joinRoom(roomId) {
  net.send({
    type: 'join_room',
    roomId,
    playerName: getPlayerName(),
    charId: app.selectedCharId,
    playerToken: app.playerToken,
  });
}

function createRoomFromSave(saveId, roomName) {
  net.send({
    type: 'create_room',
    roomName,
    loadSaveId: saveId,
    playerName: getPlayerName(),
    charId: app.selectedCharId,
    playerToken: app.playerToken,
  });
}

// ==================== 大厅界面事件绑定 ====================
function initLobbyUI() {
  const savedName = localStorage.getItem('starve_player_name');
  const nameInput = document.getElementById('player-name-input');
  nameInput.value = savedName || `探险家${Math.floor(10 + Math.random() * 89)}`;

  const selectChar = (cid) => {
    app.selectedCharId = cid;
    localStorage.setItem('starve_char_id', cid);
    ui.renderCharacterSelector(cid, selectChar);
  };
  selectChar(app.selectedCharId);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('btn-refresh-rooms').addEventListener('click', () => {
    net.send({ type: 'refresh_lobby' });
  });

  document.getElementById('btn-create-room').addEventListener('click', () => {
    net.send({
      type: 'create_room',
      roomName: document.getElementById('create-room-name').value.trim() || '饥荒联机营地',
      startSeason: document.getElementById('create-season').value,
      difficulty: document.getElementById('create-difficulty').value,
      pvp: document.getElementById('create-pvp').value === '1',
      seed: document.getElementById('create-seed').value.trim(),
      playerName: getPlayerName(),
      charId: app.selectedCharId,
      playerToken: app.playerToken,
    });
  });

  const copyLanUrl = () => {
    const url = app.lanUrls[0] || window.location.origin;
    navigator.clipboard?.writeText(url).then(() => {
      ui.showToast(`✅ 已复制局域网联机地址：${url}`);
    }).catch(() => {
      prompt('复制以下局域网联机地址发送给好友：', url);
    });
  };
  document.getElementById('btn-copy-lan').addEventListener('click', copyLanUrl);
  document.getElementById('btn-ingame-copy').addEventListener('click', copyLanUrl);

  document.getElementById('btn-mute').addEventListener('click', (ev) => {
    const muted = sound.toggleMute();
    ev.currentTarget.textContent = muted ? '🔇 静音' : '🔊 音效';
  });
  document.getElementById('btn-save-world').addEventListener('click', () => {
    net.send({ type: 'save_world' });
  });
  document.getElementById('btn-toggle-pvp').addEventListener('click', () => {
    net.send({ type: 'toggle_pvp' });
  });
  document.getElementById('btn-leave-room').addEventListener('click', () => {
    net.send({ type: 'leave_room' });
  });
  document.getElementById('btn-cancel-place').addEventListener('click', () => cancelPlacement());
}

function cancelPlacement() {
  app.placementMode = null;
  document.getElementById('placement-bar').classList.add('hidden');
}

// ==================== 游戏内鼠标悬停目标检测与智能操作提示 ====================
function findTargetAtWorld(wx, wy) {
  const st = app.latestState;
  if (!st) return null;

  for (const mob of renderer.interpMobs.values()) {
    if (mob.t === 'abigail') continue;
    const hitR = MOB_DEFS[mob.t]?.isBoss ? 52 : 34;
    if (Math.hypot(mob.x - wx, (mob.y - 16) - wy) < hitR) {
      return { kind: 'mob', id: mob.id, type: mob.t, data: mob };
    }
  }

  if (app.pvp) {
    for (const pl of renderer.interpPlayers.values()) {
      if (pl.id !== app.selfId && !pl.isGhost && Math.hypot(pl.x - wx, (pl.y - 18) - wy) < 28) {
        return { kind: 'player', id: pl.id, name: pl.name };
      }
    }
  }

  for (const gi of st.items) {
    if (Math.hypot(gi.x - wx, (gi.y - 6) - wy) < 24) {
      return { kind: 'item', id: gi.id, itemId: gi.i, count: gi.c };
    }
  }

  for (const ent of st.entities) {
    const def = ENTITY_DEFS[ent.t];
    if (!def || ent.t === 'rabbit_hole') continue;
    const hitR = Math.max(24, (def.radius || 20) + 10);
    if (Math.hypot(ent.x - wx, (ent.y - 12) - wy) < hitR) {
      return { kind: 'ent', id: ent.id, type: ent.t, data: ent };
    }
  }
  return null;
}

function describeHoverAction(hit) {
  if (!hit || app.placementMode) return null;
  const self = app.latestState?.self;
  if (!self) return null;

  if (self.isGhost) {
    if (hit.kind === 'ent' && (hit.type === 'touch_stone' || hit.type === 'portal')) {
      return `👻 左键: 作祟【${ENTITY_DEFS[hit.type]?.name}】复活`;
    }
    if (hit.kind === 'item' && hit.itemId === 'life_amulet') {
      return '👻 左键: 作祟【重生护符】复活';
    }
    return null;
  }

  const handId = self.equip?.hand?.id;
  const handDef = handId ? ITEMS[handId] : null;

  if (hit.kind === 'item') {
    const nm = ITEMS[hit.itemId]?.name || hit.itemId;
    return `✋ 左键: 拾取【${nm}${hit.count > 1 ? ` x${hit.count}` : ''}】`;
  }
  if (hit.kind === 'player') {
    return `⚔️ 左键: 攻击玩家【${hit.name}】`;
  }
  if (hit.kind === 'mob') {
    const mName = MOB_DEFS[hit.type]?.name || hit.type;
    if (hit.type === 'pigman') {
      return `🍖 左键: 喂肉雇佣【${mName}】 | ⚔️ Ctrl+左键: 强行攻击`;
    }
    const atkIcon = handDef?.rangedDamage ? '🎯 远程射击' : '⚔️ 攻击';
    return `${atkIcon}: 【${mName}】`;
  }
  if (hit.kind === 'ent') {
    const def = ENTITY_DEFS[hit.type];
    const ent = hit.data;
    if (!def) return null;

    let mainAct = `🔍 查看【${def.name}】`;
    if (hit.type === 'spider_den') mainAct = `⚔️ 左键: 攻击【${def.name}】`;
    else if (hit.type === 'pig_king') mainAct = '👑 左键: 献上肉食换取黄金';
    else if (def.isCrockPot) mainAct = ent.ri ? `🍲 左键: 收获【${ITEMS[ent.ri]?.name}】` : '🍲 左键: 打开烹饪锅';
    else if (def.isDryingRack) mainAct = ent.dr ? `🥩 左键: 收取【${ITEMS[ent.dr]?.name}】` : '🥩 左键: 悬挂生肉风干';
    else if (def.isContainer) mainAct = `📦 左键: 打开【${def.name}】`;
    else if (def.isFire) mainAct = '🔥 左键: 添柴或烤熟生食';
    else if (def.isTent) mainAct = '⛺ 左键: 黄昏/夜晚小睡恢复生命理智';
    else if (def.isToothTrap) mainAct = ent.sp ? '⚙️ 左键: 重置犬牙陷阱' : '🪤 左键: 收起犬牙陷阱';
    else if (def.isTrap) mainAct = ent.ci ? '🐰 左键: 收获猎物' : '🪤 左键: 收起捕兽笼';
    else if (def.category === 'pickable') mainAct = ent.r === 0 ? `🌱 ${def.name}（生长中）` : `✋ 左键: 采集【${def.name}】`;
    else if (def.workType === 'chop') mainAct = `🪓 左键: 砍伐【${def.name}】`;
    else if (def.workType === 'mine') mainAct = `⛏️ 左键: 开采【${def.name}】`;
    else if (def.workType === 'dig') mainAct = `🛠️ 左键: 铲除【${def.name}】`;
    else if (def.workType === 'net') mainAct = `🕸️ 左键: 用捕虫网捕捉【${def.name}】`;

    // 拼接手持特殊工具时的 Ctrl+左键 高阶提示！
    const extras = [];
    if (handDef?.hammerPower && (def.category === 'structure' || hit.type === 'pig_house' || hit.type === 'skeleton')) {
      extras.push('🔨 Ctrl+左键: 铁锤拆毁返料');
    }
    if (handDef?.digPower && def.transplantItem) {
      extras.push('🌱 Ctrl+左键: 连根铲起移植');
    }
    if (handDef?.fireWeapon && def.flammable && !ent.b) {
      extras.push('🔥 Ctrl+左键: 点燃烧炭');
    }

    return extras.length > 0 ? `${mainAct}  |  ${extras.join(' ')}` : mainAct;
  }
  return null;
}

function initInputHandlers() {
  canvas.addEventListener('mousemove', (ev) => {
    app.mouseScreen.x = ev.clientX;
    app.mouseScreen.y = ev.clientY;
    app.mouseWorld = renderer.screenToWorld(ev.clientX, ev.clientY);
    app.hoverTarget = findTargetAtWorld(app.mouseWorld.x, app.mouseWorld.y);
    ui.updateCursorHint(describeHoverAction(app.hoverTarget), ev.clientX, ev.clientY);
  });

  canvas.addEventListener('mouseleave', () => {
    ui.updateCursorHint(null, 0, 0);
  });

  // 鼠标滚轮平滑缩放视野！
  canvas.addEventListener('wheel', (ev) => {
    if (!app.inGame) return;
    ev.preventDefault();
    renderer.adjustZoom(ev.deltaY < 0 ? 0.1 : -0.1);
  }, { passive: false });

  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (app.placementMode) {
      cancelPlacement();
    }
  });

  canvas.addEventListener('mousedown', (ev) => {
    if (!app.inGame) return;
    if (ev.button === 1) {
      ev.preventDefault();
      renderer.resetZoom();
      return;
    }
    if (ev.button !== 0) return;

    const mw = renderer.screenToWorld(ev.clientX, ev.clientY);

    if (app.placementMode) {
      net.send({
        type: 'place_structure',
        recipeId: app.placementMode.recipeId,
        x: mw.x,
        y: mw.y,
      });
      if (!ev.shiftKey) cancelPlacement();
      return;
    }

    const hit = findTargetAtWorld(mw.x, mw.y);
    if (!hit) {
      net.send({ type: 'click_ground', x: mw.x, y: mw.y });
      return;
    }

    if (hit.kind === 'item') {
      net.send({ type: 'interact_target', targetId: hit.id });
    } else if (hit.kind === 'player') {
      net.send({ type: 'attack_target', targetId: hit.id });
    } else if (hit.kind === 'mob') {
      if (hit.type === 'pigman' && !ev.ctrlKey) {
        net.send({ type: 'interact_target', targetId: hit.id });
      } else {
        net.send({ type: 'attack_target', targetId: hit.id });
      }
    } else if (hit.kind === 'ent') {
      const handId = app.latestState?.self?.equip?.hand?.id;
      const handDef = handId ? ITEMS[handId] : null;
      const eDef = ENTITY_DEFS[hit.type];

      // 按住 Ctrl 左键：优先检查铁锤拆建、铁铲挖苗、火把点火！
      if (ev.ctrlKey) {
        if (
          (handDef?.hammerPower && (eDef?.category === 'structure' || hit.type === 'pig_house' || hit.type === 'skeleton')) ||
          (handDef?.digPower && eDef?.transplantItem) ||
          (handDef?.fireWeapon && eDef?.flammable)
        ) {
          net.send({ type: 'alt_interact_target', targetId: hit.id });
          return;
        }
        if (hit.type === 'wood_wall' || hit.type === 'stone_wall' || hit.type === 'spider_den') {
          net.send({ type: 'attack_target', targetId: hit.id });
          return;
        }
      }

      if (hit.type === 'spider_den') {
        net.send({ type: 'attack_target', targetId: hit.id });
      } else {
        net.send({ type: 'interact_target', targetId: hit.id });
      }
    }
  });

  const chatInput = document.getElementById('chat-input');
  const sendChat = () => {
    const text = chatInput.value.trim();
    if (text) {
      net.send({ type: 'chat', text });
      chatInput.value = '';
    }
    chatInput.blur();
  };
  document.getElementById('btn-send-chat').addEventListener('click', sendChat);

  window.addEventListener('keydown', (ev) => {
    if (!app.inGame) return;
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        sendChat();
      } else if (ev.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    if (ev.key === 'Enter') {
      ev.preventDefault();
      chatInput.focus();
      return;
    }

    if (ev.key === 'Escape') {
      if (app.placementMode) cancelPlacement();
      ui.toggleMap(false);
      document.getElementById('guide-modal').classList.add('hidden');
      return;
    }

    const code = ev.code;
    if (code === 'KeyM' || code === 'Tab') {
      ev.preventDefault();
      ui.toggleMap();
      return;
    }

    if (code === 'Space') {
      ev.preventDefault();
      net.send({ type: 'quick_gather' });
      return;
    }

    if (code === 'KeyF') {
      ev.preventDefault();
      net.send({ type: 'quick_attack' });
      return;
    }

    if (/^Digit[0-9]$/.test(code)) {
      const digit = Number(code.slice(5));
      const idx = digit === 0 ? 9 : digit - 1;
      net.send({ type: 'use_slot', slotIndex: idx, secondary: false });
      return;
    }

    app.keys.add(code);
  });

  window.addEventListener('keyup', (ev) => {
    app.keys.delete(ev.code);
  });

  window.addEventListener('blur', () => {
    app.keys.clear();
  });
}

function pollMovementInput() {
  if (!app.inGame) return;
  let mx = 0;
  let my = 0;
  if (app.keys.has('KeyW') || app.keys.has('ArrowUp')) my -= 1;
  if (app.keys.has('KeyS') || app.keys.has('ArrowDown')) my += 1;
  if (app.keys.has('KeyA') || app.keys.has('ArrowLeft')) mx -= 1;
  if (app.keys.has('KeyD') || app.keys.has('ArrowRight')) mx += 1;

  if (mx !== app.lastMoveSent.x || my !== app.lastMoveSent.y) {
    app.lastMoveSent.x = mx;
    app.lastMoveSent.y = my;
    net.send({ type: 'input', moveX: mx, moveY: my });
  }
}

// ==================== 60 FPS 主渲染循环 ====================
let lastFrameTime = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  pollMovementInput();

  if (app.inGame && app.latestState) {
    const me = renderer.interpPlayers.get(app.selfId);
    let nearFire = false;
    if (me) {
      for (const ent of app.latestState.entities) {
        if ((ENTITY_DEFS[ent.t]?.isFire && (ent.f || 0) > 0) || ent.b) {
          if (Math.hypot(ent.x - me.x, ent.y - me.y) < 220) {
            nearFire = true;
            break;
          }
        }
      }
    }
    sound.tickAmbience(dt, nearFire, Boolean(app.latestState.world?.isRaining));
  }

  if (app.inGame) {
    renderer.render({
      worldStatic: app.worldStatic,
      latestState: app.latestState,
      selfId: app.selfId,
      hoverTargetId: app.hoverTarget?.id || null,
      placementMode: app.placementMode,
      mouseWorld: app.mouseWorld,
    }, dt, now / 1000);
  }

  requestAnimationFrame(frameLoop);
}

initLobbyUI();
initInputHandlers();
net.connect();
requestAnimationFrame(frameLoop);
