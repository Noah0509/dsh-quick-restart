// dsh-quick-restart 重启辅助脚本（由 host 插件 detached spawn）
//
// 用法:
//   node restart-helper.mjs <oldPid> <cwd> <logPath> <args...>
//
// 行为:
//   1. 轮询等待 oldPid 对应的进程完全退出（最长 60 秒），保证端口释放；
//   2. 稍作延迟后，用 process.execPath + args 在 cwd 下重新拉起 DSH；
//   3. 新进程 detached + unref，stdout/stderr 追加写入 logPath；
//   4. helper 自身随即退出。
//
// 全程不依赖任何第三方包；Windows 下使用 process.kill(pid, 0) 探测进程
// 存活（ESRCH = 已退出）。不接收 execPath 参数：本脚本自身就是 node
// 运行，execPath 用 process.execPath，避免传含空格的路径参数。

import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'

const [oldPid, cwd, logPath, ...cmdArgs] = process.argv.slice(2)

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

// 1) 等待旧进程退出（最长 60 秒）
const deadline = Date.now() + 60_000
while (Date.now() < deadline && isAlive(Number(oldPid))) {
  await sleep(300)
}

// 给端口释放与优雅关闭留一点余量（即使旧进程已退出，也可能有连接在收尾）
await sleep(600)

// 2) 重新拉起 DSH
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
  // 复用已打开的 fd：Windows 上句柄会被复制给子进程，父进程关闭不影响它
  stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],
})
child.unref()
