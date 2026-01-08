# SmartMart 防火墙规则配置脚本
# 需要管理员权限运行

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SmartMart 防火墙配置工具" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 错误: 需要管理员权限" -ForegroundColor Red
    Write-Host ""
    Write-Host "请右键点击 PowerShell，选择"以管理员身份运行"" -ForegroundColor Yellow
    Write-Host ""
    Pause
    exit 1
}

# 配置
$ruleName = "SmartMart Backend Service"
$port = 8000
$programPath = Join-Path $PSScriptRoot "backend\dist\smartmart-backend.exe"

# 检查程序是否存在
if (-not (Test-Path $programPath)) {
    Write-Host "⚠️  警告: Backend 程序不存在" -ForegroundColor Yellow
    Write-Host "   路径: $programPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "将配置端口规则（适用于任何程序）" -ForegroundColor Yellow
    $usePortRule = $true
} else {
    Write-Host "✓ 找到 Backend 程序" -ForegroundColor Green
    Write-Host "  路径: $programPath" -ForegroundColor Gray
    $usePortRule = $false
}

Write-Host ""

# 删除旧规则
Write-Host "🔍 检查旧规则..." -ForegroundColor Cyan
try {
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  删除旧规则..." -ForegroundColor Yellow
        Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        Write-Host "  ✓ 已删除" -ForegroundColor Green
    } else {
        Write-Host "  无旧规则" -ForegroundColor Gray
    }
} catch {
    Write-Host "  无旧规则" -ForegroundColor Gray
}

Write-Host ""

# 添加新规则
Write-Host "➕ 添加防火墙规则..." -ForegroundColor Cyan

try {
    if ($usePortRule) {
        # 端口规则
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -LocalPort $port `
            -Protocol TCP `
            -Action Allow `
            -Profile Private,Domain `
            -Description "允许 SmartMart 在端口 $port 接收局域网连接" | Out-Null
        
        Write-Host "  ✓ 端口规则添加成功" -ForegroundColor Green
    } else {
        # 程序规则
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -Program $programPath `
            -Action Allow `
            -Profile Private,Domain `
            -Description "允许 SmartMart 后端服务在局域网通信" | Out-Null
        
        Write-Host "  ✓ 程序规则添加成功" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ 添加规则失败: $_" -ForegroundColor Red
    Write-Host ""
    Pause
    exit 1
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  防火墙配置完成！" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "配置详情:" -ForegroundColor Cyan
Write-Host "  规则名称: $ruleName" -ForegroundColor White
Write-Host "  端口: $port" -ForegroundColor White
if ($usePortRule) {
    Write-Host "  类型: 端口规则" -ForegroundColor White
} else {
    Write-Host "  类型: 程序规则" -ForegroundColor White
    Write-Host "  程序: $programPath" -ForegroundColor Gray
}
Write-Host "  配置文件: 专用网络、域网络" -ForegroundColor White
Write-Host ""
Write-Host "✓ 现在可以在局域网内访问 SmartMart 服务了" -ForegroundColor Green
Write-Host ""

# 验证规则
Write-Host "📋 验证规则..." -ForegroundColor Cyan
try {
    $rule = Get-NetFirewallRule -DisplayName $ruleName
    if ($rule.Enabled -eq "True") {
        Write-Host "  ✓ 规则已启用" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  规则未启用" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  无法验证规则" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


