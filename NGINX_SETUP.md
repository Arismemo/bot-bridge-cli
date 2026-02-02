# Bot Bridge Nginx 配置指南

## 🎯 为什么使用 Nginx 代理？

### 优势

- ✅ **域名访问**：不用记住 IP + 端口
- ✅ **HTTPS 加密**：使用 Let's Encrypt 免费证书
- ✅ **负载均衡**：支持多实例部署
- ✅ **安全防护**：防火墙、限流、访问控制
- ✅ **性能优化**：静态资源缓存、Gzip 压缩
- ✅ **WebSocket 支持**：完美支持 Bot Bridge 的实时通信

---

## 📝 基础配置

### HTTP 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 主代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # 健康检查（不记录日志）
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
```

---

## 🔒 HTTPS 配置（推荐）

```nginx
# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 主代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

    # 日志配置
    access_log /var/log/nginx/bot-bridge-access.log;
    error_log /var/log/nginx/bot-bridge-error.log;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🚀 快速部署步骤

### 1. 安装 Nginx 和 Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx

# 验证安装
nginx -v
certbot --version
```

### 2. 创建配置文件

```bash
# 创建配置
sudo nano /etc/nginx/sites-available/bot-bridge

# 粘贴上面的配置，替换 your-domain.com 为你的域名

# 启用配置
sudo ln -s /etc/nginx/sites-available/bot-bridge /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t
```

### 3. 重启 Nginx

```bash
# 重启 nginx
sudo systemctl restart nginx

# 启用开机自启
sudo systemctl enable nginx

# 检查状态
sudo systemctl status nginx
```

### 4. 申请 SSL 证书

```bash
# 自动申请并配置 HTTPS
sudo certbot --nginx -d your-domain.com

# 按照提示：
# 1. 输入邮箱
# 2. 同意服务条款
# 3. 选择是否重定向到 HTTPS（选择 2: Redirect）

# 测试续期（确保自动续期正常工作）
sudo certbot renew --dry-run
```

---

## 📊 高级配置

### 负载均衡

```nginx
# 定义后端服务器组
upstream bot_bridge_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # ... SSL 配置 ...

    location / {
        # 使用 upstream 而不是直接指向 127.0.0.1:3000
        proxy_pass http://bot_bridge_backend;
        # ... 其他配置 ...
    }
}
```

### 限流保护

```nginx
# 定义限流规则
limit_req_zone $binary_remote_addr zone=bot_bridge:10m rate=10r/s;

server {
    # ...
    location / {
        # 应用限流
        limit_req zone=bot_bridge burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        # ...
    }
}
```

### Gzip 压缩

```nginx
server {
    # ...

    # 启用 Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        # ...
    }
}
```

### 访问控制

```nginx
server {
    # ...

    # 只允许特定 IP 访问
    location /admin {
        allow 1.2.3.4;  # 你的 IP
        deny all;
        proxy_pass http://127.0.0.1:3000;
    }

    # 基本认证
    location /api {
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

---

## 🔧 Bot Bridge 客户端配置更新

使用域名后，更新客户端配置：

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

// 使用 HTTPS 域名
const client = new BotBridgeClient({
    apiUrl: 'https://your-domain.com',  // 改为你的域名
    botId: 'my-bot',
    onMessage: (msg) => console.log('Received:', msg)
});

await client.sendMessage('other-bot', 'Hello!');
```

---

## 🔒 安全建议

### 1. 防火墙配置

```bash
# 只开放必要端口
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 3000      # 不允许外部直接访问 3000

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 2. SSL 证书自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# Certbot 会自动添加 cron 任务
# 查看任务
sudo systemctl list-timers | grep certbot
```

### 3. 日志轮转

```bash
# 配置日志轮转
sudo nano /etc/logrotate.d/nginx-bot-bridge

# 内容：
/var/log/nginx/bot-bridge-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
```

---

## ✅ 验证配置

### 1. 测试 Nginx 配置

```bash
sudo nginx -t
```

### 2. 检查 Nginx 状态

```bash
sudo systemctl status nginx
```

### 3. 测试访问

```bash
# HTTP 测试
curl http://your-domain.com/health

# HTTPS 测试
curl https://your-domain.com/health

# WebSocket 测试
wscat -c wss://your-domain.com/ws?bot_id=test
```

### 4. 查看 SSL 证书

```bash
# 查看证书信息
certbot certificates

# 检查证书有效期
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 📋 配置对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **直接访问 localhost:3000** | 简单，无额外配置 | 不安全，无域名，无加密 | ⭐ |
| **Nginx HTTP 代理** | 域名访问，简单配置 | 无加密，明文传输 | ⭐⭐ |
| **Nginx HTTPS 代理** | 安全，域名，加密 | 需配置 SSL | ⭐⭐⭐⭐⭐ |

**推荐**: Nginx HTTPS 代理 + Let's Encrypt 免费证书

---

## 🚨 常见问题

### 端口已被占用

```bash
# 查看占用 80/443 端口的进程
sudo lsof -i :80
sudo lsof -i :443

# 停止占用进程（如 Apache）
sudo systemctl stop apache2
```

### SSL 证书申请失败

```bash
# 检查 DNS 解析
nslookup your-domain.com

# 确保 80 端口可访问
curl http://your-domain.com

# 检查防火墙
sudo ufw status
```

### WebSocket 连接失败

```bash
# 确保 nginx 配置包含：
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

# 检查超时设置
proxy_read_timeout 86400;
```

---

## 📚 参考资料

- [Nginx 文档](https://nginx.org/en/docs/)
- [Certbot 文档](https://certbot.eff.org/)
- [Let's Encrypt](https://letsencrypt.org/)

---

## 📝 总结

1. **安装 Nginx 和 Certbot**
2. **创建配置文件**
3. **申请 SSL 证书**
4. **更新 Bot Bridge 客户端配置**
5. **配置防火墙和监控**

完成！现在可以使用 `https://your-domain.com` 访问 Bot Bridge 服务了。
