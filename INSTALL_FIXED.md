# ✅ 安装脚本已修复

## 问题原因
原安装脚本尝试 `npm install -g bot-bridge`，但 npm 包尚未发布到 npm registry。

## 解决方案
改为直接从 GitHub 克隆仓库：
```bash
git clone https://github.com/Arismemo/bot-bridge-cli.git ~/.bot-bridge
```

## 更新内容

1. **install-server.sh** - 改为 GitHub 克隆方式
2. **scripts/bot-bridge-server.sh** - 更新启动脚本适应新的安装路径
3. **README.md** - 更新所有 URL 为 `Arismemo/bot-bridge-cli`
4. **SKILL.md** - 更新所有 URL 为 `Arismemo/bot-bridge-cli`
5. **package.json** - 移除 npm 全局安装相关配置

## 现在可以使用的命令

### 服务器端安装
```bash
curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/install-server.sh | bash
```

### 客户端安装
发送给 OpenClaw 机器人：
```
/install https://github.com/Arismemo/bot-bridge-cli
```

### 启动服务器
```bash
# 使用命令
bot-bridge-server

# 或直接运行
cd ~/.bot-bridge
node server/index.js
```

## 已推送更新

所有更改已推送到 GitHub：
https://github.com/Arismemo/bot-bridge-cli

现在可以重新运行安装命令了！
