# AI 外观识别系统 - 完整实现指南

## 🎯 系统架构

```
样本图片目录
    ↓ (build_index.py)
提取特征 (CLIP)
    ↓
构建 FAISS 索引
    ↓
查询图片
    ↓ (infer.py)
提取特征
    ↓
FAISS 检索
    ↓
返回 Top-K
```

## 📦 Embedding 模型选择

### 方案对比

| 模型 | 特征维度 | 大小 | 速度 | 精度 | 推荐场景 |
|------|---------|------|------|------|----------|
| **CLIP-ViT-B/32** (推荐) | 512 | 350MB | 快 | 高 | 通用商品识别 |
| CLIP-ViT-L/14 | 768 | 890MB | 较慢 | 更高 | 精细识别 |
| SigLIP | 512 | 350MB | 快 | 高 | 替代方案 |
| 自训练 ResNet | 256-2048 | 自定义 | 快 | 看数据 | 特定领域 |

### 🏆 推荐：CLIP-ViT-B/32

**理由**：
1. ✅ **离线可运行** - 下载后无需网络
2. ✅ **零样本能力** - 少样本也能工作
3. ✅ **通用性强** - 预训练于 4亿图文对
4. ✅ **性能平衡** - 速度和精度兼顾
5. ✅ **易于集成** - Hugging Face Transformers

**下载路径**：
- 模型：`openai/clip-vit-base-patch32`
- 自动缓存：`./models/`

## 🗂️ 数据组织

### 目录结构

```
ai/
├── data/
│   ├── samples/              # 样本图片目录
│   │   ├── sku_001/
│   │   │   ├── img_001.jpg  # 商品1-样本1
│   │   │   ├── img_002.jpg  # 商品1-样本2
│   │   │   └── img_003.jpg  # 商品1-样本3
│   │   ├── sku_002/
│   │   │   ├── img_001.jpg
│   │   │   └── img_002.jpg
│   │   └── ...
│   │
│   └── index/                # FAISS 索引目录
│       ├── products.index         # FAISS 索引文件
│       ├── products_metadata.json # 索引元数据
│       └── build_info.json        # 构建信息
│
├── models/                   # 模型缓存目录
│   └── openai--clip-vit-base-patch32/
│
├── scripts/
│   ├── build_index.py       # 构建索引脚本
│   └── infer.py             # 推理脚本
│
└── app/
    └── services/
        ├── clip_embedder.py      # CLIP 特征提取
        └── faiss_manager.py      # FAISS 索引管理
```

### 样本图片要求

1. **格式**: JPG/PNG/BMP/WebP
2. **分辨率**: 建议 800x800 以上
3. **数量**: 每个 SKU 建议 3-10 张
4. **角度**: 多角度拍摄（正面、侧面、俯视）
5. **背景**: 简洁背景，避免杂乱
6. **光照**: 光线均匀，避免强逆光

### 命名规范

```
sku_{商品ID}/
    ├── front.jpg       # 正面
    ├── side.jpg        # 侧面
    ├── top.jpg         # 俯视
    ├── detail_01.jpg   # 细节1
    └── ...
```

## 🔨 构建索引

### 1. 准备样本

```bash
# 创建样本目录
mkdir -p ai/data/samples

# 按 SKU 组织图片
# ai/data/samples/sku_001/*.jpg
# ai/data/samples/sku_002/*.jpg
```

### 2. 运行构建脚本

```bash
cd ai

# 基础用法
python scripts/build_index.py \
  --samples_dir ./data/samples \
  --output_dir ./data/index

# 使用不同模型
python scripts/build_index.py \
  --samples_dir ./data/samples \
  --output_dir ./data/index \
  --model openai/clip-vit-large-patch14

# 使用 GPU 加速
python scripts/build_index.py \
  --samples_dir ./data/samples \
  --output_dir ./data/index \
  --use_gpu

# 调整批次大小
python scripts/build_index.py \
  --samples_dir ./data/samples \
  --output_dir ./data/index \
  --batch_size 64
```

### 3. 构建输出

```
✅ 索引构建完成！
   索引文件: ./data/index/products.index
   元数据: ./data/index/products_metadata.json
   构建信息: ./data/index/build_info.json

📊 索引统计:
   SKU 数量: 50
   向量数量: 250
   平均每个 SKU: 5.0 张图片
```

## 🔍 推理测试

### 命令行推理

```bash
cd ai

# 基础用法
python scripts/infer.py \
  --image test.jpg \
  --index_dir ./data/index \
  --top_k 5

# 使用不同聚合方式
python scripts/infer.py \
  --image test.jpg \
  --index_dir ./data/index \
  --top_k 5 \
  --aggregation mean  # max/mean/none
```

### 输出示例

