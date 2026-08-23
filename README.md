# dsh-quick-restart

DSH 快速重启插件：在 Web GUI 侧边栏底部加一个「重启」按钮（设置页里也有「快速重启」卡片），点击确认后重启 DSH 服务进程本身，页面在服务恢复后自动刷新。

## 功能

- **侧边栏脚注「重启」按钮**：宽栏显示图标 + 文字，窄栏仅图标；点击后弹确认框，确认后重启服务。
- **设置页「快速重启」卡片**：显示服务 PID、重启按钮与状态提示。
- **重启方式**：host 插件 detached spawn 一个 helper 脚本，helper 等待当前进程完全退出后，用与当前进程相同的启动参数（`process.execPath + process.execArgv + process.argv.slice(1)`）重新拉起 DSH；当前进程随即优雅退出（launcher 的 bounded shutdown）。新进程的 stdout/stderr 追加写入 `<DSH_HOME>/logs/dsh-quick-restart.log`。
- **自动恢复**：客户端在确认重启后轮询服务是否恢复，恢复后自动刷新页面。

## 前提

- DSH web profile（提供 `connection` RPC 服务与 launcher 的 `appExit`；插件集变更需重启生效）。
- Node.js ≥ 18（DSH 自身运行所需版本即可）。
- pnpm（profile 目录安装依赖用）。

## 安装

在 web profile（`~/.dsh/profiles/web`），二选一：

### 从 GitHub 安装（推荐）

```jsonc
// package.json
{
  "dependencies": {
    // 建议固定版本 tag（不固定则始终拉取默认分支最新提交）
    "dsh-quick-restart": "github:Noah0509/dsh-quick-restart#v0.1.0"
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

然后在 profile 目录执行：

```sh
pnpm install
```

并重启 DSH 服务使插件生效（首次安装必须手动重启一次，此后即可用按钮一键重启）。

## 卸载

1. 从 `~/.dsh/profiles/web/package.json` 的 `dependencies` 和 `dsh.profile.bundles` 中移除 `dsh-quick-restart`。
2. 在 profile 目录执行 `pnpm install`。
3. 重启 DSH 服务。

## 故障排查

- **服务长时间未恢复**：检查 `<DSH_HOME>/logs/dsh-quick-restart.log`（新进程的启动输出）；确认 3080 端口未被其他进程占用后，在 DSH 安装目录手动重新启动：
  ```sh
  pnpm dsh web
  ```
- **按钮未出现**：插件未生效，确认 `dsh-quick-restart` 在 `dsh.profile.bundles` 中且 `pnpm install` 成功，再重启一次服务。
- **重启日志**：`<DSH_HOME>/logs/dsh-quick-restart.log`。

## 安全说明

- 重启 RPC 端点仅接受 **loopback（本机回环）** 来源的调用（`authority: 'loopback'`），不会响应来自网络的请求；请勿在非信任网络环境中将 DSH 暴露为 `0.0.0.0`。
- 重启会强制终止当前服务进程并中断**所有正在进行的对话与任务**，点击前请确认。
- 插件不读取、不传输任何凭据或敏感配置。

## 仓库结构

| 文件 | 说明 |
| --- | --- |
| `lib/index.js` | host 插件：注册 `/dsh-quick-restart` RPC（status / restart） |
| `lib/restart-helper.mjs` | 重启辅助脚本：等待旧进程退出后按相同命令重新拉起 DSH |
| `lib/activate.mjs` | 一次性激活脚本（仅首次安装后由管理员手工运行，强杀旧进程并拉起新进程） |
| `client/client.js` | 浏览器半：侧边栏按钮 + 设置页卡片 + 自动刷新 |
| `cordis.patch.yml` | bundle patch：插入插件行 |

## License

[MIT](LICENSE) © 2026 Noah0509
