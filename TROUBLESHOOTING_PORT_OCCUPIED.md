# Bot Bridge 服务问题 - 端口占用

## 问题描述

**错误**: `EADDRINUSE: address already in use 0.0.0.0:3000`

**原因**: 端口 3000 已被占用，可能是之前启动的进程未关闭

---

## 解决方案

### 1. 查找占用端口的进程

```bash
# 方法 1：使用 lsof
lsof -i :3000

# 方法 2：使用 netstat
netstat -tlnp | grep :3000

# 方法 3：使用 ss
ss -tlnp | grep :3000
```

### 2. 停止旧进程

```bash
# 假设找到的 PID 是 12345
kill 12345

# 如果无法停止，强制结束
kill -9 12345
```

### 3. 重新启动

```bash
bot-bridge-server
```

---

## 一键命令

```bash
# 查找并停止占用 3000 端口的进程
PID=$(lsof -ti:3000)
if [ -n "$PID" ]; then
    echo "Stopping process $PID on port 3000..."
    kill $PID
    sleep 2
fi

# 重新启动
bot-bridge-server
```

---

## 验证服务

```bash
# 检查健康
curl http://localhost:3000/health

# 应该返回：{"status":"ok"}
```

---

## 记录时间

**日期**: 2026-02-02 16:29 GMT+8
**问题**: 端口 3000 已被占用
**解决**: 使用 `lsof -ti:3000` 找到进程并停止
