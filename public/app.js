/**
 * 德州扑克下注模拟器 - 客户端主逻辑
 */

const socket = io();

const views = {
  lobby: document.getElementById('lobby-view'),
  waiting: document.getElementById('waiting-view'),
  game: document.getElementById('game-view')
};

const elements = {
  playerName: document.getElementById('player-name'),
  roomCode: document.getElementById('room-code'),
  createRoomBtn: document.getElementById('create-room-btn'),
  joinRoomBtn: document.getElementById('join-room-btn'),
  errorMessage: document.getElementById('error-message'),
  displayRoomCode: document.getElementById('display-room-code'),
  copyRoomCode: document.getElementById('copy-room-code'),
  leaveRoomBtn: document.getElementById('leave-room-btn'),
  playerCount: document.getElementById('player-count'),
  playersList: document.getElementById('players-list'),
  startGameBtn: document.getElementById('start-game-btn'),
  gameRoomCode: document.getElementById('game-room-code'),
  bettingRound: document.getElementById('betting-round'),
  potAmount: document.getElementById('pot-amount'),
  currentBetAmount: document.getElementById('current-bet-amount'),
  gamePlayers: document.getElementById('game-players'),
  turnIndicator: document.getElementById('turn-indicator'),
  checkBtn: document.getElementById('check-btn'),
  betBtn: document.getElementById('bet-btn'),
  callBtn: document.getElementById('call-btn'),
  raiseBtn: document.getElementById('raise-btn'),
  foldBtn: document.getElementById('fold-btn'),
  callAmount: document.getElementById('call-amount'),
  betModal: document.getElementById('bet-modal'),
  modalTitle: document.getElementById('modal-title'),
  betAmountInput: document.getElementById('bet-amount-input'),
  betMinus: document.getElementById('bet-minus'),
  betPlus: document.getElementById('bet-plus'),
  betPresets: document.querySelectorAll('.bet-preset'),
  modalChips: document.getElementById('modal-chips'),
  modalConfirm: document.getElementById('modal-confirm'),
  modalCancel: document.getElementById('modal-cancel'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
  timerDisplay: document.getElementById('timer-display'),
  timerValue: document.getElementById('timer-value'),
  resultModal: document.getElementById('result-modal'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  resultClose: document.getElementById('result-close'),
  resultContinue: document.getElementById('result-continue'),
  roomList: document.getElementById('room-list'),
  refreshRoomsBtn: document.getElementById('refresh-rooms-btn'),
  roomListContainer: document.getElementById('room-list-container'),
  logEntries: document.getElementById('log-entries'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsTitle: document.getElementById('settings-title'),
  minBetInput: document.getElementById('min-bet-input'),
  minBetValue: document.getElementById('min-bet-value'),
  timerInput: document.getElementById('timer-input'),
  timerInputValue: document.getElementById('timer-input-value'),
  chipsInput: document.getElementById('chips-input'),
  chipsValue: document.getElementById('chips-value'),
  settingsSave: document.getElementById('settings-save'),
  settingsCancel: document.getElementById('settings-cancel'),
  settingsRestore: document.getElementById('settings-restore')
};

let currentRoomId = null;
let currentPlayerSocketId = null;
let currentPlayerName = null;
let isHost = false;
let currentBetType = null;
let timerInterval = null;
let gameData = null;
let actionLog = [];
let currentSettings = {
  minBet: 10,
  timer: 30,
  initialChips: 1000
};

function addLogEntry(type, message) {
  actionLog.push({ type, message });
  renderActionLog();
}

function renderActionLog() {
  if (!elements.logEntries) return;
  elements.logEntries.innerHTML = actionLog
    .map(e => `<div class="log-entry ${e.type}">${e.message}</div>`)
    .join('');
  elements.logEntries.scrollTop = elements.logEntries.scrollHeight;
}

function clearActionLog() {
  actionLog = [];
  renderActionLog();
}

function openSettingsModal() {
  elements.minBetInput.value = currentSettings.minBet;
  elements.minBetValue.textContent = currentSettings.minBet;
  elements.timerInput.value = currentSettings.timer;
  elements.timerInputValue.textContent = currentSettings.timer;
  elements.chipsInput.value = currentSettings.initialChips;
  elements.chipsValue.textContent = currentSettings.initialChips;

  if (elements.settingsModal.parentElement.id !== 'app') {
    document.getElementById('app').appendChild(elements.settingsModal);
  }

  elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  elements.settingsModal.classList.add('hidden');
}

function restoreDefaultSettings() {
  const defaults = { minBet: 10, timer: 30, initialChips: 1000 };
  elements.minBetInput.value = defaults.minBet;
  elements.minBetValue.textContent = defaults.minBet;
  elements.timerInput.value = defaults.timer;
  elements.timerInputValue.textContent = defaults.timer;
  elements.chipsInput.value = defaults.initialChips;
  elements.chipsValue.textContent = defaults.initialChips;
}

function updateSettingsFromServer(settings) {
  currentSettings = { ...settings };
}

function showView(viewName) {
  Object.values(views).forEach(view => view.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
}

function showError(message) {
  elements.errorMessage.textContent = message;
  setTimeout(() => {
    elements.errorMessage.textContent = '';
  }, 5000);
}

function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

function initLobby() {
  elements.createRoomBtn.addEventListener('click', () => {
    const name = elements.playerName.value.trim();
    if (!name) {
      showError('请输入昵称');
      return;
    }
    socket.emit('createRoom', { playerName: name });
  });

  elements.joinRoomBtn.addEventListener('click', () => {
    const name = elements.playerName.value.trim();
    const roomId = elements.roomCode.value.trim().toUpperCase();
    if (!name) {
      showError('请输入昵称');
      return;
    }
    if (!roomId) {
      showError('请输入房间号');
      return;
    }
    socket.emit('joinRoom', { playerName: name, roomId: roomId });
  });

  elements.refreshRoomsBtn.addEventListener('click', () => {
    socket.emit('refreshRooms');
  });
}

function initWaitingRoom() {
  elements.leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom');
    currentRoomId = null;
    isHost = false;
    showView('lobby');
  });

  elements.copyRoomCode.addEventListener('click', () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId);
      showToast('房间号已复制');
    }
  });

  elements.startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
  });

  elements.settingsBtn.addEventListener('click', () => {
    if (!isHost) {
      showToast('仅房主可更改配置');
      return;
    }
    openSettingsModal();
  });

  elements.minBetInput.addEventListener('input', () => {
    elements.minBetValue.textContent = elements.minBetInput.value;
  });

  elements.timerInput.addEventListener('input', () => {
    elements.timerInputValue.textContent = elements.timerInput.value;
  });

  elements.chipsInput.addEventListener('input', () => {
    elements.chipsValue.textContent = elements.chipsInput.value;
  });

  elements.settingsSave.addEventListener('click', () => {
    const settings = {
      minBet: parseInt(elements.minBetInput.value),
      timer: parseInt(elements.timerInput.value),
      initialChips: parseInt(elements.chipsInput.value)
    };
    socket.emit('updateSettings', { settings });
    closeSettingsModal();
  });

  elements.settingsCancel.addEventListener('click', () => {
    closeSettingsModal();
  });

  elements.settingsRestore.addEventListener('click', () => {
    restoreDefaultSettings();
  });

  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettingsModal();
  });
}

