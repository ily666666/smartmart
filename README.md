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
- 🔐 系统设置密码保护
- 👁️ 页面可见性控制
- 🚀 开机自启动支持

### 📱 微信小程序
- **独立收银功能** - 扫码添加商品、购物车管理、一键结账
- 支持远程服务器连接（花生壳等动态域名映射）
- 扫码/拍照识别商品
- 无需开启桌面端即可独立使用
- 移动便携，随时使用

### 🔗 多端协同
- 小程序可独立连接远程服务器，也可与桌面端协同
- WebSocket 实时通信（可选，用于桌面端同步）
- 支持局域网 IP 和外网域名两种连接方式

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
│   ├── pages/        # 小程序页面
│   │   ├── index/    # 收银台（首页）
│   │   ├── settings/ # 设置（服务器配置）
│   │   └── ...       # 其他功能页面
│   └── custom-tab-bar/ # 自定义底部导航
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

# 方式 A：通过 conda 一次装好 PyTorch + faiss（推荐）
# GPU 服务器：
conda install pytorch torchvision torchaudio pytorch-cuda=12.6 -c pytorch -c nvidia -y
conda install -c pytorch faiss-gpu -y
# 无 GPU 的机器：
# conda install pytorch torchvision torchaudio cpuonly -c pytorch -y
# conda install -c pytorch faiss-cpu -y

# 方式 B：通过 pip 装 PyTorch，conda 装 faiss
# pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu126
# conda install -c pytorch faiss-gpu -y

# 安装其他依赖
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

## 🐳 Docker 部署（GPU）

适用于有 NVIDIA GPU 的 Linux 服务器，一键启动后端服务。

### 前置条件

- Docker 和 Docker Compose
- NVIDIA 驱动已安装
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) 已安装

### 快速启动

```bash
cd backend

# 构建并启动（首次构建约 10-20 分钟）
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 自定义配置

通过环境变量覆盖默认配置：

```bash
# 修改 API 密码
API_KEY=my_secret docker compose up -d

# 或者创建 .env 文件
echo "API_KEY=my_secret" > .env
docker compose up -d
```

### 数据持久化

以下目录通过 volume 挂载到宿主机，容器重建不丢数据：

| 挂载路径 | 说明 |
|----------|------|
| `./data` | FAISS 索引 + 样本图片 |
| `./models` | CLIP 模型缓存（~350MB，首次启动自动下载） |
| `./static` | 商品图片 |
| `./uploads` | 上传文件 |
| `./smartmart.db` | SQLite 数据库 |

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

## 📱 小程序使用说明

### 首次配置
1. 在微信开发者工具或手机中打开小程序
2. 点击底部 **设置** 标签
3. 输入服务器地址（支持以下格式）：
   - 花生壳域名：`example.oicp.net:12345`
   - 局域网 IP：`192.168.1.100:8000`
   - 带协议的地址：`http://example.oicp.net:12345`
4. 如果服务器设置了连接密码，还需要输入 **连接密码**
5. 点击 **测试连接** 确认可达，然后 **保存**
6. 回到 **收银** 标签即可开始使用

### 收银功能
- 扫描商品条码或输入名称搜索，自动添加到购物车
- 调整商品数量，点击 **结账** 完成交易
- 订单自动同步到后端服务器

### 桌面端同步（可选）
- 在设置页面点击 **扫码配对桌面端**
- 扫描桌面端显示的二维码即可建立实时连接
- 连接后，小程序扫码会同步到桌面端收银台

## 🔐 API 连接密码

后端支持设置连接密码，防止他人通过外网地址访问你的数据。

### 设置密码

在 `backend/app/config.py` 中修改 `API_KEY`：

```python
# 设置密码（改成你自己的）
API_KEY = os.getenv("API_KEY", "你的密码")

# 不需要密码（留空即可）
API_KEY = os.getenv("API_KEY", "")
```

也可以通过环境变量覆盖，不用改代码：

```bash
API_KEY=my_secret uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 工作原理

| 场景 | 行为 |
|------|------|
| `API_KEY` 为空 | 所有请求正常通过，无需密码 |
| `API_KEY` 已设置 | 请求必须携带 `X-API-Key` 请求头，密码错误返回 401 |
| `/health` 接口 | 始终不需要密码，用于检测服务器是否可达 |

### 小程序端

在小程序 **设置** 页面输入服务器地址时一并输入连接密码，小程序会自动在每个请求中带上密码。

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
