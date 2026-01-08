# SmartMart Backend - AI 识别模块

## 概述

本后端已集成 CLIP + FAISS 商品外观识别功能。无需单独启动 AI 服务，所有功能都在一个服务中运行。

## 架构

```
backend/
├── app/
│   ├── services/
│   │   ├── clip_embedder.py    # CLIP 特征提取
│   │   ├── faiss_manager.py    # FAISS 索引管理
│   │   └── vision_service.py   # 视觉识别服务（集成 AI）
│   └── api/
│       ├── vision.py           # 外观识别 API（小程序调用）
│       └── recognition.py      # AI 识别 API（直接调用）
├── scripts/
│   ├── prepare_samples.py      # 准备样本目录
│   ├── build_index.py          # 构建 FAISS 索引
│   ├── infer.py                # 命令行推理工具
│   └── evaluate.py             # 准确率评估
└── data/
    ├── samples/                # 商品样本图片
    │   ├── sku_001/
    │   ├── sku_002/
    │   └── ...
    └── index/                  # FAISS 索引文件
        ├── products.index
        └── products_metadata.json
```

## 快速开始

### 1. 安装依赖

**使用 Conda（推荐）：**
```powershell
cd backend

# 创建并激活环境
conda create -n smartmart python=3.11 -y
conda activate smartmart

# 安装 PyTorch
conda install pytorch torchvision cpuonly -c pytorch -y
# 如有 GPU：conda install pytorch torchvision pytorch-cuda=11.8 -c pytorch -c nvidia -y

# 安装其他依赖
pip install -e .
```

**使用 uv：**
```powershell
cd backend
uv sync
```

### 2. 准备商品样本

```powershell
# 生成样本目录结构
python scripts/prepare_samples.py --db ./smartmart.db --output ./data/samples
```

然后为每个 SKU 目录添加商品图片（每个 SKU 建议 3-10 张）。

### 3. 构建 FAISS 索引

```powershell
# 构建索引（首次运行会下载 CLIP 模型，约 350MB）
python scripts/build_index.py --samples_dir ./data/samples --output_dir ./data/index
```

### 4. 启动服务

```powershell
# 确保已激活 conda 环境
conda activate smartmart

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后，AI 模型会在首次识别请求时延迟加载。

## API 接口

### 外观识别（小程序调用）

```
POST /vision/query
```

- 上传图片
- 返回 Top-K 候选商品列表
- 记录识别样本到数据库

### AI 识别（直接调用）

```
POST /api/recognition/recognize
```

- 纯粹的 AI 识别接口
- 返回 Top-K 相似商品

### AI 状态

```
GET /api/recognition/status
```

- 查看模型是否已加载
- 查看索引统计信息

### 预加载模型

```
POST /api/recognition/preload
```

- 手动预加载模型
- 避免首次请求等待

## 配置

环境变量配置（可在 `.env` 文件中设置）：

```env
# CLIP 模型
CLIP_MODEL_NAME=openai/clip-vit-base-patch32
MODEL_CACHE_DIR=./models

# FAISS 索引
FAISS_INDEX_PATH=./data/index/products.index
FAISS_METADATA_PATH=./data/index/products_metadata.json

# 样本目录
SAMPLES_DIR=./data/samples
```

## 模型选择

| 模型 | 特征维度 | 大小 | 速度 | 精度 |
|------|----------|------|------|------|
| openai/clip-vit-base-patch32 | 512 | ~350MB | 快 | 高 |
| openai/clip-vit-large-patch14 | 768 | ~890MB | 慢 | 更高 |

默认使用 `clip-vit-base-patch32`，适合大多数场景。

## 命令行工具

### 单图推理测试

```powershell
python scripts/infer.py --image ./test.jpg --top_k 5
```

### 评估识别准确率

```powershell
python scripts/evaluate.py --db ./smartmart.db --errors
```

### 检查样本状态

```powershell
python scripts/prepare_samples.py --check
```

## 注意事项

1. **首次启动较慢** - 需要下载 CLIP 模型（~350MB），之后会缓存到 `./models` 目录
2. **内存占用** - 模型加载后约占用 500MB 内存
3. **索引未构建时** - 会自动降级到随机选择的占位实现
4. **GPU 加速** - 如有 NVIDIA GPU，会自动使用 CUDA 加速

## 故障排除

### 模型下载失败

如果网络问题导致模型下载失败，可以：
1. 使用代理
2. 手动下载模型到 `./models` 目录

### 索引加载失败

确保先运行 `build_index.py` 构建索引。

### 内存不足

尝试使用更小的批次大小：
```powershell
python scripts/build_index.py --batch_size 8
```