function initGame() {
  elements.checkBtn.addEventListener('click', () => performAction('check'));
  elements.betBtn.addEventListener('click', () => openBetModal('bet'));
  elements.callBtn.addEventListener('click', () => performAction('call'));
  elements.raiseBtn.addEventListener('click', () => openBetModal('raise'));
  elements.foldBtn.addEventListener('click', () => performAction('fold'));

  elements.betMinus.addEventListener('click', () => {
    const input = elements.betAmountInput;
    const newValue = Math.max(parseInt(input.min) || 10, parseInt(input.value) - 10);
    input.value = newValue;
  });

  elements.betPlus.addEventListener('click', () => {
    const input = elements.betAmountInput;
    const currentChips = parseInt(elements.modalChips.textContent);
    const newValue = Math.min(currentChips, parseInt(input.value) + 10);
    input.value = newValue;
  });

  elements.betPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      const amount = preset.dataset.amount;
      elements.betAmountInput.value = amount === 'all'
        ? parseInt(elements.modalChips.textContent)
        : parseInt(amount);
    });
  });

  elements.modalConfirm.addEventListener('click', () => {
    const amount = parseInt(elements.betAmountInput.value);
    if (amount > 0) {
      performAction(currentBetType, amount);
      closeBetModal();
    }
  });

  elements.modalCancel.addEventListener('click', closeBetModal);
  elements.betModal.addEventListener('click', (e) => {
    if (e.target === elements.betModal) closeBetModal();
  });

  elements.resultClose.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
    socket.emit('leaveRoom');
    currentRoomId = null;
    isHost = false;
    clearActionLog();
    showView('lobby');
  });

  elements.resultContinue.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
    updateWaitingRoom(gameData);
    showView('waiting');
  });
}

