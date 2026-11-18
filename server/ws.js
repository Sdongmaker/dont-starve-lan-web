// 零外部依赖原生 RFC 6455 WebSocket 服务端实现（支持分包重组、心跳检测、低延迟传输）
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB 安全上限

export class WSClient extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.ip = req.socket.remoteAddress || 'unknown';
    this.isAlive = true;
    this.closed = false;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = 0;

    socket.setNoDelay(true);
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._cleanup());
    socket.on('end', () => this._cleanup());
    socket.on('error', () => this._cleanup());
  }

  send(data) {
    if (this.closed || !this.socket.writable) return false;
    const payload = typeof data === 'string'
      ? Buffer.from(data, 'utf8')
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(JSON.stringify(data), 'utf8');
    const frame = encodeFrame(0x1, payload);
    try {
      this.socket.write(frame);
      return true;
    } catch {
      this._cleanup();
      return false;
    }
  }

  ping() {
    if (this.closed || !this.socket.writable) return;
    try {
      this.socket.write(Buffer.from([0x89, 0x00]));
    } catch {
      this._cleanup();
    }
  }

  close() {
    if (this.closed) return;
    try {
      if (this.socket.writable) {
        this.socket.write(Buffer.from([0x88, 0x00]));
      }
      this.socket.destroy();
    } catch {
      // ignore
    }
    this._cleanup();
  }

  _cleanup() {
    if (this.closed) return;
    this.closed = true;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.emit('close');
  }

  _onData(chunk) {
    if (this.closed) return;
    this.isAlive = true;
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < 4) return;
        payloadLen = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (this.buffer.length < 10) return;
        const bigLen = this.buffer.readBigUInt64BE(2);
        if (bigLen > BigInt(MAX_PAYLOAD_BYTES)) {
          this.close();
          return;
        }
        payloadLen = Number(bigLen);
        offset = 10;
      }

      if (payloadLen > MAX_PAYLOAD_BYTES) {
        this.close();
        return;
      }

      const maskLen = masked ? 4 : 0;
      const totalFrameLen = offset + maskLen + payloadLen;
      if (this.buffer.length < totalFrameLen) return;

      let payload = this.buffer.subarray(offset + maskLen, totalFrameLen);
      if (masked) {
        const mask = this.buffer.subarray(offset, offset + 4);
        const unmasked = Buffer.allocUnsafe(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          unmasked[i] = payload[i] ^ mask[i & 3];
        }
        payload = unmasked;
      } else {
        payload = Buffer.from(payload);
      }

      this.buffer = this.buffer.subarray(totalFrameLen);
      this._handleFrame(fin, opcode, payload);
      if (this.closed) return;
    }
  }

  _handleFrame(fin, opcode, payload) {
    // 控制帧（Close / Ping / Pong）
    if (opcode === 0x8) {
      this.close();
      return;
    }
    if (opcode === 0x9) {
      // Ping -> Pong
      if (!this.closed && this.socket.writable) {
        this.socket.write(encodeFrame(0x0a, payload));
      }
      return;
    }
    if (opcode === 0x0a) {
      this.isAlive = true;
      return;
    }

    // 数据帧与分片重组
    if (opcode === 0x0) {
      this.fragments.push(payload);
      if (fin) {
        const full = Buffer.concat(this.fragments);
        this.fragments = [];
        this._emitPayload(this.fragmentOpcode, full);
      }
      return;
    }

    if (opcode === 0x1 || opcode === 0x2) {
      if (fin) {
        this._emitPayload(opcode, payload);
      } else {
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
      }
    }
  }

  _emitPayload(opcode, buf) {
    if (opcode === 0x1) {
      const text = buf.toString('utf8');
      try {
        const parsed = JSON.parse(text);
        this.emit('json', parsed);
      } catch {
        // 非法JSON忽略
      }
    }
  }
}

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

export function attachWebSocketServer(httpServer, onConnection) {
  const clients = new Set();

  httpServer.on('upgrade', (req, socket) => {
    const upgrade = (req.headers['upgrade'] || '').toLowerCase();
    const key = req.headers['sec-websocket-key'];
    if (upgrade !== 'websocket' || !key) {
      socket.destroy();
      return;
    }

    const accept = crypto
      .createHash('sha1')
      .update(key + WS_GUID)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ];
    socket.write(responseHeaders.join('\r\n'));

    const client = new WSClient(socket, req);
    clients.add(client);
    client.on('close', () => clients.delete(client));
    onConnection(client);
  });

  // 20秒心跳检测清理断线设备
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.isAlive) {
        c.close();
        clients.delete(c);
        continue;
      }
      c.isAlive = false;
      c.ping();
    }
  }, 20000);
  heartbeat.unref?.();

  return { clients };
}
