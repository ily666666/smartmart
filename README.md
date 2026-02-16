# SmartMart AI 智能收银系统

一款集成 AI 视觉识别的智能零售收银系统，支持桌面端、微信小程序多端协同。

## 核心功能

### AI 商品识别
- 基于 **CLIP + FAISS** 的商品外观识别
- 拍照即可识别商品，无需条码
- 支持多角度商品图片学习
- **上传商品图片自动同步为 AI 样本**（无需重复上传）
- 毫秒级识别响应

### 桌面收银台
- 条码扫描 + AI 视觉双模式
- 购物车管理、快捷结账
- 搜索商品名称弹出选择框确认
- 商品管理、库存管理
- 订单查询、订单撤销
- 销售报表、数据分析
- 支持离线草稿保存
- 系统设置密码保护、页面可见性控制
- 开机自启动支持
- **可配置远程/本地服务器**（Settings 页面配置服务器地址、端口、密码）

### 微信小程序（店小蜜）
- **独立收银功能**（首页即收银台）- 扫码/搜索添加商品、购物车管理、一键结账
- 支持持续扫码模式，无需反复打开相机
- 商品浏览、搜索、详情查看
- **OCR 文字识别** - 添加商品时上传图片自动识别商品名称
- 订单列表、订单详情、撤销订单（商品可自动回到桌面端收银台）
- 采集中心（扫码录入、AI 拍照识别）
- 销售报表、数据分析
- 支持远程服务器连接（花生壳等动态域名映射）
- 无需桌面端即可独立使用

### 多端协同
- 小程序可独立连接远程服务器，也可与桌面端联动
- WebSocket 实时通信（用于桌面端同步，需扫码配对）
- 支持局域网 IP 和外网域名两种连接方式

### 双重认证体系

| 认证方式 | 用途 | 使用场景 |
|----------|------|---------|
| **API_KEY（连接密码）** | HTTP API 访问控制 | 所有客户端访问后端接口都需要密码 |
| **Token（配对令牌）** | WebSocket 联动授权 | 小程序扫桌面端二维码后获取，用于实时同步 |

- 只有密码：可以独立使用小程序收银、商品管理等
- 密码 + Token：可以额外与桌面端实时联动（撤销订单回到收银台、扫码同步等）

## 项目结构

```
SmartMartAI/
├── backend/          # Python 后端服务
│   ├── app/          # FastAPI 应用
│   │   ├── api/      # API 路由（商品、订单、报表、配对、WebSocket、AI识别等）
│   │   ├── models/   # SQLAlchemy 数据模型
│   │   ├── services/ # 业务逻辑
│   │   ├── config.py # 配置管理
│   │   ├── middleware.py # CORS + API_KEY 中间件
│   │   └── security.py  # Token 管理器
│   ├── data/         # FAISS 索引 + 样本图片
│   ├── models/       # CLIP 模型缓存
│   ├── scripts/      # 工具脚本
│   ├── Dockerfile    # Docker 镜像构建
│   └── docker-compose.yml
├── desktop/          # 桌面客户端（Tauri + React）
│   ├── src/          # React 源代码
│   │   ├── config.ts # 服务器配置 + apiFetch 封装
│   │   ├── pages/    # 页面组件
│   │   └── components/
│   └── src-tauri/    # Tauri Rust 后端
├── miniapp/          # 微信小程序（店小蜜）
│   ├── pages/
│   │   ├── index/        # 收银台（首页）
│   │   ├── products/     # 商品列表
│   │   ├── product-detail/ # 商品详情
│   │   ├── collect/      # 采集中心
│   │   ├── scan/         # 扫码录入
│   │   ├── vision/       # AI 拍照识别
│   │   ├── samples/      # AI 样本管理
│   │   ├── orders/       # 订单列表
│   │   ├── order-detail/ # 订单详情（支持撤销）
│   │   ├── data/         # 数据管理
│   │   ├── reports/      # 销售报表
│   │   ├── analysis/     # 数据分析
│   │   └── settings/     # 设置（服务器配置、扫码配对）
│   └── custom-tab-bar/   # 自定义底部导航
└── README.md
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | Python 3.11+, FastAPI, SQLAlchemy, SQLite |
| AI 识别 | CLIP (OpenAI), FAISS, PyTorch, Transformers |
| OCR 文字识别 | RapidOCR (基于 PaddleOCR, ONNX Runtime) |
| 桌面端 | Tauri, React 18, TypeScript, Vite |
| 小程序 | 微信小程序原生开发 |
| 通信 | WebSocket（设备联动）, REST API（数据操作） |

## 快速开始

### 1. 启动后端服务

```bash
cd backend

