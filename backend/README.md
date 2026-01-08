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

# 安装 PyTorch（根据你的硬件选择）
# CPU 版本：
conda install pytorch torchvision cpuonly -c pytorch -y
# GPU 版本（CUDA 11.8）：
# conda install pytorch torchvision pytorch-cuda=11.8 -c pytorch -c nvidia -y

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
│   │   └── transaction.py   # 交易模型
│   ├── schemas/             # Pydantic 模式
│   │   └── __init__.py
│   ├── api/                 # API 路由
│   │   ├── __init__.py
│   │   ├── products.py      # 商品接口
│   │   ├── inventory.py     # 库存接口
│   │   ├── cashier.py       # 收银接口
│   │   └── websocket.py     # WebSocket 接口
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

