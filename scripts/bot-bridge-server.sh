#!/bin/bash
# Bot Bridge Server Launcher

# Get installation directory
INSTALL_DIR="$HOME/.bot-bridge"
if [[ -n "$BOT_BRIDGE_DIR" ]]; then
    INSTALL_DIR="$BOT_BRIDGE_DIR"
fi

# Check if bot-bridge is installed
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Bot Bridge is not installed!"
    echo ""
    echo "Install it with:"
    echo "curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/install-server.sh | bash"
    exit 1
fi

# Change to installation directory
cd "$INSTALL_DIR"

# Load environment variables
ENV_FILE="$INSTALL_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
fi

# Set defaults
export PORT=${PORT:-3000}
export DB_PATH=${DB_PATH:-"$INSTALL_DIR/messages.db"}
export NODE_ENV=${NODE_ENV:-production}

# Start server
echo "🚀 Starting Bot Bridge Server..."
echo "   Installation: $INSTALL_DIR"
echo "   Port: $PORT"
echo "   Database: $DB_PATH"
echo ""

node server/index.js