# 创建并激活 conda 环境
conda create -n smartmart python=3.11 -y
conda activate smartmart

# ===== 安装 GPU 依赖（AI 识别需要）=====

# 方式 A：通过 conda 一次装好（推荐）
conda install pytorch torchvision torchaudio pytorch-cuda=12.6 -c pytorch -c nvidia -y
conda install -c pytorch faiss-gpu -y

# 方式 B：通过 pip 装 PyTorch，conda 装 faiss
# pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu126
# conda install -c pytorch faiss-gpu -y

# 无 GPU 的机器：
# conda install pytorch torchvision torchaudio cpuonly -c pytorch -y
# conda install -c pytorch faiss-cpu -y

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

### 3. 配置微信小程序

1. 用微信开发者工具导入 `miniapp` 目录
2. 编译运行后进入 **设置** 页面
3. 输入服务器地址（如 `192.168.1.100:8000` 或 `example.vicp.fun`）
4. 输入连接密码（与后端 `API_KEY` 一致）
5. 点击 **测试连接** → **保存**

### 4. 配置 AI 识别（可选）

```bash
cd backend

# 为商品创建样本目录
python scripts/prepare_samples.py --db ./smartmart.db

# 添加商品图片到 ./data/samples/sku_XXX/ 目录（每个商品3-10张）
# 💡 提示：上传商品图片时会自动复制一份到 AI 样本目录，无需手动重复操作

# 构建 AI 索引
python scripts/build_index.py
```

> **自动同步说明**：当你在商品管理中上传/更新商品图片时，系统会自动将该图片复制到对应的 AI 样本目录（`data/samples/sku_XXX/`）。这意味着商品图片会自动成为 AI 识别训练的一张样本，你只需额外补充几张不同角度的照片即可达到最佳识别效果。

## Docker 部署（GPU）

适用于有 NVIDIA GPU 的 Linux 服务器，一键启动后端服务。

### 前置条件

- Docker 和 Docker Compose
- NVIDIA 驱动已安装
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) 已安装

### 快速启动

```bash
cd backend

# 首次启动前，创建空数据库文件（避免 Docker 把它当目录）
touch smartmart.db

# 构建并启动（首次构建约 10-20 分钟）
docker compose up -d

# 查看日志
docker compose logs -f
```

### 常用命令

```bash
# ---- 日常操作 ----
docker compose up -d              # 启动（后台运行）
docker compose down               # 停止
docker compose restart            # 重启
docker compose up -d --build      # 代码改了，重新构建并启动

# ---- 查看状态 ----
docker compose ps                 # 看容器是否在运行
docker compose logs -f            # 看实时日志（Ctrl+C 退出）
docker compose logs --tail 100    # 看最后 100 行日志
docker stats smartmart-backend    # 看 CPU / 内存 / GPU 占用

# ---- 进入容器 ----
docker exec -it smartmart-backend bash          # 进容器命令行
docker exec smartmart-backend nvidia-smi        # 看 GPU 是否被识别

# ---- 清理 ----
docker compose down               # 停止并删除容器（不删镜像，数据不丢）
docker compose down --rmi local   # 同时删除镜像（下次要重新构建）
docker image prune -f             # 清理无用悬空镜像，释放磁盘

# ---- 数据备份 ----
cp smartmart.db smartmart.db.bak  # 备份数据库
tar czf smartmart-backup-$(date +%Y%m%d).tar.gz smartmart.db data/ static/ uploads/
```

### 环境变量配置

```bash
# 创建 .env 文件（推荐）
cat > .env << EOF
API_KEY=my_secret
WARMUP_AI=true
DEBUG=false
EOF
docker compose up -d

# 或直接在命令行传入
API_KEY=my_secret WARMUP_AI=false docker compose up -d
```

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `API_KEY` | `smartmart2026` | 连接密码，客户端和小程序需填此密码 |
| `WARMUP_AI` | `true` | 启动时预热 AI 模型（`false` 则首次识别时才加载） |
| `CLIP_MODEL_NAME` | `openai/clip-vit-base-patch32` | CLIP 模型名称 |
| `DEBUG` | `false` | 调试模式 |
| `TZ` | `Asia/Shanghai` | 容器时区 |

### 数据持久化

以下通过 volume 挂载到宿主机，容器重建不丢数据：

| 挂载路径 | 说明 |
|----------|------|
| `./smartmart.db` | SQLite 数据库（首次启动前需 `touch smartmart.db`） |
| `./data` | FAISS 索引 + 样本图片 |
| `./models` | CLIP 模型缓存（~350MB，首次启动自动下载） |
| `./static` | 商品图片 |
| `./uploads` | 上传文件 |

### 故障排查

