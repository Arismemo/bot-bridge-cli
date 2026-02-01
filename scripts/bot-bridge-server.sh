#!/bin/bash
# Bot Bridge Server Launcher

CONFIG_DIR="$HOME/.bot-bridge"
ENV_FILE="$CONFIG_DIR/.env"

# Load environment variables
if [[ -f "$ENV_FILE" ]]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
fi

# Set defaults
export PORT=${PORT:-3000}
export DB_PATH=${DB_PATH:-"$CONFIG_DIR/messages.db"}
export NODE_ENV=${NODE_ENV:-production}

# Start server
cd "$(npm root -g)/bot-bridge" 2>/dev/null || cd "$(dirname "$0")"

echo "🚀 Starting Bot Bridge Server..."
echo "   Port: $PORT"
echo "   Database: $DB_PATH"
echo ""

node server/index.js
