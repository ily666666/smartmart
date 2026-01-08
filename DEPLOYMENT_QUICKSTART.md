# 🚀 快速部署指南（10分钟）

最快捷的打包和部署流程。

---

## ✅ 前置检查

```bash
# 检查 Python 版本
python --version  # 需要 3.11+

# 检查 Node.js 版本
node --version    # 需要 18+

# 检查 Rust
rustc --version   # 需要最新版本
```

---

## 📦 一键打包

### 步骤 1: 安装依赖（首次）

```bash
# Backend
cd backend
uv pip install pyinstaller

# Desktop  
cd desktop
npm install
# 或
pnpm install

# 安装二维码库
npm install qrcode
```

### 步骤 2: 打包 Backend

```bash
cd backend
python build_exe.py
```

**输出**: `backend/dist/smartmart-backend.exe`

### 步骤 3: 复制 Backend

```powershell
# PowerShell
Copy-Item backend\dist\smartmart-backend.exe desktop\src-tauri\smartmart-backend.exe
```

### 步骤 4: 打包 Desktop

```bash
cd desktop
npm run tauri build
```

**输出**: 
- `desktop/src-tauri/target/release/bundle/msi/SmartMart_1.0.0_x64.msi`
- `desktop/src-tauri/target/release/bundle/nsis/SmartMart_1.0.0_x64-setup.exe`

**耗时**: 首次约 10-15 分钟，后续约 3-5 分钟

---

## 🔥 配置防火墙

### 自动配置（推荐）

```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\add_firewall_rule.ps1
```

### 手动配置

```powershell
# 以管理员身份运行
netsh advfirewall firewall add rule name="SmartMart Backend" dir=in action=allow protocol=TCP localport=8000 profile=private,domain
```

---

## 🎯 测试部署

### 1. 安装

双击 `SmartMart_1.0.0_x64.msi` 安装。

### 2. 启动

运行 SmartMart，Backend 会自动启动。

### 3. 配对

1. Desktop: 进入"设备配对"页面
2. 点击"生成配对码"
3. 小程序: 点击"扫码配对"
4. 扫描二维码
5. 自动连接成功

---

## 🐛 快速排查

### Backend 未启动

```bash
# 检查进程
tasklist | findstr smartmart-backend

# 手动启动测试
cd "C:\Program Files\SmartMart"
.\smartmart-backend.exe
```

### 防火墙阻止

```powershell
# 检查规则
netsh advfirewall firewall show rule name=all | findstr SmartMart

# 重新添加
.\add_firewall_rule.ps1
```

### 小程序无法连接

1. 确认手机和电脑在同一局域网
2. 检查防火墙规则
3. 重新生成配对码

---

## 📋 完整流程脚本

创建 `build_all.ps1`：

```powershell
# SmartMart 一键打包脚本

Write-Host "🚀 开始打包 SmartMart..." -ForegroundColor Cyan

# 1. 打包 Backend
Write-Host "`n📦 步骤 1: 打包 Backend" -ForegroundColor Yellow
Set-Location backend
python build_exe.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend 打包失败" -ForegroundColor Red
    exit 1
}

# 2. 复制 Backend.exe
Write-Host "`n📋 步骤 2: 复制 Backend" -ForegroundColor Yellow
Set-Location ..
Copy-Item backend\dist\smartmart-backend.exe desktop\src-tauri\smartmart-backend.exe -Force
Write-Host "✓ 复制完成" -ForegroundColor Green

# 3. 打包 Desktop
Write-Host "`n📦 步骤 3: 打包 Desktop（需要几分钟）" -ForegroundColor Yellow
Set-Location desktop
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Desktop 打包失败" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host "`n✅ 打包完成！" -ForegroundColor Green
Write-Host "`n📦 安装包位置:" -ForegroundColor Cyan
Write-Host "   desktop\src-tauri\target\release\bundle\msi\SmartMart_1.0.0_x64.msi" -ForegroundColor White
Write-Host "`n🔥 下一步: 运行 add_firewall_rule.ps1 配置防火墙" -ForegroundColor Yellow
```

使用：

```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\build_all.ps1
```

---

## ✅ 完成！

现在你有了：
- ✅ Windows 安装包 (.msi)
- ✅ 自动启动的 Backend
- ✅ 扫码配对功能
- ✅ 防火墙规则

**分发安装包，开始使用吧！** 🎉


