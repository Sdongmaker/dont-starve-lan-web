// 程序化饥荒多生态群落世界生成器
import {
  WORLD_SIZE,
  WORLD_HALF,
  TILE_SIZE,
  BIOMES,
} from '../shared/constants.js';
import { ENTITY_DEFS, MOB_DEFS } from '../shared/entities.js';

function createRng(seedStr) {
  let h = 2166136261 >>> 0;
  const s = String(seedStr || 'starve-lan-2026');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix, iy, seedNum) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seedNum, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x, y, scale, seedNum) {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);

  const v00 = hash2D(ix, iy, seedNum);
  const v10 = hash2D(ix + 1, iy, seedNum);
  const v01 = hash2D(ix, iy + 1, seedNum);
  const v11 = hash2D(ix + 1, iy + 1, seedNum);

  const a = v00 + (v10 - v00) * ux;
  const b = v01 + (v11 - v01) * ux;
  return a + (b - a) * uy;
}

export function sampleBiomeAt(x, y, seedNum) {
  const dist = Math.hypot(x, y);
  const wobble = (smoothNoise(x, y, 360, seedNum) - 0.5) * 140;
  if (dist + wobble * 0.45 < 330) {
    return BIOMES.SPAWN;
  }

  // 使用角度扇区 + 噪声扰动形成清晰的5大生态区
  const angleNoise = (smoothNoise(x + 900, y - 700, 520, seedNum) - 0.5) * 0.85;
  let angle = Math.atan2(y, x) + angleNoise; // -PI ~ PI
  if (angle > Math.PI) angle -= Math.PI * 2;
  if (angle < -Math.PI) angle += Math.PI * 2;

  // 5个扇区：
  // [-0.35, 0.95] -> 丰饶草原 (东 & 东南)
  // [0.95, 1.85] -> 毒雾沼泽 (正南偏东/南端)
  // [1.85, 3.14] & [-3.14, -2.15] -> 猪王桦木林 (西南/正西)
  // [-2.15, -1.05] -> 幽暗松林 (西北/正北)
  // [-1.05, -0.35] -> 乱石矿区 (东北)
  if (angle >= -0.35 && angle < 0.95) return BIOMES.GRASSLAND;
  if (angle >= 0.95 && angle < 1.80) {
    return dist > 620 ? BIOMES.SWAMP : BIOMES.GRASSLAND;
  }
  if (angle >= 1.80 || angle < -2.18) return BIOMES.BIRCH;
  if (angle >= -2.18 && angle < -1.02) return BIOMES.FOREST;
  return BIOMES.ROCKY;
}