function openBetModal(type) {
  currentBetType = type;
  elements.modalTitle.textContent = type === 'bet' ? '下注' : '加注';

  const player = getCurrentPlayer();
  elements.modalChips.textContent = player.chips;

  let minAmount;
  if (type === 'bet') {
    minAmount = gameData?.minBet || 10;
  } else {
    minAmount = (gameData?.currentBetAmount || 0) * 2;
  }
  elements.betAmountInput.min = minAmount;
  elements.betAmountInput.value = Math.max(minAmount, 10);

  elements.betModal.classList.remove('hidden');
}

function closeBetModal() {
  elements.betModal.classList.add('hidden');
  currentBetType = null;
}

function performAction(action, amount = null) {
  const player = getCurrentPlayer();
  if (player.chips <= 0 && action !== 'fold') {
    showError('筹码用尽，不可下注');
    return;
  }
  socket.emit('playerAction', { action, amount });
}

function getCurrentPlayer() {
  const player = gameData?.players?.find(p => p.socketId === currentPlayerSocketId);
  return {
    chips: player?.chips || 1000
  };
}

function renderWaitingPlayers(players, hostSocketId) {
  elements.playersList.innerHTML = '';

  players.forEach(player => {
    const isYou = player.socketId === currentPlayerSocketId;
    const card = document.createElement('div');
    card.className = `player-card${isYou ? ' is-you' : ''}${player.socketId === hostSocketId ? ' host' : ''}`;

    const initial = player.name.charAt(0).toUpperCase();

    card.innerHTML = `
      <div class="player-avatar">${initial}</div>
      <div class="player-name">${player.name}</div>
      <div class="player-badge${player.socketId === hostSocketId ? ' host-badge' : ''}">
        ${player.socketId === hostSocketId ? '房主' : (isYou ? '你' : '玩家')}
      </div>
    `;

    elements.playersList.appendChild(card);
  });

  elements.playerCount.textContent = `(${players.length}/8)`;
}

function renderRoomList(rooms) {
  if (rooms.length === 0) {
    elements.roomList.innerHTML = '<div class="no-rooms">暂无等待中的房间</div>';
    return;
  }

  elements.roomList.innerHTML = '';

  rooms.forEach(room => {
    const roomEl = document.createElement('div');
    roomEl.className = 'room-item';
    roomEl.innerHTML = `
      <div class="room-item-info">
        <div class="room-item-id">房间号: <strong>${room.roomId}</strong></div>
        <div class="room-item-players">${room.playerCount}/${room.maxPlayers} 人</div>
      </div>
      <button class="btn btn-small btn-primary room-join-btn">加入</button>
    `;

    roomEl.querySelector('.room-join-btn').addEventListener('click', () => {
      const name = elements.playerName.value.trim();
      if (!name) {
        showError('请输入昵称');
        return;
      }
      socket.emit('joinRoom', { playerName: name, roomId: room.roomId });
    });

    elements.roomList.appendChild(roomEl);
  });
}

function handleRoomList(data) {
  renderRoomList(data.rooms || []);
}