```
📊 检索结果:
────────────────────────────────────────────────────────────
  1. SKU   1 | 相似度:  85.3% | 分数: 0.8532
  2. SKU   5 | 相似度:  72.1% | 分数: 0.7215
  3. SKU  12 | 相似度:  68.9% | 分数: 0.6890
  4. SKU   3 | 相似度:  65.2% | 分数: 0.6523
  5. SKU   8 | 相似度:  61.7% | 分数: 0.6171
────────────────────────────────────────────────────────────
```

## 🚀 启动 AI 服务

### 1. 安装依赖

```bash
cd ai

# 创建虚拟环境
uv venv

# 激活环境 (Windows)
.venv\Scripts\Activate.ps1

# 安装依赖
uv pip install -e .
```

### 2. 启动服务

```bash
# 开发模式
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 2
```

### 3. 测试 API

```bash
# 上传图片识别
curl -X POST http://localhost:8001/api/recognition/recognize \
  -F "file=@test.jpg" \
  -F "top_k=5"
```

**响应**:
```json
{
  "results": [
    {"sku_id": 1, "score": 0.85},
    {"sku_id": 5, "score": 0.72}
  ]
}
```

## 🔗 与 Backend 集成

Backend 的 `/vision/query` 会自动调用 AI 服务：

```python
# backend/app/services/vision_service.py
async def recognize_image(self, image_path, db, top_k=5):
    # 调用 AI 服务
    response = httpx.post(
        'http://localhost:8001/api/recognition/recognize',
        files={'file': open(image_path, 'rb')},
        data={'top_k': top_k}
    )
    
    ai_results = response.json()['results']
    
    # 补充商品详情
    for item in ai_results:
        product = db.query(Product).filter(Product.id == item['sku_id']).first()
        item['name'] = product.name
        item['price'] = product.price
```

## 📊 准确率评估

### 评估指标

#### 1. Top-1 准确率
```sql
SELECT 
    COUNT(CASE 
        WHEN JSON_EXTRACT(top_k_results, '$[0].sku_id') = confirmed_sku_id 
        THEN 1 
    END) * 1.0 / COUNT(*) as top1_accuracy
FROM vision_samples
WHERE confirmed_sku_id IS NOT NULL;
```

#### 2. Top-K 准确率
```sql
-- 用户确认的商品是否在 Top-K 中
SELECT 
    AVG(CASE 
        WHEN confirmed_sku_id IN (
            SELECT value FROM json_each(
                json_extract(top_k_results, '$[*].sku_id')
            )
        ) THEN 1 ELSE 0 
    END) as topk_accuracy
FROM vision_samples
WHERE confirmed_sku_id IS NOT NULL;
```

#### 3. Mean Reciprocal Rank (MRR)
```python
# 计算 MRR
mrr = 0
for sample in samples:
    top_k = json.loads(sample.top_k_results)
    confirmed_sku = sample.confirmed_sku_id
    
    for rank, item in enumerate(top_k, 1):
        if item['sku_id'] == confirmed_sku:
            mrr += 1.0 / rank
            break

mrr /= len(samples)
print(f"MRR: {mrr:.3f}")
```

### 评估脚本

```python
# ai/scripts/evaluate.py
import json
from pathlib import Path
import sqlite3

def evaluate_accuracy(db_path: str):
    """评估识别准确率"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有确认的样本
    cursor.execute("""
        SELECT id, top_k_results, confirmed_sku_id
        FROM vision_samples
        WHERE confirmed_sku_id IS NOT NULL
    """)
    
    samples = cursor.fetchall()
    
    if not samples:
        print("无可评估的样本")
        return
    
    # 计算准确率
    top1_correct = 0
    topk_correct = 0
    mrr = 0
    
    for sample_id, top_k_json, confirmed_sku in samples:
        top_k = json.loads(top_k_json)
        
        # Top-1
        if top_k[0]['sku_id'] == confirmed_sku:
            top1_correct += 1
        
        # Top-K
        sku_ids = [item['sku_id'] for item in top_k]
        if confirmed_sku in sku_ids:
            topk_correct += 1
            rank = sku_ids.index(confirmed_sku) + 1
            mrr += 1.0 / rank
    
    num_samples = len(samples)
    
    print(f"📊 评估结果 (样本数: {num_samples})")
    print(f"   Top-1 准确率: {top1_correct/num_samples:.2%}")
    print(f"   Top-5 准确率: {topk_correct/num_samples:.2%}")
    print(f"   MRR: {mrr/num_samples:.3f}")

if __name__ == "__main__":
    evaluate_accuracy("backend/smartmart.db")
```

## 💡 数据采集建议

### 采集策略

#### 1. 初始阶段（冷启动）
- **目标**: 每个 SKU 3-5 张高质量图片
- **方法**: 手动拍摄标准照片
- **重点**: 多角度、清晰、标准化