// 计算点到折线道路的最短距离
export function distToRoads(x, y, roads) {
  let minDist = Infinity;
  for (const poly of roads) {
    for (let i = 0; i < poly.length - 1; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy || 1;
      let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

function makeCurvedRoad(x0, y0, x1, y1, rand, steps = 9) {
  const pts = [[Math.round(x0), Math.round(y0)]];
  const perpX = -(y1 - y0);
  const perpY = x1 - x0;
  const len = Math.hypot(perpX, perpY) || 1;
  const nx = perpX / len;
  const ny = perpY / len;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sway = Math.sin(t * Math.PI) * ((rand() - 0.5) * 260);
    const px = x0 + (x1 - x0) * t + nx * sway;
    const py = y0 + (y1 - y0) * t + ny * sway;
    pts.push([Math.round(px), Math.round(py)]);
  }
  pts.push([Math.round(x1), Math.round(y1)]);
  return pts;
}

export function generateWorld(seedStr = 'starve-lan') {
  const rand = createRng(seedStr);
  const seedNum = Math.floor(rand() * 1000000);

  // 生成网格生物群落图（供前端渲染地表和地图）
  const cols = Math.ceil(WORLD_SIZE / TILE_SIZE);
  const rows = cols;
  const biomeOrder = [
    BIOMES.SPAWN,
    BIOMES.GRASSLAND,
    BIOMES.FOREST,
    BIOMES.BIRCH,
    BIOMES.ROCKY,
    BIOMES.SWAMP,
  ];
  const biomeGrid = [];
  for (let r = 0; r < rows; r++) {
    const wy = -WORLD_HALF + (r + 0.5) * TILE_SIZE;
    for (let c = 0; c < cols; c++) {
      const wx = -WORLD_HALF + (c + 0.5) * TILE_SIZE;
      const b = sampleBiomeAt(wx, wy, seedNum);
      biomeGrid.push(biomeOrder.indexOf(b));
    }
  }

  // 核心地标坐标规划
  const pigKingPos = { x: -1120, y: 520 };
  const rockyCenter = { x: 960, y: -920 };
  const forestCenter = { x: -780, y: -1060 };
  const grassCenter = { x: 1080, y: 420 };

  // 三条主干鹅卵石道路（连接出生门 -> 猪王村、乱石矿区、丰饶草原）
  const roads = [
    makeCurvedRoad(0, 45, pigKingPos.x + 80, pigKingPos.y - 40, rand, 10),
    makeCurvedRoad(0, -45, rockyCenter.x, rockyCenter.y, rand, 10),
    makeCurvedRoad(45, 20, grassCenter.x, grassCenter.y, rand, 9),
    makeCurvedRoad(-35, -45, forestCenter.x, forestCenter.y, rand, 8),
  ];

  const entities = new Map();
  const mobs = new Map();
  const groundItems = new Map();
  let nextId = 1;
  const allocId = (prefix = 'e') => `${prefix}_${nextId++}`;

  const canPlace = (x, y, minDist = 48, allowOnRoad = false) => {
    if (Math.abs(x) > WORLD_HALF - 90 || Math.abs(y) > WORLD_HALF - 90) return false;
    if (!allowOnRoad && distToRoads(x, y, roads) < 42) return false;
    for (const e of entities.values()) {
      const req = Math.max(minDist, (e.radius || 18) + 22);
      if (Math.hypot(e.x - x, e.y - y) < req) return false;
    }
    return true;
  };

  const addEntity = (type, x, y, extra = {}) => {
    const def = ENTITY_DEFS[type];
    if (!def) return null;
    const id = allocId('ent');
    const ent = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      radius: def.radius || 18,
      hp: def.maxHp || 100,
      maxHp: def.maxHp || 100,
      hitsLeft: def.workHits || 1,
      ready: true, // 可采集状态
      regrowAt: 0,
      scale: 0.9 + rand() * 0.25,
      variant: Math.floor(rand() * 3),
      ...extra,
    };
    entities.set(id, ent);
    return ent;
  };

  const addMob = (type, x, y, extra = {}) => {
    const def = MOB_DEFS[type];
    if (!def) return null;
    const id = allocId('mob');
    const mob = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      homeX: Math.round(x),
      homeY: Math.round(y),
      vx: 0,
      vy: 0,
      hp: def.hp,
      maxHp: def.hp,
      state: 'idle',
      targetId: null,
      stateTimer: rand() * 3,
      attackCooldown: 0,
      windupTimer: 0,
      facing: rand() > 0.5 ? 1 : -1,
      leaderId: null,
      followUntil: 0,
      fedMonster: 0,
      ...extra,
    };
    mobs.set(id, mob);
    return mob;
  };

  const addGroundItem = (itemId, count, x, y) => {
    const id = allocId('itm');
    groundItems.set(id, {
      id,
      itemId,
      count,
      x: Math.round(x),
      y: Math.round(y),
      durability: null,
      spawnedAt: 0,
    });
  };

  // 1. 绚丽之门出生点（世界中心）
  addEntity('portal', 0, -25, { scale: 1 });

  // 出生点周边贴心新手资源圈（燧石、树枝、干草、浆果、胡萝卜、野花）
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + rand() * 0.3;
    const r = 135 + rand() * 145;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    addGroundItem('flint', 1, px + (rand() - 0.5) * 30, py + (rand() - 0.5) * 30);
    if (canPlace(px, py, 42)) {
      const starterTypes = ['grass_tuft', 'sapling', 'berry_bush', 'flower', 'carrot_plant', 'grass_tuft', 'sapling', 'berry_bush'];
      addEntity(starterTypes[i], px, py);
    }
  }

  // 2. 猪王与猪人村落
  addEntity('pig_king', pigKingPos.x, pigKingPos.y, { scale: 1 });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.2;
    const hx = pigKingPos.x + Math.cos(ang) * 215;
    const hy = pigKingPos.y + Math.sin(ang) * 200;
    if (canPlace(hx, hy, 75, true)) {
      const house = addEntity('pig_house', hx, hy);
      if (house) {
        addMob('pigman', hx + 32, hy + 28, { homeEntityId: house.id, homeX: hx, homeY: hy });
      }
    }
  }
  // 猪王村果园浆果丛
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      const bx = pigKingPos.x + 290 + c * 46;
      const by = pigKingPos.y + 120 + r * 46;
      if (canPlace(bx, by, 38)) addEntity('berry_bush', bx, by);
    }
  }

  // 3. 四座远古试金石（四象限复活点）
  const touchCoords = [
    [980, 980],
    [-1080, -860],
    [1180, -640],
    [-820, 1180],
  ];
  for (const [tx, ty] of touchCoords) {
    const jx = tx + (rand() - 0.5) * 160;
    const jy = ty + (rand() - 0.5) * 160;
    if (canPlace(jx, jy, 85)) {
      addEntity('touch_stone', jx, jy, { usedBy: [] });
    }
  }

  // 4. 发条遗迹驻点（保障齿轮产出供冰箱与 WX-78 升级）
  const clockSpots = [
    [rockyCenter.x + 280, rockyCenter.y - 220],
    [pigKingPos.x - 280, pigKingPos.y + 310],
    [forestCenter.x + 320, forestCenter.y - 250],
  ];
  for (const [cx, cy] of clockSpots) {
    if (Math.abs(cx) < WORLD_HALF - 160 && Math.abs(cy) < WORLD_HALF - 160) {
      addMob('clockwork_knight', cx, cy);
      addMob('clockwork_knight', cx + 55, cy - 35);
    }
  }

  // 5. 全图生态自然资源与巢穴撒点
  const totalSamples = 1350;
  for (let i = 0; i < totalSamples; i++) {
    const x = (rand() - 0.5) * (WORLD_SIZE - 220);
    const y = (rand() - 0.5) * (WORLD_SIZE - 220);
    if (Math.hypot(x, y) < 165) continue;

    const biome = sampleBiomeAt(x, y, seedNum);
    const r = rand();

    if (biome === BIOMES.SPAWN) {
      if (!canPlace(x, y, 48)) continue;
      if (r < 0.26) addEntity('grass_tuft', x, y);
      else if (r < 0.48) addEntity('sapling', x, y);
      else if (r < 0.68) addEntity('berry_bush', x, y);
      else if (r < 0.85) addEntity('flower', x, y);
      else addEntity('carrot_plant', x, y);
    } else if (biome === BIOMES.GRASSLAND) {
      if (!canPlace(x, y, 48)) continue;
      if (r < 0.30) addEntity('grass_tuft', x, y);
      else if (r < 0.46) addEntity('sapling', x, y);
      else if (r < 0.61) addEntity('berry_bush', x, y);
      else if (r < 0.75) addEntity('flower', x, y);
      else if (r < 0.85) addEntity('carrot_plant', x, y);
      else if (r < 0.92) {
        const hole = addEntity('rabbit_hole', x, y);
        if (hole) addMob('rabbit', x + 18, y + 12, { homeEntityId: hole.id });
      } else if (r < 0.97) addEntity('pine_tree', x, y);
      else addGroundItem('flint', 1, x, y);
    } else if (biome === BIOMES.FOREST) {
      if (!canPlace(x, y, 52)) continue;
      if (r < 0.54) addEntity('pine_tree', x, y, { stage: 1 + Math.floor(rand() * 3) });
      else if (r < 0.63) addEntity('burnt_tree', x, y);
      else if (r < 0.74) addEntity('sapling', x, y);
      else if (r < 0.82) addEntity('berry_bush', x, y);
      else if (r < 0.88) addEntity('mushroom_red', x, y);
      else if (r < 0.93) addEntity('mushroom_green', x, y);
      else if (r < 0.97 && Math.hypot(x, y) > 650 && canPlace(x, y, 160)) {
        const tier = rand() < 0.3 ? 2 : 1;
        const den = addEntity('spider_den', x, y, { tier, hp: 220 * tier, maxHp: 220 * tier });
        if (den) {
          addMob('spider', x + 28, y + 20, { homeEntityId: den.id });
          if (tier >= 2) addMob('spider', x - 26, y + 22, { homeEntityId: den.id });
        }
      } else addEntity('rock_plain', x, y);
    } else if (biome === BIOMES.BIRCH) {
      if (Math.hypot(x - pigKingPos.x, y - pigKingPos.y) < 155) continue;
      if (!canPlace(x, y, 52)) continue;
      if (r < 0.48) addEntity('birch_tree', x, y);
      else if (r < 0.62) addEntity('sapling', x, y);
      else if (r < 0.74) addEntity('grass_tuft', x, y);
      else if (r < 0.84) addEntity('mushroom_green', x, y);
      else if (r < 0.93) addEntity('flower', x, y);
      else addEntity('berry_bush', x, y);
    } else if (biome === BIOMES.ROCKY) {
      if (!canPlace(x, y, 56)) continue;
      if (r < 0.38) addEntity('rock_plain', x, y);
      else if (r < 0.64) addEntity('rock_gold', x, y);
      else if (r < 0.78) addEntity('ice_glacier', x, y);
      else if (r < 0.90) addGroundItem('flint', 1 + (rand() < 0.4 ? 1 : 0), x, y);
      else if (r < 0.95 && Math.hypot(x, y) > 680 && canPlace(x, y, 175)) {
        const nest = addEntity('tallbird_nest', x, y, { hasEgg: true });
        if (nest) addMob('tallbird', x + 28, y + 16, { homeEntityId: nest.id });
      } else addEntity('sapling', x, y);
    } else if (biome === BIOMES.SWAMP) {
      if (!canPlace(x, y, 54)) continue;
      if (r < 0.34) addEntity('reeds_tuft', x, y);
      else if (r < 0.56) addEntity('spiky_tree', x, y);
      else if (r < 0.70) addEntity('mushroom_blue', x, y);
      else if (r < 0.80) addEntity('mushroom_green', x, y);
      else if (r < 0.90 && Math.hypot(x, y) > 700 && canPlace(x, y, 145)) {
        addMob('tentacle', x, y);
      } else if (r < 0.96 && Math.hypot(x, y) > 750 && canPlace(x, y, 165)) {
        const den = addEntity('spider_den', x, y, { tier: 2, hp: 440, maxHp: 440 });
        if (den) addMob('spider', x + 25, y - 20, { homeEntityId: den.id });
      }
    }
  }

  return {
    seed: seedStr,
    seedNum,
    worldSize: WORLD_SIZE,
    tileSize: TILE_SIZE,
    gridCols: cols,
    biomeOrder,
    biomeGrid,
    roads,
    entities,
    mobs,
    groundItems,
    nextId,
  };
}
