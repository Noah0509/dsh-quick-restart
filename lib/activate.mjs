// dsh-quick-restart 安装激活脚本（一次性，仅首次安装后使用）
//
// 用法:
//   node activate.mjs <delayMs> <oldPid> <cwd> <logPath> <port> <args...>
//
// 行为:
//   1. sleep delayMs（给「请手动保存/确认」留出时间窗口）；
//   2. taskkill /F 强杀旧 DSH 主进程（不带 /T：不杀子进程树，避免误杀
//      本脚本自身的进程链；DSH 数据为逐步持久化，强杀安全）；
//   3. 等待旧进程完全退出，确保 3080 端口释放；
//   4. 用 process.execPath + args 在 cwd 下 detached 重新拉起 DSH，
//      stdout/stderr 追加写入 logPath；
//   5. 轮询 port 直到可连接（或超时），把就绪结果写日志；
//   6. 脚本自身退出。
//
// 脚本由 Start-Process 独立启动（不挂在 DSH 的 job 管理下），
// 因此旧 DSH 进程被强杀后它仍能继续完成拉起。
// 不接收 execPath 参数：本脚本自身就是 node 运行，execPath 用
// process.execPath，避免传含空格的路径参数被 shell 转义破坏。

import { execFile, spawn } from 'node:child_process'
import { openSync, writeSync } from 'node:fs'
import net from 'node:net'

const [delayMs, oldPid, cwd, logPath, port, ...cmdArgs] = process.argv.slice(2)

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/** 探测进程是否存活（Windows 下 ESRCH 表示已退出；EPERM 视为存活）。 */
function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

/** 尝试连接端口一次。 */
function probe(host, targetPort) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: targetPort })
    const done = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(800, () => done(false))
  })
}

await sleep(Number(delayMs))

/**
 * 误杀防护：确认目标进程确实是 DSH（命令行含 bin.ts）才动手。
 * 防止参数写错（例如把当前 shell 或无关进程的 PID 传进来）时
 * taskkill /F 误杀无辜进程。用 PowerShell 查命令行（wmic 已弃用）。
 * @returns {Promise<boolean>} 目标进程是 DSH 时返回 true。
 */
async function isDshProcess(pid) {
  return new Promise((resolve) => {
    execFile('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(Get-CimInstance Win32_Process -Filter 'ProcessId=${String(pid)}').CommandLine`,
    ], { windowsHide: true, timeout: 10_000 }, (error, stdout) => {
      if (error) return resolve(false)
      const cmdline = String(stdout ?? '').trim()
      // DSH 命令行必然包含 bin.ts（源码或打包路径）
      resolve(/bin\.ts/.test(cmdline))
    })
  })
}

if (!(await isDshProcess(Number(oldPid)))) {
  process.stderr.write(`dsh-quick-restart activate: target pid ${String(oldPid)} is not a DSH process (missing bin.ts in command line), refusing to kill\n`)
  process.exit(1)
}

// 强杀旧进程（不带 /T；旧进程退出后 pnpm 父命令自然结束）
await new Promise((resolve) => {
  execFile('taskkill', ['/PID', String(oldPid), '/F'], { windowsHide: true }, () => resolve())
})

// 等待旧进程完全退出（最长 60 秒），确保端口释放
const deadline = Date.now() + 60_000
while (Date.now() < deadline && isAlive(Number(oldPid))) {
  await sleep(300)
}
await sleep(800)

// 重新拉起 DSH（detached + unref，独立于任何父进程）
let logFd = null
try {
  logFd = openSync(logPath, 'a')
} catch {
  /* 日志不可用则忽略 */
}
const child = spawn(process.execPath, cmdArgs, {
  cwd,
  detached: true,
  windowsHide: true,
  stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],
})
child.unref()

// 轮询端口就绪（最长 60 秒），结果写入日志供确认
const host = process.env.DSH_WEB_HOST ?? '127.0.0.1'
const readyAt = Date.now() + 60_000
let ready = false
while (Date.now() < readyAt) {
  if (await probe(host, Number(port))) {
    ready = true
    break
  }
  await sleep(1000)
}
if (logFd !== null) {
  try {
    writeSync(logFd, `[${new Date().toISOString()}] relaunched pid=${String(child.pid ?? '?')} port=${port} ready=${String(ready)}\n`)
  } catch {
    /* 日志写入失败忽略 */
  }
}
