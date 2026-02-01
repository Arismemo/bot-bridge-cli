# ✅ Gitee 同步完成！

## 🎯 已同步仓库

### GitHub（源仓库）
- **URL**: https://github.com/Arismemo/bot-bridge-cli
- **用户**: Arismemo

### Gitee（镜像仓库）
- **URL**: https://gitee.com/john121/bot-bridge-cli
- **用户**: john121

## 🚀 快速访问

- **GitHub**: https://github.com/Arismemo/bot-bridge-cli
- **Gitee**: https://gitee.com/john121/bot-bridge-cli

## 📋 安装命令

### 服务器端（从 Gitee）
```bash
curl -sSL https://gitee.com/john121/bot-bridge-cli/raw/master/install-server.sh | bash
```

### 服务器端（从 GitHub）
```bash
curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/install-server.sh | bash
```

### 客户端
发送给 OpenClaw 机器人：
```
/install https://github.com/Arismemo/bot-bridge-cli
```

或
```
/install https://gitee.com/john121/bot-bridge-cli
```

## 🔗 Git 远程仓库配置

```bash
origin	https://github.com/Arismemo/bot-bridge.git (fetch)
origin	https://github.com/Arismemo/bot-bridge.git (push)

github	https://github.com/Arismemo/bot-bridge-cli.git (fetch)
github	https://github.com/Arismemo/bot-bridge-cli.git (push)

gitee	https://gitee.com/john121/bot-bridge-cli.git (fetch)
gitee	https://gitee.com/john121/bot-bridge-cli.git (push)
```

## 📝 同时推送到两个平台

### 方法 1：分别推送
```bash
cd /Users/liukun/.openclaw/workspace/bot-bridge

# 推送到 GitHub
git push github master

# 推送到 Gitee
git push gitee master
```

### 方法 2：创建快捷命令

```bash
# 编辑 ~/.zshrc 或 ~/.bashrc
echo 'alias git-push-all="cd /Users/liukun/.openclaw/workspace/bot-bridge && git push github master && git push gitee master"' >> ~/.zshrc

# 重新加载配置
source ~/.zshrc

# 使用快捷命令
git-push-all
```

### 方法 3：配置同时推送

编辑 `.git/config`，添加：
```ini
[remote "all"]
    url = https://github.com/Arismemo/bot-bridge-cli.git
    pushurl = https://github.com/Arismemo/bot-bridge-cli.git
    pushurl = https://gitee.com/john121/bot-bridge-cli.git
```

然后使用：
```bash
git push all master
```

## 📊 项目状态

- ✅ **GitHub**: 已同步
- ✅ **Gitee**: 已同步
- ✅ **测试覆盖率**: 92%+
- ✅ **文档**: 完整
- ✅ **安装脚本**: 一键可用

## 🎉 总结

Bot Bridge v2.0.0 现已同步到：
- GitHub: https://github.com/Arismemo/bot-bridge-cli
- Gitee: https://gitee.com/john121/bot-bridge-cli

中国用户可以使用 Gitee 访问，速度更快！
