# SmartMart Desktop

基于 Tauri + React + TypeScript 的桌面收银客户端。

## 技术栈

- Tauri 1.5（桌面框架）
- React 18（UI 框架）
- TypeScript（类型安全）
- Vite（构建工具）
- WebSocket（与后端实时通信）

## 前置要求

### 1. 安装 Rust

```bash
# Windows：下载并安装 https://rustup.rs/
# macOS/Linux：
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. 安装 Node.js

需要 Node.js 18 或更高版本。

## 安装和运行

```bash
cd desktop
npm install

# 开发模式
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`

## 项目结构

```
desktop/
├── src/                        # React 源代码
│   ├── App.tsx                # 主应用（路由）
│   ├── App.css                # 全局样式
│   ├── main.tsx               # 应用入口
│   ├── config.ts              # 服务器配置 + apiFetch 封装
│   ├── components/
│   │   └── Layout.tsx         # 布局组件（侧边栏导航）
│   └── pages/
│       ├── Dashboard.tsx      # 仪表盘
│       ├── Cashier.tsx        # 收银台
│       ├── Products.tsx       # 商品管理
│       ├── Orders.tsx         # 订单查询
│       ├── Reports.tsx        # 销售报表
│       ├── Analysis.tsx       # 数据分析
│       ├── Samples.tsx        # AI 样本管理
│       ├── Database.tsx       # 数据库管理
│       ├── Pairing.tsx        # 设备配对
│       └── Settings.tsx       # 系统设置
├── src-tauri/                  # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs            # Rust 主程序
│   │   └── backend.rs         # Backend 进程管理
│   ├── tauri.conf.json        # Tauri 配置
│   └── icons/                 # 应用图标
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 主要功能

### 收银台
- 条码扫描（扫码枪或手动输入）
- 名称搜索商品（弹出选择框确认，即使只有一个结果）
- AI 视觉识别添加商品
- 购物车管理、快捷结账
- 支持离线草稿保存

### 商品管理
- 商品列表、搜索、新增、编辑、删除
- CSV 批量导入
- 库存管理
- 商品分类筛选

### AI 样本管理
- 上传商品图片
- 构建 FAISS 识别索引
- 索引状态监控

### 订单查询
- 订单列表、详情
- 订单撤销（商品自动恢复库存）
- 订单删除

### 数据分析
- 仪表盘（今日销售概览）
- 销售报表、趋势分析

### 设备配对
- 生成 QR 码供小程序扫描
- QR 码包含：服务器地址 + 连接密码 + 配对 Token
- 本地后端：显示 IP 选择器（多网卡场景）
- 远程服务器：直接使用配置的远程地址
- 已配对设备列表管理

### 系统设置
- **服务器配置**：可切换本地或远程后端服务器（输入地址、端口、密码）
- **密码保护**：进入设置需管理密码（默认 `admin`）
- **页面可见性**：控制侧边栏显示哪些页面
- **开机自启动**：Windows 开机自动启动

## 服务器配置

桌面端默认连接本地后端（`localhost:8000`），可在 **系统设置** 页面切换到远程服务器。

### 配置方式

在 **设置 → 服务器配置** 中：
1. 输入服务器地址（如 `411gwyz96414.vicp.fun`）
2. 输入端口（远程通常是 `443`，本地 `8000`）
3. 输入连接密码
4. 点击 **测试连接**，成功后 **保存**
5. 可随时点 **恢复本地默认** 切回本地

### 技术实现

配置集中在 `src/config.ts`：

```typescript
// 获取动态配置
getServerHost()    // 服务器地址
getServerPort()    // 端口
getApiKey()        // 连接密码
getApiBaseUrl()    // 完整 HTTP URL
getWsUrl()         // WebSocket URL
isLocalServer()    // 是否本地服务

// 统一的 HTTP 请求封装（自动带 URL + 密码）
apiFetch(path, options)

// 保存配置
setServerConfig(host, port, apiKey)
resetServerConfig()
```

所有页面的 API 调用都通过 `apiFetch()` 发起，自动附加服务器地址和 `X-API-Key` 请求头。

## 开发建议

- 开发时先启动后端服务
- 使用 React DevTools 调试前端
- 使用 Tauri DevTools 查看 Rust 日志
- 服务器配置保存在浏览器 `localStorage` 中
