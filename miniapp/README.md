# SmartMart 微信小程序（店小蜜）

微信小程序端，支持独立收银、商品管理、AI 识别、与桌面端实时联动。

## 功能特性

### 收银（首页）
- 扫描商品条码 / 搜索商品名称，添加到购物车
- 支持 **持续扫码模式**（无需反复打开相机）
- 搜索结果弹出选择框确认
- 购物车管理、数量调整、一键结账
- 无需桌面端，可独立完成收银

### 商品
- 商品列表浏览、分类筛选
- 模糊搜索商品
- 商品详情查看

### 采集中心
- **扫码录入**：扫码后通过 WebSocket 发送给桌面端
- **AI 拍照识别**：拍照上传后端 AI 识别，结果同步到桌面端
- 需与桌面端 WebSocket 连接，未连接时会提示

### 订单
- 订单列表、订单详情
- **撤销订单**：恢复库存，商品通过 WebSocket 自动回到桌面端收银台
- 删除订单

### 数据
- 销售报表
- 数据分析

### 设置
- 服务器地址配置（支持局域网 IP、外网域名）
- 连接密码配置
- 测试连接 / 保存 / 清除
- **扫码配对桌面端**（自动更新地址 + 密码 + Token）
- WebSocket 连接管理

## 开发工具

[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

## 开发步骤

### 1. 导入项目

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择 `miniapp` 目录
4. 填写 AppID（测试可以使用测试号）

### 2. 配置服务器

**方式 A：小程序内配置（推荐）**

运行后进入 **设置** 页面：
1. 输入服务器地址（如 `192.168.1.100:8000` 或 `example.vicp.fun`）
2. 输入连接密码
3. 测试连接 → 保存

**方式 B：扫码配对**

在桌面端"设备配对"页面扫码，自动配置服务器地址 + 密码 + 配对 Token。

### 3. 微信后台配置（正式发布时）

在 [微信公众平台](https://mp.weixin.qq.com) 配置服务器域名：

| 类型 | 域名 |
|------|------|
| request 合法域名 | `https://your-domain.com` |
| socket 合法域名 | `wss://your-domain.com` |
| uploadFile 合法域名 | `https://your-domain.com` |
| downloadFile 合法域名 | `https://your-domain.com` |

> 开发调试时可在开发者工具中勾选"不校验合法域名"。
> 真机调试需要在手机上开启调试模式：扫码进入小程序 → 右上角 ··· → 开发调试。

## 项目结构

```
miniapp/
├── pages/
│   ├── index/            # 收银台（首页，持续扫码 + 搜索 + 购物车）
│   ├── products/         # 商品列表（分类、搜索）
│   ├── product-detail/   # 商品详情
│   ├── collect/          # 采集中心（入口页）
│   ├── scan/             # 扫码录入（→ WebSocket → 桌面端）
│   ├── vision/           # AI 拍照识别（→ HTTP → 后端AI）
│   ├── samples/          # AI 样本管理
│   ├── orders/           # 订单列表
│   ├── order-detail/     # 订单详情（撤销 / 删除）
│   ├── data/             # 数据管理
│   ├── reports/          # 销售报表
│   ├── analysis/         # 数据分析
│   └── settings/         # 设置（服务器配置 + 扫码配对 + WebSocket）
├── custom-tab-bar/       # 自定义底部导航栏
├── app.js                # 小程序入口（全局数据、连接测试）
├── app.json              # 全局配置（页面路由、tabBar）
├── app.wxss              # 全局样式
├── config.js             # URL 解析工具（parseServerUrl, getApiUrl, getWsUrl）
└── README.md
```

## 底部导航（TabBar）

| 标签 | 页面 | 说明 |
|------|------|------|
| 收银 | `index` | 收银台（首页） |
| 商品 | `products` | 商品列表 |
| 采集 | `collect` | 采集中心入口 |
| 订单 | `orders` | 订单列表 |
| 设置 | `settings` | 服务器配置、配对 |

## 认证说明

### 连接密码（API_KEY）

所有 HTTP 请求自动在请求头添加 `X-API-Key`：

```javascript
// app.js 中的全局请求方法
app.request({
  url: '...',
  header: { 'X-API-Key': app.globalData.apiKey }
})
```

密码保存在 `wx.setStorageSync('apiKey', ...)`，全局通过 `app.globalData.apiKey` 访问。

### 配对 Token（WebSocket 联动）

| 场景 | 说明 |
|------|------|
| 只有密码 | 可独立使用收银、商品、订单等所有 HTTP 功能 |
| 密码 + Token | 额外获得 WebSocket 联动能力（采集同步、撤销回收银台） |

配对 Token 通过扫描桌面端 QR 码获取，保存在 `wx.setStorageSync('pairingToken', ...)`。

WebSocket 注册时发送：
```json
{
  "type": "REGISTER",
  "device_id": "miniapp-xxx",
  "device_type": "miniapp",
  "token": "配对Token"
}
```

首次验证通过后，设备被标记为已认证，后续重连无需再次提供 Token。

## 服务器地址格式

小程序支持多种格式输入，`config.js` 会自动解析：

| 输入 | 解析为 HTTP | 解析为 WS |
|------|------------|-----------|
| `192.168.1.100:8000` | `http://192.168.1.100:8000` | `ws://192.168.1.100:8000/ws` |
| `example.vicp.fun` | `https://example.vicp.fun` | `wss://example.vicp.fun/ws` |
| `http://192.168.1.100:8000` | 原样 | `ws://192.168.1.100:8000/ws` |
| `https://example.vicp.fun` | 原样 | `wss://example.vicp.fun/ws` |

> 域名自动使用 `https/wss`，IP 地址自动使用 `http/ws`。

## 注意事项

1. **首次使用**：先在设置页面配置服务器地址和密码
2. **局域网**：手机和后端需在同一网络下
3. **外网域名**：正式发布需在微信后台配置合法域名（`https` 必须）
4. **iOS 限制**：iOS 真机调试时需确保域名证书有效，"不校验域名"仅对开发工具有效
5. **WebSocket 断连**：小程序切到后台会断开 WebSocket，回到前台后需手动重连或自动重连
6. **权限**：首次使用会申请相机、扫码权限

## 调试技巧

1. `console.log()` 查看日志
2. 开发者工具"调试器"中查看网络请求
3. "真机调试"测试扫码和拍照功能
4. 设置页面有连接状态指示，方便排查网络问题

## 发布

1. 微信开发者工具 → 上传
2. 填写版本号和描述
3. 在微信公众平台提交审核
4. 审核通过后发布
