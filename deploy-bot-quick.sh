#!/bin/bash

# Bot Bridge 机器人端快速部署脚本（非交互式）
# 使用方式:
#   curl -sSL ... | bash -s -- <BOT_ID> <TELEGRAM_BOT_TOKEN> <TELEGRAM_CHAT_IDS> [BRIDGE_API_URL] [WEBHOOK_PORT]
#
# 参数说明:
#   BOT_ID             - 机器人 ID（必填）
#   TELEGRAM_BOT_TOKEN  - Telegram Bot Token（可选）
#   TELEGRAM_CHAT_IDS   - 群聊 ID（可选，多个用逗号分隔）
#   BRIDGE_API_URL      - 中转服务器地址（可选，默认 http://localhost:3000）
#   WEBHOOK_PORT        - Webhook 端口（可选，默认 3001）

set -e

# 解析参数
BOT_ID="${1:-}"
TELEGRAM_BOT_TOKEN="${2:-}"
TELEGRAM_CHAT_IDS="${3:-}"
BRIDGE_API_URL="${4:-http://localhost:3000}"
WEBHOOK_PORT="${5:-3001}"

# 检查必填参数
if [ -z "$BOT_ID" ]; then
    echo "❌ 错误: BOT_ID 必填"
    echo ""
    echo "使用方式:"
    echo "  curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge/master/deploy-bot-quick.sh | bash -s -- <BOT_ID> <TELEGRAM_BOT_TOKEN> <TELEGRAM_CHAT_IDS> [BRIDGE_API_URL] [WEBHOOK_PORT]"
    echo ""
    echo "参数说明:"
    echo "  BOT_ID             - 机器人 ID（必填）"
    echo "  TELEGRAM_BOT_TOKEN  - Telegram Bot Token（可选）"
    echo "  TELEGRAM_CHAT_IDS   - 群聊 ID（可选，多个用逗号分隔）"
    echo "  BRIDGE_API_URL      - 中转服务器地址（可选，默认 http://localhost:3000）"
    echo "  WEBHOOK_PORT        - Webhook 端口（可选，默认 3001）"
    echo ""
    echo "示例:"
    echo "  curl ... | bash -s -- xiaoc 123456:ABC -5094630990 http://localhost:3000 3001"
    exit 1
fi

echo "🤖 Bot Bridge 机器人端快速部署"
echo "================================"
echo ""
echo "📋 配置信息:"
echo "  机器人 ID: $BOT_ID"
echo "  Bot Token: ${TELEGRAM_BOT_TOKEN:-[未设置]}"
echo "  群聊 ID: ${TELEGRAM_CHAT_IDS:-[未设置]}"
echo "  中转服务器: $BRIDGE_API_URL"
echo "  Webhook 端口: $WEBHOOK_PORT"
echo ""

# 确定工作目录
WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# 克隆代码
if [ -d "bot-bridge" ]; then
    echo "✅ bot-bridge 已存在，更新代码..."
    cd bot-bridge
    git pull
else
    echo "📥 正在克隆 bot-bridge 仓库..."
    git clone --depth 1 https://github.com/Arismemo/bot-bridge.git
    cd bot-bridge
fi

# 安装依赖
echo "📦 正在安装依赖..."
npm install --silent --no-audit --no-fund
echo "✅ 依赖安装完成"

# 生成 .env 文件
echo "💾 正在配置机器人..."
cat > .env << EOF
# Bot Bridge 配置
BRIDGE_API_URL=$BRIDGE_API_URL
BOT_ID=$BOT_ID

# Telegram 集成
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_IDS=$TELEGRAM_CHAT_IDS

# Webhook 端口
WEBHOOK_PORT=$WEBHOOK_PORT
EOF
echo "✅ 配置完成"

# 启动服务
echo ""
echo "🚀 正在启动 Webhook 服务器..."

# 使用 PM2
if command -v pm2 &> /dev/null; then
    # 停止旧进程
    pm2 stop "bot-bridge-$BOT_ID" 2>/dev/null || true
    pm2 delete "bot-bridge-$BOT_ID" 2>/dev/null || true

    # 启动新进程
    pm2 start webhook-server.js --name "bot-bridge-$BOT_ID"

    echo "✅ Webhook 服务器已启动（PM2）"
    echo "   进程名: bot-bridge-$BOT_ID"
    echo "   查看状态: pm2 status"
    echo "   查看日志: pm2 logs bot-bridge-$BOT_ID"
else
    # 使用后台进程
    pkill -f "webhook-server.js.*BOT_ID=$BOT_ID" 2>/dev/null || true

    mkdir -p logs
    nohup node webhook-server.js > logs/webhook.log 2>&1 &
    WEBHOOK_PID=$!

    echo "✅ Webhook 服务器已启动（后台进程）"
    echo "   PID: $WEBHOOK_PID"
    echo "   日志: logs/webhook.log"
fi

# 等待服务启动
sleep 2

# 检查服务状态
echo ""
echo "🔍 正在检查服务状态..."
if curl -s "http://localhost:$WEBHOOK_PORT/health" > /dev/null 2>&1; then
    echo "✅ 服务运行正常！"
else
    echo "⚠️  服务可能未正常启动，请检查日志"
fi

# 设置 Telegram Webhook（如果有 Token）
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo ""
    echo "⚠️  需要手动设置 Telegram Webhook"
    echo ""
    echo "请执行以下命令设置 Webhook："
    echo ""
    echo "  curl -X POST https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook \\"
    echo "    -d 'url=https://your-server.com:$WEBHOOK_PORT/telegram-webhook'"
    echo ""
    echo "提示："
    echo "- 如果是本地测试，可以使用 ngrok: https://ngrok.com"
    echo "- 如果是公网服务器，请确保端口开放且使用 HTTPS"
else
    echo ""
    echo "⚠️  TELEGRAM_BOT_TOKEN 未设置，跳过 Webhook 配置"
fi

# 完成
echo ""
echo "🎉 部署完成！"
echo ""
echo "后续操作："
echo "1. 查看 PM2 状态: pm2 status"
echo "2. 查看日志: pm2 logs bot-bridge-$BOT_ID"
echo "3. 重启服务: pm2 restart bot-bridge-$BOT_ID"
echo "4. 停止服务: pm2 stop bot-bridge-$BOT_ID"
echo ""
echo "📚 文档: https://github.com/Arismemo/bot-bridge#readme"
echo ""
