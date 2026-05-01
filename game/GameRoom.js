/**
 * 德州扑克下注流程模拟器 - 游戏房间管理
 */

const GameState = require('./GameState');

class GameRoom {
  constructor(roomId, hostSocketId) {
    this.roomId = roomId;
    this.hostSocketId = hostSocketId;
    this.gameState = new GameState();
    this.gameStarted = false;
    this.createdAt = Date.now();
    this.playerSockets = new Map();
    this.disconnectedPlayers = new Map();
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

    const playerName = player.name;
    const playerChips = player.chips;
    const playerFolded = player.hasFolded;

    this.gameState.removePlayer(oldSocketId);
    this.gameState.addPlayer(socketId, playerName);
    const newPlayer = this.gameState.getPlayer(socketId);
    if (newPlayer) {
      newPlayer.chips = playerChips;
      newPlayer.hasFolded = playerFolded;
    }

    this.disconnectedPlayers.delete(oldSocketId);
    this.playerSockets.set(socketId, socketId);
    this.playerSockets.delete(oldSocketId);

    this.gameState.rebuildActivePlayers();

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

  startGame() {
    if (this.gameState.players.size < 2) {
      return { success: false, message: '需要至少2名玩家才能开始' };
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
    this.gameState = new GameState();

    for (const playerData of existingPlayers) {
      this.gameState.addPlayer(playerData.socketId, playerData.name);
      const newPlayer = this.gameState.getPlayer(playerData.socketId);
      if (newPlayer) {
        newPlayer.chips = playerData.chips || 1000;
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
      currentPlayerSocketId: this.gameState.getCurrentPlayerSocketId()
    };
  }

  isOnlyOnePlayerLeft() {
    return this.gameState.activePlayers.length <= 1;
  }
}

module.exports = GameRoom;
