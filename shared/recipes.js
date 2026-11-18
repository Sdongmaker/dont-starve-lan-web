// 科技合成树与烹饪锅配方系统（服务端与客户端共享）
import { TECH_LEVELS } from './constants.js';
import { ITEMS } from './items.js';

export const CRAFT_CATEGORIES = [
  { id: 'tools', name: '工具', icon: 'axe' },
  { id: 'light', name: '照明', icon: 'torch' },
  { id: 'survival', name: '生存', icon: 'heart' },
  { id: 'science', name: '精炼', icon: 'gold' },
  { id: 'structures', name: '建筑', icon: 'chest' },
  { id: 'fight', name: '战斗', icon: 'spear' },
  { id: 'dress', name: '衣帽', icon: 'top_hat' },
  { id: 'magic', name: '暗影', icon: 'dark_sword' },
];

export const RECIPES = [
  // ==================== 工具类 ====================
  {
    id: 'axe', name: '燧石斧头', category: 'tools', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'twigs', count: 1 }, { id: 'flint', count: 1 }],
    result: { id: 'axe', count: 1 },
    desc: '砍伐树木的基础工具。',
  },
  {
    id: 'pickaxe', name: '鹤嘴锄', category: 'tools', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'twigs', count: 2 }, { id: 'flint', count: 2 }],
    result: { id: 'pickaxe', count: 1 },
    desc: '敲碎岩石、金矿与冰川。',
  },
  {
    id: 'shovel', name: '铁铲', category: 'tools', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'twigs', count: 2 }, { id: 'flint', count: 2 }],
    result: { id: 'shovel', count: 1 },
    desc: '挖出树桩获得额外木头。',
  },
  {
    id: 'razor', name: '剃刀', category: 'tools', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'twigs', count: 2 }, { id: 'flint', count: 2 }],
    result: { id: 'razor', count: 1 },
    desc: '刮除胡须获得材料并恢复理智。',
  },
  {
    id: 'golden_axe', name: '黄金斧头', category: 'tools', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'twigs', count: 4 }, { id: 'gold', count: 2 }],
    result: { id: 'golden_axe', count: 1 },
    desc: '4倍超长耐久，砍树速度提升 50%。',
  },
  {
    id: 'golden_pickaxe', name: '黄金鹤嘴锄', category: 'tools', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'twigs', count: 4 }, { id: 'gold', count: 2 }],
    result: { id: 'golden_pickaxe', count: 1 },
    desc: '4倍耐久黄金镐，采矿更快。',
  },

  // ==================== 照明与控温火源 ====================
  {
    id: 'torch', name: '火把', category: 'light', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'grass', count: 2 }, { id: 'twigs', count: 2 }],
    result: { id: 'torch', count: 1 },
    desc: '手持照明火炬，黑夜赶路保命必备！',
  },
  {
    id: 'campfire', name: '临时营火', category: 'light', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'grass', count: 3 }, { id: 'log', count: 2 }],
    structure: 'campfire',
    desc: '提供照明、取暖与烤肉；燃料耗尽后会化为灰烬。',
  },
  {
    id: 'fire_pit', name: '石头火坑', category: 'light', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'log', count: 2 }, { id: 'rocks', count: 10 }],
    structure: 'fire_pit',
    desc: '永久营地火坑！熄灭后不会消失，随时添柴重燃且更省燃料。',
  },
  {
    id: 'endothermic_pit', name: '吸热冷火坑', category: 'light', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'nitre', count: 2 }, { id: 'cut_stone', count: 2 }],
    structure: 'endothermic_pit',
    desc: '燃烧蓝色冷焰！夜间照明的同时为周围幸存者强效降温度夏！',
  },
  {
    id: 'miner_hat', name: '矿工头灯', category: 'light', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'straw_hat', count: 1 }, { id: 'gold', count: 1 }, { id: 'nightmare_fuel', count: 1 }],
    result: { id: 'miner_hat', count: 1 },
    desc: '戴在头上的稳定光源，夜晚解放双手自由战斗采集！',
  },
  {
    id: 'lantern', name: '炼金提灯', category: 'light', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'twigs', count: 3 }, { id: 'rope', count: 2 }, { id: 'gold', count: 2 }],
    result: { id: 'lantern', count: 1 },
    desc: '范围广阔的便携提灯，丢在地上也能持续照明！',
  },

  // ==================== 生存与医疗 ====================
  {
    id: 'trap', name: '捕兽草笼', category: 'survival', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'grass', count: 6 }, { id: 'twigs', count: 2 }],
    result: { id: 'trap', count: 1 },
    desc: '放在地上自动捕捉兔子与蜘蛛，稳定获取肉食。',
  },
  {
    id: 'healing_salve', name: '治疗药膏', category: 'survival', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'ash', count: 2 }, { id: 'rocks', count: 1 }, { id: 'spider_gland', count: 1 }],
    result: { id: 'healing_salve', count: 1 },
    desc: '使用立即恢复 +22 点生命值。',
  },
  {
    id: 'telltale_heart', name: '救赎之心', category: 'survival', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'grass', count: 3 }, { id: 'spider_gland', count: 1 }],
    hpCost: 30,
    result: { id: 'telltale_heart', count: 1 },
    desc: '献出 30 点鲜血制成，对队友鬼魂使用可使其当场复活！',
  },
  {
    id: 'thermal_stone', name: '蓄能保暖石', category: 'survival', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'rocks', count: 8 }, { id: 'pickaxe', count: 1 }, { id: 'flint', count: 3 }],
    result: { id: 'thermal_stone', count: 1 },
    desc: '冬暖夏凉神器！靠近火源蓄热，靠近吸热冷火蓄冷！',
  },
  {
    id: 'umbrella', name: '猪皮雨伞', category: 'survival', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'twigs', count: 6 }, { id: 'pig_skin', count: 1 }, { id: 'silk', count: 2 }],
    result: { id: 'umbrella', count: 1 },
    desc: '春季 90% 防雨防潮，夏季隔热降温 12℃。',
  },
  {
    id: 'walking_cane', name: '步行手杖', category: 'survival', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'gold', count: 2 }, { id: 'twigs', count: 4 }, { id: 'hound_tooth', count: 2 }],
    result: { id: 'walking_cane', count: 1 },
    desc: '永久手持加速 +25%，跑图拉怪无往不利！',
  },
  {
    id: 'tent', name: '露营帐篷', category: 'survival', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'silk', count: 6 }, { id: 'twigs', count: 4 }, { id: 'rope', count: 3 }],
    structure: 'tent',
    desc: '黄昏或夜晚点击小睡：消耗 35 饱食度，大幅恢复 +50 生命与 +50 理智！',
  },

  // ==================== 科学机器与材料精炼 ====================
  {
    id: 'science_machine', name: '科学机器（一本）', category: 'science', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'gold', count: 1 }, { id: 'log', count: 4 }, { id: 'rocks', count: 4 }],
    structure: 'science_machine',
    desc: '站在旁边解锁【一本科技】配方！首次制作新配方永久学会并 +15 理智！',
  },
  {
    id: 'alchemy_engine', name: '炼金引擎（二本）', category: 'science', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'boards', count: 4 }, { id: 'cut_stone', count: 2 }, { id: 'gold', count: 4 }],
    structure: 'alchemy_engine',
    desc: '高阶研发核心！靠近解锁全部【二本与暗影高阶】配方！',
  },
  {
    id: 'rope', name: '草绳', category: 'science', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'grass', count: 3 }],
    result: { id: 'rope', count: 1 },
    desc: '将三束干草拧成结实绳索。',
  },
  {
    id: 'boards', name: '木板', category: 'science', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'log', count: 4 }],
    result: { id: 'boards', count: 1 },
    desc: '四根原木加工成一块厚木板。',
  },
  {
    id: 'cut_stone', name: '石砖', category: 'science', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'rocks', count: 3 }],
    result: { id: 'cut_stone', count: 1 },
    desc: '三块原石切割成平整石砖。',
  },
  {
    id: 'papyrus', name: '莎草纸', category: 'science', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'reeds', count: 4 }],
    result: { id: 'papyrus', count: 1 },
    desc: '用沼泽芦苇压制成纸。',
  },

  // ==================== 基地建筑类 ====================
  {
    id: 'chest', name: '木质储物箱', category: 'structures', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'boards', count: 3 }],
    structure: 'chest',
    desc: '12格团队共享储物箱，方便与局域网队友互通物资！',
  },
  {
    id: 'crock_pot', name: '烹饪锅', category: 'structures', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'cut_stone', count: 3 }, { id: 'charcoal', count: 6 }, { id: 'twigs', count: 6 }],
    structure: 'crock_pot',
    desc: '基地灵魂建筑！放入4份食材烹调肉丸、波兰水饺、培根煎蛋等神级料理！',
  },
  {
    id: 'ice_box', name: '保鲜冰箱', category: 'structures', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'gold', count: 2 }, { id: 'gears', count: 1 }, { id: 'boards', count: 1 }],
    structure: 'ice_box',
    desc: '12格低温储藏柜，专门存放团队食材与冰块！',
  },
  {
    id: 'wood_wall', name: '木栅栏墙', category: 'structures', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'boards', count: 1 }],
    structure: 'wood_wall',
    desc: '建造坚固的木防线阻挡猎犬与蜘蛛群（按住 Shift 可连续铺设）！',
  },
  {
    id: 'stone_wall', name: '花岗岩石墙', category: 'structures', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'cut_stone', count: 1 }],
    structure: 'stone_wall',
    desc: '高耐久防火石墙，基地防御工事首选（按住 Shift 可连续铺设）！',
  },

  // ==================== 武器与护甲类 ====================
  {
    id: 'spear', name: '燧石长矛', category: 'fight', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'twigs', count: 2 }, { id: 'rope', count: 1 }, { id: 'flint', count: 1 }],
    result: { id: 'spear', count: 1 },
    desc: '标准生存战矛（伤害 34）。',
  },
  {
    id: 'ham_bat', name: '鲜肉火腿棒', category: 'fight', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'pig_skin', count: 1 }, { id: 'twigs', count: 2 }, { id: 'meat', count: 2 }],
    result: { id: 'ham_bat', count: 1 },
    desc: '重型近战利器（伤害 58，耐久充足）！',
  },
  {
    id: 'grass_suit', name: '干草护甲', category: 'fight', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'grass', count: 8 }, { id: 'twigs', count: 2 }],
    result: { id: 'grass_suit', count: 1 },
    desc: '吸收 60% 怪物攻击伤害，前期防身必备。',
  },
  {
    id: 'log_suit', name: '原木盔甲', category: 'fight', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'log', count: 8 }, { id: 'rope', count: 2 }],
    result: { id: 'log_suit', count: 1 },
    desc: '吸收 80% 战斗伤害的经典主力木甲！',
  },
  {
    id: 'football_helmet', name: '橄榄球头盔', category: 'fight', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'pig_skin', count: 1 }, { id: 'rope', count: 1 }],
    result: { id: 'football_helmet', count: 1 },
    desc: '吸收 80% 伤害的头部护具，不占身体栏！',
  },
  {
    id: 'battle_spear', name: '女武神长矛', category: 'fight', tech: TECH_LEVELS.NONE,
    characterOnly: 'wigfrid',
    cost: [{ id: 'twigs', count: 2 }, { id: 'flint', count: 2 }, { id: 'gold', count: 2 }],
    result: { id: 'battle_spear', count: 1 },
    desc: '薇格弗德专属战矛（伤害 43），全团皆可使用！',
  },
  {
    id: 'battle_helm', name: '女武神头盔', category: 'fight', tech: TECH_LEVELS.NONE,
    characterOnly: 'wigfrid',
    cost: [{ id: 'gold', count: 2 }, { id: 'rocks', count: 2 }],
    result: { id: 'battle_helm', count: 1 },
    desc: '薇格弗德专属高耐久战盔（80% 减伤）！',
  },

  // ==================== 四季衣帽类 ====================
  {
    id: 'garland', name: '鲜花花环', category: 'dress', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'petals', count: 12 }],
    result: { id: 'garland', count: 1 },
    desc: '佩戴在头上持续缓慢恢复理智。',
  },
  {
    id: 'straw_hat', name: '清凉草帽', category: 'dress', tech: TECH_LEVELS.NONE,
    cost: [{ id: 'grass', count: 12 }],
    result: { id: 'straw_hat', count: 1 },
    desc: '夏季遮阳降温 10℃，也是制作矿工帽的底材。',
  },
  {
    id: 'top_hat', name: '绅士高礼帽', category: 'dress', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'silk', count: 6 }],
    result: { id: 'top_hat', count: 1 },
    desc: '优雅高礼帽，提供高额持续理智恢复！',
  },
  {
    id: 'winter_hat', name: '保暖冬帽', category: 'dress', tech: TECH_LEVELS.SCIENCE_1,
    cost: [{ id: 'silk', count: 4 }, { id: 'beard_hair', count: 2 }],
    result: { id: 'winter_hat', count: 1 },
    desc: '严冬御寒 +16℃ 并恢复理智。',
  },
  {
    id: 'puffy_vest', name: '寒冬背心', category: 'dress', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'silk', count: 6 }, { id: 'pig_skin', count: 2 }, { id: 'rope', count: 2 }],
    result: { id: 'puffy_vest', count: 1 },
    desc: '强力抗冻棉背心（保暖 +18℃）。',
  },
  {
    id: 'eyebrella', name: '巨鹿眼球伞', category: 'dress', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'eyeball', count: 1 }, { id: 'twigs', count: 12 }, { id: 'rocks', count: 4 }],
    result: { id: 'eyebrella', count: 1 },
    desc: '100% 完全避雨 + 夏季超强隔热 22℃！',
  },

  // ==================== 暗影与挑战类 ====================
  {
    id: 'dark_sword', name: '暗影魔剑', category: 'magic', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'nightmare_fuel', count: 5 }, { id: 'living_log', count: 1 }],
    result: { id: 'dark_sword', count: 1 },
    desc: '68 点毁灭伤害的暗影魔剑！',
  },
  {
    id: 'night_armor', name: '暗影护甲', category: 'magic', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'nightmare_fuel', count: 5 }, { id: 'papyrus', count: 3 }],
    result: { id: 'night_armor', count: 1 },
    desc: '高达 90% 伤害减免的暗影战甲！',
  },
  {
    id: 'life_amulet', name: '重生护符', category: 'magic', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'gold', count: 3 }, { id: 'nightmare_fuel', count: 2 }, { id: 'telltale_heart', count: 1 }],
    result: { id: 'life_amulet', count: 1 },
    desc: '佩戴阵亡自动复活，或丢在地上供鬼魂作祟重生！',
  },
  {
    id: 'hostile_flare', name: '敌意信号弹', category: 'magic', tech: TECH_LEVELS.SCIENCE_2,
    cost: [{ id: 'nitre', count: 2 }, { id: 'charcoal', count: 2 }, { id: 'nightmare_fuel', count: 1 }],
    result: { id: 'hostile_flare', count: 1 },
    desc: '点燃后立即召唤【独眼巨鹿 Boss】前来激战，刷取巨鹿眼球！',
  },
];