```bash
# 容器起不来，看完整日志
docker compose logs --no-log-prefix

# 看容器健康状态
docker inspect smartmart-backend --format='{{.State.Health.Status}}'

# 数据库打不开 → 检查宿主机上 smartmart.db 是文件不是目录
ls -la smartmart.db
# 如果是目录，删掉重建：rm -rf smartmart.db && touch smartmart.db
```

## 打包发布

将项目打包成 Windows 安装包。

### 前置条件

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Python | 3.11+ | Backend 运行 |
| Node.js | 18+ | Desktop 前端 |
| Rust | Latest | Tauri 编译 |
| PyInstaller | Latest | Backend 打包 |

### 打包步骤

```bash
# 1. 打包后端
cd backend
pip install pyinstaller
python build_exe.py
# 生成 dist/smartmart-backend.exe

# 2. 复制到桌面端目录
copy backend\dist\smartmart-backend.exe desktop\src-tauri\

# 3. 打包桌面端
cd desktop
npm install
npm run tauri build
```

安装包位于 `desktop/src-tauri/target/release/bundle/`：
- **NSIS**: `nsis/SmartMart_*-setup.exe`（推荐）
- **MSI**: `msi/SmartMart_*.msi`（企业部署）

## 小程序使用说明

### 首次配置
1. 打开小程序，点击底部 **设置** 标签
2. 输入服务器地址（支持格式：`example.vicp.fun`、`192.168.1.100:8000`、`http://...`）
3. 输入 **连接密码**（与后端 `API_KEY` 一致）
4. 点击 **测试连接** → **保存**

### 收银功能（首页）
- 扫描商品条码或搜索名称，添加到购物车
- 支持持续扫码模式
- 搜索结果弹出选择框确认（即使只有一个结果）
- 调整数量，点击 **结账** 完成交易

### 与桌面端联动（可选）
- 在设置页面点击 **扫码配对桌面端**
- 扫描桌面端"设备配对"页面显示的二维码
- 扫码后自动更新：服务器地址 + 连接密码 + 配对 Token
- 配对后，撤销订单的商品会自动回到桌面端收银台

### 采集功能
- 采集中心：扫码录入、AI 拍照识别
- 需要与桌面端 WebSocket 连接才能实时同步
- 未连接桌面端时会提示

## API 连接密码

后端支持设置连接密码，防止他人通过外网访问数据。

### 设置密码

在 `backend/app/config.py` 中：

```python
API_KEY = os.getenv("API_KEY", "你的密码")  # 设置密码
API_KEY = os.getenv("API_KEY", "")           # 不需要密码
```

或通过环境变量：

```bash
API_KEY=my_secret uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 工作原理

| 场景 | 行为 |
|------|------|
| `API_KEY` 为空 | 所有请求正常通过，无需密码 |
| `API_KEY` 已设置 | 请求必须携带 `X-API-Key` 请求头 |
| `/health` 接口 | 始终不需要密码（用于连接测试） |
| WebSocket | 桌面端免密，小程序需 Token 配对 |

## 设备配对流程

```
桌面端"设备配对"页面                      小程序"设置"页面
         │                                       │
         │  1. 调用后端 /generate_pairing_code    │
         │     获取一次性 Token（5分钟有效）       │
         │                                       │
         │  2. 生成 QR 码：                      │
         │     { server_url, api_key, token }     │
         │     (本地后端用局域网IP，远程用配置地址)  │
         │                                       │
         │  ──── 小程序扫码 ────────────────────→ │
         │                                       │
         │                  3. 自动保存：          │
         │                     - 服务器地址        │
         │                     - 连接密码          │
         │                     - 配对 Token        │
         │                                       │
         │                  4. 测试连接 → 连 WebSocket
         │                     用 Token 注册       │
         │                                       │
         │  ←── WebSocket 实时联动 ──────────────→│
```

## 详细文档

- [后端文档](./backend/README.md) - API 接口、AI 配置、Docker 部署
- [桌面端文档](./desktop/README.md) - 客户端开发、服务器配置
- [小程序文档](./miniapp/README.md) - 微信小程序配置和使用
- [AI 识别指南](./backend/AI_README.md) - 商品识别功能详解

## 系统要求

### 后端服务
- Python 3.11+
- 4GB+ 内存（AI 识别需要加载模型）
- GPU 推荐（CUDA 12.x，AI 识别加速）
- 支持 Windows / macOS / Linux

### 桌面客户端
- Node.js 18+、Rust 工具链
- Windows 10+ / macOS 10.15+ / Linux

### 微信小程序
- 微信开发者工具
- 微信小程序 AppID
- 若使用外网域名需在微信后台配置合法域名

## 许可证

MIT License
