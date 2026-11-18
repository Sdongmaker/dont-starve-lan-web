// 世界静态实体、建筑与生物模板定义（服务端与客户端共享）

export const ENTITY_DEFS = {
  // ==================== 地标与遗迹 ====================
  portal: {
    type: 'portal', name: '绚丽之门', category: 'landmark',
    radius: 44, solid: true, indestructible: true, lightRadius: 120,
    mapIcon: 'portal', mapColor: '#eb5e8d',
  },
  touch_stone: {
    type: 'touch_stone', name: '远古试金石', category: 'landmark',
    radius: 34, solid: true, indestructible: true, lightRadius: 85,
    mapIcon: 'touch_stone', mapColor: '#d9c69c',
  },
  pig_king: {
    type: 'pig_king', name: '猪王', category: 'landmark',
    radius: 46, solid: true, indestructible: true,
    mapIcon: 'pig_king', mapColor: '#f2b838',
  },
  skeleton: {
    type: 'skeleton', name: '幸存者遗骸', category: 'resource',
    radius: 18, solid: false, workType: 'mine', workHits: 2,
    drops: [{ id: 'rocks', count: 1 }],
  },

  // ==================== 树木与植物资源 ====================
  pine_tree: {
    type: 'pine_tree', name: '常青松树', category: 'resource',
    radius: 20, solid: true, flammable: true,
    workType: 'chop', workHits: 8,
    mapColor: '#2d4d2a',
  },
  birch_tree: {
    type: 'birch_tree', name: '桦木树', category: 'resource',
    radius: 20, solid: true, flammable: true,
    workType: 'chop', workHits: 8,
    mapColor: '#ba6e32',
  },
  spiky_tree: {
    type: 'spiky_tree', name: '沼泽枯刺树', category: 'resource',
    radius: 18, solid: true, flammable: true,
    workType: 'chop', workHits: 5,
  },
  burnt_tree: {
    type: 'burnt_tree', name: '焦黑枯树', category: 'resource',
    radius: 16, solid: true,
    workType: 'chop', workHits: 1,
  },
  stump: {
    type: 'stump', name: '树桩', category: 'resource',
    radius: 14, solid: false,
    workType: 'dig', workHits: 1,
  },
  pine_sapling: {
    type: 'pine_sapling', name: '常青松树苗', category: 'resource',
    radius: 10, solid: false, growInto: 'pine_tree', growTime: 160,
  },
  birch_sapling: {
    type: 'birch_sapling', name: '桦木树苗', category: 'resource',
    radius: 10, solid: false, growInto: 'birch_tree', growTime: 160,
  },

  // ==================== 矿石资源 ====================
  rock_plain: {
    type: 'rock_plain', name: '巨石', category: 'resource',
    radius: 26, solid: true,
    workType: 'mine', workHits: 6,
    mapColor: '#8c8a82',
  },
  rock_gold: {
    type: 'rock_gold', name: '金脉矿石', category: 'resource',
    radius: 26, solid: true,
    workType: 'mine', workHits: 7,
    mapColor: '#f2c138',
  },
  ice_glacier: {
    type: 'ice_glacier', name: '迷你冰川', category: 'resource',
    radius: 24, solid: true,
    workType: 'mine', workHits: 4,
    mapColor: '#9be0ff',
  },

  // ==================== 可徒手采集资源 ====================
  grass_tuft: {
    type: 'grass_tuft', name: '干草丛', category: 'pickable',
    radius: 14, solid: false, flammable: true, transplantItem: 'dug_grass',
    yieldItem: 'grass', yieldCount: 1, regrowTime: 240,
  },
  sapling: {
    type: 'sapling', name: '小树枝丛', category: 'pickable',
    radius: 12, solid: false, flammable: true, transplantItem: 'dug_sapling',
    yieldItem: 'twigs', yieldCount: 1, regrowTime: 240,
  },
  berry_bush: {
    type: 'berry_bush', name: '浆果丛', category: 'pickable',
    radius: 18, solid: false, flammable: true, transplantItem: 'dug_berry_bush',
    yieldItem: 'berries', yieldCount: 2, regrowTime: 300,
    mapColor: '#cf3434',
  },
  fireflies: {
    type: 'fireflies', name: '林间流萤', category: 'resource',
    radius: 12, solid: false, workType: 'net', workHits: 1, nightLightRadius: 72,
  },
  reeds_tuft: {
    type: 'reeds_tuft', name: '芦苇丛', category: 'pickable',
    radius: 14, solid: false, flammable: true,
    yieldItem: 'reeds', yieldCount: 1, regrowTime: 280,
  },
  flower: {
    type: 'flower', name: '荒野小花', category: 'pickable',
    radius: 10, solid: false,
    yieldItem: 'petals', yieldCount: 1, sanityBonus: 5, destroyOnPick: false, regrowTime: 360,
  },
  carrot_plant: {
    type: 'carrot_plant', name: '野生胡萝卜', category: 'pickable',
    radius: 10, solid: false,
    yieldItem: 'carrot', yieldCount: 1, destroyOnPick: false, regrowTime: 420,
  },
  mushroom_red: {
    type: 'mushroom_red', name: '红蘑菇丛', category: 'pickable',
    radius: 10, solid: false,
    yieldItem: 'red_cap', yieldCount: 1, regrowTime: 340,
  },
  mushroom_green: {
    type: 'mushroom_green', name: '绿蘑菇丛', category: 'pickable',
    radius: 10, solid: false,
    yieldItem: 'green_cap', yieldCount: 1, regrowTime: 340,
  },
  mushroom_blue: {
    type: 'mushroom_blue', name: '蓝蘑菇丛', category: 'pickable',
    radius: 10, solid: false,
    yieldItem: 'blue_cap', yieldCount: 1, regrowTime: 360,
  },

  // ==================== 怪物巢穴与房舍 ====================
  pig_house: {
    type: 'pig_house', name: '猪人木屋', category: 'spawner',
    radius: 30, solid: true, maxHp: 300,
    mapIcon: 'pig_house', mapColor: '#d99679',
  },
  spider_den: {
    type: 'spider_den', name: '蜘蛛巢', category: 'spawner',
    radius: 28, solid: true, maxHp: 280,
    mapIcon: 'spider_den', mapColor: '#ebeef2',
  },
  tallbird_nest: {
    type: 'tallbird_nest', name: '高脚鸟巢', category: 'spawner',
    radius: 22, solid: false,
    mapColor: '#6ec4d9',
  },
  rabbit_hole: {
    type: 'rabbit_hole', name: '兔子洞', category: 'spawner',
    radius: 12, solid: false,
  },

  // ==================== 玩家建造建筑 ====================
  campfire: {
    type: 'campfire', name: '临时营火', category: 'structure',
    radius: 20, solid: false, isFire: true, isTempFire: true,
    maxFuel: 180, startFuel: 110, heatOutput: 35,
    mapIcon: 'fire', mapColor: '#ff9632',
  },
  fire_pit: {
    type: 'fire_pit', name: '石头火坑', category: 'structure',
    radius: 24, solid: true, isFire: true, isTempFire: false,
    maxFuel: 260, startFuel: 150, heatOutput: 42, maxHp: 400,
    mapIcon: 'fire_pit', mapColor: '#ffb84d',
  },
  endothermic_pit: {
    type: 'endothermic_pit', name: '吸热冷火坑', category: 'structure',
    radius: 24, solid: true, isFire: true, isColdFire: true,
    maxFuel: 240, startFuel: 140, heatOutput: -38, maxHp: 400,
    mapIcon: 'cold_fire', mapColor: '#5ec8ff',
  },
  science_machine: {
    type: 'science_machine', name: '科学机器', category: 'structure',
    radius: 28, solid: true, techLevel: 1, maxHp: 350,
    mapIcon: 'science', mapColor: '#f2c138',
  },
  alchemy_engine: {
    type: 'alchemy_engine', name: '炼金引擎', category: 'structure',
    radius: 30, solid: true, techLevel: 2, maxHp: 450, lightRadius: 75,
    mapIcon: 'alchemy', mapColor: '#78e0a8',
  },
  crock_pot: {
    type: 'crock_pot', name: '烹饪锅', category: 'structure',
    radius: 26, solid: true, isCrockPot: true, maxHp: 350,
    mapIcon: 'crock_pot', mapColor: '#c95e3a',
  },
  chest: {
    type: 'chest', name: '木质储物箱', category: 'structure',
    radius: 22, solid: true, isContainer: true, slots: 12, maxHp: 250,
    mapIcon: 'chest', mapColor: '#b07642',
  },
  ice_box: {
    type: 'ice_box', name: '保鲜冰箱', category: 'structure',
    radius: 22, solid: true, isContainer: true, isIceBox: true, slots: 12, maxHp: 300,
    mapIcon: 'ice_box', mapColor: '#ccefff',
  },
  wood_wall: {
    type: 'wood_wall', name: '木栅栏墙', category: 'structure',
    radius: 20, solid: true, isWall: true, maxHp: 220, repairItem: 'boards',
    mapColor: '#9e683b',
  },
  stone_wall: {
    type: 'stone_wall', name: '花岗岩石墙', category: 'structure',
    radius: 21, solid: true, isWall: true, maxHp: 480, repairItem: 'rocks',
    mapColor: '#8f8d84',
  },
  tent: {
    type: 'tent', name: '露营帐篷', category: 'structure',
    radius: 34, solid: true, isTent: true, uses: 8, maxHp: 300,
    mapIcon: 'tent', mapColor: '#d9ccb2',
  },
  trap_placed: {
    type: 'trap_placed', name: '捕兽草笼', category: 'structure',
    radius: 16, solid: false, isTrap: true,
  },
  drying_rack: {
    type: 'drying_rack', name: '风干晾肉架', category: 'structure',
    radius: 24, solid: true, isDryingRack: true, maxHp: 250,
    mapIcon: 'drying_rack', mapColor: '#a86b43',
  },
  tooth_trap: {
    type: 'tooth_trap', name: '犬牙陷阱', category: 'structure',
    radius: 16, solid: false, isToothTrap: true,
  },
};

