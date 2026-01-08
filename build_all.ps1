# SmartMart 一键打包脚本
# 自动完成 Backend 和 Desktop 的打包流程

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SmartMart 一键打包工具" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 检查当前目录
if (-not (Test-Path "backend") -or -not (Test-Path "desktop")) {
    Write-Host "[ERROR] 请在项目根目录运行此脚本" -ForegroundColor Red
    Write-Host ""
    Write-Host "当前目录: $PWD" -ForegroundColor Yellow
    Write-Host "期望目录结构:" -ForegroundColor Yellow
    Write-Host "  SmartMartAI/" -ForegroundColor Gray
    Write-Host "    +-- backend/" -ForegroundColor Gray
    Write-Host "    +-- desktop/" -ForegroundColor Gray
    Write-Host "    +-- build_all.ps1" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按 Enter 退出"
    exit 1
}

# ============================================
# 步骤 1: 打包 Backend
# ============================================

Write-Host "[1/3] 打包 Backend" -ForegroundColor Yellow
Write-Host ""

Push-Location backend

try {
    Write-Host "  运行 build_exe.py..." -ForegroundColor Gray
    python build_exe.py
    
    if ($LASTEXITCODE -ne 0) {
        throw "Backend 打包失败"
    }
    
    if (-not (Test-Path "dist\smartmart-backend.exe")) {
        throw "Backend.exe 未生成"
    }
    
    $backendSize = (Get-Item "dist\smartmart-backend.exe").Length / 1MB
    Write-Host "  [OK] Backend 打包成功 ($([math]::Round($backendSize, 1)) MB)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Backend 打包失败: $_" -ForegroundColor Red
    Pop-Location
    Write-Host ""
    Read-Host "按 Enter 退出"
    exit 1
} finally {
    Pop-Location
}

Write-Host ""

# ============================================
# 步骤 2: 复制 Backend.exe
# ============================================

Write-Host "[2/3] 复制 Backend.exe" -ForegroundColor Yellow
Write-Host ""

try {
    $sourcePath = "backend\dist\smartmart-backend.exe"
    $destPath = "desktop\src-tauri\smartmart-backend.exe"
    
    Write-Host "  源文件: $sourcePath" -ForegroundColor Gray
    Write-Host "  目标: $destPath" -ForegroundColor Gray
    
    # 确保目标目录存在
    $destDir = Split-Path -Parent $destPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    Copy-Item $sourcePath $destPath -Force
    
    Write-Host "  [OK] 复制完成" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] 复制失败: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "按 Enter 退出"
    exit 1
}

Write-Host ""

# ============================================
# 步骤 3: 打包 Desktop
# ============================================

Write-Host "[3/3] 打包 Desktop (需要几分钟，请耐心等待)" -ForegroundColor Yellow
Write-Host ""

Push-Location desktop

try {
    Write-Host "  运行 npm run tauri build..." -ForegroundColor Gray
    Write-Host "  (首次构建可能需要 10-15 分钟)" -ForegroundColor Gray
    Write-Host ""
    
    npm run tauri build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Desktop 打包失败"
    }
    
    # 查找生成的文件
    $msiPath = "src-tauri\target\release\bundle\msi\SmartMart_*.msi"
    $nsisPath = "src-tauri\target\release\bundle\nsis\SmartMart_*-setup.exe"
    
    $msiFile = Get-Item $msiPath -ErrorAction SilentlyContinue | Select-Object -First 1
    $nsisFile = Get-Item $nsisPath -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $msiFile -and -not $nsisFile) {
        throw "未找到生成的安装包"
    }
    
    Write-Host ""
    Write-Host "  [OK] Desktop 打包成功" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Desktop 打包失败: $_" -ForegroundColor Red
    Pop-Location
    Write-Host ""
    Read-Host "按 Enter 退出"
    exit 1
} finally {
    Pop-Location
}

Write-Host ""

# ============================================
# 完成
# ============================================

Write-Host "====================================================" -ForegroundColor Green
Write-Host "  打包完成!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""

Write-Host "生成的文件:" -ForegroundColor Cyan
Write-Host ""

if ($msiFile) {
    $msiSize = $msiFile.Length / 1MB
    Write-Host "  MSI 安装包:" -ForegroundColor White
    Write-Host "    $($msiFile.FullName)" -ForegroundColor Gray
    Write-Host "    大小: $([math]::Round($msiSize, 1)) MB" -ForegroundColor Gray
    Write-Host ""
}

if ($nsisFile) {
    $nsisSize = $nsisFile.Length / 1MB
    Write-Host "  NSIS 安装包:" -ForegroundColor White
    Write-Host "    $($nsisFile.FullName)" -ForegroundColor Gray
    Write-Host "    大小: $([math]::Round($nsisSize, 1)) MB" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "下一步:" -ForegroundColor Yellow
Write-Host "  1. 运行 add_firewall_rule.ps1 配置防火墙" -ForegroundColor White
Write-Host "  2. 双击安装包进行安装" -ForegroundColor White
Write-Host "  3. 启动 SmartMart 并开始使用" -ForegroundColor White
Write-Host ""

Write-Host "详细文档: DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

Read-Host "按 Enter 退出"
