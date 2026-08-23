# dsh-quick-restart

DSH 快速重启插件：在 Web GUI 侧边栏底部加一个「重启」按钮（设置页里也有「快速重启」卡片），点击确认后重启 DSH 服务进程本身，页面在服务恢复后自动刷新。

## 功能

- **侧边栏脚注「重启」按钮**：宽栏显示图标 + 文字，窄栏仅图标；点击后弹确认框，确认后重启服务。
- **设置页「快速重启」卡片**：显示服务 PID、重启按钮与状态提示。
- **重启方式**：host 插件 detached spawn 一个 helper 脚本，helper 等待当前进程完全退出后，用与当前进程完全相同的命令（`execArgv + argv`）重新拉起 DSH；当前进程随即优雅退出（launcher 的 bounded shutdown）。新进程的 stdout/stderr 追加写入 `<DSH_HOME>/logs/dsh-quick-restart.log`。
- **自动恢复**：客户端在确认重启后轮询服务是否恢复，恢复后自动刷新页面。

## 安装

在 web profile（`~/.dsh/profiles/web`），二选一：

### 从 GitHub 安装

```jsonc
// package.json
{
  "dependencies": {
    "dsh-quick-restart": "github:Noah0509/dsh-quick-restart"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... 现有 bundle，
        "dsh-quick-restart"
      ]
    }
  }
}
```

### 本地 link 安装（开发用）

```jsonc
// package.json
{
  "dependencies": {
    "dsh-quick-restart": "link:D:/Desktop/DEEPSEEK/dsh-quick-restart"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... 现有 bundle，
        "dsh-quick-restart"
      ]
    }
  }
}
```

然后在该 profile 目录执行 `pnpm install`，并重启 DSH 服务使插件生效（此后即可用按钮一键重启）。

## 说明

- 重启会中断所有正在进行的对话与任务，请确认后再操作。
- 若服务长时间未恢复，浏览器页面需要手动刷新。
- 重启日志：`<DSH_HOME>/logs/dsh-quick-restart.log`。
