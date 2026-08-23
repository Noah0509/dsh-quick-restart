// dsh-quick-restart 插件入口（host 侧）
//
// 提供 RPC channel /dsh-quick-restart：
//   - server.status  查询服务状态（pid / 是否正在重启）
//   - server.restart 重启 DSH 服务进程
//
// 重启策略：detached spawn 一个 helper 脚本（restart-helper.mjs），helper
// 等待当前进程退出后，用与当前进程完全相同的命令（execPath + execArgv +
// argv）重新拉起 DSH；当前进程随即通过 ctx.appExit 优雅退出（launcher 的
// bounded shutdown 会在 dispose 完整棵树后结束进程）。helper 是 detached
// 新进程组 + unref，旧进程退出不影响它，也不阻塞事件循环。
//
// 不依赖任何 @deepseek-ai 内部包：只使用 ctx 提供的服务与 node 内置模块，
// 保证在 DSH Desktop 与源码运行两种宿主下都能加载。

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-quick-restart'
export const inject = ['connection']

const CHANNEL = '/dsh-quick-restart'
const ENDPOINTS = Object.freeze({
  restart: 'server.restart',
  status: 'server.status',
})

/** helper 脚本的绝对路径（与本文件同目录）。 */
const HELPER = fileURLToPath(new URL('./restart-helper.mjs', import.meta.url))

/** 给 RPC 响应留出的送达余量（毫秒），之后才开始退出（loopback 足够）。 */
const EXIT_GRACE_MS = 300

/** 符合 DSH rpcErrorSchema 的错误。 */
function fail(message) {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [{ message }] } } }
}

/** DSH 主目录（与 dsh-session-manager 一致的环境约定）。 */
const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh')

export function apply(ctx) {
  const log = ctx.logger ?? console
  let restarting = false

  /**
   * 触发重启：spawn detached helper，然后优雅退出当前进程。
   * helper 会在本进程退出后按相同命令重新拉起 DSH。
   */
  const scheduleRestart = () => {
    const logDir = join(dshHome(), 'logs')
    try {
      mkdirSync(logDir, { recursive: true })
    } catch {
      /* 日志目录不可用则忽略 */
    }
    const restartLog = join(logDir, 'dsh-quick-restart.log')
    // helper 参数：<oldPid> <cwd> <logPath> <args...>
    // 命令重建 = execArgv + argv.slice(1)，与启动命令行一致（execPath 由
    // helper 内部取 process.execPath，避免路径含空格时被 shell 转义破坏）
    const helperArgs = [
      HELPER,
      String(process.pid),
      process.cwd(),
      restartLog,
      ...process.execArgv,
      ...process.argv.slice(1),
    ]
    const helper = spawn(process.execPath, helperArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    helper.unref()
  }

  const handler = async (endpoint, payload = {}) => {
    if (endpoint === ENDPOINTS.status) {
      return { ok: true, value: { pid: process.pid, restarting } }
    }
    if (endpoint === ENDPOINTS.restart) {
      if (restarting) return fail('重启已在进行中 | restart already in progress')
      restarting = true
      try {
        scheduleRestart()
      } catch (error) {
        restarting = false
        log.error?.('dsh-quick-restart: schedule failed: %s', error?.message ?? error)
        return fail('无法启动重启进程：' + (error?.message ?? error))
      }
      // 先让 RPC 响应送达浏览器，再优雅退出
      setTimeout(() => {
        const exit = ctx.get('appExit')
        if (typeof exit === 'function') exit(0)
        else process.exit(0)
      }, EXIT_GRACE_MS)
      return { ok: true, value: { restarting: true } }
    }
    return fail(`Unknown endpoint: ${endpoint}`)
  }

  ctx.connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' })
  log.info?.('dsh-quick-restart: loaded (channel %s)', CHANNEL)
}