// 生物与 Boss 模板定义
export const MOB_DEFS = {
  rabbit: {
    type: 'rabbit', name: '草原野兔',
    hp: 25, speed: 155, radius: 11, behavior: 'prey', trappable: true,
    drops: [{ id: 'morsel', count: 1, chance: 1.0 }],
  },
  pigman: {
    type: 'pigman', name: '猪人守卫',
    hp: 250, speed: 125, radius: 18, damage: 33, attackRange: 48,
    windup: 0.42, cooldown: 1.5, behavior: 'pig',
    drops: [
      { id: 'meat', count: 1, chance: 0.75 },
      { id: 'pig_skin', count: 1, chance: 0.35 },
    ],
  },
  werepig: {
    type: 'werepig', name: '狂暴疯猪',
    hp: 350, speed: 162, radius: 22, damage: 40, attackRange: 54,
    windup: 0.38, cooldown: 1.25, behavior: 'hostile', sanityAura: -12,
    drops: [
      { id: 'meat', count: 2, chance: 1.0 },
      { id: 'pig_skin', count: 1, chance: 1.0 },
    ],
  },
  spider: {
    type: 'spider', name: '森林蜘蛛',
    hp: 100, speed: 132, radius: 14, damage: 20, attackRange: 42,
    windup: 0.38, cooldown: 1.45, behavior: 'spider', trappable: true, sanityAura: -8,
    drops: [
      { id: 'monster_meat', count: 1, chance: 0.55 },
      { id: 'silk', count: 1, chance: 0.35 },
      { id: 'spider_gland', count: 1, chance: 0.30 },
    ],
  },
  spider_warrior: {
    type: 'spider_warrior', name: '剧毒蜘蛛战士',
    hp: 260, speed: 150, radius: 17, damage: 28, attackRange: 56,
    windup: 0.40, cooldown: 1.55, behavior: 'hostile', sanityAura: -14,
    drops: [
      { id: 'monster_meat', count: 1, chance: 0.7 },
      { id: 'silk', count: 1, chance: 0.6 },
      { id: 'spider_gland', count: 1, chance: 0.5 },
    ],
  },
  tallbird: {
    type: 'tallbird', name: '独眼高脚鸟',
    hp: 400, speed: 150, radius: 20, damage: 42, attackRange: 58,
    windup: 0.45, cooldown: 1.65, behavior: 'territorial', sanityAura: -6,
    drops: [
      { id: 'meat', count: 2, chance: 1.0 },
    ],
  },
  tentacle: {
    type: 'tentacle', name: '沼泽巨触手',
    hp: 500, speed: 0, radius: 22, damage: 34, attackRange: 88,
    windup: 0.50, cooldown: 1.45, behavior: 'ambush', sanityAura: -18,
    drops: [
      { id: 'tentacle_spike', count: 1, chance: 0.55 },
      { id: 'monster_meat', count: 2, chance: 1.0 },
    ],
  },
  clockwork_knight: {
    type: 'clockwork_knight', name: '发条铁骑',
    hp: 450, speed: 138, radius: 22, damage: 40, attackRange: 60,
    windup: 0.46, cooldown: 1.6, behavior: 'territorial', sanityAura: -10,
    drops: [
      { id: 'gears', count: 2, chance: 1.0 },
    ],
  },
  clockwork_bishop: {
    type: 'clockwork_bishop', name: '发条主教',
    hp: 400, speed: 105, radius: 22, damage: 36, attackRange: 255,
    windup: 0.52, cooldown: 2.2, behavior: 'territorial', isRanged: true, sanityAura: -14,
    drops: [
      { id: 'gears', count: 2, chance: 1.0 },
      { id: 'nightmare_fuel', count: 1, chance: 0.7 },
    ],
  },
  hound: {
    type: 'hound', name: '荒野猎犬',
    hp: 150, speed: 168, radius: 16, damage: 22, attackRange: 46,
    windup: 0.36, cooldown: 1.3, behavior: 'hound', sanityAura: -12,
    drops: [
      { id: 'monster_meat', count: 1, chance: 0.8 },
      { id: 'hound_tooth', count: 1, chance: 0.5 },
    ],
  },
  fire_hound: {
    type: 'fire_hound', name: '赤焰猎犬',
    hp: 130, speed: 172, radius: 16, damage: 28, attackRange: 46,
    windup: 0.36, cooldown: 1.3, behavior: 'hound', sanityAura: -15, deathEffect: 'fire',
    drops: [
      { id: 'monster_meat', count: 1, chance: 0.8 },
      { id: 'hound_tooth', count: 2, chance: 0.85 },
      { id: 'charcoal', count: 1, chance: 0.6 },
    ],
  },
  ice_hound: {
    type: 'ice_hound', name: '霜寒猎犬',
    hp: 130, speed: 172, radius: 16, damage: 28, attackRange: 46,
    windup: 0.36, cooldown: 1.3, behavior: 'hound', sanityAura: -15, deathEffect: 'ice',
    drops: [
      { id: 'monster_meat', count: 1, chance: 0.8 },
      { id: 'hound_tooth', count: 2, chance: 0.85 },
      { id: 'ice', count: 2, chance: 0.8 },
    ],
  },
  shadow_crawler: {
    type: 'shadow_crawler', name: '爬行梦魇',
    hp: 180, speed: 112, radius: 19, damage: 22, attackRange: 50,
    windup: 0.48, cooldown: 1.7, behavior: 'shadow', isShadow: true, sanityKillReward: 18,
    drops: [
      { id: 'nightmare_fuel', count: 1, chance: 1.0 },
    ],
  },
  shadow_beak: {
    type: 'shadow_beak', name: '尖喙梦魇',
    hp: 260, speed: 158, radius: 20, damage: 34, attackRange: 54,
    windup: 0.42, cooldown: 1.5, behavior: 'shadow', isShadow: true, sanityKillReward: 32,
    drops: [
      { id: 'nightmare_fuel', count: 2, chance: 1.0 },
    ],
  },
  abigail: {
    type: 'abigail', name: '阿比盖尔',
    hp: 600, speed: 152, radius: 16, damage: 18, attackRange: 95,
    windup: 0.2, cooldown: 1.1, behavior: 'companion', lightRadius: 95,
    drops: [],
  },
  treeguard: {
    type: 'treeguard', name: '常青树精守卫', isBoss: true,
    hp: 1400, speed: 95, radius: 32, damage: 52, attackRange: 76,
    windup: 0.62, cooldown: 2.1, behavior: 'boss_tree', sanityAura: -25,
    drops: [
      { id: 'living_log', count: 5, chance: 1.0 },
      { id: 'monster_meat', count: 2, chance: 1.0 },
    ],
  },
  deerclops: {
    type: 'deerclops', name: '冬季霸主·独眼巨鹿', isBoss: true,
    hp: 2400, speed: 118, radius: 40, damage: 75, attackRange: 108,
    windup: 0.72, cooldown: 2.35, behavior: 'boss_deerclops', sanityAura: -40, smashStructures: true,
    drops: [
      { id: 'eyeball', count: 1, chance: 1.0 },
      { id: 'meat', count: 8, chance: 1.0 },
      { id: 'ice', count: 4, chance: 1.0 },
    ],
  },
  spider_queen: {
    type: 'spider_queen', name: '巢穴母皇·蜘蛛女王', isBoss: true,
    hp: 1250, speed: 102, radius: 34, damage: 55, attackRange: 74,
    windup: 0.56, cooldown: 1.9, behavior: 'boss_spider', sanityAura: -30,
    drops: [
      { id: 'spider_hat', count: 1, chance: 1.0 },
      { id: 'silk', count: 4, chance: 1.0 },
      { id: 'monster_meat', count: 3, chance: 1.0 },
    ],
  },
};
