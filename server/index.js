// 饥荒局域网纯网页联机版 - 主入口 HTTP & WebSocket 服务
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachWebSocketServer } from './ws.js';
import { LobbyManager } from './lobby.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

let activePort = Number(process.env.PORT) || 3000;

export function detectLanUrls(port = activePort) {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const [ifName, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    const lowerName = ifName.toLowerCase();
    const isVirtual = /vmware|virtualbox|vbox|wsl|hyper-v|vethernet|docker|loopback/.test(lowerName);
    for (const addr of addrs) {
      if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal) {
        let priority = isVirtual ? 10 : 1;
        if (addr.address.startsWith('192.168.')) priority -= 0.5;
        candidates.push({
          url: `http://${addr.address}:${port}`,
          ip: addr.address,
          ifName,
          priority,
        });
      }
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  const urls = candidates.map((c) => c.url);
  if (urls.length === 0) {
    urls.push(`http://127.0.0.1:${port}`);
  }
  return urls;
}

function serveStaticFile(req, res) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  let pathname = decodeURIComponent(urlObj.pathname);

  if (pathname === '/api/info') {
    const body = JSON.stringify({
      ok: true,
      port: activePort,
      lanUrls: detectLanUrls(activePort),
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  let baseDir = PUBLIC_DIR;
  let relPath = pathname.slice(1);
  if (pathname.startsWith('/shared/')) {
    baseDir = SHARED_DIR;
    relPath = pathname.slice('/shared/'.length);
  }

  const targetPath = path.resolve(baseDir, relPath);
  if (!targetPath.startsWith(baseDir + path.sep) && targetPath !== baseDir) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(targetPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(targetPath).pipe(res);
  });
}

export function startServer(preferredPort = activePort) {
  const server = http.createServer(serveStaticFile);
  const lobby = new LobbyManager(() => detectLanUrls(activePort));
  attachWebSocketServer(server, (client) => lobby.attachClient(client));

  const tryListen = (portToTry) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        if (err.code === 'EADDRINUSE' && !process.env.PORT && portToTry < preferredPort + 10) {
          resolve(tryListen(portToTry + 1));
        } else {
          reject(err);
        }
      };
      const onListening = () => {
        server.off('error', onError);
        activePort = server.address().port;
        resolve({ server, lobby, port: activePort });
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(portToTry, '0.0.0.0');
    });

  const shutdown = () => {
    lobby.saveAllRooms();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return tryListen(preferredPort);
}

// 直接运行时启动服务
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer(activePort)
    .then(({ port }) => {
      const urls = detectLanUrls(port);
      console.log('============================================================');
      console.log(' 🔥 《荒野余烬：饥荒局域网联机网页版》服务已启动！');
      console.log('------------------------------------------------------------');
      console.log(` 💻 本机游玩家请打开: http://localhost:${port}`);
      console.log(' 🌐 局域网好友浏览器打开以下任一地址即可直接联机:');
      for (const u of urls) {
        console.log(`    👉 ${u}`);
      }
      console.log('------------------------------------------------------------');
      console.log(' 💡 提示: 若好友无法访问，请允许 Windows 防火墙放行 Node.js');
      console.log('============================================================');

      if (process.argv.includes('--open')) {
        const localUrl = `http://localhost:${port}`;
        if (process.platform === 'win32') exec(`start "" "${localUrl}"`);
        else if (process.platform === 'darwin') exec(`open "${localUrl}"`);
        else exec(`xdg-open "${localUrl}"`);
      }
    })
    .catch((err) => {
      console.error('服务器启动失败:', err);
      process.exit(1);
    });
}
