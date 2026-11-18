// 饥荒哥特手绘纸片风格 Canvas 程序化精灵与图标绘制引擎
import { CHARACTERS } from '../shared/characters.js';
import { ITEMS } from '../shared/items.js';

const iconCache = new Map();

// 获取或生成带缓存的物品图标 DataURL / Canvas
export function getItemIconCanvas(itemId, size = 36) {
  const key = `${itemId}_${size}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  drawItemVector(ctx, itemId, size / 2, size / 2, size * 0.42);
  iconCache.set(key, c);
  return c;
}

export function getItemIconDataUrl(itemId, size = 36) {
  return getItemIconCanvas(itemId, size).toDataURL();
}

export function drawItemVector(ctx, itemId, cx, cy, r) {
  const def = ITEMS[itemId];
  if (!def) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.strokeStyle = '#1a1410';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const ic = def.icon || itemId;

  if (ic === 'axe' || ic === 'golden_axe') {
    // 木柄 + 斧刃
    ctx.strokeStyle = '#6e4726';
    ctx.lineWidth = r * 0.24;
    ctx.beginPath(); ctx.moveTo(-r * 0.65, r * 0.65); ctx.lineTo(r * 0.55, -r * 0.55); ctx.stroke();
    ctx.fillStyle = ic === 'golden_axe' ? '#f5c53b' : '#b8bdc4';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.4);
    ctx.quadraticCurveTo(r * 0.85, -r * 0.1, r * 0.65, r * 0.45);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (ic === 'pickaxe' || ic === 'golden_pickaxe') {
    ctx.strokeStyle = '#6e4726';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.65); ctx.lineTo(r * 0.45, -r * 0.45); ctx.stroke();
    ctx.strokeStyle = ic === 'golden_pickaxe' ? '#f5c53b' : '#9ea4ad';
    ctx.lineWidth = r * 0.26;
    ctx.beginPath();
    ctx.arc(r * 0.1, -r * 0.1, r * 0.72, -Math.PI * 0.78, Math.PI * 0.12);
    ctx.stroke();
  } else if (ic === 'torch' || ic === 'lighter') {
    ctx.fillStyle = ic === 'lighter' ? '#d9a736' : '#7a502d';
    ctx.fillRect(-r * 0.2, -r * 0.1, r * 0.4, r * 0.85);
    ctx.strokeRect(-r * 0.2, -r * 0.1, r * 0.4, r * 0.85);
    ctx.fillStyle = '#ff7b24';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.quadraticCurveTo(r * 0.52, -r * 0.35, 0, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.52, -r * 0.35, 0, -r * 0.92);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe252';
    ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();
  } else if (ic === 'spear' || ic === 'battle_spear' || ic === 'dark_sword' || ic === 'spike') {
    ctx.strokeStyle = ic === 'dark_sword' ? '#2e1642' : '#78502b';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath(); ctx.moveTo(-r * 0.65, r * 0.65); ctx.lineTo(r * 0.4, -r * 0.4); ctx.stroke();
    ctx.fillStyle = ic === 'battle_spear' ? '#f0c243' : (ic === 'dark_sword' ? '#5e2ca6' : (ic === 'spike' ? '#8c4985' : '#b8bec7'));
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1a1410';
    ctx.beginPath();
    ctx.moveTo(r * 0.78, -r * 0.78);
    ctx.lineTo(r * 0.42, -r * 0.08);
    ctx.lineTo(r * 0.08, -r * 0.42);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (ic === 'log' || ic === 'living_log' || ic === 'boards') {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(-r * 0.72, -r * 0.38, r * 1.44, r * 0.76, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#cfa676';
    ctx.beginPath(); ctx.arc(r * 0.52, 0, r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (ic === 'grass' || ic === 'twigs' || ic === 'reeds') {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = r * 0.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.25, r * 0.68);
      ctx.quadraticCurveTo(i * r * 0.42, 0, i * r * 0.32, -r * 0.68);
      ctx.stroke();
    }
  } else if (ic === 'berries' || ic === 'cooked_berries') {
    ctx.fillStyle = '#3b6e32';
    ctx.beginPath(); ctx.arc(0, -r * 0.45, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = def.color;
    for (const [bx, by] of [[-0.28, 0.15], [0.28, 0.15], [0, -0.15], [0, 0.38]]) {
      ctx.beginPath(); ctx.arc(bx * r, by * r, r * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (ic === 'meatballs' || ic === 'stew' || ic === 'bacon_eggs' || ic === 'pierogi') {
    // 盘装料理
    ctx.fillStyle = '#d9d2c5';
    ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.82, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.color;
    if (ic === 'meatballs') {
      for (const [mx, my] of [[-0.26, 0.1], [0.26, 0.1], [0, -0.18]]) {
        ctx.beginPath(); ctx.arc(mx * r, my * r, r * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (ic === 'pierogi') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (ic === 'heart' || ic === 'amulet') {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.65);
    ctx.bezierCurveTo(-r * 0.9, r * 0.05, -r * 0.7, -r * 0.75, 0, -r * 0.25);
    ctx.bezierCurveTo(r * 0.7, -r * 0.75, r * 0.9, r * 0.05, 0, r * 0.65);
    ctx.fill(); ctx.stroke();
  } else if (ic.includes('hat') || ic.includes('helm') || ic === 'garland' || ic === 'eyebrella') {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.82, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.52, Math.PI, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (ic === 'miner_hat') {
      ctx.fillStyle = '#fff394';
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else {
    // 通用多边形/宝石/矿块/肉排造型
    ctx.fillStyle = def.color || '#baa888';
    ctx.beginPath();
    if (ic === 'gold' || ic === 'flint' || ic === 'rocks' || ic === 'nitre' || ic === 'ice') {
      ctx.moveTo(-r * 0.65, r * 0.35);
      ctx.lineTo(-r * 0.45, -r * 0.52);
      ctx.lineTo(r * 0.28, -r * 0.65);
      ctx.lineTo(r * 0.7, r * 0.12);
      ctx.lineTo(r * 0.18, r * 0.62);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // 高光点缀
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.2, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// 绘制幸存者人物（含鬼魂形态、服装、头盔、手持武器与挥砍动画）
export function drawSurvivor(ctx, p, time, isSelf = false) {
  const charDef = CHARACTERS[p.charId] || CHARACTERS.wilson;
  ctx.save();
  ctx.translate(p.x, p.y);

  // 椭圆地面投影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 4, p.isGhost ? 14 : 17, p.isGhost ? 6 : 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 自己脚下的柔和定位光圈
  if (isSelf) {
    ctx.strokeStyle = 'rgba(240, 200, 90, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 4, 21, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 鬼魂形态绘制
  if (p.isGhost) {
    const floatY = Math.sin(time * 3.8 + (p.x * 0.02)) * 5;
    ctx.save();
    ctx.translate(0, -18 + floatY);
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = '#d8f3ff';
    ctx.strokeStyle = '#3b6580';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -10, 16, Math.PI, 0);
    ctx.lineTo(16, 14);
    ctx.quadraticCurveTo(8, 8, 4, 15);
    ctx.quadraticCurveTo(0, 8, -4, 15);
    ctx.quadraticCurveTo(-10, 8, -16, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 鬼魂空洞双眼
    ctx.fillStyle = '#1b2b38';
    ctx.beginPath();
    ctx.ellipse(-5 * (p.facing || 1), -10, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(4 * (p.facing || 1), -10, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPlayerNameTag(ctx, p, -56, isSelf);
    ctx.restore();
    return;
  }

  const moving = Boolean(p._moving);
  const bob = moving ? Math.abs(Math.sin(time * 12)) * 3.5 : Math.sin(time * 2.4) * 1.0;
  const mightyScale = p.mighty === 2 ? 1.18 : (p.mighty === 0 ? 0.91 : 1.0);

  ctx.save();
  ctx.scale((p.facing || 1) * mightyScale, mightyScale);
  ctx.translate(0, -bob);

  if (p.hurt) {
    ctx.filter = 'brightness(1.85) sepia(0.5) hue-rotate(-30deg)';
  }

  ctx.strokeStyle = '#17120e';
  ctx.lineWidth = 2.1;
  ctx.lineJoin = 'round';

  // 双腿步伐
  const legSwing = moving ? Math.sin(time * 13) * 5 : 0;
  ctx.strokeStyle = '#1c1714';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-5, -8); ctx.lineTo(-5 - legSwing, 3);
  ctx.moveTo(5, -8); ctx.lineTo(5 + legSwing, 3);
  ctx.stroke();

  // 躯干与护甲颜色
  let bodyColor = charDef.coatColor;
  if (p.body === 'grass_suit') bodyColor = '#cfb657';
  else if (p.body === 'log_suit') bodyColor = '#7d4d2c';
  else if (p.body === 'night_armor') bodyColor = '#2f1942';
  else if (p.body === 'puffy_vest') bodyColor = '#b04035';

  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = '#17120e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -7);
  ctx.lineTo(-9, -25);
  ctx.lineTo(9, -25);
  ctx.lineTo(11, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (p.body === 'life_amulet') {
    ctx.fillStyle = '#eb344c';
    ctx.beginPath(); ctx.arc(0, -17, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // 大头（饥荒标志性大头纸片人比例！）
  ctx.fillStyle = charDef.skinColor;
  ctx.beginPath();
  ctx.ellipse(0, -38, 15.5, 14.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 角色专属发型特征
  ctx.fillStyle = charDef.hairColor;
  if (p.charId === 'wilson') {
    // 威尔逊经典三尖 W 发型
    ctx.beginPath();
    ctx.moveTo(-15, -40);
    ctx.lineTo(-21, -50);
    ctx.lineTo(-9, -48);
    ctx.lineTo(0, -58);
    ctx.lineTo(9, -48);
    ctx.lineTo(19, -50);
    ctx.lineTo(14, -39);
    ctx.quadraticCurveTo(0, -45, -15, -40);
    ctx.fill(); ctx.stroke();
    if (p.beard) {
      ctx.fillStyle = '#241e1a';
      ctx.beginPath();
      ctx.moveTo(-9, -29); ctx.lineTo(0, -19); ctx.lineTo(9, -29);
      ctx.closePath(); ctx.fill();
    }
  } else if (p.charId === 'willow') {
    ctx.beginPath();
    ctx.arc(0, -42, 15, Math.PI, 0);
    ctx.lineTo(-15, -42); ctx.fill(); ctx.stroke();
    // 双马尾
    ctx.beginPath(); ctx.ellipse(-18, -38, 5, 8, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (p.charId === 'wendy') {
    ctx.beginPath();
    ctx.arc(0, -42, 15.5, Math.PI, 0);
    ctx.fill(); ctx.stroke();
    // 头顶小红花
    ctx.fillStyle = '#e84d67';
    ctx.beginPath(); ctx.arc(-8, -51, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (p.charId === 'wolfgang') {
    // 大八字胡
    ctx.fillStyle = '#3d2b1f';
    ctx.beginPath();
    ctx.ellipse(-5, -32, 6, 2.5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(6, -32, 6, 2.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.charId === 'wx78') {
    // 机器人金属棱角天线
    ctx.strokeStyle = '#524c42';
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, -59); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, -42, 15, Math.PI, 0);
    ctx.fill(); ctx.stroke();
  }

  // 哥特手绘小眼睛
  ctx.fillStyle = p.charId === 'wx78' ? '#ffeb70' : '#17120e';
  ctx.beginPath();
  ctx.ellipse(1, -37, 2.0, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(8.5, -37, 2.0, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头盔与帽子叠层
  if (p.head) {
    const hDef = ITEMS[p.head];
    ctx.fillStyle = hDef?.color || '#ba5945';
    if (p.head === 'garland') {
      for (const hx of [-9, -3, 3, 9]) {
        ctx.fillStyle = hx % 2 === 0 ? '#ff7a9c' : '#ffe066';
        ctx.beginPath(); ctx.arc(hx, -49, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (p.head === 'top_hat') {
      ctx.fillStyle = '#24201e';
      ctx.fillRect(-11, -66, 22, 17); ctx.strokeRect(-11, -66, 22, 17);
      ctx.beginPath(); ctx.ellipse(0, -49, 17, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.head === 'eyebrella') {
      ctx.fillStyle = '#73b8d1';
      ctx.beginPath(); ctx.arc(0, -54, 21, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, -68, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, -46, 16.5, Math.PI * 1.05, -0.05);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (p.head === 'miner_hat') {
        ctx.fillStyle = '#fff27a';
        ctx.beginPath(); ctx.arc(5, -52, 4.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (p.head === 'battle_helm') {
        // 女武神双翼
        ctx.fillStyle = '#f2edd8';
        ctx.beginPath(); ctx.moveTo(-14, -50); ctx.lineTo(-23, -60); ctx.lineTo(-12, -56); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }

  // 手持武器与挥动动画
  if (p.hand) {
    ctx.save();
    ctx.translate(10, -16);
    const swingAngle = p.swing ? Math.sin(time * 28) * 1.1 + 0.65 : -0.25;
    ctx.rotate(swingAngle);
    drawHeldEquipment(ctx, p.hand, time);
    ctx.restore();
  }

  ctx.restore();
  drawPlayerNameTag(ctx, p, -64 * mightyScale, isSelf);
  ctx.restore();
}

function drawHeldEquipment(ctx, handId, time) {
  const def = ITEMS[handId];
  if (!def) return;
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 1.8;

  if (handId === 'torch' || handId === 'lighter') {
    ctx.fillStyle = '#754c28';
    ctx.fillRect(-2, -18, 4.5, 20);
    ctx.strokeRect(-2, -18, 4.5, 20);
    const flk = Math.sin(time * 22) * 2.5;
    ctx.fillStyle = '#ff8426';
    ctx.beginPath();
    ctx.moveTo(0, -32 - flk);
    ctx.quadraticCurveTo(8, -22, 0, -16);
    ctx.quadraticCurveTo(-8, -22, 0, -32 - flk);
    ctx.fill();
    ctx.fillStyle = '#ffec73';
    ctx.beginPath(); ctx.arc(0, -21, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (handId === 'lantern') {
    ctx.fillStyle = '#ffe97d';
    ctx.beginPath(); ctx.roundRect(-5, -2, 10, 13, 3); ctx.fill(); ctx.stroke();
  } else if (handId === 'umbrella') {
    ctx.strokeStyle = '#6e4929';
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -28); ctx.stroke();
    ctx.fillStyle = '#e08d84';
    ctx.beginPath(); ctx.arc(0, -24, 18, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    // 刀剑/长矛/斧镐
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(14, -22); ctx.stroke();
    ctx.fillStyle = def.color || '#c4c9d1';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(14, -22, handId === 'ham_bat' ? 7.5 : 5.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
}

function drawPlayerNameTag(ctx, p, yOffset, isSelf) {
  ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  const label = p.isGhost ? `👻 ${p.name}` : p.name;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(label, 0, yOffset);
  ctx.fillStyle = p.isGhost ? '#9be0ff' : (isSelf ? '#ffe07d' : '#ffffff');
  ctx.fillText(label, 0, yOffset);

  if (!p.isGhost && p.hp < p.maxHp) {
    const bw = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-bw / 2, yOffset + 4, bw, 4.5);
    ctx.fillStyle = '#e03b3b';
    ctx.fillRect(-bw / 2, yOffset + 4, bw * Math.max(0, p.hp / p.maxHp), 4.5);
  }
}

// 绘制世界静态自然资源、地标与建筑
export function drawWorldEntity(ctx, ent, time, season) {
  ctx.save();
  ctx.translate(ent.x, ent.y);
  ctx.strokeStyle = '#17120e';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  const sway = Math.sin(time * 1.8 + ent.x * 0.03 + ent.y * 0.02) * 2.2;

  switch (ent.t) {
    case 'portal': {
      // 绚丽之门哥特拱门
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(0, 8, 48, 18, 0, 0, Math.PI * 2); ctx.fill();

      const pulse = 0.75 + Math.sin(time * 3) * 0.15;
      const grad = ctx.createRadialGradient(0, -34, 4, 0, -34, 34);
      grad.addColorStop(0, `rgba(255, 120, 175, ${pulse})`);
      grad.addColorStop(1, 'rgba(70, 20, 55, 0.9)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.ellipse(0, -34, 28, 36, 0, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = '#cfa34e';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, -34, 30, 38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#17120e'; ctx.lineWidth = 2;
      ctx.fillStyle = '#635d55';
      ctx.fillRect(-38, -2, 76, 12); ctx.strokeRect(-38, -2, 76, 12);
      break;
    }

    case 'touch_stone': {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 6, 38, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ent.used ? '#4f4d49' : '#9c9584';
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!ent.used) {
        ctx.strokeStyle = '#ffe082';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, -1, 16, 0, Math.PI * 2); ctx.stroke();
      }
      // 四角猪头木桩
      for (const [px, py] of [[-34, -18], [34, -18], [-30, 14], [30, 14]]) {
        ctx.strokeStyle = '#5c3c22'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 20); ctx.stroke();
        if (!ent.used) {
          ctx.fillStyle = '#d9968c'; ctx.strokeStyle = '#17120e'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(px, py - 22, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      break;
    }

    case 'pig_king': {
      ctx.fillStyle = '#9c2c2c';
      ctx.beginPath(); ctx.ellipse(0, 4, 48, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e69c91';
      ctx.beginPath(); ctx.ellipse(0, -16, 36, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // 皇冠
      ctx.fillStyle = '#f5c53b';
      ctx.beginPath();
      ctx.moveTo(-14, -40); ctx.lineTo(-16, -54); ctx.lineTo(-6, -46);
      ctx.lineTo(0, -57); ctx.lineTo(6, -46); ctx.lineTo(16, -54); ctx.lineTo(14, -40);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }

    case 'pine_tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(0, 4, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#634024';
      ctx.fillRect(-6, -22, 12, 26); ctx.strokeRect(-6, -22, 12, 26);

      const leafColor = season === 'winter' ? '#3d594c' : '#264728';
      for (let layer = 0; layer < 3; layer++) {
        const yBase = -18 - layer * 20;
        const w = 30 - layer * 5;
        ctx.fillStyle = leafColor;
        ctx.beginPath();
        ctx.moveTo(sway * (layer + 1) * 0.45, yBase - 30);
        ctx.lineTo(w + sway * 0.3, yBase);
        ctx.lineTo(-w + sway * 0.3, yBase);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        if (season === 'winter') {
          ctx.fillStyle = '#e8f4ff';
          ctx.beginPath();
          ctx.moveTo(sway * (layer + 1) * 0.45, yBase - 30);
          ctx.lineTo(w * 0.45, yBase - 16);
          ctx.lineTo(-w * 0.45, yBase - 16);
          ctx.closePath(); ctx.fill();
        }
      }
      break;
    }

    case 'birch_tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 4, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ded8cc';
      ctx.fillRect(-5.5, -28, 11, 32); ctx.strokeRect(-5.5, -28, 11, 32);
      if (season !== 'winter') {
        ctx.fillStyle = season === 'autumn' ? '#cf6a29' : (season === 'spring' ? '#63ab48' : '#4e8f38');
        ctx.beginPath(); ctx.arc(sway, -46, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-14 + sway, -38, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(15 + sway, -38, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      break;
    }

    case 'spiky_tree':
    case 'burnt_tree': {
      ctx.strokeStyle = ent.t === 'burnt_tree' ? '#24201e' : '#574331';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, 4); ctx.lineTo(sway * 0.5, -46);
      ctx.moveTo(0, -18); ctx.lineTo(-16, -34);
      ctx.moveTo(0, -26); ctx.lineTo(15, -40);
      ctx.stroke();
      break;
    }

    case 'stump': {
      ctx.fillStyle = '#7a502e';
      ctx.fillRect(-10, -6, 20, 10); ctx.strokeRect(-10, -6, 20, 10);
      ctx.fillStyle = '#cfa472';
      ctx.beginPath(); ctx.ellipse(0, -6, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }

    case 'pine_sapling':
    case 'birch_sapling': {
      ctx.fillStyle = '#43783b';
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(10, 2); ctx.lineTo(-10, 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }

    case 'rock_plain':
    case 'rock_gold':
    case 'ice_glacier': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 5, 28, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ent.t === 'ice_glacier' ? '#a8e4ff' : '#7d7b74';
      ctx.beginPath();
      ctx.moveTo(-24, 4); ctx.lineTo(-19, -22); ctx.lineTo(-3, -32);
      ctx.lineTo(18, -24); ctx.lineTo(25, 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (ent.t === 'rock_gold') {
        ctx.strokeStyle = '#ffd042'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, -18); ctx.lineTo(-2, -8); ctx.lineTo(8, -19);
        ctx.moveTo(4, -4); ctx.lineTo(14, -9);
        ctx.stroke();
      }
      break;
    }

    case 'berry_bush': {
      ctx.fillStyle = ent.r === 0 ? '#4b5938' : '#35662d';
      ctx.beginPath(); ctx.arc(sway * 0.4, -12, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (ent.r !== 0) {
        ctx.fillStyle = '#e03131';
        for (const [bx, by] of [[-7, -15], [6, -17], [0, -8], [-9, -6], [8, -8]]) {
          ctx.beginPath(); ctx.arc(bx, by, 3.2, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }

    case 'grass_tuft':
    case 'reeds_tuft': {
      if (ent.r === 0) {
        ctx.strokeStyle = '#6e5e38';
        ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-6, -4); ctx.moveTo(4, 2); ctx.lineTo(4, -4); ctx.stroke();
      } else {
        ctx.strokeStyle = ent.t === 'reeds_tuft' ? '#7b8f49' : '#d4bc5d';
        ctx.lineWidth = 2.6;
        for (const gx of [-7, -2, 3, 8]) {
          ctx.beginPath();
          ctx.moveTo(gx, 3);
          ctx.quadraticCurveTo(gx + sway, -10, gx * 1.3 + sway, -21);
          ctx.stroke();
        }
      }
      break;
    }

    case 'sapling': {
      ctx.strokeStyle = '#8a623c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 3); ctx.lineTo(sway * 0.5, -18);
      if (ent.r !== 0) {
        ctx.moveTo(0, -8); ctx.lineTo(-9, -16);
        ctx.moveTo(0, -11); ctx.lineTo(9, -19);
      }
      ctx.stroke();
      break;
    }

    case 'flower': {
      if (ent.r === 0) break;
      ctx.fillStyle = '#f26d91';
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(ang) * 4.5, -6 + Math.sin(ang) * 4.5, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffe052';
      ctx.beginPath(); ctx.arc(0, -6, 2.8, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'carrot_plant': {
      if (ent.r === 0) break;
      ctx.strokeStyle = '#4ca644'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-5, -9); ctx.moveTo(0, 1); ctx.lineTo(5, -9); ctx.stroke();
      ctx.fillStyle = '#ed7a26';
      ctx.beginPath(); ctx.arc(0, 1, 3.8, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'mushroom_red':
    case 'mushroom_green':
    case 'mushroom_blue': {
      if (ent.r === 0) break;
      ctx.fillStyle = '#e8dfc8';
      ctx.fillRect(-3, -7, 6, 8);
      ctx.fillStyle = ent.t === 'mushroom_red' ? '#db3737' : (ent.t === 'mushroom_green' ? '#4ca852' : '#4a7ad4');
      ctx.beginPath(); ctx.arc(0, -7, 8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }

    case 'pig_house': {
      ctx.fillStyle = '#9c6e49';
      ctx.fillRect(-22, -38, 44, 42); ctx.strokeRect(-22, -38, 44, 42);
      ctx.fillStyle = '#633524';
      ctx.beginPath(); ctx.moveTo(-28, -36); ctx.lineTo(0, -64); ctx.lineTo(28, -36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffdf78';
      ctx.fillRect(-7, -28, 14, 12); ctx.strokeRect(-7, -28, 14, 12);
      break;
    }

    case 'spider_den': {
      const tier = ent.tr || 1;
      ctx.fillStyle = 'rgba(235,240,245,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 3, 46 + tier * 8, 20 + tier * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8ecf0';
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.ellipse(0, -10 - i * 13, 24 - i * 4, 15 - i * 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#17120e';
      ctx.beginPath(); ctx.ellipse(0, -6, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'tallbird_nest': {
      ctx.fillStyle = '#8f7244';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (ent.egg) {
        ctx.fillStyle = '#73cde0';
        ctx.beginPath(); ctx.ellipse(0, -8, 8, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      break;
    }

    case 'rabbit_hole': {
      ctx.fillStyle = '#291e16';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'campfire':
    case 'fire_pit':
    case 'endothermic_pit': {
      if (ent.t !== 'campfire') {
        ctx.fillStyle = ent.t === 'endothermic_pit' ? '#587285' : '#78756e';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 19, Math.sin(a) * 9, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = '#6e4523'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-14, 5); ctx.lineTo(14, -5); ctx.moveTo(-14, -5); ctx.lineTo(14, 5); ctx.stroke();
        ctx.strokeStyle = '#17120e'; ctx.lineWidth = 2;
      }

      if ((ent.f || 0) > 0) {
        const isCold = ent.t === 'endothermic_pit';
        const h = 16 + Math.min(28, (ent.f / 200) * 26) + Math.sin(time * 18) * 4;
        ctx.fillStyle = isCold ? '#38a8ff' : '#ff771c';
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.quadraticCurveTo(16, -h * 0.35, 0, 2);
        ctx.quadraticCurveTo(-16, -h * 0.35, 0, -h);
        ctx.fill();
        ctx.fillStyle = isCold ? '#c7f2ff' : '#ffe863';
        ctx.beginPath(); ctx.arc(0, -h * 0.32, 6.5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }

    case 'science_machine':
    case 'alchemy_engine': {
      const isAlch = ent.t === 'alchemy_engine';
      ctx.fillStyle = isAlch ? '#42594e' : '#7d5634';
      ctx.fillRect(-20, -34, 40, 36); ctx.strokeRect(-20, -34, 40, 36);
      ctx.save();
      ctx.translate(0, -40);
      ctx.rotate(time * 1.6);
      ctx.fillStyle = isAlch ? '#78e0a8' : '#f2c138';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      break;
    }

    case 'crock_pot': {
      const shake = ent.ck ? Math.sin(time * 26) * 2 : 0;
      ctx.translate(shake, 0);
      ctx.fillStyle = '#403c39';
      ctx.beginPath(); ctx.ellipse(0, -14, 21, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a8442c';
      ctx.beginPath(); ctx.ellipse(0, -28, 19, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (ent.ck) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🍲 ${ent.ck}s`, 0, -40);
      } else if (ent.ri) {
        const ic = getItemIconCanvas(ent.ri, 30);
        ctx.drawImage(ic, -15, -62);
      }
      break;
    }

    case 'chest':
    case 'ice_box': {
      ctx.fillStyle = ent.t === 'ice_box' ? '#cfeaf5' : '#9c6638';
      ctx.fillRect(-18, -24, 36, 26); ctx.strokeRect(-18, -24, 36, 26);
      ctx.fillStyle = '#f0c341';
      ctx.fillRect(-4, -14, 8, 6); ctx.strokeRect(-4, -14, 8, 6);
      break;
    }

    case 'wood_wall':
    case 'stone_wall': {
      ctx.fillStyle = ent.t === 'stone_wall' ? '#85837b' : '#946237';
      ctx.fillRect(-18, -24, 36, 28); ctx.strokeRect(-18, -24, 36, 28);
      break;
    }

    case 'tent': {
      ctx.fillStyle = '#cfc3a9';
      ctx.beginPath(); ctx.moveTo(-32, 4); ctx.lineTo(0, -40); ctx.lineTo(32, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b241d';
      ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(0, -18); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
      break;
    }

    case 'trap_placed': {
      ctx.fillStyle = '#bfa658';
      ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (ent.ci) {
        ctx.fillStyle = '#ffdf5e';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❗已捕获', 0, -22);
      }
      break;
    }

    case 'skeleton': {
      ctx.fillStyle = '#dedad2';
      ctx.beginPath(); ctx.arc(0, -8, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

// 绘制生物、暗影怪与巨型 Boss
export function drawMob(ctx, mob, time) {
  ctx.save();
  ctx.translate(mob.x, mob.y);

  const isShadow = mob.t === 'shadow_crawler' || mob.t === 'shadow_beak';
  const isBoss = mob.t === 'deerclops' || mob.t === 'treeguard';
  const hop = Math.abs(Math.sin(time * 10 + mob.x * 0.05)) * 3;

  // 蓄力攻击前摇红圈预警（方便玩家走A躲避！）
  if (mob.w) {
    ctx.strokeStyle = 'rgba(255, 70, 55, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 4, isBoss ? 62 : 34, isBoss ? 26 : 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 4, isBoss ? 36 : 16, isBoss ? 14 : 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.scale(mob.f || 1, 1);
  if (isShadow) ctx.globalAlpha = 0.62 + Math.sin(time * 16) * 0.12;

  ctx.strokeStyle = '#14100d';
  ctx.lineWidth = 2;

  switch (mob.t) {
    case 'rabbit': {
      ctx.fillStyle = '#c9b79c';
      ctx.beginPath(); ctx.ellipse(0, -6 - hop, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-2, -16 - hop, 2.5, 6, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(3, -16 - hop, 2.5, 6, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }

    case 'pigman':
    case 'werepig': {
      const isWere = mob.t === 'werepig';
      ctx.fillStyle = isWere ? '#593629' : '#e69c91';
      ctx.beginPath(); ctx.ellipse(0, -18 - hop * 0.5, isWere ? 20 : 16, isWere ? 20 : 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // 猪鼻
      ctx.fillStyle = '#cf786d';
      ctx.beginPath(); ctx.ellipse(7, -17, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }

    case 'spider':
    case 'spider_warrior': {
      const isWar = mob.t === 'spider_warrior';
      ctx.strokeStyle = isWar ? '#6e8c2b' : '#1f1c1d';
      ctx.lineWidth = 2.4;
      for (const ly of [-6, -2, 2]) {
        ctx.beginPath(); ctx.moveTo(-16, ly); ctx.lineTo(16, -ly); ctx.stroke();
      }
      ctx.fillStyle = isWar ? '#b8cf3a' : '#262224';
      ctx.beginPath(); ctx.arc(0, -8, isWar ? 13 : 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#eb2f2f';
      ctx.beginPath(); ctx.arc(4, -9, 2.5, 0, Math.PI * 2); ctx.arc(9, -9, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'tallbird': {
      ctx.strokeStyle = '#3d4852'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-4, 3); ctx.lineTo(-4, -22); ctx.moveTo(4, 3); ctx.lineTo(4, -22); ctx.stroke();
      ctx.fillStyle = '#24292e';
      ctx.beginPath(); ctx.arc(0, -32 - hop * 0.4, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // 标志性独眼大眼球
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(5, -33, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#17120e';
      ctx.beginPath(); ctx.arc(7, -33, 3.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'tentacle': {
      const sway = Math.sin(time * 8) * 7;
      ctx.fillStyle = '#6b3869';
      ctx.beginPath();
      ctx.moveTo(-12, 4);
      ctx.quadraticCurveTo(-8 + sway, -24, sway * 1.4, -52);
      ctx.quadraticCurveTo(10 + sway, -24, 12, 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }

    case 'clockwork_knight': {
      ctx.fillStyle = '#b5a279';
      ctx.fillRect(-13, -38, 26, 36); ctx.strokeRect(-13, -38, 26, 36);
      ctx.fillStyle = '#ff5942';
      ctx.beginPath(); ctx.arc(6, -28, 3.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'hound':
    case 'fire_hound':
    case 'ice_hound': {
      ctx.fillStyle = mob.t === 'fire_hound' ? '#bd3728' : (mob.t === 'ice_hound' ? '#6eb8e0' : '#4a433e');
      ctx.beginPath();
      ctx.ellipse(0, -12 - hop, 17, 10, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -18 - hop); ctx.lineTo(24, -14 - hop); ctx.lineTo(12, -7 - hop);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff3838';
      ctx.beginPath(); ctx.arc(14, -15 - hop, 2.2, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'shadow_crawler':
    case 'shadow_beak': {
      ctx.fillStyle = '#120b1a';
      ctx.strokeStyle = '#6c309c';
      ctx.beginPath();
      ctx.arc(0, -18, 17, 0, Math.PI * 2);
      if (mob.t === 'shadow_beak') {
        ctx.lineTo(28, -22);
      }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff5bd';
      ctx.beginPath(); ctx.arc(6, -20, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'abigail': {
      const fl = Math.sin(time * 4) * 5;
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = '#ffe3ec';
      ctx.strokeStyle = '#9c4e68';
      ctx.beginPath();
      ctx.arc(0, -24 + fl, 14, Math.PI, 0);
      ctx.lineTo(14, 0 + fl); ctx.lineTo(-14, 0 + fl);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }

    case 'treeguard': {
      ctx.fillStyle = '#543924';
      ctx.fillRect(-16, -46, 32, 48); ctx.strokeRect(-16, -46, 32, 48);
      ctx.fillStyle = '#244726';
      ctx.beginPath();
      ctx.moveTo(0, -96); ctx.lineTo(38, -36); ctx.lineTo(-38, -36);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#140f0c';
      ctx.beginPath(); ctx.arc(8, -28, 5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'deerclops': {
      // 巨型独眼巨鹿 Boss！
      const stepBob = Math.abs(Math.sin(time * 6)) * 5;
      ctx.translate(0, -stepBob);
      ctx.fillStyle = '#d4dde6';
      ctx.beginPath();
      ctx.ellipse(0, -44, 34, 42, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // 寒冰巨角
      ctx.strokeStyle = '#89bdd6'; ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-12, -78); ctx.lineTo(-28, -106);
      ctx.moveTo(12, -78); ctx.lineTo(28, -106);
      ctx.stroke();
      // 血红巨型独眼
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#17120e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(10, -52, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d92638';
      ctx.beginPath(); ctx.arc(13, -52, 6, 0, Math.PI * 2); ctx.fill();
      break;
    }

    default:
      break;
  }

  ctx.restore();

  // 雇佣猪人头顶友好标记
  if (mob.ally) {
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💛随从', 0, -42);
  }

  // 生物血条（受伤时或 Boss 常驻显示）
  if (mob.hp < mob.mhp || isBoss) {
    const bw = isBoss ? 72 : 34;
    const by = isBoss ? -112 : -36;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(-bw / 2, by, bw, isBoss ? 7 : 4.5);
    ctx.fillStyle = isBoss ? '#ff4747' : '#e0533b';
    ctx.fillRect(-bw / 2, by, bw * Math.max(0, mob.hp / mob.mhp), isBoss ? 7 : 4.5);
    if (isBoss) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${mob.hp}/${mob.mhp}`, 0, by - 4);
    }
  }

  ctx.restore();
}
