// 世界存档管理模块（支持手动存档、自动存档、读取存档列表与恢复世界）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVES_DIR = path.resolve(__dirname, '..', 'saves');

function ensureSavesDir() {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

export function sanitizeSaveId(raw) {
  return String(raw || 'world')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')
    .slice(0, 48) || 'world';
}

export function listSaves() {
  ensureSavesDir();
  const files = fs.readdirSync(SAVES_DIR).filter((f) => f.endsWith('.json'));
  const results = [];
  for (const file of files) {
    try {
      const fullPath = path.join(SAVES_DIR, file);
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      results.push({
        saveId: file.replace(/\.json$/, ''),
        roomName: raw.roomName || file.replace(/\.json$/, ''),
        day: raw.day || 1,
        season: raw.season || 'autumn',
        savedAt: raw.savedAt || fs.statSync(fullPath).mtimeMs,
        playerCount: raw.savedPlayers ? Object.keys(raw.savedPlayers).length : 0,
      });
    } catch {
      // 忽略损坏存档
    }
  }
  results.sort((a, b) => b.savedAt - a.savedAt);
  return results;
}

export function saveWorldToDisk(saveId, snapshot) {
  ensureSavesDir();
  const safeId = sanitizeSaveId(saveId);
  const fullPath = path.join(SAVES_DIR, `${safeId}.json`);
  const tmpPath = `${fullPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(snapshot), 'utf8');
  fs.renameSync(tmpPath, fullPath);
  return safeId;
}

export function loadWorldFromDisk(saveId) {
  ensureSavesDir();
  const safeId = sanitizeSaveId(saveId);
  const fullPath = path.join(SAVES_DIR, `${safeId}.json`);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch {
    return null;
  }
}
