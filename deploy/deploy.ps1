param(
    [string]$ServerHost = "192.168.86.128",
    [string]$ServerUser = "h",
    [string]$KeyPath = "$env:USERPROFILE\.ssh\blanket_deploy_ed25519",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$target = "$ServerUser@$ServerHost"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteStage = "/tmp/blanket-release-$stamp"

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "缺少部署密钥：$KeyPath"
}

Push-Location $projectRoot
try {
    if (-not $SkipBuild) {
        & ".\node_modules\.bin\vue-tsc.cmd" --noEmit
        if ($LASTEXITCODE -ne 0) {
            throw "TypeScript 检查失败"
        }

        & ".\node_modules\.bin\vite.cmd" build
        if ($LASTEXITCODE -ne 0) {
            throw "前端构建失败"
        }
    }

    if (-not (Test-Path -LiteralPath ".\dist\index.html")) {
        throw "找不到 dist/index.html"
    }

    & scp -q -i $KeyPath -r -o StrictHostKeyChecking=accept-new .\dist "${target}:$remoteStage"
    if ($LASTEXITCODE -ne 0) {
        throw "上传失败"
    }

    & ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $target "sudo /usr/local/bin/blanket-deploy $remoteStage"
    if ($LASTEXITCODE -ne 0) {
        throw "服务器发布失败"
    }

    Write-Host "部署完成：http://$ServerHost/"
}
finally {
    Pop-Location
}