// 烹饪锅食谱指南（用于前端食谱手册展示）
export const CROCK_POT_GUIDE = [
  { id: 'meatballs', name: '浓香肉丸', formula: '任意肉类 ≥ 0.5 + 3个浆果/蘑菇/冰块（禁放树枝，怪物肉≤1）', stats: '+62.5饥饿 +5理智 +3生命' },
  { id: 'meaty_stew', name: '丰盛肉汤', formula: '肉度总和 ≥ 3.0（如 2大肉+1怪物肉+1小肉/填充，禁树枝，怪物肉≤1）', stats: '+130饥饿 +12生命 +5理智' },
  { id: 'bacon_eggs', name: '培根煎蛋', formula: '高脚鸟蛋 + 肉度 ≥ 1.5（如 高脚鸟蛋 + 怪物肉 + 小肉 + 浆果/冰，无蔬菜）', stats: '+75饥饿 +20生命 +5理智' },
  { id: 'pierogi', name: '波兰水饺', formula: '高脚鸟蛋 + 任意肉类 + 任意蔬菜(胡萝卜/蘑菇) + 填充物（禁树枝）', stats: '+40生命 +37.5饥饿 +5理智' },
  { id: 'kabobs', name: '炭烤肉串', formula: '任意肉类 + 恰好1根树枝 + 2个浆果/蔬菜/冰块（怪物肉≤1）', stats: '+37.5饥饿 +15理智 +5生命' },
  { id: 'trail_mix', name: '什锦干果', formula: '烤桦木果 + 2份浆果 + 任意果蔬/树枝（不能放肉）', stats: '+30生命 +15饥饿 +5理智' },
  { id: 'jam', name: '满罐果酱', formula: '浆果等水果度 ≥ 1.5（如 4个浆果，禁肉禁菜禁树枝）', stats: '+37.5饥饿 +5理智 +3生命' },
];

