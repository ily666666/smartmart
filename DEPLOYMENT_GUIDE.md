# 📦 SmartMartAI 部署指南（Windows）

完整的打包、部署和配对流程指南。

---

## 🎯 部署目标

1. ✅ 桌面端打包成 Windows 安装包 (.msi)
2. ✅ Backend 随桌面端自动启动
3. ✅ 小程序扫码配对，自动连接
4. ✅ Token 鉴权和局域网安全

---

## 📋 前置准备

### 开发环境

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Python | 3.11+ | Backend 开发 |
| Node.js | 18+ | Desktop 前端 |
| Rust | Latest | Tauri 编译 |
| uv | Latest | Python 包管理 |
| PyInstaller | Latest | Backend 打包 |

### 安装工具

```bash
# 安装 Python 依赖
cd backend
uv pip install pyinstaller

# 安装 Desktop 依赖
cd desktop
npm install qrcode
# 或
pnpm add qrcode

# 安装 Rust（如果还没有）
# 访问 https://rustup.rs/
```

---

## 🔨 步骤 1: 打包 Backend

### 1.1 安装 PyInstaller

```bash
cd backend
uv pip install pyinstaller
```

### 1.2 运行打包脚本

```bash
python build_exe.py
```

**输出**:
- `dist/smartmart-backend.exe`（约 50-80 MB）

### 1.3 测试 Backend.exe

```bash
cd dist
.\smartmart-backend.exe --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 确认服务正常。

---

## 🔨 步骤 2: 配置 Tauri 打包

### 2.1 复制 Backend.exe

将 `backend/dist/smartmart-backend.exe` 复制到 `desktop/src-tauri/` 目录：

```bash
# PowerShell
Copy-Item backend\dist\smartmart-backend.exe desktop\src-tauri\
```

### 2.2 更新 Tauri 配置

编辑 `desktop/src-tauri/tauri.conf.json`：

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "package": {
    "productName": "SmartMart",
    "version": "1.0.0"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "category": "Business",
      "copyright": "",
      "deb": {
        "depends": []
      },
      "externalBin": [
        "smartmart-backend"
      ],
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.smartmart.app",
      "longDescription": "本地超市收银+进销存+AI分析系统",
      "macOS": {
        "entitlements": null,
        "exceptionDomain": "",
        "frameworks": [],
        "providerShortName": null,
        "signingIdentity": null
      },
      "resources": [
        "smartmart-backend.exe"
      ],
      "shortDescription": "智能超市管理系统",
      "targets": ["msi", "nsis"],
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": "",
        "wix": {
          "language": "zh-CN"
        }
      }
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "height": 800,
        "resizable": true,
        "title": "SmartMart - 智能超市管理系统",
        "width": 1200,
        "minWidth": 1000,
        "minHeight": 600
      }
    ],
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "execute": false,
        "sidecar": true,
        "open": false
      }
    }
  }
}
```

### 2.3 编译 Tauri 应用

```bash
cd desktop

# 开发模式测试
npm run tauri dev

# 生产打包
npm run tauri build
```

**输出位置**:
- `desktop/src-tauri/target/release/bundle/msi/SmartMart_1.0.0_x64.msi`
- `desktop/src-tauri/target/release/bundle/nsis/SmartMart_1.0.0_x64-setup.exe`

---

## 🔨 步骤 3: 防火墙配置

### 方法 1: 自动添加规则（推荐）

创建 PowerShell 脚本 `add_firewall_rule.ps1`：

```powershell
# 需要管理员权限运行

$ruleName = "SmartMart Backend"
$programPath = "$PSScriptRoot\smartmart-backend.exe"
$port = 8000

Write-Host "🔥 配置防火墙规则..." -ForegroundColor Cyan

# 删除旧规则（如果存在）
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

# 添加入站规则
New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Program $programPath `
    -Action Allow `
    -Profile Private,Domain `
    -Description "允许 SmartMart 后端服务在局域网通信"

