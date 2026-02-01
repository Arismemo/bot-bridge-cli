# Gitee 同步指南

## 需要手动创建 Gitee 仓库

由于 Gitee 仓库不存在，需要先创建：

### 方法 1: Gitee 网站创建（推荐）

1. 访问 https://gitee.com/projects/new
2. 填写信息：
   - 仓库名称：`bot-bridge-cli`
   - 仓库介绍：`OpenClaw Bot Intercommunication Service - Context-Aware Version with 92% Test Coverage`
   - 是否公开：✅ 公开
   - 初始化仓库：❌ 不初始化（已有代码）
3. 点击"创建"

### 方法 2: 导入 GitHub 仓库

1. 访问 https://gitee.com/import/import
2. 输入 GitHub 仓库 URL：`https://github.com/Arismemo/bot-bridge-cli`
3. 点击"开始导入"

## 创建仓库后

### 一键推送命令

创建 Gitee 仓库后，运行以下命令：

```bash
cd ~/j/code/openclaw/workspace/bot-bridge

# 添加 Gitee 远程仓库（如果还未添加）
git remote add gitee https://gitee.com/Arismemo/bot-bridge-cli.git

# 推送代码到 Gitee
git push -u gitee master

# 推送所有分支（如果有）
git push gitee --all
```

### 已添加远程仓库

当前已添加的远程仓库：
```bash
$ git remote -v
github	https://github.com/Arismemo/bot-bridge-cli.git (push)
gitee	https://gitee.com/Arismemo/bot-bridge-cli.git (push)  # 已添加
```

## 后续同步

### 推送到两个仓库

```bash
# 推送到 GitHub
git push github master

# 推送到 Gitee
git push gitee master
```

### 同时推送（简化）

创建快捷命令：
```bash
# 编辑 ~/.bashrc 或 ~/.zshrc
alias git-push-all='git push github master && git push gitee master'

# 重新加载配置
source ~/.bashrc  # 或 source ~/.zshrc

# 使用命令
git-push-all
```

### Git 配置同时推送

编辑 `.git/config` 添加：
```ini
[remote "all"]
    url = https://github.com/Arismemo/bot-bridge-cli.git
    url = https://gitee.com/Arismemo/bot-bridge-cli.git
```

然后使用：
```bash
git push all master
```

## 总结

1. **访问 Gitee** 创建仓库：https://gitee.com/projects/new
2. **仓库名称**：`bot-bridge-cli`
3. **推送代码**：`git push -u gitee master`
4. **验证**：访问 https://gitee.com/Arismemo/bot-bridge-cli

Gitee 远程仓库已配置，只需创建仓库后即可推送！
