/**
 * 德州扑克下注流程模拟器 - Socket.io 事件处理
 */

const GameRoom = require('../game/GameRoom');

const TIMER_DURATION = 30;

class SocketEvents {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.playerRooms = new Map();
    this.socketToPlayer = new Map();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`玩家连接: ${socket.id}`);

      socket.on('createRoom', (data, callback) => {
        this.handleCreateRoom(socket, data, callback);
      });

      socket.on('joinRoom', (data, callback) => {
        this.handleJoinRoom(socket, data, callback);
      });

      socket.on('leaveRoom', (callback) => {
        this.handleLeaveRoom(socket, callback);
      });

      socket.on('getRooms', (callback) => {
        this.handleGetRooms(callback);
      });

      socket.on('getRoomInfo', (data, callback) => {
        this.handleGetRoomInfo(socket, data, callback);
      });

      socket.on('startGame', (callback) => {
        this.handleStartGame(socket, callback);
      });

      socket.on('playerAction', (data, callback) => {
        this.handlePlayerAction(socket, data, callback);
      });

      socket.on('chatMessage', (data, callback) => {
        this.handleChatMessage(socket, data, callback);
      });

      socket.on('requestReconnect', (data, callback) => {
        this.handleReconnect(socket, data, callback);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  handleCreateRoom(socket, data, callback) {
    const { playerName } = data;

    if (!playerName || playerName.trim().length === 0) {
      this.sendError(callback, '请输入昵称');
      return;
    }

    let roomId;
    do {
      roomId = this.generateRoomId();
    } while (this.rooms.has(roomId));

    const room = new GameRoom(roomId, socket.id);
    room.addPlayer(socket.id, playerName.trim());

    this.rooms.set(roomId, room);
    this.playerRooms.set(socket.id, roomId);
    this.socketToPlayer.set(socket.id, { name: playerName.trim(), roomId });

    socket.join(roomId);

    console.log(`房间创建: ${roomId} by ${playerName}`);

    socket.emit('createRoom', {
      success: true,
      roomId: roomId,
      roomInfo: room.getInfo()
    });
  }

  handleJoinRoom(socket, data, callback) {
    const { roomId, playerName } = data;

    if (!playerName || playerName.trim().length === 0) {
      this.sendError(callback, '请输入昵称');
      return;
    }

    const room = this.rooms.get(roomId?.toUpperCase());

    if (!room) {
      this.sendError(callback, '房间不存在');
      return;
    }

    if (room.gameStarted) {
      this.sendError(callback, '游戏已开始，无法加入');
      return;
    }

    if (room.gameState.players.size >= 8) {
      this.sendError(callback, '房间已满');
      return;
    }

    const result = room.addPlayer(socket.id, playerName.trim());

    if (!result.success) {
      this.sendError(callback, result.message);
      return;
    }

    this.playerRooms.set(socket.id, roomId);
    this.socketToPlayer.set(socket.id, { name: playerName.trim(), roomId });
    socket.join(roomId);

    console.log(`${playerName} 加入房间 ${roomId}`);

    this.io.to(roomId).emit('playerJoined', {
      player: room.gameState.getPlayer(socket.id),
      roomInfo: room.getInfo()
    });

    socket.emit('joinRoom', {
      success: true,
      roomId: roomId,
      roomInfo: room.getInfo()
    });
  }

  handleLeaveRoom(socket, callback) {
    const roomId = this.playerRooms.get(socket.id);

    if (!roomId) {
      this.sendError(callback, '不在任何房间中');
      return;
    }

    this.removePlayerFromRoom(socket, roomId);
    socket.leave(roomId);

    this.sendSuccess(callback, { success: true });
  }

  removePlayerFromRoom(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const playerName = room.gameState.getPlayer(socket.id)?.name;
    const result = room.removePlayer(socket.id);
    this.playerRooms.delete(socket.id);
    this.socketToPlayer.delete(socket.id);

    if (result.hostChanged) {
      this.io.to(roomId).emit('hostChanged', {
        newHostSocketId: result.newHostSocketId
      });
    }

    this.io.to(roomId).emit('playerLeft', {
      socketId: socket.id,
      playerName: playerName,
      roomInfo: room.getInfo()
    });

    if (room.gameState.players.size === 0) {
      room.gameState.stopTimer();
      this.rooms.delete(roomId);
      console.log(`房间 ${roomId} 已删除`);
    }

    console.log(`${playerName} 离开房间 ${roomId}`);
  }

  handleGetRooms(callback) {
    const rooms = [];
    for (const [roomId, room] of this.rooms) {
      if (!room.gameStarted) {
        rooms.push({
          roomId: roomId,
          playerCount: room.gameState.players.size,
          maxPlayers: 8
        });
      }
    }
    this.sendSuccess(callback, { rooms: rooms });
  }

  handleGetRoomInfo(socket, data, callback) {
    const { roomId } = data;
    const room = this.rooms.get(roomId?.toUpperCase());

    if (!room) {
      this.sendError(callback, '房间不存在');
      return;
    }

    this.sendSuccess(callback, {
      roomInfo: room.getInfo()
    });
  }

  handleStartGame(socket, callback) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) {
      this.sendError(callback, '不在任何房间中');
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(callback, '房间不存在');
      return;
    }

    if (room.hostSocketId !== socket.id) {
      this.sendError(callback, '只有房主可以开始游戏');
      return;
    }

    const result = room.startGame();

    if (!result.success) {
      this.sendError(callback, result.message);
      return;
    }

    for (const [, player] of room.gameState.players) {
      player.chips = 1000;
      player.hasFolded = false;
      player.hasActed = false;
    }

    this.io.to(roomId).emit('gameStarted', {
      roomInfo: room.getInfo()
    });

    this.sendPlayerUpdate(roomId);
    this.startTurnTimer(roomId);

    socket.emit('startGame', { success: true, roomInfo: room.getInfo() });
  }

  handlePlayerAction(socket, data, callback) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) {
      this.sendError(callback, '不在任何房间中');
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(callback, '房间不存在');
      return;
    }

    if (!room.gameStarted) {
      this.sendError(callback, '游戏未开始');
      return;
    }

    const { action, amount } = data;
    const currentPlayerId = room.gameState.getCurrentPlayerSocketId();

    if (currentPlayerId !== socket.id) {
      this.sendError(callback, '当前不是你的回合');
      return;
    }

    let result;
    let actionType;

    switch (action) {
      case 'check':
        result = room.gameState.check(socket.id);
        actionType = 'check';
        break;
      case 'bet':
        if (!room.gameState.canBet(socket.id)) {
          this.sendError(callback, '无法下注');
          return;
        }
        const betAmount = Math.min(amount || room.gameState.minBet, room.gameState.getPlayer(socket.id).chips);
        result = room.gameState.bet(socket.id, betAmount);
        actionType = 'bet';
        break;
      case 'call':
        result = room.gameState.call(socket.id);
        actionType = 'call';
        break;
      case 'raise':
        const raiseAmount = amount || (room.gameState.currentBetAmount * 2);
        result = room.gameState.raise(socket.id, raiseAmount);
        actionType = 'raise';
        break;
      case 'fold':
        result = room.gameState.fold(socket.id);
        actionType = 'fold';
        break;
      default:
        this.sendError(callback, '无效的操作');
        return;
    }

    if (!result.success) {
      this.sendError(callback, result.message);
      return;
    }

    room.gameState.stopTimer();

    this.io.to(roomId).emit('playerActed', {
      socketId: socket.id,
      playerName: room.gameState.getPlayer(socket.id).name,
      action: actionType,
      amount: result.amount,
      roomInfo: room.getInfo()
    });

    if (room.isOnlyOnePlayerLeft()) {
      this.handleRoundEnd(roomId);
    } else if (room.gameState.isBettingRoundOver()) {
      this.handleBettingRoundEnd(roomId);
    } else {
      const nextPlayerId = room.gameState.nextPlayer();
      if (nextPlayerId) {
        this.sendPlayerUpdate(roomId);
        this.startTurnTimer(roomId);
      }
    }

    this.sendSuccess(callback, { success: true });
  }

  handleBettingRoundEnd(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.gameState.startNewBettingRound();

    this.io.to(roomId).emit('bettingRoundEnded', {
      round: room.gameState.bettingRound,
      roomInfo: room.getInfo()
    });

    this.sendPlayerUpdate(roomId);
    this.startTurnTimer(roomId);
  }

  handleRoundEnd(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.gameState.stopTimer();

    const winnerId = room.gameState.activePlayers[0];
    const winner = room.gameState.getPlayer(winnerId);

    winner.chips += room.gameState.pot;

    this.io.to(roomId).emit('roundEnded', {
      reason: 'allFolded',
      winner: {
        socketId: winnerId,
        name: winner.name,
        pot: room.gameState.pot
      },
      roomInfo: room.getInfo()
    });

    room.gameState.pot = 0;

    setTimeout(() => {
      room.resetGame();
      this.io.to(roomId).emit('gameReady', {
        roomInfo: room.getInfo()
      });
    }, 3000);
  }

  startTurnTimer(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const currentPlayerId = room.gameState.getCurrentPlayerSocketId();
    if (!currentPlayerId) return;

    room.gameState.startTimer(TIMER_DURATION, () => {
      const currentPlayer = room.gameState.getCurrentPlayerSocketId();
      if (currentPlayer === currentPlayerId) {
        room.gameState.fold(currentPlayerId);
        room.gameState.stopTimer();

        this.io.to(roomId).emit('playerActed', {
          socketId: currentPlayerId,
          playerName: room.gameState.getPlayer(currentPlayerId)?.name,
          action: 'fold',
          reason: 'timeout',
          amount: 0,
          roomInfo: room.getInfo()
        });

        if (room.isOnlyOnePlayerLeft()) {
          this.handleRoundEnd(roomId);
        } else if (room.gameState.isBettingRoundOver()) {
          this.handleBettingRoundEnd(roomId);
        } else {
          room.gameState.nextPlayer();
          this.sendPlayerUpdate(roomId);
          this.startTurnTimer(roomId);
        }
      }
    });

    this.io.to(roomId).emit('timerUpdate', {
      currentPlayerSocketId: currentPlayerId,
      timerRemaining: TIMER_DURATION
    });
  }

  sendPlayerUpdate(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const currentPlayerId = room.gameState.getCurrentPlayerSocketId();
    if (currentPlayerId) {
      this.io.to(roomId).emit('turnChanged', {
        currentPlayerSocketId: currentPlayerId,
        currentPlayerName: room.gameState.getPlayer(currentPlayerId).name,
        actions: room.gameState.getAvailableActions(currentPlayerId),
        roomInfo: room.getInfo()
      });
    }
  }

  handleChatMessage(socket, data, callback) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) {
      this.sendError(callback, '不在任何房间中');
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(callback, '房间不存在');
      return;
    }

    const player = room.gameState.getPlayer(socket.id);
    if (!player) {
      this.sendError(callback, '玩家不存在');
      return;
    }

    const { message } = data;
    if (!message || message.trim().length === 0) {
      this.sendError(callback, '消息不能为空');
      return;
    }

    this.io.to(roomId).emit('chatMessage', {
      socketId: socket.id,
      playerName: player.name,
      message: message.trim().substring(0, 200),
      timestamp: Date.now()
    });

    this.sendSuccess(callback, { success: true });
  }

  handleReconnect(socket, data, callback) {
    const { playerName } = data;
    if (!playerName) {
      this.sendError(callback, '请提供昵称');
      return;
    }

    for (const [roomId, room] of this.rooms) {
      for (const [oldSocketId, player] of room.gameState.players) {
        if (player.name === playerName) {
          const result = room.reconnectPlayer(socket.id, oldSocketId);
          if (result.success) {
            this.playerRooms.set(socket.id, roomId);
            this.socketToPlayer.set(socket.id, { name: playerName, roomId });
            socket.join(roomId);

            this.io.to(roomId).emit('playerReconnected', {
              socketId: socket.id,
              playerName: playerName,
              roomInfo: room.getInfo()
            });

            this.sendSuccess(callback, result);
            return;
          }
        }
      }
    }

    this.sendError(callback, '未找到离线玩家');
  }

  handleDisconnect(socket) {
    console.log(`玩家断开: ${socket.id}`);

    const roomId = this.playerRooms.get(socket.id);

    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.markDisconnected(socket.id);
        this.io.to(roomId).emit('playerDisconnected', {
          socketId: socket.id,
          playerName: room.gameState.getPlayer(socket.id)?.name,
          roomInfo: room.getInfo()
        });
      }

      this.removePlayerFromRoom(socket, roomId);
      socket.leave(roomId);
    }

    this.playerRooms.delete(socket.id);
    this.socketToPlayer.delete(socket.id);
  }

  sendSuccess(callback, data) {
    if (typeof callback === 'function') {
      callback({ success: true, ...data });
    }
  }

  sendError(callback, message) {
    if (typeof callback === 'function') {
      callback({ success: false, message });
    }
  }
}

module.exports = SocketEvents;