Write-Host "✅ 防火墙规则已添加" -ForegroundColor Green
Write-Host "   规则名称: $ruleName" -ForegroundColor Yellow
Write-Host "   端口: $port" -ForegroundColor Yellow
```

**使用方法**:
```bash
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\add_firewall_rule.ps1
```

### 方法 2: 手动配置（图形界面）

1. 打开"Windows Defender 防火墙"
2. 点击"高级设置"
3. 点击"入站规则" → "新建规则"
4. 选择"程序" → "下一步"
5. 选择程序路径: `smartmart-backend.exe`
6. 选择"允许连接" → "下一步"
7. 勾选"专用"和"域" → "下一步"
8. 名称: "SmartMart Backend" → "完成"

### 方法 3: 端口规则（备选）

```bash
# 以管理员身份运行
netsh advfirewall firewall add rule name="SmartMart Port 8000" dir=in action=allow protocol=TCP localport=8000 profile=private,domain
```

---

## 🔨 步骤 4: 配对二维码实现

### 4.1 Backend API（已实现）

- `POST /pairing/generate_pairing_code` - 生成配对信息
- `GET /pairing/validate_token` - 验证 Token
- `GET /pairing/pairing_status` - 配对状态

### 4.2 Desktop 配对页面（已实现）

文件: `desktop/src/pages/Pairing.tsx`

**功能**:
- 调用 Backend API 生成配对信息
- 生成二维码（使用 `qrcode` 库）
- 显示倒计时（5分钟）
- 自动刷新过期的二维码

### 4.3 小程序扫码配对

编辑 `miniapp/pages/index/index.js`：

```javascript
// 扫码配对
scanQRCode() {
  wx.scanCode({
    onlyFromCamera: false,
    scanType: ['qrCode'],
    success: (res) => {
      try {
        const data = JSON.parse(res.result);
        
        // 验证是否为 SmartMart 配对码
        if (data.type === 'smartmart_pairing') {
          const { http_url, ws_url, token } = data;
          
          // 提取 IP 和端口
          const url = new URL(http_url);
          const serverUrl = `${url.hostname}:${url.port}`;
          
          // 保存配置
          wx.setStorageSync('serverUrl', serverUrl);
          wx.setStorageSync('pairingToken', token);
          
          this.setData({
            serverUrl: serverUrl,
            isConnected: false
          });
          
          // 立即连接
          this.connectWebSocket(token);
          
          wx.showToast({
            title: '配对成功',
            icon: 'success'
          });
        } else {
          throw new Error('无效的配对码');
        }
      } catch (error) {
        wx.showToast({
          title: '配对码格式错误',
          icon: 'none'
        });
      }
    },
    fail: () => {
      wx.showToast({
        title: '扫码失败',
        icon: 'none'
      });
    }
  });
},

// 连接 WebSocket（带 Token）
connectWebSocket(token) {
  const app = getApp();
  const serverUrl = this.data.serverUrl;
  
  if (!serverUrl) {
    wx.showToast({
      title: '请先配对',
      icon: 'none'
    });
    return;
  }
  
  const wsUrl = `ws://${serverUrl}/ws?token=${token || ''}`;
  
  const socketTask = wx.connectSocket({
    url: wsUrl,
    success: () => {
      console.log('WebSocket 连接成功');
    },
    fail: (err) => {
      console.error('WebSocket 连接失败', err);
      this.setData({ isConnected: false });
      wx.showToast({
        title: '连接失败',
        icon: 'none'
      });
    }
  });
  
  // ... (其他 WebSocket 事件处理)
}
```

更新 WXML（`miniapp/pages/index/index.wxml`）：

```xml
<view class="container">
  <!-- 连接状态 -->
  <view class="status-card">
    <view class="status-indicator {{isConnected ? 'connected' : 'disconnected'}}"></view>
    <text class="status-text">{{isConnected ? '已连接' : '未连接'}}</text>
  </view>

  <!-- 配对按钮 -->
  <button class="action-btn primary" bindtap="scanQRCode">
    📱 扫码配对
  </button>

  <!-- 或手动配置 -->
  <view class="config-section">
    <text class="section-title">或手动输入</text>
    <input
      class="input-field"
      placeholder="输入服务器地址（IP:端口）"
      value="{{serverUrl}}"
      bindinput="onServerUrlInput"
    />
    <button class="action-btn" bindtap="connectWebSocket">连接</button>
  </view>
</view>
```

---

## 🔨 步骤 5: Token 鉴权

### 5.1 Backend WebSocket 验证

编辑 `backend/app/api/websocket_api.py`：

```python
from fastapi import WebSocket, WebSocketDisconnect, Query
from ..security import get_token_manager, is_local_network_ip

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None)  # Token 作为查询参数
):
    # 获取客户端 IP
    client_ip = websocket.client.host
    
    # 验证局域网 IP
    if not is_local_network_ip(client_ip):
        await websocket.close(code=403, reason="仅允许局域网访问")
        return
    
    # 验证 Token（如果提供）
    if token:
        token_manager = get_token_manager()
        if not token_manager.validate_token(token, mark_as_used=True):
            await websocket.close(code=401, reason="Token 无效或已过期")
            return
    
    # 接受连接
    await manager.connect(websocket)
    
    # ... (其余逻辑)
```

### 5.2 API 中间件（可选）

如果需要保护其他 API：

```python
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

class LocalNetworkMiddleware(BaseHTTPMiddleware):
    """局域网访问限制中间件"""
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        
        # 跳过健康检查和文档
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # 验证局域网 IP
        if not is_local_network_ip(client_ip):
            raise HTTPException(
                status_code=403,
                detail="仅允许局域网访问"
            )
        
        return await call_next(request)

