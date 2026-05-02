/**
 * 德州扑克下注流程模拟器 - 游戏状态管理
 */

class GameState {
  constructor(settings = {}) {
    this.players = new Map();
    this.currentBets = new Map();
    this.pot = 0;
    this.currentPlayerIndex = 0;
    this.currentBetAmount = 0;
    this.bettingRound = 0;
    this.activePlayers = [];
    this.turnActions = new Map();
    this.minBet = settings.minBet || 10;
    this.timer = null;
    this.timerDuration = settings.timer || 30;
    this.initialChips = settings.initialChips || 1000;
    this.actionDeadline = null;
  }

  applySettings(settings) {
    if (settings.minBet) this.minBet = settings.minBet;
    if (settings.timer) this.timerDuration = settings.timer;
    if (settings.initialChips) this.initialChips = settings.initialChips;
  }

  addPlayer(socketId, name) {
    this.players.set(socketId, {
      name: name,
      chips: this.initialChips,
      socketId: socketId,
      hasFolded: false,
      hasActed: false
    });
    this.currentBets.set(socketId, 0);
    this.rebuildActivePlayers();
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.currentBets.delete(socketId);
    this.rebuildActivePlayers();
  }

  rebuildActivePlayers() {
    this.activePlayers = [];
    for (const [socketId, player] of this.players) {
      if (!player.hasFolded) {
        this.activePlayers.push(socketId);
      }
    }
  }

  getCurrentPlayerSocketId() {
    if (this.activePlayers.length === 0) return null;
    if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.activePlayers.length) {
      this.currentPlayerIndex = 0;
    }
    return this.activePlayers[this.currentPlayerIndex];
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getPlayersList() {
    const players = [];
    for (const [socketId, player] of this.players) {
      players.push({
        ...player,
        currentBet: this.currentBets.get(socketId) || 0,
        isCurrentPlayer: socketId === this.getCurrentPlayerSocketId()
      });
    }
    return players;
  }

  canBet(socketId) {
    return this.currentBetAmount === 0 && this.getCurrentPlayerSocketId() === socketId && this.hasChips(socketId);
  }

  canCheck(socketId) {
    const playerBet = this.currentBets.get(socketId) || 0;
    return playerBet === this.currentBetAmount && this.getCurrentPlayerSocketId() === socketId;
  }

  canCall(socketId) {
    const playerBet = this.currentBets.get(socketId) || 0;
    const callAmount = this.currentBetAmount - playerBet;
    return callAmount > 0 && this.getCurrentPlayerSocketId() === socketId && this.hasChips(socketId);
  }

  canRaise(socketId) {
    const player = this.getPlayer(socketId);
    const playerBet = this.currentBets.get(socketId) || 0;
    const callAmount = this.currentBetAmount - playerBet;
    return this.getCurrentPlayerSocketId() === socketId && this.hasChips(socketId) && callAmount > 0 && player.chips > callAmount;
  }

  bet(socketId, amount) {
    const player = this.getPlayer(socketId);
    if (!player || amount < this.minBet || amount > player.chips) {
      return { success: false, message: '下注金额无效' };
    }

    this.pot += amount;
    player.chips -= amount;
    this.currentBets.set(socketId, amount);
    this.currentBetAmount = amount;
    player.hasActed = true;

    return { success: true, amount: amount };
  }

  call(socketId) {
    const player = this.getPlayer(socketId);
    const playerBet = this.currentBets.get(socketId) || 0;
    const callAmount = this.currentBetAmount - playerBet;

    if (callAmount <= 0) {
      return { success: false, message: '无需跟注' };
    }

    const actualCall = Math.min(callAmount, player.chips);
    this.pot += actualCall;
    player.chips -= actualCall;
    this.currentBets.set(socketId, playerBet + actualCall);
    player.hasActed = true;

    return { success: true, amount: actualCall };
  }

  raise(socketId, amount) {
    const player = this.getPlayer(socketId);
    const playerBet = this.currentBets.get(socketId) || 0;
    const totalNeeded = amount - playerBet;

    if (amount <= this.currentBetAmount || totalNeeded > player.chips) {
      return { success: false, message: '加注金额无效' };
    }

    this.pot += totalNeeded;
    player.chips -= totalNeeded;
    this.currentBets.set(socketId, amount);
    this.currentBetAmount = amount;
    player.hasActed = true;

    return { success: true, amount: totalNeeded };
  }

  fold(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    player.hasFolded = true;
    player.hasActed = true;
    this.rebuildActivePlayers();

    return { success: true };
  }

  check(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    player.hasActed = true;
    return { success: true };
  }

  nextPlayer() {
    if (this.activePlayers.length === 0) return null;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.activePlayers.length;
    return this.getCurrentPlayerSocketId();
  }

  isBettingRoundOver() {
    if (this.activePlayers.length <= 1) return true;

    for (const socketId of this.activePlayers) {
      const player = this.getPlayer(socketId);
      if (!player.hasActed) return false;
    }

    let referenceBet = null;
    for (const socketId of this.activePlayers) {
      const bet = this.currentBets.get(socketId) || 0;
      if (referenceBet === null) {
        referenceBet = bet;
      } else if (bet !== referenceBet) {
        return false;
      }
    }
    return true;
  }

  resetActions() {
    for (const [socketId, player] of this.players) {
      player.hasActed = false;
    }
    this.currentPlayerIndex = 0;
  }

  resetBets() {
    for (const socketId of this.currentBets.keys()) {
      this.currentBets.set(socketId, 0);
    }
    this.currentBetAmount = 0;
    this.resetActions();
  }

  startNewBettingRound() {
    this.bettingRound++;
    this.resetBets();
  }

  startTimer(duration, callback) {
    this.stopTimer();
    this.timerDuration = duration || 30;
    this.actionDeadline = Date.now() + this.timerDuration * 1000;
    this.timer = setTimeout(() => {
      if (callback) callback();
    }, this.timerDuration * 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.actionDeadline = null;
  }

  getTimeRemaining() {
    if (!this.actionDeadline) return null;
    return Math.max(0, Math.ceil((this.actionDeadline - Date.now()) / 1000));
  }

  getState() {
    return {
      players: this.getPlayersList(),
      pot: this.pot,
      currentBetAmount: this.currentBetAmount,
      currentPlayerSocketId: this.getCurrentPlayerSocketId(),
      activePlayerCount: this.activePlayers.length,
      bettingRound: this.bettingRound,
      minBet: this.minBet,
      timerRemaining: this.getTimeRemaining()
    };
  }

  getAvailableActions(socketId) {
    const player = this.getPlayer(socketId);
    return {
      canCheck: this.canCheck(socketId),
      canBet: this.canBet(socketId),
      canCall: this.canCall(socketId),
      canRaise: this.canRaise(socketId),
      isCurrentPlayer: this.getCurrentPlayerSocketId() === socketId,
      currentBetAmount: this.currentBetAmount,
      playerChips: player?.chips || 0,
      playerCurrentBet: this.currentBets.get(socketId) || 0,
      callAmount: this.getCallAmount(socketId),
      minBet: this.minBet
    };
  }

  getCallAmount(socketId) {
    const playerBet = this.currentBets.get(socketId) || 0;
    return Math.max(0, this.currentBetAmount - playerBet);
  }

  hasChips(socketId) {
    const player = this.getPlayer(socketId);
    return player && player.chips > 0;
  }
}

module.exports = GameState;
