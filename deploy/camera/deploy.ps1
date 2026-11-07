param(
    [string]$ServerHost = "172.20.10.10",
    [string]$ServerUser = "lg",
    [string]$PlatformServerHost = "172.20.10.12",
    [int]$PlatformServerPort = 80,
    [string]$KeyPath = "$env:USERPROFILE\.ssh\blanket_camera_deploy_ed25519"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$target = "$ServerUser@$ServerHost"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteStage = "/tmp/blanket-camera-release-$stamp"
$localStage = Join-Path $projectRoot "tmp\camera-deploy-staging-$stamp"
$jetsonRoot = Join-Path $projectRoot "deploy\jetson"
$knownHostsPath = Join-Path $env:USERPROFILE ".ssh\blanket_known_hosts"

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "缺少摄像头部署密钥：$KeyPath。请先完成一次部署密钥安装。"
}

$files = @(
    "install-with-docker.sh",
    "camera-stream.sh",
    "camera-stream.service",
    "camera-stream.env.example",
    "setvdserver.sh",
    "mediamtx-recordings-cleanup.sh",
    "camera-maintenance.sh",
    "blanket-recordings-cleanup.service",
    "blanket-recordings-cleanup.timer",
    "blanket-camera-maintenance.service",
    "blanket-camera-maintenance.timer",
    "camera-healthcheck.py"
)

Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force -Path $localStage | Out-Null
    foreach ($file in $files) {
        $source = Join-Path $jetsonRoot $file
        if (-not (Test-Path -LiteralPath $source)) {
            throw "摄像头发布包缺少文件：$source"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $localStage $file) -Force
    }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "blanket-camera-deploy") `
        -Destination (Join-Path $localStage "blanket-camera-deploy.helper") -Force

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
        Write-Warning "摄像头上传失败，3 秒后重试（$attempt/3）"
        Start-Sleep -Seconds 3
    }
    if (-not $uploaded) {
        throw "摄像头发布包上传失败：网络连续 3 次不可用"
    }

    $deployed = $false
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        & ssh -i $KeyPath `
            -o StrictHostKeyChecking=accept-new `
            -o UserKnownHostsFile=$knownHostsPath `
            -o ConnectTimeout=10 `
            -o ServerAliveInterval=5 `
            -o ServerAliveCountMax=3 `
            $target "sudo /usr/local/bin/blanket-camera-deploy $remoteStage $PlatformServerHost $PlatformServerPort"
        if ($LASTEXITCODE -eq 0) {
            $deployed = $true
            break
        }
        Write-Warning "摄像头发布失败，3 秒后重试（$attempt/2）"
        Start-Sleep -Seconds 3
    }
    if (-not $deployed) {
        throw "摄像头发布失败，服务器已尝试自动回滚"
    }

    & ssh -i $KeyPath `
        -o BatchMode=yes `
        -o StrictHostKeyChecking=accept-new `
        -o UserKnownHostsFile=$knownHostsPath `
        -o ConnectTimeout=10 `
        -o ServerAliveInterval=5 `
        -o ServerAliveCountMax=3 `
        $target "systemctl is-active camera-stream.service; /usr/local/bin/blanket-camera-healthcheck camera-01"
    if ($LASTEXITCODE -ne 0) {
        throw "摄像头发布后健康检查失败"
    }

    Write-Host "摄像头部署完成：$ServerHost"
}
finally {
    if (Test-Path -LiteralPath $localStage) {
        Remove-Item -LiteralPath $localStage -Recurse -Force
    }
    Pop-Location
}
