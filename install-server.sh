#!/bin/bash
# Bot Bridge Server One-Click Install Script
# Usage: curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/install-server.sh | bash

set -e

echo "🚀 Installing Bot Bridge Server..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo -e "${RED}Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Installing...${NC}"
    if [[ "$OS" == "linux" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        brew install node
    fi
else
    echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git is not installed. Installing...${NC}"
    if [[ "$OS" == "linux" ]]; then
        sudo apt-get install -y git
    elif [[ "$OS" == "macos" ]]; then
        brew install git
    fi
else
    echo -e "${GREEN}✓ Git installed${NC}"
fi

# Install bot-bridge from GitHub
INSTALL_DIR="$HOME/.bot-bridge"
echo ""
echo "📦 Installing bot-bridge from GitHub to $INSTALL_DIR..."

# Remove old installation if exists
if [[ -d "$INSTALL_DIR" ]]; then
    echo "Removing old installation..."
    rm -rf "$INSTALL_DIR"
fi

# Clone repository
git clone https://github.com/Arismemo/bot-bridge-cli.git "$INSTALL_DIR"

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production

# Make scripts executable
chmod +x scripts/bot-bridge-server.sh

# Create symlink
echo ""
echo "🔗 Creating bot-bridge-server command..."
sudo ln -sf "$INSTALL_DIR/scripts/bot-bridge-server.sh" /usr/local/bin/bot-bridge-server
echo -e "${GREEN}✓ bot-bridge-server command created${NC}"

# Create systemd service (Linux only)
if [[ "$OS" == "linux" ]]; then
    echo ""
    echo "🔧 Creating systemd service..."
    cat <<EOF | sudo tee /etc/systemd/system/bot-bridge.service > /dev/null
[Unit]
Description=Bot Bridge Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DB_PATH=$INSTALL_DIR/messages.db

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable bot-bridge.service
    echo -e "${GREEN}✓ Systemd service created${NC}"
fi

# Create default config
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    echo ""
    echo "📝 Creating default configuration..."
    cat <<EOF > "$INSTALL_DIR/.env"
# Bot Bridge Server Configuration
PORT=3000
DB_PATH=$INSTALL_DIR/messages.db

# Add your configuration here
EOF
    echo -e "${GREEN}✓ Config file created at $INSTALL_DIR/.env${NC}"
fi

echo ""
echo -e "${GREEN}═════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Bot Bridge Server installed successfully!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════${NC}"
echo ""
echo "📚 Quick Start:"
echo "   1. Edit configuration: $INSTALL_DIR/.env"
echo "   2. Start server: bot-bridge-server"
echo "   3. Check health: curl http://localhost:3000/health"
echo ""
echo "📂 Installation directory: $INSTALL_DIR"
echo "📖 Documentation: https://github.com/Arismemo/bot-bridge-cli"
echo "💬 Issues: https://github.com/Arismemo/bot-bridge-cli/issues"
echo ""

if [[ "$OS" == "linux" ]]; then
    echo "🔌 Start service: sudo systemctl start bot-bridge"
    echo "📖 View logs: sudo journalctl -u bot-bridge -f"
    echo "⚙️  Enable auto-start: sudo systemctl enable bot-bridge"
    echo ""
fi