// 权威烹饪锅结算函数：传入4个物品ID数组，返回产出物品ID
export function evaluateCrockPot(itemIds) {
  if (!Array.isArray(itemIds) || itemIds.length !== 4) return 'wet_goop';

  let meat = 0;
  let monster = 0;
  let egg = 0;
  let veggie = 0;
  let fruit = 0;
  let seed = 0;
  let inedible = 0;
  let validCount = 0;

  for (const id of itemIds) {
    const def = ITEMS[id];
    if (!def || !def.potTags) continue;
    validCount++;
    const t = def.potTags;
    meat += t.meat || 0;
    monster += t.monster || 0;
    egg += t.egg || 0;
    veggie += t.veggie || 0;
    fruit += t.fruit || 0;
    seed += t.seed || 0;
    inedible += t.inedible || 0;
  }

  if (validCount < 4) return 'wet_goop';

  // 1. 怪物肉放了2个及以上且没树枝兜底 -> 怪物千层饼（高优先级惩罚，与原版饥荒一致！）
  if (monster >= 2 && inedible === 0) {
    return 'monster_lasagna';
  }

  // 2. 波兰水饺：蛋 >= 1 + 肉 > 0 + 菜 >= 0.5 + 无树枝
  if (egg >= 1 && meat > 0 && veggie >= 0.5 && inedible === 0) {
    return 'pierogi';
  }

  // 3. 培根煎蛋：蛋 >= 2 + 肉 >= 1.5 + 无蔬菜 + 无树枝
  if (egg >= 2 && meat >= 1.5 && veggie === 0 && inedible === 0) {
    return 'bacon_eggs';
  }

  // 4. 丰盛肉汤：肉度 >= 3.0 + 无树枝
  if (meat >= 3.0 && inedible === 0) {
    return 'meaty_stew';
  }

  // 5. 炭烤肉串：肉 > 0 + 树枝 === 1 + 怪物肉 <= 1
  if (meat > 0 && inedible === 1 && monster <= 1) {
    return 'kabobs';
  }

  // 6. 什锦干果：烤桦木果(seed>=1) + 水果 >= 1.0 + 无肉
  if (seed >= 1 && fruit >= 1.0 && meat === 0) {
    return 'trail_mix';
  }

  // 7. 浓香肉丸：肉 > 0 + 无树枝
  if (meat > 0 && inedible === 0) {
    return 'meatballs';
  }

  // 8. 满罐果酱：水果 >= 1.5 + 无肉 + 无菜 + 无树枝
  if (fruit >= 1.5 && meat === 0 && veggie === 0 && inedible === 0) {
    return 'jam';
  }

  return 'wet_goop';
}
