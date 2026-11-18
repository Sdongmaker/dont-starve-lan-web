// 浏览器端 WebSocket 网络通信管理（含延迟 Ping 测量与断线提示）

export class NetClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.pingMs = 1;
    this.pingInterval = null;
  }

  connect() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      this.handlers.onOpen?.();
      this._startPing();
    });

    this.ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'pong_res') {
        this.pingMs = Math.max(1, Math.round(performance.now() - msg.t));
        this.handlers.onPing?.(this.pingMs);
        return;
      }
      this.handlers.onMessage?.(msg);
    });

    this.ws.addEventListener('close', () => {
      clearInterval(this.pingInterval);
      this.handlers.onClose?.();
      // 2.5秒后自动尝试重连大厅
      setTimeout(() => this.connect(), 2500);
    });
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  _startPing() {
    clearInterval(this.pingInterval);
    this.send({ type: 'ping_req', t: performance.now() });
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping_req', t: performance.now() });
    }, 3500);
  }
}
