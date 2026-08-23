# dsh-quick-restart 发布脚本
#
# 用法:
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 0.3.0
#
# 流程:
#   1. 校验参数与 git 工作区干净
#   2. 用 node 改写 package.json 的 version（避免 PowerShell 编码破坏中文）
#   3. commit + 打 tag + 推送 main 与 tag
#   4. 提示在 web profile 目录执行 pnpm update（需要单独运行）
#
# 注意: 推送需要已配置的 GitHub 凭据（Git Credential Manager 登录过即可）。

param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. 版本号格式校验（x.y.z）
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  Write-Host "error: version must be x.y.z, got '$Version'" -ForegroundColor Red
  exit 1
}

# 2. 工作区必须干净（未提交/未跟踪文件要先处理）
Push-Location $repo
try {
  $status = git status --porcelain
  if ($status) {
    Write-Host "error: working tree not clean:" -ForegroundColor Red
    $status | ForEach-Object { Write-Host "  $_" }
    Write-Host 'commit or stash your changes first'
    exit 1
  }

  # 3. 用 node 改版本号（安全处理 UTF-8 与换行，避免 PowerShell 编码坑）
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const version = process.argv[2];
    const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
    const prev = pkg.version;
    pkg.version = version;
    fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('version ' + prev + ' -> ' + version);
  " (Join-Path $repo 'package.json') $Version

  # 4. 提交 + tag + 推送
  git add package.json
  git commit -m "chore: bump version to $Version"
  git tag "v$Version"
  git push origin main
  git push origin "v$Version"

  Write-Host ''
  Write-Host "published v$Version" -ForegroundColor Green
  Write-Host 'next step (in the web profile dir, e.g. C:\Users\22675\.dsh\profiles\web):'
  Write-Host '  pnpm update dsh-quick-restart'
  Write-Host 'then restart DSH for the new version to take effect.'
} finally {
  Pop-Location
}