# 添加到 main.py
app.add_middleware(LocalNetworkMiddleware)
```

---

## 📦 步骤 6: 最终打包

### 6.1 完整打包流程

```bash
# 1. 打包 Backend
cd backend
python build_exe.py

# 2. 复制 Backend.exe
Copy-Item dist\smartmart-backend.exe ..\desktop\src-tauri\

# 3. 打包 Desktop
cd ..\desktop
npm run tauri build

# 4. 输出位置
# desktop/src-tauri/target/release/bundle/msi/SmartMart_1.0.0_x64.msi
```

### 6.2 安装包内容

```
SmartMart_1.0.0_x64.msi
├── SmartMart.exe (Tauri 主程序)
├── smartmart-backend.exe (Backend 服务)
├── WebView2Loader.dll
└── 其他依赖...
```

---

## 🚀 步骤 7: 部署和使用

### 7.1 安装

1. 双击 `SmartMart_1.0.0_x64.msi`
2. 按向导完成安装
3. 首次运行可能需要管理员权限（配置防火墙）

### 7.2 启动

1. 运行 SmartMart
2. Backend 自动在后台启动（端口 8000）
3. 进入"设备配对"页面

### 7.3 配对小程序

1. 点击"生成配对码"
2. 打开小程序，点击"扫码配对"
3. 扫描二维码
4. 自动连接成功

---

## 🔒 安全说明

### Token 机制

- **生成**: Backend 生成随机 32 字节 Token
- **有效期**: 5 分钟（可配置）
- **一次性**: 使用后自动失效
- **存储**: 内存中（重启后失效）

### 局域网限制

- **IP 白名单**: 
  - 10.0.0.0/8
  - 172.16.0.0/12
  - 192.168.0.0/16
  - 127.0.0.1

### 防火墙规则

- **仅允许专用网络**: 不允许公网访问
- **程序级规则**: 绑定到 smartmart-backend.exe
- **自动配置**: 安装时自动添加规则

---

## 🐛 常见问题

### 问题 1: Backend 启动失败

**症状**: Desktop 启动后无法连接 Backend

**排查**:
```bash
# 检查 Backend 进程
tasklist | findstr smartmart-backend

# 手动测试 Backend
cd "C:\Program Files\SmartMart"
.\smartmart-backend.exe --host 0.0.0.0 --port 8000
```

**解决方案**:
- 确保端口 8000 未被占用
- 检查防火墙规则
- 以管理员身份运行

---

### 问题 2: 小程序无法连接

**症状**: 扫码后连接失败

**排查**:
1. 检查手机和电脑是否在同一局域网
2. 检查防火墙是否放行
3. 检查 Token 是否过期

```bash
# 测试连接
curl http://[电脑IP]:8000/health
```

**解决方案**:
- 重新生成配对码
- 确认 IP 地址正确
- 关闭公共网络防火墙限制

---

### 问题 3: 防火墙阻止连接

**症状**: Desktop 可用，但小程序无法连接

**解决方案**:
```powershell
# 以管理员身份运行 PowerShell
netsh advfirewall firewall show rule name="SmartMart Backend"

# 如果规则不存在或无效，重新添加
netsh advfirewall firewall add rule name="SmartMart Backend" dir=in action=allow program="C:\Program Files\SmartMart\smartmart-backend.exe" profile=private,domain
```

---

## ✅ 部署检查清单

### 打包前

- [ ] Backend 测试通过
- [ ] Desktop 测试通过
- [ ] 小程序测试通过
- [ ] PyInstaller 已安装
- [ ] Rust/Tauri 已配置

### 打包中

- [ ] Backend.exe 生成成功
- [ ] Backend.exe 可独立运行
- [ ] Tauri 配置正确
- [ ] 资源文件包含完整

### 打包后

- [ ] MSI 安装包生成成功
- [ ] 安装包可正常安装
- [ ] Backend 随应用启动
- [ ] 防火墙规则添加成功

### 功能测试

- [ ] Desktop 收银功能正常
- [ ] 生成配对二维码
- [ ] 小程序扫码配对成功
- [ ] WebSocket 通信正常
- [ ] Token 鉴权生效
- [ ] 局域网限制生效

---

## 🎉 完成！

现在你拥有一个完整的、可部署的 Windows 应用程序！

**交付内容**:
1. ✅ `SmartMart_1.0.0_x64.msi` - Windows 安装包
2. ✅ 自动启动的 Backend 服务
3. ✅ 扫码配对功能
4. ✅ Token 鉴权和安全措施
5. ✅ 完整的部署文档

**下一步**:
- 分发安装包给用户
- 提供技术支持文档
- 收集用户反馈
- 持续优化改进

需要帮助？查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 获取详细信息。


