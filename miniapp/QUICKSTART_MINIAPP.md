# 微信小程序 - 快速启动指南

## ⚡ 5 步上手

### 1️⃣ 准备后端

确保后端服务已启动：

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

查看电脑局域网 IP：
```bash
# Windows
ipconfig
# 找到 IPv4 地址，例如：192.168.1.100
```

### 2️⃣ 打开微信开发者工具

1. 下载: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 点击"导入项目"
3. 选择 `miniapp` 目录
4. AppID 选择"测试号"

### 3️⃣ 关闭域名校验（重要！）

1. 点击右上角"详情"
2. 选择"本地设置"
3. ✅ 勾选"不校验合法域名..."

**必须勾选**，否则无法连接局域网 IP！

### 4️⃣ 编译运行

点击"编译"按钮，查看首页。

### 5️⃣ 配置并连接

在小程序首页：

1. 输入：`192.168.1.100:8000`（你的电脑 IP）
2. 点击"保存配置"
3. 点击"连接服务器"
4. ✅ 看到绿点 = 成功！

---

## 🔍 测试扫码

1. 点击"开始扫码"
2. 允许相机权限
3. 扫描条码（如 `6901028075831`）
4. ✅ 显示"已发送到桌面端"
5. 查看桌面客户端是否收到

---

## 📱 真机测试

1. 点击"预览"按钮
2. 用微信扫描二维码
3. **确保手机和电脑在同一 WiFi**
4. 重复上面的配置和扫码步骤

---

## ⚠️ 网络检查

如果连接失败，在手机浏览器访问：

```
http://192.168.1.100:8000
```

能看到 API 页面 = 网络通。

---

## 📋 关键代码

### app.json - 页面配置

```json
{
  "pages": [
    "pages/index/index",  // 首页
    "pages/scan/scan"     // 扫码页
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/scan/scan", "text": "扫码" }
    ]
  }
}
```

### pages/index/index.js - 首页逻辑

**核心功能**:
```javascript
// 连接 WebSocket
connectWebSocket() {
  const wsUrl = `ws://${serverUrl}/ws`;
  const socketTask = wx.connectSocket({ url: wsUrl });
  
  socketTask.onOpen(() => {
    // 发送注册消息
    socketTask.send({
      data: JSON.stringify({
        type: 'REGISTER',
        device_id: deviceId,
        source: 'miniapp'
      })
    });
  });
  
  socketTask.onMessage((res) => {
    const data = JSON.parse(res.data);
    if (data.type === 'PRODUCT_FOUND') {
      wx.showToast({ title: `${data.name} ¥${data.price}` });
    }
  });
}
```

### pages/scan/scan.js - 扫码逻辑

**核心功能**:
```javascript
// 开始扫码
startScan() {
  wx.scanCode({
    onlyFromCamera: true,
    scanType: ['barCode'],
    success: (res) => {
      this.sendScanEvent(res.result);
    }
  });
}

// 发送扫码事件
sendScanEvent(code) {
  const message = {
    type: 'SCAN_BARCODE',
    code: code,
    device_id: deviceId,
    source: 'miniapp',
    ts: Date.now()
  };
  
  socketTask.send({
    data: JSON.stringify(message)
  });
}
```

### pages/index/index.wxml - 首页界面

**关键元素**:
```xml
<!-- 连接状态 -->
<view class="status">
  <view class="status-dot {{wsConnected ? 'connected' : 'disconnected'}}"></view>
  <text>{{wsConnected ? '已连接' : '未连接'}}</text>
</view>

<!-- 服务器地址输入 -->
<input 
  type="text" 
  value="{{serverUrl}}"
  placeholder="192.168.1.100:8000"
  bindinput="onServerUrlInput"
/>

<!-- 连接按钮 -->
<button bindtap="connectWebSocket">连接服务器</button>

<!-- 扫码按钮 -->
<button bindtap="goToScan">开始扫码</button>
```

### pages/scan/scan.wxml - 扫码界面

**关键元素**:
```xml
<!-- 状态栏 -->
<view class="status-bar">
  <view class="status-dot {{wsConnected ? 'connected' : 'disconnected'}}"></view>
  <text>已扫描: {{scanCount}}</text>
</view>

<!-- 扫码区域 -->
<view class="scan-frame">
  <view class="corner corner-tl"></view>
  <view class="corner corner-tr"></view>
  <view class="corner corner-bl"></view>
  <view class="corner corner-br"></view>
</view>

<!-- 扫码按钮 -->
<button bindtap="startScan">开始扫码</button>
```

---

## 🌐 局域网 IP 限制说明

### 开发环境（当前）

✅ **可用**: `ws://192.168.1.100:8000`

**要求**:
- 勾选"不校验合法域名"
- 手机和电脑同一网络

### 生产环境（审核/正式版）

❌ **不可用**: IP 地址  
✅ **必须**: 域名 + WSS

**解决方案**:

#### 方案 1: 使用真实域名 + SSL

```bash
# 1. 申请域名（如 smartmart.com）
# 2. 配置 SSL 证书
# 3. 后端启动 HTTPS
uvicorn app.main:app --ssl-keyfile=key.pem --ssl-certfile=cert.pem

# 4. 小程序使用
const wsUrl = 'wss://smartmart.com/ws'
```

#### 方案 2: 使用内网穿透（测试）

```bash
# 使用 ngrok
ngrok http 8000

# 获得临时域名
Forwarding: https://abc123.ngrok.io -> localhost:8000

# 小程序使用
const wsUrl = 'wss://abc123.ngrok.io/ws'
```

#### 方案 3: mDNS（仅 Apple 设备）

```javascript
// Mac 设置计算机名为 smartmart-server
const wsUrl = 'ws://smartmart-server.local:8000/ws'
```

**本 MVP**: 使用方案 1（`ws://IP`），仅适合开发测试。

---

## 🐛 故障排除

### 问题：连接失败

**检查**:
```
✓ 后端是否启动？
✓ IP 地址是否正确？
✓ 同一 WiFi 网络？
✓ 防火墙开放 8000 端口？
✓ 勾选"不校验域名"？
```

### 问题：扫码无反应

**检查**:
```
✓ 顶部是否显示绿点？
✓ 相机权限是否允许？
✓ 查看控制台错误？
```

### 问题：真机连不上

**测试**:
```
1. 手机浏览器访问 http://电脑IP:8000
2. 能访问 = 网络OK，检查小程序配置
3. 不能访问 = 网络问题，检查防火墙
```

---

## 📖 完整文档

详细说明请查看: [MINIAPP_MVP.md](./MINIAPP_MVP.md)

---

**🎉 现在可以开始扫码了！**


