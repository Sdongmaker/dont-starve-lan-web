// 局域网大厅与多房间调度器
import { GameRoom } from './gameRoom.js';
import { listSaves, loadWorldFromDisk } from './saveManager.js';

export class LobbyManager {
  constructor(getLanUrls) {
    this.getLanUrls = getLanUrls;
    this.rooms = new Map();       // roomId -> GameRoom
    this.lobbyClients = new Set(); // 停留在大厅的 WSClient
    this.nextClientSeq = 1;
  }

  attachClient(client) {
    client.clientId = `p_${this.nextClientSeq++}_${Math.random().toString(36).slice(2, 6)}`;
    client.roomId = null;
    this.lobbyClients.add(client);

    // 初次握手下发局域网地址列表、现有房间列表与存档列表
    client.send({
      type: 'welcome',
      clientId: client.clientId,
      lanUrls: this.getLanUrls(),
      rooms: this.getRoomSummaries(),
      saves: listSaves(),
    });

    client.on('json', (msg) => this._onClientMessage(client, msg));
    client.on('close', () => this._onClientClose(client));
  }

  getRoomSummaries() {
    const arr = [];
    for (const room of this.rooms.values()) {
      arr.push(room.getSummary());
    }
    return arr;
  }

  broadcastLobbyState() {
    const packet = JSON.stringify({
      type: 'lobby_update',
      lanUrls: this.getLanUrls(),
      rooms: this.getRoomSummaries(),
      saves: listSaves(),
    });
    for (const c of this.lobbyClients) {
      c.send(packet);
    }
  }

  _onClientMessage(client, msg) {
    if (!msg || typeof msg.type !== 'string') return;

    // 延迟测速 Ping
    if (msg.type === 'ping_req') {
      client.send({ type: 'pong_res', t: msg.t });
      return;
    }

    if (msg.type === 'refresh_lobby') {
      client.send({
        type: 'lobby_update',
        lanUrls: this.getLanUrls(),
        rooms: this.getRoomSummaries(),
        saves: listSaves(),
      });
      return;
    }

    if (msg.type === 'create_room') {
      this._leaveCurrentRoom(client);
      let loadedSnapshot = null;
      let saveId = undefined;
      if (msg.loadSaveId) {
        loadedSnapshot = loadWorldFromDisk(msg.loadSaveId);
        if (!loadedSnapshot) {
          client.send({ type: 'error', message: '读取存档失败或存档不存在！' });
          return;
        }
        saveId = msg.loadSaveId;
      }

      const roomName = String(msg.roomName || (loadedSnapshot?.roomName) || '饥荒联机营地').trim().slice(0, 22) || '饥荒联机营地';
      const room = new GameRoom({
        name: roomName,
        hostClientId: client.clientId,
        pvp: Boolean(msg.pvp),
        difficulty: msg.difficulty === 'hardcore' ? 'hardcore' : 'standard',
        startSeason: msg.startSeason || 'autumn',
        seed: msg.seed || `${roomName}_${Date.now()}`,
        loadedSnapshot,
        saveId,
        onEmpty: (rid) => {
          this.rooms.delete(rid);
          this.broadcastLobbyState();
        },
        onSummaryChange: () => this.broadcastLobbyState(),
      });

      this.rooms.set(room.id, room);
      const ok = room.addPlayer(client, {
        name: msg.playerName,
        charId: msg.charId,
        playerToken: msg.playerToken,
      });
      if (ok) {
        client.roomId = room.id;
        this.lobbyClients.delete(client);
        this.broadcastLobbyState();
      }
      return;
    }

    if (msg.type === 'join_room') {
      const room = this.rooms.get(String(msg.roomId || ''));
      if (!room) {
        client.send({ type: 'error', message: '房间已关闭或不存在，请刷新房间列表！' });
        this.broadcastLobbyState();
        return;
      }
      this._leaveCurrentRoom(client);
      const ok = room.addPlayer(client, {
        name: msg.playerName,
        charId: msg.charId,
        playerToken: msg.playerToken,
      });
      if (ok) {
        client.roomId = room.id;
        this.lobbyClients.delete(client);
        this.broadcastLobbyState();
      }
      return;
    }

    if (msg.type === 'leave_room') {
      this._leaveCurrentRoom(client);
      this.lobbyClients.add(client);
      client.send({
        type: 'left_room',
        rooms: this.getRoomSummaries(),
        saves: listSaves(),
      });
      this.broadcastLobbyState();
      return;
    }

    // 游戏房间内操作转发
    if (client.roomId && this.rooms.has(client.roomId)) {
      this.rooms.get(client.roomId).handleAction(client.clientId, msg);
    }
  }

  _leaveCurrentRoom(client) {
    if (client.roomId && this.rooms.has(client.roomId)) {
      const room = this.rooms.get(client.roomId);
      room.removePlayer(client.clientId);
      client.roomId = null;
    }
  }

  _onClientClose(client) {
    this.lobbyClients.delete(client);
    this._leaveCurrentRoom(client);
    this.broadcastLobbyState();
  }

  saveAllRooms() {
    for (const room of this.rooms.values()) {
      try {
        room.saveNow();
      } catch {
        // ignore
      }
    }
  }
}
