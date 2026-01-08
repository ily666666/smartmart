# SmartMart AI 智能收银系统

🛒 一款集成 AI 视觉识别的智能零售收银系统，支持桌面端、微信小程序多端协同。

## ✨ 核心功能

### 🤖 AI 商品识别
- 基于 **CLIP + FAISS** 的商品外观识别
- 拍照即可识别商品，无需条码
- 支持多角度商品图片学习
- 毫秒级识别响应

### 💻 桌面收银台
- 条码扫描 + AI 视觉双模式
- 购物车管理、快捷结账
- 商品管理、库存管理
- 订单查询、销售报表
- 支持离线草稿保存

### 📱 微信小程序
- 扫码/拍照识别商品
- 与桌面端实时联动
- 移动便携，随时使用

### 🔗 多端协同
- WebSocket 实时通信
- 小程序扫码，桌面端自动添加商品
- 局域网内即可使用，无需外网

## 🏗️ 项目结构

```
SmartMartAI/
├── backend/          # Python 后端服务
│   ├── app/          # FastAPI 应用
│   ├── data/         # 样本数据和索引
│   ├── models/       # CLIP 模型缓存
│   └── scripts/      # 工具脚本
├── desktop/          # 桌面客户端
│   ├── src/          # React 源代码
│   └── src-tauri/    # Tauri Rust 后端
├── miniapp/          # 微信小程序
│   └── pages/        # 小程序页面
└── README.md         # 本文件
```

## 🛠️ 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | Python 3.11+, FastAPI, SQLAlchemy, SQLite |
| AI 识别 | CLIP (OpenAI), FAISS, PyTorch |
| 桌面端 | Tauri, React 18, TypeScript, Vite |
| 小程序 | 微信小程序原生开发 |
| 通信 | WebSocket, REST API |

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd backend

# 创建并激活 conda 环境
conda create -n smartmart python=3.11 -y
conda activate smartmart

# 安装 PyTorch
conda install pytorch torchvision cpuonly -c pytorch -y

# 安装依赖
pip install -e .

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 启动桌面客户端

```bash
cd desktop

# 安装依赖
npm install

# 开发模式
npm run tauri:dev

# 或构建生产版本
npm run tauri:build
```

### 3. 配置 AI 识别（可选）

```bash
cd backend

# 为商品创建样本目录
python scripts/prepare_samples.py --db ./smartmart.db

# 添加商品图片到 ./data/samples/sku_XXX/ 目录（每个商品3-10张）

# 构建 AI 索引
python scripts/build_index.py
```

## 📦 打包发布

将项目打包成 Windows 安装包，双击即可安装使用。

### 前置条件

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Python | 3.11+ | Backend 运行 |
| Node.js | 18+ | Desktop 前端 |
| Rust | Latest | Tauri 编译 |
| PyInstaller | Latest | Backend 打包 |

```bash
# 安装 PyInstaller
cd backend
pip install pyinstaller
```

### 打包步骤

#### 步骤 1: 打包 Backend

```bash
cd backend
python build_exe.py
```

等待完成，生成 `dist\smartmart-backend.exe`

#### 步骤 2: 复制 Backend.exe

```bash
copy backend\dist\smartmart-backend.exe desktop\src-tauri\
```

#### 步骤 3: 打包 Desktop

```bash
cd desktop
npm install
npm run tauri build
```

首次编译约 10-15 分钟。

### 生成的安装包

打包完成后，安装包位于：

| 格式 | 路径 | 说明 |
|------|------|------|
| **NSIS** | `desktop/src-tauri/target/release/bundle/nsis/SmartMart_*-setup.exe` | 推荐，双击安装 |
| **MSI** | `desktop/src-tauri/target/release/bundle/msi/SmartMart_*.msi` | 企业部署用 |

### 安装和使用

1. 双击安装包，按向导完成安装
2. 首次运行时允许防火墙访问（端口 8000）
3. 启动 SmartMart，后端自动运行
4. 如需小程序连接，运行 `add_firewall_rule.ps1` 开放防火墙

### 注意事项

- 安装包约 200-500MB（包含 AI 依赖）
- 首次启动会自动创建数据库和必要目录
- 数据保存在安装目录下，卸载前注意备份

## 📖 详细文档

- [后端文档](./backend/README.md) - API 接口、AI 配置说明
- [桌面端文档](./desktop/README.md) - 客户端开发和构建
- [小程序文档](./miniapp/README.md) - 微信小程序配置
- [AI 识别指南](./backend/AI_README.md) - 商品识别功能详解
- [部署指南](./DEPLOYMENT_GUIDE.md) - 生产环境部署

## 🖥️ 系统要求

### 后端服务
- Python 3.11+
- 4GB+ 内存（AI 识别需要加载模型）
- 支持 Windows / macOS / Linux

### 桌面客户端
- Node.js 18+
- Rust 工具链
- Windows 10+ / macOS 10.15+ / Linux

### 微信小程序
- 微信开发者工具
- 微信小程序 AppID

## 📸 功能截图

### 收银台
- 扫码添加商品
- AI 视觉识别
- 快捷结账

### 商品管理
- 商品列表、搜索
- 批量导入
- 库存管理

### AI 样本管理
- 上传商品图片
- 构建识别索引
- 索引状态监控

### 订单查询
- 订单列表、详情
- 订单撤销、删除
- 销售统计

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
