#!/bin/bash

# Bot Bridge 一键安装脚本
# 使用方式: curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge/master/install.sh | bash

set -e

echo "🚀 Bot Bridge 安装向导"
echo "========================="
echo ""

# 检查是否已安装 git 和 node
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 请先安装 git"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ 错误: 请先安装 Node.js (建议 v18+)"
    exit 1
fi

# 检查是否在 bot-bridge 目录中运行
if [ -f "package.json" ] && grep -q "bot-bridge" package.json; then
    echo "✅ 检测到 bot-bridge 目录，跳过克隆步骤"
    cd "$(dirname "$(pwd)")"
else
    # 克隆代码
    echo "📥 正在克隆 bot-bridge 仓库..."
    INSTALL_DIR="${INSTALL_DIR:-$HOME/bot-bridge}"

    if [ -d "$INSTALL_DIR" ]; then
        echo "⚠️  目录 $INSTALL_DIR 已存在"
        read -p "是否覆盖? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ 安装已取消"
            exit 1
        fi
        rm -rf "$INSTALL_DIR"
    fi

    git clone https://github.com/Arismemo/bot-bridge.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 安装依赖
echo ""
echo "📦 正在安装依赖..."
npm install --silent --no-audit --no-fund

# 交互式配置
echo ""
echo "⚙️  配置向导"
echo "========================="

# BRIDGE_API_URL
read -p "中转服务地址 [默认: http://localhost:3000]: " BRIDGE_API_URL
BRIDGE_API_URL=${BRIDGE_API_URL:-http://localhost:3000}

# BOT_ID
read -p "机器人 ID (必填): " BOT_ID
while [ -z "$BOT_ID" ]; do
    echo "❌ 机器人 ID 不能为空"
    read -p "机器人 ID (必填): " BOT_ID
done

# TELEGRAM_BOT_TOKEN
read -p "Telegram Bot Token (可选，回车跳过): " TELEGRAM_BOT_TOKEN

# TELEGRAM_CHAT_IDS
read -p "Telegram 群聊 ID，多个用逗号分隔 (可选，回车跳过): " TELEGRAM_CHAT_IDS

# WEBHOOK_PORT
read -p "Webhook 服务端口 [默认: 3001]: " WEBHOOK_PORT
WEBHOOK_PORT=${WEBHOOK_PORT:-3001}

# 生成 .env 文件
echo ""
echo "💾 正在生成 .env 文件..."

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

echo "✅ .env 文件已生成"

# 显示配置摘要
echo ""
echo "📋 配置摘要"
echo "========================="
echo "安装目录: $(pwd)"
echo "中转服务: $BRIDGE_API_URL"
echo "机器人 ID: $BOT_ID"
echo "Bot Token: ${TELEGRAM_BOT_TOKEN:-[未设置]}"
echo "群聊 ID: ${TELEGRAM_CHAT_IDS:-[未设置]}"
echo "Webhook 端口: $WEBHOOK_PORT"
echo ""

# 询问是否立即启动服务
read -p "是否立即启动服务? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "🚀 启动中转服务器 (bot-bridge-server)..."
    pm2 start server/index.js --name bot-bridge-server || {\
        echo "⚠️  PM2 未安装，使用 npm start 启动（需要手动管理进程）"
        npm start &
        SERVER_PID=$!
        echo "服务器 PID: $SERVER_PID"
    }

    echo ""
    echo "🚀 启动 Webhook 服务器 (bot-bridge-webhook)..."
    pm2 start webhook-server.js --name bot-bridge-webhook || {\
        echo "⚠️  PM2 未安装，使用 node webhook-server.js 启动"
        node webhook-server.js &
        WEBHOOK_PID=$!
        echo "Webhook PID: $WEBHOOK_PID"
    }

    echo ""
    echo "🚀 启动客户端 (bot-bridge-client)..."
    pm2 start client/index.js --name bot-bridge-client || {\
        echo "⚠️  PM2 未安装，使用 node client/index.js 启动"
        node client/index.js &
        CLIENT_PID=$!
        echo "客户端 PID: $CLIENT_PID"
    }

    echo ""
    echo "✅ 服务已启动！"
fi

# 询问是否设置 Telegram Webhook
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    read -p "是否设置 Telegram Webhook? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        read -p "请输入 Webhook URL (例如: https://your-server.com:3001/telegram-webhook): " WEBHOOK_URL

        if [ -n "$WEBHOOK_URL" ]; then
            echo "🔗 正在设置 Telegram Webhook..."
            RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
                -d "url=$WEBHOOK_URL")

            if echo "$RESPONSE" | grep -q '\"ok\":true'; then
                echo "✅ Webhook 设置成功！"
            else
                echo "❌ Webhook 设置失败:"
                echo "$RESPONSE"
            fi
        fi
    fi
fi

# 完成
echo ""
echo "🎉 安装完成！"
echo ""
echo "下一步："
echo "1. 查看服务状态: pm2 status"
echo "2. 查看日志: pm2 logs"
echo "3. 重启服务: pm2 restart all"
echo "4. 停止服务: pm2 stop all"
echo ""
echo "文档: https://github.com/Arismemo/bot-bridge#readme"
echo ""