#### 2. 运营阶段（持续优化）
- **目标**: 收集真实场景图片
- **方法**: 用户上传 + 自动标注
- **重点**: 识别错误的案例

#### 3. 优化阶段（精准提升）
- **目标**: 每个 SKU 10+ 张多样化图片
- **方法**: 主动采集 + 众包标注
- **重点**: 困难样本、易混淆商品

### 采集规范

| 维度 | 要求 | 说明 |
|------|------|------|
| **角度** | 正面、侧面、俯视 | 全方位覆盖 |
| **距离** | 近景、中景 | 不同距离 |
| **光照** | 自然光、室内光 | 多种光照 |
| **背景** | 简洁、复杂 | 增强鲁棒性 |
| **摆放** | 竖放、横放、叠放 | 真实场景 |

### 困难样本采集

重点采集以下情况：
1. **易混淆商品**: 相似外观的不同商品
2. **多规格商品**: 同品牌不同尺寸
3. **包装变更**: 新旧包装过渡期
4. **部分遮挡**: 手持、叠放等场景
5. **模糊图片**: 运动模糊、失焦

## 🔄 增量更新策略

### 方案 1: 定时重建（推荐）

**适用**: 数据量 < 1万 SKU

```bash
# 每天凌晨 3 点重建索引
crontab -e
0 3 * * * cd /path/to/ai && python scripts/build_index.py
```

**优点**:
- 简单可靠
- 索引质量最优
- 无需担心一致性

**缺点**:
- 重建耗时（1万 SKU 约 10 分钟）
- 新增样本需等待

### 方案 2: 增量添加

**适用**: 数据量 > 1万 SKU，新增频繁

```python
# ai/scripts/incremental_add.py
from app.services.clip_embedder import get_embedder
from app.services.faiss_manager import get_faiss_manager

def add_new_samples(new_samples_dir: str):
    """增量添加新样本"""
    # 1. 加载现有索引
    embedder = get_embedder()
    faiss_manager = get_faiss_manager(embedder.get_embedding_dim())
    faiss_manager.load()
    
    # 2. 提取新样本特征
    new_embeddings = []
    new_sku_ids = []
    
    for sku_dir in Path(new_samples_dir).iterdir():
        sku_id = int(sku_dir.name.replace('sku_', ''))
        
        for img_path in sku_dir.glob('*.jpg'):
            embedding = embedder.extract_image_features(str(img_path))
            new_embeddings.append(embedding)
            new_sku_ids.append(sku_id)
    
    new_embeddings = np.vstack(new_embeddings)
    
    # 3. 增量添加
    faiss_manager.add_vectors(new_embeddings, new_sku_ids)
    
    # 4. 保存索引
    faiss_manager.save()
```

**优点**:
- 实时更新
- 无需重建全部

**缺点**:
- 索引可能不够优化
- 建议定期重建

### 方案 3: 混合策略（生产推荐）

```python
# 增量更新 + 定期重建
1. 新增样本 → 增量添加（立即生效）
2. 每周末 → 完全重建（优化索引）
3. 监控准确率 → 触发重建（质量下降时）
```

## 🎓 最佳实践

### 1. 模型选择
- 小数据量（< 100 SKU）: CLIP-ViT-B/32
- 大数据量（> 1000 SKU）: CLIP-ViT-L/14
- 特定领域: 考虑微调

### 2. 索引优化
- 小规模（< 1万）: IndexFlatIP（精确搜索）
- 中规模（1万-10万）: IndexIVFFlat（快速近似）
- 大规模（> 10万）: IndexIVFPQ（压缩索引）

### 3. 性能优化
- 使用 GPU 加速特征提取
- 批量处理图片
- 缓存常用查询

### 4. 质量控制
- 定期评估准确率
- 收集困难样本
- A/B 测试新模型

## ✅ 完整测试清单

- [ ] 安装依赖 (uv pip install -e .)
- [ ] 准备样本图片（至少 3 个 SKU）
- [ ] 运行 build_index.py
- [ ] 检查索引文件生成
- [ ] 运行 infer.py 测试
- [ ] 启动 AI 服务（端口 8001）
- [ ] 测试 API 接口
- [ ] Backend 集成测试
- [ ] 小程序端到端测试
- [ ] 评估准确率
- [ ] 制定更新策略

## 🎉 完成！

现在你拥有完整的 AI 识别系统：
1. ✅ CLIP 特征提取
2. ✅ FAISS 向量检索
3. ✅ 完整的构建和推理脚本
4. ✅ REST API 服务
5. ✅ Backend 集成
6. ✅ 准确率评估
7. ✅ 增量更新策略

**开始构建你的商品识别系统吧！** 🚀