function renderGamePlayers(players, currentPlayerSocketId, currentPlayerId) {
  elements.gamePlayers.innerHTML = '';

  players.forEach(player => {
    const isYou = player.socketId === currentPlayerSocketId;
    const isCurrentTurn = player.socketId === currentPlayerId;
    const isFolded = player.hasFolded;

    const playerEl = document.createElement('div');
    playerEl.className = `game-player${isCurrentTurn ? ' current-turn' : ''}${isFolded ? ' folded' : ''}${isYou ? ' is-you' : ''}`;

    let html = '';

    if (isCurrentTurn && !isFolded) {
      html += '<div class="game-player-turn-indicator">行动中</div>';
    }
    if (isFolded) {
      html += '<div class="game-player-folded-badge">弃牌</div>';
    }

    html += `
      <div class="game-player-info">
        <div class="game-player-name">${player.name}</div>
      </div>
      <div class="game-player-stats">
        <div class="game-player-chips">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          ${player.chips}
        </div>
        <div class="game-player-bet">
          ${isFolded ? '' : `当前: ${player.currentBet}`}
        </div>
      </div>
    `;

    playerEl.innerHTML = html;
    elements.gamePlayers.appendChild(playerEl);
  });
}

function updateActionButtons(data) {
  const actions = data.actions || data;

  elements.checkBtn.disabled = !actions.canCheck;
  elements.betBtn.disabled = !actions.canBet;
  elements.callBtn.disabled = !actions.canCall;
  elements.raiseBtn.disabled = !actions.canRaise;
  elements.foldBtn.disabled = !actions.isCurrentPlayer;

  const callAmount = actions.callAmount || 0;
  elements.callAmount.textContent = `跟注 ${callAmount}`;
}

function updateTimer(seconds) {
  if (seconds === null || seconds === undefined) {
    elements.timerDisplay.classList.add('hidden');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    return;
  }

  elements.timerDisplay.classList.remove('hidden');
  elements.timerValue.textContent = seconds;
  elements.timerDisplay.classList.toggle('warning', seconds <= 10);

  if (timerInterval) clearInterval(timerInterval);

  let remaining = seconds;
  timerInterval = setInterval(() => {
    remaining--;
    elements.timerValue.textContent = remaining;
    elements.timerDisplay.classList.toggle('warning', remaining <= 10);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }, 1000);
}

function updateRoomInfo(roomInfo) {
  gameData = roomInfo;

  elements.gameRoomCode.textContent = roomInfo.roomId;
  elements.bettingRound.textContent = roomInfo.bettingRound + 1;
  elements.potAmount.textContent = roomInfo.pot;
  elements.currentBetAmount.textContent = roomInfo.currentBetAmount;

  renderGamePlayers(roomInfo.players, currentPlayerSocketId, roomInfo.currentPlayerSocketId);
}

function updateWaitingRoom(roomInfo) {
  elements.displayRoomCode.textContent = roomInfo.roomId;
  renderWaitingPlayers(roomInfo.players, roomInfo.hostSocketId);
  elements.startGameBtn.disabled = roomInfo.playerCount < 2 || !isHost;
}

function showResultModal(title, message) {
  elements.resultTitle.textContent = title;
  elements.resultMessage.innerHTML = message;
  elements.resultModal.classList.remove('hidden');
}

socket.on('connect', () => {
  console.log('已连接到服务器');
  currentPlayerSocketId = socket.id;
});

socket.on('disconnect', () => {
  console.log('与服务器断开连接');
  showToast('连接已断开');
});

socket.on('createRoom', (data) => {
  if (data.success) {
    currentRoomId = data.roomId;
    currentPlayerSocketId = socket.id;
    isHost = true;
    currentPlayerName = elements.playerName.value.trim();
    if (data.roomInfo.settings) {
      updateSettingsFromServer(data.roomInfo.settings);
    }
    updateWaitingRoom(data.roomInfo);
    showView('waiting');
    showToast('房间创建成功');
  } else {
    showError(data.message);
  }
});

socket.on('joinRoom', (data) => {
  if (data.success) {
    currentRoomId = data.roomId;
    currentPlayerSocketId = socket.id;
    isHost = data.roomInfo.hostSocketId === socket.id;
    currentPlayerName = elements.playerName.value.trim();
    if (data.roomInfo.settings) {
      updateSettingsFromServer(data.roomInfo.settings);
    }
    updateWaitingRoom(data.roomInfo);
    showView('waiting');
    showToast('加入房间成功');
  } else {
    showError(data.message);
  }
});

socket.on('playerJoined', (data) => {
  if (currentRoomId) {
    updateWaitingRoom(data.roomInfo);
  }
});

