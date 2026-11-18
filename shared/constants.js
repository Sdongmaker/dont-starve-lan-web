// 共享全局常量定义（服务端与浏览器端共用）

export const TICK_RATE = 20; // 20 TPS 权威物理与逻辑帧率
export const TICK_MS = 1000 / TICK_RATE;

export const WORLD_SIZE = 3800; // 世界宽高 (-1900 ~ +1900)
export const WORLD_HALF = WORLD_SIZE / 2;
export const TILE_SIZE = 80; // 地块采样粒度

// 昼夜时长（1游戏日 = 240秒 = 4分钟，共16个时钟格，每格15秒）
export const DAY_DURATION = 240;
export const CLOCK_SEGMENTS = 16;

export const PHASES = {
  DAY: 'day',
  DUSK: 'dusk',
  NIGHT: 'night',
};

// 四季配置（每季5天，一年20天）
export const SEASON_LENGTH = 5;
export const SEASONS = {
  autumn: {
    id: 'autumn',
    name: '秋季',
    segments: { day: 9, dusk: 5, night: 2 }, // 9 + 5 + 2 = 16
    tempDay: 23,
    tempNight: 14,
    rainChance: 0.08,
    tint: 'rgba(220, 155, 65, 0.04)',
    desc: '气候宜人，适合收集物资与建立营地',
  },
  winter: {
    id: 'winter',
    name: '冬季',
    segments: { day: 5, dusk: 6, night: 5 },
    tempDay: -6,
    tempNight: -18,
    rainChance: 0.22, // 冬季表现为降雪
    tint: 'rgba(155, 200, 255, 0.14)',
    desc: '严寒刺骨且黑夜漫长，小心冻伤与独眼巨鹿！',
  },
  spring: {
    id: 'spring',
    name: '春季',
    segments: { day: 6, dusk: 7, night: 3 },
    tempDay: 16,
    tempNight: 7,
    rainChance: 0.42,
    tint: 'rgba(120, 210, 150, 0.07)',
    desc: '春雨绵绵万物复苏，注意防潮避免理智流失',
  },
  summer: {
    id: 'summer',
    name: '夏季',
    segments: { day: 11, dusk: 3, night: 2 },
    tempDay: 45,
    tempNight: 31,
    rainChance: 0.03,
    tint: 'rgba(255, 140, 50, 0.11)',
    desc: '烈日酷暑白昼极长，需吸热冷火与冰块防暑降温！',
  },
};

export const SEASON_ORDER = ['autumn', 'winter', 'spring', 'summer'];

// 生态群落定义
export const BIOMES = {
  SPAWN: 'spawn',       // 绚丽之门安全草甸
  GRASSLAND: 'grass',   // 常青大草原
  FOREST: 'forest',     // 幽暗松林
  BIRCH: 'birch',       // 猪王桦木林
  ROCKY: 'rocky',       // 乱石矿区
  SWAMP: 'swamp',       // 毒雾沼泽
};

export const BIOME_INFO = {
  [BIOMES.SPAWN]: { name: '绚丽草甸', color: '#5c7c42', mapColor: '#6d914f' },
  [BIOMES.GRASSLAND]: { name: '丰饶草原', color: '#6b833d', mapColor: '#7d9948' },
  [BIOMES.FOREST]: { name: '幽暗松林', color: '#355033', mapColor: '#3a5937' },
  [BIOMES.BIRCH]: { name: '猪村桦木林', color: '#7b5832', mapColor: '#91673b' },
  [BIOMES.ROCKY]: { name: '乱石矿区', color: '#64635c', mapColor: '#7a7970' },
  [BIOMES.SWAMP]: { name: '毒雾沼泽', color: '#3b2e44', mapColor: '#483754' },
};

// 装备槽位
export const EQUIP_SLOTS = {
  HAND: 'hand',
  BODY: 'body',
  HEAD: 'head',
};

// 科技等级
export const TECH_LEVELS = {
  NONE: 0,     // 徒手制作
  SCIENCE_1: 1, // 科学机器（一本）
  SCIENCE_2: 2, // 炼金引擎（二本）
};

// 背包容量
export const INVENTORY_SIZE = 15;
export const CHEST_SIZE = 12;

// 体温阈值
export const TEMP_FREEZE_WARN = 5;
export const TEMP_FREEZING = 0;
export const TEMP_HEAT_WARN = 65;
export const TEMP_OVERHEAT = 70;

// 视野同步范围
export const VIEW_RADIUS = 1050;
export const INTERACT_RANGE = 92;
export const TECH_RANGE = 230;
