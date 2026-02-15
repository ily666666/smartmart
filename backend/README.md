# SmartMart Backend - 集成 AI 识别

基于 FastAPI 的后端 API 服务，**已集成 CLIP + FAISS 商品外观识别功能**。

**🎯 一个服务包含所有功能：商品管理、订单、报表、AI 识别！**

## 技术栈

- Python 3.11+
- FastAPI (Web 框架)
- SQLAlchemy (ORM)
- SQLite (数据库)
- Conda / uv (包管理器)
- WebSocket (实时通信)
- **CLIP + FAISS (AI 商品识别)**
- PyTorch + Transformers (深度学习)

## 安装依赖

### 方式一：使用 Conda（推荐）

```bash
cd backend

# 创建 conda 虚拟环境
conda create -n smartmart python=3.11 -y

# 激活环境
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
```

### 方式二：使用 uv

```bash
cd backend

# 安装 uv（如未安装）
# Windows: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
# macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh

# 同步依赖
uv sync
```

## 🐳 Docker 部署（GPU）

适用于有 NVIDIA GPU 的 Linux 服务器。

### 前置条件

- Docker 和 Docker Compose
- NVIDIA 驱动已安装
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

### 启动

```bash
# 构建并启动（首次约 10-20 分钟）
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down

# 重新构建（代码更新后）
docker compose up -d --build
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_KEY` | `smartmart2026` | API 连接密码，为空则不需要密码 |
| `DEBUG` | `false` | 调试模式 |
| `CLIP_MODEL_NAME` | `openai/clip-vit-base-patch32` | CLIP 模型名称 |

```bash
# 通过 .env 文件配置
echo "API_KEY=my_secret" > .env
docker compose up -d
```

### 数据持久化

数据通过 volume 挂载，容器重建不丢失：

- `./data` — FAISS 索引 + 样本图片
- `./models` — CLIP 模型缓存（~350MB，首次自动下载）
- `./static` — 商品图片
- `./uploads` — 上传文件
- `./smartmart.db` — SQLite 数据库

## 🚀 启动服务

```bash
# 确保已激活环境（conda activate smartmart）

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 uv（如果用 uv 安装）
# uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ 启动成功后访问 http://localhost:8000/docs 查看 API 文档

**详细启动步骤请查看 [SETUP.md](./SETUP.md)**

## API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models/              # SQLAlchemy 模型
│   │   ├── __init__.py
│   │   ├── product.py       # 商品模型
│   │   ├── inventory.py     # 库存模型
│   │   ├── transaction.py   # 交易模型
│   │   └── settings.py      # 系统设置模型
│   ├── schemas/             # Pydantic 模式
│   │   └── __init__.py
│   ├── api/                 # API 路由
│   │   ├── __init__.py
│   │   ├── products.py      # 商品接口
│   │   ├── orders.py        # 订单接口
│   │   ├── reports.py       # 报表接口
│   │   ├── database.py      # 数据库管理接口
│   │   ├── settings.py      # 系统设置接口
│   │   ├── recognition.py   # AI 识别接口
│   │   ├── samples.py       # AI 样本接口
│   │   ├── pairing.py       # 设备配对接口
│   │   └── websocket_api.py # WebSocket 接口
│   └── services/            # 业务逻辑
│       └── __init__.py
├── pyproject.toml           # 项目配置
└── README.md                # 本文件
```

## ✅ MVP 功能清单

### 1. 数据库表结构
- ✅ `products` - 商品表（id, barcode, name, price, stock）
- ✅ `orders` - 订单表
- ✅ `order_items` - 订单明细表
- ✅ `inventory_moves` - 库存变动表
- ✅ `devices` - 设备表
- ✅ `system_settings` - 系统设置表（密码、密保、页面可见性）

### 2. REST API
- ✅ `GET /products/by_barcode?code=xxxx` - 根据条码查询商品
  - 返回: `{sku_id, barcode, name, price, stock}`
- ✅ `POST /products/import_csv` - 批量导入商品（CSV）
  - 格式: `barcode,name,price`
- ✅ `GET /products/` - 获取商品列表
- ✅ `POST /products/` - 创建单个商品

### 3. WebSocket 通信
- ✅ `ws://localhost:8000/ws` - WebSocket 连接端点

**支持的消息**:

客户端发送（扫码事件）:
```json
{
  "type": "SCAN_BARCODE",
  "code": "6901028075831",
  "device_id": "desktop-001",
  "ts": 1234567890
}
```

服务端广播（商品找到）:
```json
{
  "type": "PRODUCT_FOUND",
  "sku_id": 1,
  "name": "可口可乐",
  "price": 3.50,
  "code": "6901028075831",
  "source": "desktop-001",
  "ts": 1234567890
}
```

服务端广播（商品未找到）:
```json
{
  "type": "PRODUCT_NOT_FOUND",
  "code": "123456",
  "source": "desktop-001",
  "ts": 1234567890
}
```

### 4. 局域网配置
- ✅ CORS 允许所有来源（适合局域网开发）
- ✅ 绑定 `0.0.0.0` 支持局域网访问
- ✅ 防火墙配置说明（见 SETUP.md）

## 🤖 AI 识别功能

本服务已集成商品外观识别功能，详见 [AI_README.md](./AI_README.md)。

### 快速使用

```powershell
# 确保已激活 conda 环境
conda activate smartmart

# 1. 准备样本目录
python scripts/prepare_samples.py --db ./smartmart.db

# 2. 添加商品图片到 ./data/samples/sku_XXX/ 目录

# 3. 构建 FAISS 索引（首次运行会下载 CLIP 模型 ~350MB）
python scripts/build_index.py

# 4. 启动服务，AI 识别自动可用
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### AI API

- `POST /api/recognition/recognize` - 图像识别
- `GET /api/recognition/status` - AI 状态
- `POST /api/recognition/preload` - 预加载模型

### 系统设置 API

- `GET /settings` - 获取系统设置
- `PUT /settings` - 更新系统设置
- `POST /settings/verify-password` - 验证密码
- `POST /settings/reset-password` - 通过密保重置密码
- `POST /settings/reset-to-default` - 重置为默认密码

## 🧪 测试文件

- `test_products.csv` - 测试用的商品 CSV 文件
- `test_websocket.py` - WebSocket 测试脚本

## 🔥 快速测试

### 测试 API
```bash
# 查询商品
curl "http://localhost:8000/products/by_barcode?code=6901028075831"

# 或使用 PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/products/by_barcode?code=6901028075831"
```

### 测试 WebSocket
```bash
# 安装 websockets（如未安装）
pip install websockets

# 运行测试脚本
python test_websocket.py
```

### 导入测试数据
访问 http://localhost:8000/docs，找到 `/products/import_csv` 接口，上传 `test_products.csv`

