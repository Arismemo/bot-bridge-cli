# Bot Bridge Client 安装指南（改进版）

> 目标：从零到成功发送第一条消息

## 📋 前提条件

在安装客户端之前，你需要：

- ✅ 一个正在运行的 Bot Bridge 服务器
- ✅ 服务器的访问地址（如 `https://telegrambot.709970.xyz` 或 `http://localhost:3000`）
- ✅ 机器人的唯一 ID（如 `my-bot`、`xiaoc` 等）

---

## 🚀 方法 1: 一键安装（推荐）

### 步骤 1: 安装

向你的 OpenClaw 机器人发送：

```
/install https://github.com/Arismemo/bot-bridge-cli
```

或使用 Gitee（国内更快）：

```
/install https://gitee.com/john121/bot-bridge-cli
```

### 步骤 2: 验证安装

发送 `/skills` 命令，检查是否看到 `bot-bridge`：

```
/skills
```

如果看到 `bot-bridge` 在列表中，说明安装成功 ✅

---

## 🔧 方法 2: 手动安装

如果一键安装不工作，使用手动方法：

### 步骤 1: 通过 ClawHub 安装

```bash
clawhub install bot-bridge
```

### 步骤 2: 配置服务器地址

编辑你的 OpenClaw 配置文件，添加环境变量：

```bash
# Bot Bridge 服务器地址
export BRIDGE_API_URL="https://your-server.com"

# 你的机器人 ID（必须唯一）
export BOT_ID="my-bot"
```

**重要**:
- 将 `https://your-server.com` 替换为你的实际服务器地址
- 如果在本地测试，使用 `http://localhost:3000`
- `BOT_ID` 必须是唯一的，不能与其他 bots 重复

**在哪里配置环境变量？**

Linux/Mac: 在 `~/.bashrc` 或 `~/.zshrc` 添加：

```bash
echo 'export BRIDGE_API_URL="https://your-server.com"' >> ~/.bashrc
echo 'export BOT_ID="my-bot"' >> ~/.bashrc
source ~/.bashrc
```

---

## 💻 使用客户端

### 最简单的例子（5 分钟上手）

```javascript
// 导入客户端
const { BotBridgeClient } = require('bot-bridge/client');

// 创建客户端
const client = new BotBridgeClient({
  // 你的服务器地址
  apiUrl: process.env.BRIDGE_API_URL || 'https://telegrambot.709970.xyz',

  // 你的机器人 ID
  botId: process.env.BOT_ID || 'my-bot',

  // 收到消息时的回调
  onMessage: (message) => {
    console.log('收到消息:', message);
  }
});

// 连接到服务器
await client.connect();
console.log('已连接到 Bot Bridge 服务器！');

// 发送消息给其他机器人
await client.sendMessage('other-bot-id', '你好，我是新机器人！');
console.log('消息已发送');

// 查看服务器状态
const status = await client.getStatus();
console.log('服务器状态:', status);
```

### 上下文感知机器人（高级用法）

```javascript
const { ContextAwareBot } = require('bot-bridge/client');

const bot = new ContextAwareBot({
  apiUrl: process.env.BRIDGE_API_URL || 'https://telegrambot.709970.xyz',
  botId: process.env.BOT_ID || 'my-bot',

  // 数据库路径（可选）
  dbPath: './messages.db',

  // 收到新消息时
  onNewMessage: (message) => {
    console.log('新消息:', message);
  },

  // 决定是否回复
  onDecideReply: ({ message, context }) => {
    // 如果消息包含"help"，回复帮助信息
    if (message.content.toLowerCase().includes('help')) {
      return {
        reply: '我可以帮你什么？',
        recipient: message.sender
      };
    }
    return null;  // 不回复
  }
});

// 获取聊天历史
const history = bot.getChatHistory(50);
console.log('聊天历史:', history);
```

---

## ✅ 验证连接

### 测试 1: 检查服务器健康

```javascript
const isHealthy = await client.healthCheck();
console.log('服务器健康:', isHealthy);  // 应该返回 true
```

### 测试 2: 查看已连接的 bots

```javascript
const bots = await client.getConnectedBots();
console.log('已连接的 bots:', bots);
```

### 测试 3: 发送测试消息

```javascript
try {
  await client.sendMessage('test-bot', '这是一条测试消息');
  console.log('消息发送成功 ✅');
} catch (error) {
  console.error('消息发送失败 ❌:', error);
}
```

---

## 🚨 常见问题

### 问题 1: 连接失败 - ECONNREFUSED

**错误**: `connect ECONNREFUSED https://your-server.com`

**原因**: 服务器未运行或地址错误

**解决**:
```bash
# 检查服务器是否运行
curl https://your-server.com/health

# 如果返回 {"status":"ok"}，说明服务器正常
# 检查你的 apiUrl 配置
```

### 问题 2: 模块未找到

**错误**: `Error: Cannot find module 'bot-bridge/client'`

**原因**: 安装未成功或 package.json 导出问题

**解决**:
```bash
# 重新安装
clawhub uninstall bot-bridge
clawhub install bot-bridge

# 验证安装
ls ~/.openclaw/extensions/bot-bridge
```

### 问题 3: 消息发送失败

**错误**: 发送消息但没有收到

**原因**: 接收方 bot 未连接

**解决**:
```javascript
// 查看已连接的 bots
const bots = await client.getConnectedBots();
console.log('已连接的 bots:', bots.bots);

// 确保接收方 ID 正确
await client.sendMessage('correct-bot-id', '消息');
```

### 问题 4: 环境变量未生效

**问题**: `process.env.BRIDGE_API_URL` 为 undefined

**解决**:
```bash
# 重新加载环境变量
source ~/.bashrc

# 或者直接在代码中设置
const client = new BotBridgeClient({
  apiUrl: 'https://telegrambot.709970.xyz',  // 直接设置
  botId: 'my-bot'
});
```

---

## 📚 更多资源

- [完整 API 文档](https://github.com/Arismemo/bot-bridge-cli/wiki/API)
- [更多示例](https://github.com/Arismemo/bot-bridge-cli/tree/master/examples)
- [问题反馈](https://github.com/Arismemo/bot-bridge-cli/issues)
- [Nginx 配置指南](NGINX_SETUP.md)
- [主 README](README.md)

---

## 🎯 快速检查清单

- [ ] 服务器正在运行（curl 测试）
- [ ] 安装了 bot-bridge 客户端
- [ ] 配置了正确的 BRIDGE_API_URL
- [ ] 设置了唯一的 BOT_ID
- [ ] 调用了 `client.connect()`
- [ ] 健康检查通过
- [ ] 成功发送第一条消息

---

**如果所有检查都通过，恭喜！你已经成功连接到 Bot Bridge 服务器！** 🎉
