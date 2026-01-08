# SmartMart Desktop

基于 Tauri + React + TypeScript 的桌面收银客户端。

## 技术栈

- Tauri 1.5 (桌面框架)
- React 18 (UI 框架)
- TypeScript (类型安全)
- Vite (构建工具)
- WebSocket (与后端实时通信)

## 前置要求

### 1. 安装 Rust

```bash
# Windows
# 下载并安装: https://rustup.rs/

# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. 安装 Node.js

需要 Node.js 18 或更高版本。

## 安装依赖

```bash
cd desktop
npm install
```

## 开发模式

```bash
# 启动开发服务器
npm run tauri:dev

# 或分步骤
npm run dev          # 启动 Vite 开发服务器
npm run tauri dev    # 启动 Tauri 开发模式
```

## 构建生产版本

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/`

## 项目结构

```
desktop/
├── src/                    # React 源代码
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # 应用入口
│   ├── App.css            # 样式
│   └── components/        # React 组件
│       ├── Scanner.tsx    # 扫码组件
│       ├── Cart.tsx       # 购物车组件
│       ├── Checkout.tsx   # 结账组件
│       └── ProductList.tsx # 商品列表
├── src-tauri/             # Tauri Rust 后端
│   ├── src/
│   │   └── main.rs        # Rust 主程序
│   ├── tauri.conf.json    # Tauri 配置
│   ├── Cargo.toml         # Rust 依赖
│   └── icons/             # 应用图标
├── index.html             # HTML 入口
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
├── package.json           # npm 配置
└── README.md              # 本文件
```

## 主要功能

1. **扫码收银**: 条码扫描，添加商品到购物车
2. **购物车管理**: 增删改商品，计算总价
3. **结账支付**: 支持多种支付方式
4. **商品管理**: 商品列表、搜索、编辑
5. **WebSocket 通信**: 接收小程序扫码/拍照数据
6. **本地存储**: 离线数据缓存

## 配置

后端 API 地址配置在 `src/config.ts` 中：

```typescript
export const API_BASE_URL = "http://localhost:8000";
export const WS_URL = "ws://localhost:8000/ws";
```

## 开发建议

- 使用 React DevTools 调试
- 使用 Tauri DevTools 查看 Rust 日志
- 开发时先启动后端服务


