/**
 * 德州扑克下注流程模拟器 - 游戏房间管理
 */

const GameState = require('./GameState');

class GameRoom {
  constructor(roomId, hostSocketId, settings = {}) {
    this.roomId = roomId;
    this.hostSocketId = hostSocketId;
    this.settings = {
      minBet: settings.minBet || 10,
      timer: settings.timer || 30,
      initialChips: settings.initialChips || 1000
    };
    this.gameState = new GameState(this.settings);
    this.gameStarted = false;
    this.createdAt = Date.now();
    this.playerSockets = new Map();
    this.disconnectedPlayers = new Map();
  }

  updateSettings(newSettings) {
    if (newSettings.minBet) this.settings.minBet = newSettings.minBet;
    if (newSettings.timer) this.settings.timer = newSettings.timer;
    if (newSettings.initialChips) this.settings.initialChips = newSettings.initialChips;
    this.gameState.applySettings(newSettings);
  }

  addPlayer(socketId, name) {
    if (this.gameState.players.size >= 8) {
      return { success: false, message: '房间已满（最多8人）' };
    }

    for (const [, player] of this.gameState.players) {
      if (player.name === name) {
        return { success: false, message: '昵称已被使用' };
      }
    }

    this.gameState.addPlayer(socketId, name);
    this.playerSockets.set(socketId, socketId);
    return { success: true };
  }

  reconnectPlayer(socketId, oldSocketId) {
    const player = this.gameState.getPlayer(oldSocketId);
    if (!player) return { success: false, message: '玩家不存在' };

    const currentBet = this.gameState.currentBets.get(oldSocketId) || 0;

    this.gameState.players.delete(oldSocketId);
    player.socketId = socketId;
    this.gameState.players.set(socketId, player);

    this.gameState.currentBets.delete(oldSocketId);
    this.gameState.currentBets.set(socketId, currentBet);

    this.gameState.activePlayers = this.gameState.activePlayers.map(id =>
      id === oldSocketId ? socketId : id
    );

    if (this.hostSocketId === oldSocketId) {
      this.hostSocketId = socketId;
    }

    this.disconnectedPlayers.delete(oldSocketId);
    this.playerSockets.set(socketId, socketId);
    this.playerSockets.delete(oldSocketId);

    return {
      success: true,
      player: this.gameState.getPlayer(socketId),
      roomInfo: this.getInfo()
    };
  }

  markDisconnected(socketId) {
    const player = this.gameState.getPlayer(socketId);
    if (player) {
      this.disconnectedPlayers.set(socketId, {
        name: player.name,
        chips: player.chips,
        hasFolded: player.hasFolded,
        hasActed: player.hasActed,
        currentBet: this.gameState.currentBets.get(socketId) || 0,
        disconnectedAt: Date.now()
      });
    }
  }

  removePlayer(socketId) {
    const wasHost = this.hostSocketId === socketId;
    this.gameState.removePlayer(socketId);
    this.playerSockets.delete(socketId);
    this.disconnectedPlayers.delete(socketId);

    if (wasHost && this.gameState.players.size > 0) {
      const firstSocketId = this.gameState.players.keys().next().value;
      this.hostSocketId = firstSocketId;
      return { hostChanged: true, newHostSocketId: firstSocketId };
    }

    return { hostChanged: false };
  }

  getOnlinePlayerCount() {
    return this.gameState.players.size - this.disconnectedPlayers.size;
  }

  startGame() {
    if (this.getOnlinePlayerCount() < 2) {
      return { success: false, message: '需要至少2名在线玩家才能开始' };
    }

    this.gameStarted = true;
    this.gameState.resetBets();
    this.gameState.bettingRound = 0;
    this.gameState.resetActions();

    if (this.gameState.activePlayers.length > 0) {
      this.gameState.currentPlayerIndex = 0;
    }

    return { success: true };
  }

  resetGame() {
    const existingPlayers = [];
    for (const [socketId, player] of this.gameState.players) {
      existingPlayers.push({
        socketId: socketId,
        name: player.name,
        chips: player.chips
      });
    }

    this.gameStarted = false;
    this.gameState = new GameState(this.settings);

    for (const playerData of existingPlayers) {
      this.gameState.addPlayer(playerData.socketId, playerData.name);
      const newPlayer = this.gameState.getPlayer(playerData.socketId);
      if (newPlayer) {
        newPlayer.chips = playerData.chips || this.settings.initialChips;
      }
    }
  }

  getInfo() {
    return {
      roomId: this.roomId,
      hostSocketId: this.hostSocketId,
      players: this.gameState.getPlayersList(),
      playerCount: this.gameState.players.size,
      maxPlayers: 8,
      gameStarted: this.gameStarted,
      pot: this.gameState.pot,
      currentBetAmount: this.gameState.currentBetAmount,
      minBet: this.gameState.minBet,
      bettingRound: this.gameState.bettingRound,
      currentPlayerSocketId: this.gameState.getCurrentPlayerSocketId(),
      settings: this.settings
    };
  }

  isOnlyOnePlayerLeft() {
    return this.gameState.activePlayers.length <= 1;
  }
}

module.exports = GameRoom;
