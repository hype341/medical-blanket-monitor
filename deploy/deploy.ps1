param(
    [string]$ServerHost = "172.20.10.12",
    [string]$ServerUser = "h",
    [string]$KeyPath = "$env:USERPROFILE\.ssh\blanket_deploy_ed25519",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$target = "$ServerUser@$ServerHost"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteStage = "/tmp/blanket-release-$stamp"
$localStage = Join-Path $projectRoot "tmp\deploy-staging-$stamp"
$backendJar = Join-Path $projectRoot "backend\target\blanket-backend-0.0.1-SNAPSHOT.jar"
$knownHostsPath = Join-Path $env:USERPROFILE ".ssh\blanket_known_hosts"

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

        & ".\backend\mvnw.cmd" -f ".\backend\pom.xml" package
        if ($LASTEXITCODE -ne 0) {
            throw "后端构建失败"
        }
    }

    if (-not (Test-Path -LiteralPath ".\dist\index.html")) {
        throw "找不到 dist/index.html"
    }
    if (-not (Test-Path -LiteralPath $backendJar)) {
        throw "找不到后端 JAR：$backendJar"
    }

    New-Item -ItemType Directory -Force -Path $localStage | Out-Null
    Copy-Item -Path ".\dist\*" -Destination $localStage -Recurse -Force
    Copy-Item -LiteralPath $backendJar -Destination (Join-Path $localStage "blanket-backend.jar") -Force

    $uploaded = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        & scp -q -C -i $KeyPath -r `
            -o StrictHostKeyChecking=accept-new `
            -o UserKnownHostsFile=$knownHostsPath `
            -o ConnectTimeout=10 `
            -o ServerAliveInterval=5 `
            -o ServerAliveCountMax=3 `
            $localStage "${target}:$remoteStage"
        if ($LASTEXITCODE -eq 0) {
            $uploaded = $true
            break
        }
        Write-Warning "服务器上传失败，3 秒后重试（$attempt/3）"
        Start-Sleep -Seconds 3
    }
    if (-not $uploaded) {
        throw "上传失败：服务器网络连续 3 次不可用"
    }

    $deployed = $false
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        & ssh -i $KeyPath `
            -o StrictHostKeyChecking=accept-new `
            -o UserKnownHostsFile=$knownHostsPath `
            -o ConnectTimeout=10 `
            -o ServerAliveInterval=5 `
            -o ServerAliveCountMax=3 `
            $target "sudo /usr/local/bin/blanket-deploy $remoteStage"
        if ($LASTEXITCODE -eq 0) {
            $deployed = $true
            break
        }
        Write-Warning "服务器发布失败，3 秒后重试（$attempt/2）"
        Start-Sleep -Seconds 3
    }
    if (-not $deployed) {
        throw "服务器发布失败"
    }

    Write-Host "部署完成：http://$ServerHost/"
}
finally {
    if (Test-Path -LiteralPath $localStage) {
        Remove-Item -LiteralPath $localStage -Recurse -Force
    }
    Pop-Location
}
