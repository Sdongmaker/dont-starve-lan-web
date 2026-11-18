// 全部物品、装备、食物与消耗品定义（服务端与客户端共享）
import { EQUIP_SLOTS } from './constants.js';

export const ITEMS = {
  // ==================== 基础采集材料 ====================
  grass: {
    id: 'grass', name: '干草', stack: 40, fuel: 15,
    color: '#d6be63', icon: 'grass', desc: '干燥易燃的草束，基础生存材料与燃料。',
  },
  twigs: {
    id: 'twigs', name: '树枝', stack: 40, fuel: 15,
    potTags: { inedible: 1 },
    color: '#966c44', icon: 'twigs', desc: '柔韧的小树枝，制作工具与火把必备。',
  },
  log: {
    id: 'log', name: '木头', stack: 20, fuel: 45,
    color: '#8a5532', icon: 'log', desc: '砍伐树木获得的原木，优质的营火燃料与建材。',
  },
  charcoal: {
    id: 'charcoal', name: '木炭', stack: 40, fuel: 45,
    color: '#2e2b29', icon: 'charcoal', desc: '烧焦树木产出的木炭，建造烹饪锅与火药的核心原料。',
  },
  ash: {
    id: 'ash', name: '灰烬', stack: 40,
    color: '#9c9892', icon: 'ash', desc: '火焰燃尽后的余灰，可用于制作治疗药膏。',
  },
  flint: {
    id: 'flint', name: '燧石', stack: 40,
    color: '#6e737b', icon: 'flint', desc: '边缘锋利的打火石，用于打造初级工具。',
  },
  rocks: {
    id: 'rocks', name: '岩石', stack: 40,
    color: '#8f8d84', icon: 'rocks', desc: '坚硬的石块，可修筑石头火坑、科学机器与石墙。',
  },
  gold: {
    id: 'gold', name: '金块', stack: 20,
    color: '#f2c138', icon: 'gold', desc: '闪闪发光的黄金，开启科学机器与黄金工具的关键！',
  },
  nitre: {
    id: 'nitre', name: '硝石', stack: 40, endothermicFuel: 45,
    color: '#d9d3ba', icon: 'nitre', desc: '富含矿盐的岩石，可用于建造与添置夏季吸热冷火！',
  },
  ice: {
    id: 'ice', name: '冰块', stack: 40, endothermicFuel: 25,
    food: { hp: 1, hunger: 3, sanity: 0, tempDelta: -6 },
    potTags: { ice: 1, filler: 1 },
    color: '#9be0ff', icon: 'ice', desc: '清凉的冰块，可直接吃降温，更是烹饪锅万能填充物！',
  },
  pinecone: {
    id: 'pinecone', name: '松果', stack: 40, fuel: 15, plantAs: 'pine_sapling',
    color: '#6b472a', icon: 'pinecone', desc: '右键种植可长成新的常青松树（还能安抚发怒的树精！）。',
  },
  birchnut: {
    id: 'birchnut', name: '桦木果', stack: 40, cookResult: 'roasted_birchnut', plantAs: 'birch_sapling',
    color: '#b0642b', icon: 'birchnut', desc: '可种植再生桦木，也可在营火上烤熟食用。',
  },
  reeds: {
    id: 'reeds', name: '芦苇', stack: 40, fuel: 15,
    color: '#7a8a4b', icon: 'reeds', desc: '采自危险沼泽的芦苇，可精炼为莎草纸。',
  },
  silk: {
    id: 'silk', name: '蜘蛛丝', stack: 40,
    color: '#ebeef2', icon: 'silk', desc: '坚韧洁白的蛛丝，缝制衣帽、帐篷与捕网的核心材料。',
  },
  spider_gland: {
    id: 'spider_gland', name: '蜘蛛腺体', stack: 20,
    usableHeal: 8,
    color: '#8fb579', icon: 'gland', desc: '使用立即恢复 +8 生命，也是制作药膏与救赎之心的原料。',
  },
  pig_skin: {
    id: 'pig_skin', name: '猪皮', stack: 20,
    color: '#e8a298', icon: 'pig_skin', desc: '柔韧厚实的猪皮，可制作猪皮头盔、雨伞与火腿棒！',
  },
  hound_tooth: {
    id: 'hound_tooth', name: '狗牙', stack: 40,
    color: '#ede8d8', icon: 'tooth', desc: '猎犬掉落的尖利犬齿，用于制作犬牙陷阱或针线。',
  },
  living_log: {
    id: 'living_log', name: '活木', stack: 20, fuel: 45,
    color: '#5c3c28', icon: 'living_log', desc: '击败树精获得的诡异原木，蕴含暗影魔力。',
  },
  nightmare_fuel: {
    id: 'nightmare_fuel', name: '噩梦燃料', stack: 40, lanternFuel: 60,
    color: '#281736', icon: 'nightmare', desc: '击杀暗影怪凝聚的残渣，锻造暗影神装与提灯燃料！',
  },
  gears: {
    id: 'gears', name: '精密齿轮', stack: 20,
    wxFood: { hp: 60, hunger: 75, sanity: 50 },
    color: '#b5a67f', icon: 'gears', desc: '制造保鲜冰箱的核心零件，WX-78 食用可永久升级三维！',
  },
  beard_hair: {
    id: 'beard_hair', name: '胡须', stack: 40, fuel: 15,
    color: '#2b2520', icon: 'beard', desc: '粗糙的黑胡须，用于复活肉像与保暖装备。',
  },
  eyeball: {
    id: 'eyeball', name: '巨鹿眼球', stack: 5,
    food: { hp: 60, hunger: 75, sanity: -15, isMeat: true },
    color: '#6ec0db', icon: 'eyeball', desc: '独眼巨鹿的战利品！可制作防雨隔热神器【眼球伞】。',
  },

  // ==================== 精炼半成品 ====================
  rope: {
    id: 'rope', name: '草绳', stack: 20, fuel: 30,
    color: '#bfa152', icon: 'rope', desc: '由三束干草编织而成的结实草绳。',
  },
  boards: {
    id: 'boards', name: '木板', stack: 10, fuel: 90,
    color: '#9e683b', icon: 'boards', desc: '平整的木板，建造储物箱与高级建筑必备。',
  },
  cut_stone: {
    id: 'cut_stone', name: '石砖', stack: 10,
    color: '#73726c', icon: 'cut_stone', desc: '打磨整齐的石砖，建造烹饪锅、炼金引擎与石墙。',
  },
  papyrus: {
    id: 'papyrus', name: '莎草纸', stack: 20, fuel: 20,
    color: '#ded3b1', icon: 'papyrus', desc: '芦苇压制的纸张。',
  },

  // ==================== 生鲜与烤制食材 ====================
  petals: {
    id: 'petals', name: '花瓣', stack: 40,
    food: { hp: 1, hunger: 0, sanity: 0 },
    color: '#e86888', icon: 'petals', desc: '芬芳的花瓣，可编织恢复理智的花环。',
  },
  berries: {
    id: 'berries', name: '浆果', stack: 40, cookResult: 'cooked_berries',
    food: { hp: 0, hunger: 9.5, sanity: 0 },
    potTags: { fruit: 0.5, filler: 1 },
    color: '#d63333', icon: 'berries', desc: '酸甜多汁的野生浆果，可在火上烤熟或放入烹饪锅。',
  },
  cooked_berries: {
    id: 'cooked_berries', name: '烤浆果', stack: 40,
    food: { hp: 1, hunger: 12.5, sanity: 0 },
    potTags: { fruit: 0.5, filler: 1 },
    color: '#9e2822', icon: 'cooked_berries', desc: '温热香甜的烤浆果，更加顶饱。',
  },
  carrot: {
    id: 'carrot', name: '胡萝卜', stack: 40, cookResult: 'cooked_carrot',
    food: { hp: 1, hunger: 12.5, sanity: 0 },
    potTags: { veggie: 1, filler: 1 },
    color: '#eb7a28', icon: 'carrot', desc: '爽脆的野生胡萝卜，优质蔬菜配料。',
  },
  cooked_carrot: {
    id: 'cooked_carrot', name: '烤胡萝卜', stack: 40,
    food: { hp: 3, hunger: 12.5, sanity: 0 },
    potTags: { veggie: 1, filler: 1 },
    color: '#c95c1c', icon: 'cooked_carrot', desc: '外焦里嫩的烤胡萝卜切片。',
  },
  roasted_birchnut: {
    id: 'roasted_birchnut', name: '烤桦木果', stack: 40,
    food: { hp: 1, hunger: 9.5, sanity: 0 },
    potTags: { fruit: 0.5, seed: 1, filler: 1 },
    color: '#8c491c', icon: 'roasted_birchnut', desc: '香脆可口的烤坚果，制作什锦干果的主料！',
  },
  red_cap: {
    id: 'red_cap', name: '红蘑菇', stack: 40, cookResult: 'cooked_red_cap',
    food: { hp: -20, hunger: 12.5, sanity: 0 },
    potTags: { veggie: 0.5, filler: 1 },
    color: '#d93838', icon: 'red_cap', desc: '有毒的鲜红蘑菇！生吃扣血，但可安全垫入烹饪锅做肉丸！',
  },
  cooked_red_cap: {
    id: 'cooked_red_cap', name: '烤红蘑菇', stack: 40,
    food: { hp: 1, hunger: 0, sanity: -10 },
    potTags: { veggie: 0.5, filler: 1 },
    color: '#9e2e2e', icon: 'red_cap', desc: '烤过后的红蘑菇会损伤理智。',
  },
  green_cap: {
    id: 'green_cap', name: '绿蘑菇', stack: 40, cookResult: 'cooked_green_cap',
    food: { hp: 0, hunger: 12.5, sanity: -30 },
    potTags: { veggie: 0.5, filler: 1 },
    color: '#4ea854', icon: 'green_cap', desc: '生吃产生强烈幻觉，但在火上烤熟是恢复理智的神器！',
  },
  cooked_green_cap: {
    id: 'cooked_green_cap', name: '烤绿蘑菇', stack: 40,
    food: { hp: -1, hunger: 0, sanity: 15 },
    potTags: { veggie: 0.5, filler: 1 },
    color: '#3e7d42', icon: 'green_cap', desc: '荒野精神良药！食用立即恢复 +15 理智！',
  },
  blue_cap: {
    id: 'blue_cap', name: '蓝蘑菇', stack: 40, cookResult: 'cooked_blue_cap',
    food: { hp: 20, hunger: 12.5, sanity: -15 },
    potTags: { veggie: 0.5, filler: 1 },
    color: '#4b7bd6', icon: 'blue_cap', desc: '生吃大幅恢复 +20 生命（略损理智），烤熟恢复 +10 理智。',
  },
  cooked_blue_cap: {
    id: 'cooked_blue_cap', name: '烤蓝蘑菇', stack: 40,
    food: { hp: -3, hunger: 0, sanity: 10 },
    potTags: { veggie: 0.5, filler: 1 },
    color: '#395ca6', icon: 'blue_cap', desc: '烤蓝蘑菇，食用恢复 +10 理智。',
  },
  morsel: {
    id: 'morsel', name: '小肉块', stack: 40, cookResult: 'cooked_morsel', givePigGold: 1,
    food: { hp: 0, hunger: 12.5, sanity: -10, isMeat: true },
    potTags: { meat: 0.5 },
    color: '#de7878', icon: 'morsel', desc: '生小肉块，建议烤熟或放入烹饪锅炖肉丸。',
  },
  cooked_morsel: {
    id: 'cooked_morsel', name: '熟小肉', stack: 40, givePigGold: 1,
    food: { hp: 1, hunger: 12.5, sanity: 0, isMeat: true },
    potTags: { meat: 0.5 },
    color: '#ab5946', icon: 'cooked_morsel', desc: '喷香的烤小肉，可换取猪王金块或收买猪人。',
  },
  meat: {
    id: 'meat', name: '大肉', stack: 20, cookResult: 'cooked_meat', givePigGold: 2,
    food: { hp: 1, hunger: 25, sanity: -10, isMeat: true },
    potTags: { meat: 1.0 },
    color: '#cf4242', icon: 'meat', desc: '厚实的大块生肉，可烤肉排、做火腿棒或赠予猪王换金！',
  },
  cooked_meat: {
    id: 'cooked_meat', name: '烤大肉排', stack: 20, givePigGold: 2,
    food: { hp: 3, hunger: 25, sanity: 0, isMeat: true },
    potTags: { meat: 1.0 },
    color: '#8f3b28', icon: 'cooked_meat', desc: '滋滋冒油的烤肉排！',
  },
  monster_meat: {
    id: 'monster_meat', name: '怪物肉', stack: 20, cookResult: 'cooked_monster_meat',
    food: { hp: -20, hunger: 18, sanity: -15, isMeat: true, isMonster: true },
    potTags: { meat: 1.0, monster: 1 },
    color: '#73398a', icon: 'monster_meat', desc: '散发恶臭的紫肉！直接吃剧毒，但【1块怪物肉+3浆果/冰】能做出美味肉丸！',
  },
  cooked_monster_meat: {
    id: 'cooked_monster_meat', name: '熟怪物肉', stack: 20,
    food: { hp: -3, hunger: 18, sanity: -10, isMeat: true, isMonster: true },
    potTags: { meat: 1.0, monster: 1 },
    color: '#542c66', icon: 'cooked_monster_meat', desc: '烤熟后毒性减轻，依然适合每次只放1块进烹饪锅。',
  },
  tallbird_egg: {
    id: 'tallbird_egg', name: '高脚鸟蛋', stack: 10, cookResult: 'fried_tallbird_egg', givePigGold: 3,
    food: { hp: 3, hunger: 25, sanity: 0, isMeat: true },
    potTags: { egg: 4 },
    color: '#6ec4d9', icon: 'egg', desc: '巨大的斑点鸟蛋！做【培根煎蛋】与【波兰水饺】的极品食材。',
  },
  fried_tallbird_egg: {
    id: 'fried_tallbird_egg', name: '煎高脚鸟蛋', stack: 20,
    food: { hp: 0, hunger: 37.5, sanity: 0, isMeat: true },
    potTags: { egg: 4 },
    color: '#f5cb42', icon: 'fried_egg', desc: '金黄诱人的巨型荷包蛋！',
  },

  // ==================== 烹饪锅精品料理 ====================
  meatballs: {
    id: 'meatballs', name: '浓香肉丸', stack: 20,
    food: { hp: 3, hunger: 62.5, sanity: 5, isMeat: true },
    color: '#9e472a', icon: 'meatballs', desc: '【料理】饥荒性价比之王！恢复 +62.5 饥饿、+5 理智、+3 生命。',
  },
  meaty_stew: {
    id: 'meaty_stew', name: '丰盛肉汤', stack: 20,
    food: { hp: 12, hunger: 130, sanity: 5, isMeat: true, tempDelta: 5 },
    color: '#b85c2e', icon: 'stew', desc: '【料理】一碗直接吃撑！恢复 +130 饥饿、+12 生命、+5 理智并暖身！',
  },
  bacon_eggs: {
    id: 'bacon_eggs', name: '培根煎蛋', stack: 20,
    food: { hp: 20, hunger: 75, sanity: 5, isMeat: true },
    color: '#eb9e34', icon: 'bacon_eggs', desc: '【料理】远征神粮！恢复 +75 饥饿、+20 生命、+5 理智。',
  },
  pierogi: {
    id: 'pierogi', name: '波兰水饺', stack: 20,
    food: { hp: 40, hunger: 37.5, sanity: 5, isMeat: true },
    color: '#ede3c2', icon: 'pierogi', desc: '【料理】Boss战回血神药！恢复 +40 生命、+37.5 饥饿、+5 理智！',
  },
  kabobs: {
    id: 'kabobs', name: '炭烤肉串', stack: 20,
    food: { hp: 5, hunger: 37.5, sanity: 15, isMeat: true, tempDelta: 4 },
    color: '#ad5332', icon: 'kabobs', desc: '【料理】串在树枝上的美味烤串，恢复 +37.5 饥饿与 +15 理智！',
  },
  jam: {
    id: 'jam', name: '满罐果酱', stack: 20,
    food: { hp: 3, hunger: 37.5, sanity: 5 },
    color: '#c92e4a', icon: 'jam', desc: '【料理】纯果香甜酱，恢复 +37.5 饥饿、+5 理智。',
  },
  trail_mix: {
    id: 'trail_mix', name: '什锦干果', stack: 20,
    food: { hp: 30, hunger: 15, sanity: 5 },
    color: '#b56e35', icon: 'trail_mix', desc: '【料理】桦木果与浆果混合烘焙，瞬间恢复 +30 生命！',
  },
  monster_lasagna: {
    id: 'monster_lasagna', name: '怪物千层饼', stack: 20,
    food: { hp: -20, hunger: 37.5, sanity: -20, isMeat: true, isMonster: true },
    color: '#6d3082', icon: 'lasagna', desc: '【黑暗料理】放了2块以上怪物肉的灾难产物！（WX-78 吃得津津有味）',
  },
  wet_goop: {
    id: 'wet_goop', name: '湿腻焦糊', stack: 20,
    food: { hp: 0, hunger: 2, sanity: 0 },
    color: '#7a705c', icon: 'goop', desc: '【失败料理】乱炖一通煮糊的泥浆，毫无营养。',
  },

  // ==================== 工具、照明与手持武器 ====================
  axe: {
    id: 'axe', name: '燧石斧头', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 100, chopPower: 1, damage: 27,
    color: '#a39f96', icon: 'axe', desc: '用于砍伐树木，也可勉强防身（伤害 27）。',
  },
  golden_axe: {
    id: 'golden_axe', name: '黄金斧头', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 400, chopPower: 1.5, damage: 30,
    color: '#f2c138', icon: 'golden_axe', desc: '奢华耐用的黄金斧，4倍耐久且砍树更快！',
  },
  pickaxe: {
    id: 'pickaxe', name: '鹤嘴锄', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 66, minePower: 1, damage: 27,
    color: '#8f949c', icon: 'pickaxe', desc: '用于开采岩石、金矿与冰川（伤害 27）。',
  },
  golden_pickaxe: {
    id: 'golden_pickaxe', name: '黄金鹤嘴锄', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 260, minePower: 1.5, damage: 30,
    color: '#f2c138', icon: 'golden_pickaxe', desc: '4倍耐久黄金矿镐，挖矿效率大幅提升！',
  },
  shovel: {
    id: 'shovel', name: '铁铲', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 50, digPower: 1, damage: 20,
    color: '#9aa0a8', icon: 'shovel', desc: '可铲除树桩回收木头！',
  },
  razor: {
    id: 'razor', name: '剃刀', stack: 1,
    usableShave: true,
    color: '#bdbfc4', icon: 'razor', desc: '威尔逊点击使用可刮除胡须，获得胡须材料并恢复 +10 理智。',
  },
  torch: {
    id: 'torch', name: '火把', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 85, burnRate: 1, lightRadius: 195, damage: 17, fireWeapon: true, warmth: 5,
    color: '#f59331', icon: 'torch', desc: '手持移动光源，驱散查理的黑夜袭击！（装备时缓慢消耗耐久）',
  },
  lighter: {
    id: 'lighter', name: '薇洛打火机', stack: 1, slot: EQUIP_SLOTS.HAND,
    lightRadius: 165, damage: 19, fireWeapon: true, warmth: 4, canCookInBag: true,
    color: '#e8b938', icon: 'lighter', desc: '薇洛专属无限耐久打火机，照亮身周且可随时烤熟背包食材！',
  },
  lantern: {
    id: 'lantern', name: '炼金提灯', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 220, burnRate: 0.55, lightRadius: 265, damage: 15, refuelable: true,
    color: '#ffe885', icon: 'lantern', desc: '明亮稳定的高级提灯，可用噩梦燃料补充耐久，丢在地上也会发光！',
  },
  umbrella: {
    id: 'umbrella', name: '猪皮雨伞', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 360, wearRate: 0.4, rainProtect: 0.9, summerCool: 12, damage: 17,
    color: '#e08d84', icon: 'umbrella', desc: '遮风挡雨（90%防雨）且夏季隔热降温 12℃！',
  },
  walking_cane: {
    id: 'walking_cane', name: '步行手杖', stack: 1, slot: EQUIP_SLOTS.HAND,
    speedBonus: 0.25, damage: 17,
    color: '#d9c69c', icon: 'cane', desc: '永不磨损的绅士手杖！手持移动速度 +25%，风筝走位神器！',
  },
  spear: {
    id: 'spear', name: '燧石长矛', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 150, damage: 34,
    color: '#ad8355', icon: 'spear', desc: '可靠的近战长矛（伤害 34）。',
  },
  battle_spear: {
    id: 'battle_spear', name: '女武神长矛', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 200, damage: 43,
    color: '#dbb04b', icon: 'battle_spear', desc: '锋利无比的北欧战矛（伤害 43）。',
  },
  tentacle_spike: {
    id: 'tentacle_spike', name: '触手尖刺', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 100, damage: 51,
    color: '#733e6e', icon: 'spike', desc: '沼泽触手掉落的凶器，攻击力高达 51！',
  },
  ham_bat: {
    id: 'ham_bat', name: '鲜肉火腿棒', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 180, damage: 58,
    color: '#d66565', icon: 'ham_bat', desc: '沉重多汁的大棒，高达 58 点恐怖伤害！',
  },
  dark_sword: {
    id: 'dark_sword', name: '暗影魔剑', stack: 1, slot: EQUIP_SLOTS.HAND,
    maxDurability: 120, damage: 68, sanityAura: -10,
    color: '#2c193d', icon: 'dark_sword', desc: '噩梦凝聚的终极利刃（伤害 68！手持每分钟略微消耗理智）。',
  },

  // ==================== 身体护甲与服装 ====================
  grass_suit: {
    id: 'grass_suit', name: '干草护甲', stack: 1, slot: EQUIP_SLOTS.BODY,
    maxDurability: 200, absorb: 0.60,
    color: '#cfb657', icon: 'grass_suit', desc: '抵挡 60% 战斗伤害的简易草甲。',
  },
  log_suit: {
    id: 'log_suit', name: '原木盔甲', stack: 1, slot: EQUIP_SLOTS.BODY,
    maxDurability: 450, absorb: 0.80,
    color: '#8c5835', icon: 'log_suit', desc: '坚固实用的木甲，抵挡高达 80% 的怪物伤害！',
  },
  night_armor: {
    id: 'night_armor', name: '暗影护甲', stack: 1, slot: EQUIP_SLOTS.BODY,
    maxDurability: 750, absorb: 0.90, sanityAura: -5,
    color: '#341e47', icon: 'night_armor', desc: '吸收 90% 伤害的暗影重甲！',
  },
  puffy_vest: {
    id: 'puffy_vest', name: '寒冬背心', stack: 1, slot: EQUIP_SLOTS.BODY,
    maxDurability: 480, wearRate: 0.25, winterWarmth: 18, sanityAura: 2,
    color: '#a3483b', icon: 'vest', desc: '极佳的御寒棉背心（保暖 +18℃，每分钟恢复理智）。',
  },
  life_amulet: {
    id: 'life_amulet', name: '重生护符', stack: 1, slot: EQUIP_SLOTS.BODY,
    maxDurability: 100, sanityAura: 3, autoRevive: true, hauntRevive: true,
    color: '#e0364c', icon: 'amulet', desc: '穿在身上阵亡时自动浴火重生！鬼魂也可作祟地上的护符复活！',
  },

  // ==================== 头部帽饰 ====================
  garland: {
    id: 'garland', name: '鲜花花环', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 240, wearRate: 0.4, sanityAura: 3.5,
    color: '#eb6e8f', icon: 'garland', desc: '12朵花瓣编成的花环，持续缓慢恢复理智。',
  },
  straw_hat: {
    id: 'straw_hat', name: '清凉草帽', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 280, wearRate: 0.35, summerCool: 10, rainProtect: 0.25,
    color: '#e0c769', icon: 'straw_hat', desc: '遮阳挡雨，夏季降温 10℃。',
  },
  football_helmet: {
    id: 'football_helmet', name: '橄榄球头盔', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 450, absorb: 0.80, rainProtect: 0.2,
    color: '#ba5945', icon: 'helmet', desc: '猪皮打造的硬核防具，抵挡 80% 伤害且防水！',
  },
  battle_helm: {
    id: 'battle_helm', name: '女武神头盔', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 650, absorb: 0.80, rainProtect: 0.25,
    color: '#e3ba49', icon: 'battle_helm', desc: '华丽坚固的翼盔，抵挡 80% 伤害且耐久极高！',
  },
  miner_hat: {
    id: 'miner_hat', name: '矿工头灯', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 240, burnRate: 0.55, lightRadius: 235, refuelable: true,
    color: '#f2ca44', icon: 'miner_hat', desc: '解放双手的头戴照明灯！夜间也能持武器战斗或砍树！',
  },
  winter_hat: {
    id: 'winter_hat', name: '保暖冬帽', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 420, wearRate: 0.28, winterWarmth: 16, sanityAura: 2.5,
    color: '#6e523d', icon: 'winter_hat', desc: '温暖的绒线帽，冬季御寒 +16℃ 并恢复理智。',
  },
  top_hat: {
    id: 'top_hat', name: '绅士高礼帽', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 380, wearRate: 0.25, sanityAura: 5.5, rainProtect: 0.2,
    color: '#2b2826', icon: 'top_hat', desc: '优雅的蛛丝礼帽，大幅恢复理智（+5.5/分钟）！',
  },
  eyebrella: {
    id: 'eyebrella', name: '巨鹿眼球伞', stack: 1, slot: EQUIP_SLOTS.HEAD,
    maxDurability: 520, wearRate: 0.25, rainProtect: 1.0, summerCool: 22,
    color: '#73b8d1', icon: 'eyebrella', desc: '春季 100% 完全防雨、夏季强效隔热 22℃ 的终极神帽！',
  },

  // ==================== 特殊生存与团队道具 ====================
  thermal_stone: {
    id: 'thermal_stone', name: '蓄能保暖石', stack: 1,
    isThermalStone: true,
    color: '#b89463', icon: 'thermal_stone', desc: '靠近普通营火蓄热过冬，靠近吸热冷火蓄冷度夏！随身携带即可控温！',
  },
  healing_salve: {
    id: 'healing_salve', name: '治疗药膏', stack: 20,
    usableHeal: 22,
    color: '#94ba88', icon: 'salve', desc: '点击使用立即包扎伤口，恢复 +22 点生命值。',
  },
  telltale_heart: {
    id: 'telltale_heart', name: '救赎之心', stack: 10,
    reviveItem: true,
    color: '#cf2d3e', icon: 'heart', desc: '靠近阵亡队友的鬼魂使用，立即将其复活回人间！',
  },
  trap: {
    id: 'trap', name: '捕兽草笼', stack: 1, maxDurability: 8,
    placeEntity: 'trap_placed',
    color: '#c4ab5e', icon: 'trap', desc: '点击放置在草地或蜘蛛巢旁，可自动捕获路过的兔子或小蜘蛛！',
  },
  abigail_flower: {
    id: 'abigail_flower', name: '阿比盖尔之花', stack: 1,
    summonAbigail: true,
    color: '#eb88a2', icon: 'abigail_flower', desc: '温蒂专属信物：点击使用召唤或收回阿比盖尔幽灵协助战斗！',
  },
  hostile_flare: {
    id: 'hostile_flare', name: '敌意信号弹', stack: 5,
    summonBoss: true,
    color: '#eb3b28', icon: 'flare', desc: '向天空发射猩红信号弹，立即吸引远方的【独眼巨鹿 Boss】前来决战！',
  },
};
