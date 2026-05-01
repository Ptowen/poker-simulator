---
AIGC:
    ContentProducer: Minimax Agent AI
    ContentPropagator: Minimax Agent AI
    Label: AIGC
    ProduceID: "00000000000000000000000000000000"
    PropagateID: "00000000000000000000000000000000"
    ReservedCode1: 3046022100e9601d9224ec770cdba0f1a9635b9d05e8af0f5ca0330f4151088f763ff2a10602210084a8a399c64fda6559c72f939e714a7733653b39f740f39fd1a0dc47e02a2c19
    ReservedCode2: 3044022004e16906f2b637a4c3a0fffefea4aca6a3f7d95743bf2eddd9aa6ebe9d25686502204cec0aa40e38b75f015f4a1002dd6a2297703610d79d66093d72d6e8d1c3def8
---

# 德州扑克下注模拟器 v1.1.1

Texas Hold'em Betting Simulator - 多人实时下注系统

**[更新日志](CHANGELOG.md)**

## 功能特性

- **房间系统**: 创建/加入房间，支持2-8人
- **实时下注**: Check / Bet / Call / Raise / Fold
- **回合控制**: 自动轮流转圈，支持多人局域网对战
- **底池系统**: 自动计算底池和当前下注额
- **计时器**: 30秒操作超时自动弃牌
- **断线重连**: 支持玩家断线后重新连接
- **美观UI**: 专业扑克桌设计，流畅动画

## 支持的操作

| 操作 | 说明 | 条件 |
|------|------|------|
| Check | 过牌 | 无人下注或当前下注已等于最高下注 |
| Bet | 下注 | 无人下注时首次下注 |
| Call | 跟注 | 需要跟注时 |
| Raise | 加注 | 任何时候可加注 |
| Fold | 弃牌 | 任何时候可弃牌 |

## 下注流程

1. **第一轮下注**: 所有玩家完成操作，下注相同则进入下一轮
2. **后续轮次**: 重复直到只剩一名玩家或所有玩家下注相同
3. **结算**: 最后一个未弃牌玩家获胜，获得底池

## 项目结构

```
poker-simulator/
├── server.js              # 服务器入口
├── package.json           # 项目配置
├── Dockerfile             # Docker镜像配置
├── docker-compose.yml     # Docker Compose配置
├── game/
│   ├── GameState.js       # 游戏状态管理
│   └── GameRoom.js        # 房间管理
├── socket/
│   └── events.js          # Socket.io 事件处理
└── public/
    ├── index.html         # 主页面
    ├── styles.css         # 样式表
    └── app.js             # 客户端逻辑
```

## 运行方法

### 本地运行

```bash
npm install
npm start
```

访问: http://localhost:3000

### Docker部署

```bash
# 构建镜像
docker build -t poker-simulator .

# 运行容器
docker run -d -p 3000:3000 --restart unless-stopped --name poker poker-simulator
```

### Docker Compose部署

```bash
docker-compose up -d
```

### 群晖NAS部署

1. 将项目文件上传到群晖
2. SSH登录群晖，进入项目目录
3. 运行 `docker-compose up -d`
4. 访问 `http://<群晖IP>:3000`

## Socket.io 事件

### 客户端 → 服务器

| 事件 | 参数 | 说明 |
|------|------|------|
| createRoom | { playerName } | 创建房间 |
| joinRoom | { roomId, playerName } | 加入房间 |
| leaveRoom | - | 离开房间 |
| startGame | - | 开始游戏 |
| playerAction | { action, amount } | 玩家操作 |
| chatMessage | { message } | ~~发送聊天消息~~ (已移除) |

### 服务器 → 客户端

| 事件 | 参数 | 说明 |
|------|------|------|
| playerJoined | { player, roomInfo } | 玩家加入 |
| playerLeft | { socketId, roomInfo } | 玩家离开 |
| hostChanged | { newHostSocketId } | 房主变更 |
| gameStarted | { roomInfo } | 游戏开始 |
| playerActed | { socketId, action, roomInfo } | 玩家行动 |
| turnChanged | { currentPlayerSocketId, actions } | 回合改变 |
| bettingRoundEnded | { round, roomInfo } | 下注回合结束 |
| roundEnded | { reason, winner, roomInfo } | 回合结束 |
| timerUpdate | { currentPlayerSocketId, timerRemaining } | 计时器更新 |
| playerDisconnected | { socketId, playerName } | 玩家断线 |
| playerReconnected | { socketId, playerName } | 玩家重连 |
| chatMessage | { socketId, playerName, message, timestamp } | ~~聊天消息~~ (已移除) |
| gameReady | { roomInfo } | 等待新一局 |

## 技术栈

- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **后端**: Node.js + Express
- **实时通信**: Socket.io
- **状态管理**: 内存存储（无数据库）
- **容器化**: Docker

## License

MIT
