# SmartMart Backend

基于 FastAPI 的后端 API 服务，集成 CLIP + FAISS 商品外观识别功能。

一个服务包含所有功能：商品管理、订单、报表、设备配对、WebSocket 通信、AI 识别。

## 技术栈

- Python 3.11+
- FastAPI（Web 框架）
- SQLAlchemy（ORM）
- SQLite（数据库）
- Conda / uv（包管理器）
- WebSocket（设备联动通信）
- CLIP + FAISS（AI 商品识别）
- PyTorch + Transformers（深度学习）

## 安装依赖

### 方式一：Conda（推荐）

```bash
cd backend

# 创建 conda 虚拟环境
conda create -n smartmart python=3.11 -y
conda activate smartmart

# ===== GPU 依赖（AI 识别需要）=====

# 方式 A：conda 一次装好 PyTorch + faiss（推荐）
conda install pytorch torchvision torchaudio pytorch-cuda=12.6 -c pytorch -c nvidia -y
conda install -c pytorch faiss-gpu -y

# 方式 B：pip 装 PyTorch，conda 装 faiss
# pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu126
# conda install -c pytorch faiss-gpu -y

# 无 GPU 的机器：
# conda install pytorch torchvision torchaudio cpuonly -c pytorch -y
# conda install -c pytorch faiss-cpu -y

# 安装其他依赖
pip install -e .
```

### 方式二：uv

```bash
cd backend
# 安装 uv（如未安装）
# Windows: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
# macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh

uv sync
```

> 注意：`faiss-gpu` 无法通过 pip 安装，必须用 conda。如果用 uv/pip 安装其他依赖，faiss 仍需 conda 单独装。

## 启动服务

```bash
conda activate smartmart

# 启动（绑定 0.0.0.0 允许局域网/外网访问）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 或用 uv
# uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

启动成功后访问 http://localhost:8000/docs 查看 API 文档。

## Docker 部署（GPU）

适用于有 NVIDIA GPU 的 Linux 服务器。

### 前置条件

- Docker 和 Docker Compose
- NVIDIA 驱动已安装
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

### 启动

```bash
cd backend

# 首次启动前创建空数据库文件
touch smartmart.db

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
| `API_KEY` | `smartmart2026` | 连接密码，为空则不需要密码 |
| `WARMUP_AI` | `true` | 启动时预热 AI 模型 |
| `CLIP_MODEL_NAME` | `openai/clip-vit-base-patch32` | CLIP 模型名称 |
| `DEBUG` | `false` | 调试模式 |
| `TZ` | `Asia/Shanghai` | 容器时区 |

```bash
# 通过 .env 文件配置（推荐）
cat > .env << EOF
API_KEY=my_secret
WARMUP_AI=true
EOF
docker compose up -d
```

### 数据持久化

数据通过 volume 挂载，容器重建不丢失：

| 路径 | 说明 |
|------|------|
| `./smartmart.db` | SQLite 数据库 |
| `./data` | FAISS 索引 + 样本图片 |
| `./models` | CLIP 模型缓存（~350MB） |
| `./static` | 商品图片 |
| `./uploads` | 上传文件 |

## 配置说明

配置文件：`app/config.py`

```python
# 连接密码（为空则不校验）
API_KEY = os.getenv("API_KEY", "smartmart2026")

# AI 模型预热（true = 启动时加载模型，false = 首次识别时加载）
WARMUP_AI = os.getenv("WARMUP_AI", "true").lower() == "true"
```

## 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── middleware.py         # CORS + API_KEY 认证中间件
│   ├── security.py          # Token 管理器（配对令牌）
│   ├── models/              # SQLAlchemy 模型
│   │   ├── product.py       # 商品
│   │   ├── inventory.py     # 库存
│   │   ├── transaction.py   # 订单
│   │   ├── device.py        # 设备
│   │   └── settings.py      # 系统设置
│   └── api/                 # API 路由
│       ├── products.py      # 商品接口
│       ├── orders.py        # 订单接口（含撤销）
│       ├── reports.py       # 销售报表
│       ├── database.py      # 数据库管理
│       ├── settings.py      # 系统设置
│       ├── recognition.py   # AI 识别接口
│       ├── samples.py       # AI 样本管理
│       ├── pairing.py       # 设备配对（Token 生成 + 设备管理）
│       └── websocket_api.py # WebSocket 通信
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── README.md
```

## API 概览

启动后详细文档见 http://localhost:8000/docs

### 商品
- `GET /products/` — 商品列表（支持分页、分类筛选）
- `GET /products/by_barcode?code=xxx` — 条码查询
- `GET /products/search?q=xxx` — 模糊搜索（精确匹配/模糊匹配）
- `POST /products/` — 创建商品
- `PUT /products/{id}` — 更新商品
- `DELETE /products/{id}` — 删除商品
- `POST /products/import_csv` — CSV 批量导入
- `GET /products/categories` — 获取所有分类

### 订单
- `POST /orders/create` — 创建订单
- `GET /orders/list` — 订单列表
- `GET /orders/{id}` — 订单详情
- `POST /orders/{id}/revoke` — 撤销订单（恢复库存，返回商品列表）
- `DELETE /orders/{id}` — 删除订单

### 设备配对
- `POST /pairing/generate_pairing_code` — 生成配对 Token + 本机局域网 IP
- `GET /pairing/devices` — 已配对设备列表
- `DELETE /pairing/devices/{device_id}` — 删除设备

### AI 识别
- `POST /api/recognition/recognize` — 图像识别
- `GET /api/recognition/status` — AI 状态
- `POST /api/recognition/preload` — 预加载模型

### 其他
- `GET /health` — 健康检查（不需要密码）
- `GET /reports/*` — 销售报表
- `GET/PUT /settings` — 系统设置

## WebSocket 通信

连接端点：`ws://host:port/ws`

### 认证机制

| 设备类型 | 认证方式 | 说明 |
|----------|---------|------|
| 桌面端（`desktop`） | 无需认证 | 直接注册 |
| 小程序（`miniapp`） | Token 验证 | 首次需配对 Token，认证后重连免验证 |

### 消息类型

**注册**：
```json
{ "type": "REGISTER", "device_id": "xxx", "device_type": "miniapp", "token": "xxx" }
```

**扫码**：
```json
{ "type": "SCAN_BARCODE", "code": "6901028075831", "device_id": "xxx" }
```

**添加商品**（撤销订单时小程序发送）：
```json
{ "type": "ADD_ITEM", "sku_id": 1, "qty": 2, "source": "order_revoke", "device_id": "xxx" }
```

**服务端广播**：`PRODUCT_FOUND`、`PRODUCT_NOT_FOUND`、`ADD_ITEM_SUCCESS`、`ADD_ITEM_FAILED`

## AI 识别

详见 [AI_README.md](./AI_README.md)

```bash
# 1. 准备样本目录
python scripts/prepare_samples.py --db ./smartmart.db

# 2. 添加商品图片到 ./data/samples/sku_XXX/

# 3. 构建 FAISS 索引
python scripts/build_index.py

# 4. 启动服务，AI 识别自动可用
```
