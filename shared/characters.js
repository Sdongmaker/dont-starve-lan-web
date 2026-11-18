// 可选幸存者角色定义（还原饥荒联机版经典特性）

export const CHARACTERS = {
  wilson: {
    id: 'wilson',
    name: '威尔逊',
    title: '绅士科学家',
    motto: '“我将用科学的力量征服这片荒野！”',
    hp: 150,
    hunger: 150,
    sanity: 200,
    speedMult: 1.0,
    damageMult: 1.0,
    defenseBonus: 0,
    sanityDrainMult: 1.0,
    hungerDrainMult: 1.0,
    hairColor: '#1e1b18',
    coatColor: '#8c2d2d',
    skinColor: '#f0dfd0',
    perks: [
      '三维均衡，没有任何短板',
      '随存活天数蓄起浓密胡须（冬季保暖+10℃，也可刮胡子回理智）',
      '首次解锁科技配方时额外恢复 +5 理智',
    ],
    startItems: [
      { id: 'flint', count: 2 },
      { id: 'twigs', count: 2 },
    ],
  },
  willow: {
    id: 'willow',
    name: '薇洛',
    title: '纵火少女',
    motto: '“火焰燃烧的样子真是太美了！”',
    hp: 120,
    hunger: 150,
    sanity: 120,
    speedMult: 1.02,
    damageMult: 1.0,
    defenseBonus: 0,
    sanityDrainMult: 1.05,
    hungerDrainMult: 1.0,
    fireImmune: true,
    fireSanityAura: 10, // 靠近火焰每分钟+10理智
    hairColor: '#1b1817',
    coatColor: '#3b2e38',
    skinColor: '#f2e4d8',
    perks: [
      '自带无限耐久的【薇洛打火机】（手持照明 & 可烤制食物）',
      '免疫火焰伤害，且耐高温能力更强',
      '靠近营火或火坑时会持续恢复理智',
    ],
    startItems: [
      { id: 'lighter', count: 1 },
    ],
  },
  wolfgang: {
    id: 'wolfgang',
    name: '沃尔夫冈',
    title: '大力士',
    motto: '“吃饱肚子的沃尔夫冈天下无敌！”',
    hp: 200,
    hunger: 250,
    sanity: 180,
    speedMult: 1.0,
    damageMult: 1.0, // 动态根据饱食度变为 0.75x ~ 1.55x
    defenseBonus: 0,
    sanityDrainMult: 1.15, // 怕黑
    hungerDrainMult: 1.25,
    mightyMechanic: true,
    hairColor: '#3d2b1f',
    coatColor: '#c98a38',
    skinColor: '#ebd4be',
    perks: [
      '饱食度高于 180 进入【强壮形态】：攻击力 1.55 倍、砍树挖矿更快！',
      '饱食度低于 60 进入【虚弱形态】：攻击力降至 0.75 倍',
      '胃口极大，对黑暗与怪物略微胆怯',
    ],
    startItems: [
      { id: 'morsel', count: 3 },
    ],
  },
  wendy: {
    id: 'wendy',
    name: '温蒂',
    title: '悲伤少女',
    motto: '“阿比盖尔，别离开我，黑夜就要来了……”',
    hp: 150,
    hunger: 150,
    sanity: 200,
    speedMult: 1.0,
    damageMult: 0.82,
    defenseBonus: 0,
    sanityDrainMult: 0.72, // 黑夜与怪物降理智减少28%
    hungerDrainMult: 1.0,
    hairColor: '#d9be6c',
    coatColor: '#8c3b4a',
    skinColor: '#f5ece4',
    perks: [
      '自带【阿比盖尔之花】，可使用召唤幽灵姐姐并肩作战（群体伤害，黄昏夜晚更强）',
      '对黑夜与怪物的恐惧降低 28%，理智极稳',
      '自身近战力气较小（0.82 倍伤害）',
    ],
    startItems: [
      { id: 'abigail_flower', count: 1 },
      { id: 'petals', count: 3 },
    ],
  },
  wigfrid: {
    id: 'wigfrid',
    name: '薇格弗德',
    title: '女武神',
    motto: '“世界是一座舞台，唯有荣耀之战永恒！”',
    hp: 200,
    hunger: 120,
    sanity: 120,
    speedMult: 1.02,
    damageMult: 1.25,
    defenseBonus: 0.25, // 自带25%减伤
    sanityDrainMult: 1.0,
    hungerDrainMult: 1.0,
    carnivore: true, // 只吃肉蛋及荤菜料理
    battleVamp: true, // 攻击/击杀回血回理智
    hairColor: '#c75c28',
    coatColor: '#9e7c3c',
    skinColor: '#f2ded0',
    perks: [
      '开局自带【女武神长矛】与【女武神头盔】，天生 +25% 伤害与减伤',
      '战斗攻击与击杀敌人可吸取生命值与理智值',
      '纯肉食主义者：只能食用肉类、蛋类与荤腥料理',
    ],
    startItems: [
      { id: 'battle_spear', count: 1 },
      { id: 'battle_helm', count: 1 },
      { id: 'meat', count: 3 },
    ],
  },
  wx78: {
    id: 'wx78',
    name: 'WX-78',
    title: '无情机械体',
    motto: '“检测到有机生命体。准备支配荒野。”',
    hp: 140,
    hunger: 140,
    sanity: 140,
    speedMult: 1.08,
    damageMult: 1.0,
    defenseBonus: 0.05,
    sanityDrainMult: 0.9,
    hungerDrainMult: 0.95,
    ironStomach: true, // 不挑食，怪物肉惩罚减半
    gearUpgrade: true, // 吃齿轮永久提升三维上限
    hairColor: '#7a7568',
    coatColor: '#948870',
    skinColor: '#aba089',
    perks: [
      '食用【齿轮】可永久提升生命/饥饿/理智上限（最高至 260/220/240）！',
      '钢铁肠胃：吃生肉或怪物食物惩罚大幅降低，基础移速 +8%',
      '潮湿淋雨时若无雨具保护会受到轻微漏电损耗',
    ],
    startItems: [
      { id: 'gears', count: 1 },
      { id: 'flint', count: 2 },
    ],
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