socket.on('playerLeft', (data) => {
  if (currentRoomId) {
    updateWaitingRoom(data.roomInfo);
  }
});

socket.on('hostChanged', (data) => {
  if (data.newHostSocketId === currentPlayerSocketId) {
    isHost = true;
    showToast('你已成为新房主');
  } else {
    isHost = false;
  }
});

socket.on('playerDisconnected', (data) => {
  showToast(`${data.playerName} 断开了连接`);
});

socket.on('playerReconnected', (data) => {
  showToast(`${data.playerName} 重新连接了`);
});

socket.on('gameStarted', (data) => {
  clearActionLog();
  addLogEntry('round-start', '=== 游戏开始 ===');
  showView('game');
  updateRoomInfo(data.roomInfo);
  elements.settingsBtn.style.display = 'none';
  showToast('游戏开始！');
});

socket.on('playerActed', (data) => {
  updateRoomInfo(data.roomInfo);
  const actionNames = { check: '过牌', bet: '下注', call: '跟注', raise: '加注', fold: '弃牌' };
  const actionName = actionNames[data.action] || data.action;
  const roundDisplay = (data.roomInfo?.bettingRound || 0) + 1;
  let logClass = 'action ' + (data.action === 'check' ? 'action-check' : data.action === 'bet' ? 'action-bet' : data.action === 'call' ? 'action-call' : data.action === 'raise' ? 'action-raise' : 'action-fold');
  addLogEntry(logClass, `[${roundDisplay}] ${data.playerName} ${actionName}${data.amount ? ' ' + data.amount : ''}`);
  if (data.reason === 'timeout') {
    showToast(`${data.playerName} 操作超时，强制弃牌`);
  } else {
    showToast(`${data.playerName} 进行了 ${actionName}${data.amount ? ' ' + data.amount : ''}`);
  }
});

socket.on('turnChanged', (data) => {
  updateRoomInfo(data.roomInfo);
  updateActionButtons(data);

  const isMyTurn = data.currentPlayerSocketId === currentPlayerSocketId;
  if (isMyTurn) {
    elements.turnIndicator.textContent = '轮到你了！';
    elements.turnIndicator.classList.add('your-turn');
  } else {
    elements.turnIndicator.textContent = `等待 ${data.currentPlayerName || '玩家'} 行动...`;
    elements.turnIndicator.classList.remove('your-turn');
  }
});

socket.on('timerUpdate', (data) => {
  updateTimer(data.timerRemaining);
});

socket.on('bettingRoundEnded', (data) => {
  updateRoomInfo(data.roomInfo);
  addLogEntry('round-end', `=== 第 ${data.round + 1} 轮结束 ===`);
  showToast(`第 ${data.round + 1} 轮下注结束`);
  updateTimer(null);
});

socket.on('roundEnded', (data) => {
  updateRoomInfo(data.roomInfo);
  updateTimer(null);

  if (data.winner) {
    addLogEntry('winner', `${data.winner.name} 获胜，获得 ${data.winner.pot} 筹码`);
    let message = `<div class="winner-name">${data.winner.name}</div>获胜`;
    message += `<div>获得底池: <span class="pot-amount">${data.winner.pot}</span></div>`;
    showResultModal('本轮结束', message);
  }
});

socket.on('gameReady', (data) => {
  updateWaitingRoom(data.roomInfo);
  if (data.roomInfo.settings) {
    updateSettingsFromServer(data.roomInfo.settings);
  }
  elements.settingsBtn.style.display = '';
  showToast('房主可以开始新一局');
});

socket.on('settingsUpdated', (data) => {
  updateSettingsFromServer(data.settings);
  showToast('配置已更新');
});

socket.on('connect_error', (err) => {
  showError('连接失败，请检查服务器');
});

socket.on('roomList', handleRoomList);

document.addEventListener('DOMContentLoaded', () => {
  initLobby();
  initWaitingRoom();
  initGame();
  showView('lobby');
  elements.betModal.classList.add('hidden');
  elements.resultModal.classList.add('hidden');

  socket.emit('getRooms');
  setInterval(() => {
    if (views.lobby && !views.lobby.classList.contains('hidden')) {
      socket.emit('refreshRooms');
    }
  }, 5000);
});