/**
 * 德州扑克下注流程模拟器 - 服务器入口
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const SocketEvents = require('./socket/events');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 初始化Socket事件
const socketEvents = new SocketEvents(io);
socketEvents.init();

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║        德州扑克下注流程模拟器 - 服务器启动          ║
╠════════════════════════════════════════════════════╣
║  本地访问:  http://localhost:${PORT}                    ║
║  局域网访问: http://<你的局域网IP>:${PORT}            ║
║  查找局域网IP: ifconfig | grep "inet "              ║
╚════════════════════════════════════════════════════╝
  `);
});