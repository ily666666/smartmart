#!/usr/bin/env python3
"""
构建 FAISS 索引脚本

从商品样本图片目录提取特征并构建索引

数据组织结构：
./data/samples/
    ├── sku_001/
    │   ├── img_001.jpg
    │   ├── img_002.jpg
    │   └── ...
    ├── sku_002/
    │   └── ...
    └── metadata.json  (可选：商品元信息)

使用方法：
    cd backend
    python scripts/build_index.py --samples_dir ./data/samples --output_dir ./data/index
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import argparse
from pathlib import Path
import numpy as np
from tqdm import tqdm
import json

from app.services.clip_embedder import CLIPEmbedder
from app.services.faiss_manager import FAISSManager


def collect_samples(samples_dir: Path) -> dict:
    """
    收集样本图片
    
    Args:
        samples_dir: 样本目录
        
    Returns:
        {sku_id: [image_paths]}
    """
    samples = {}
    
    print(f"📁 扫描样本目录: {samples_dir}")
    
    # 支持的图片格式
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    
    for sku_dir in sorted(samples_dir.iterdir()):
        if not sku_dir.is_dir():
            continue
        
        sku_id = sku_dir.name
        
        # 尝试解析 sku_id 为整数
        try:
            sku_id_int = int(sku_id.replace('sku_', ''))
        except ValueError:
            print(f"⚠️ 跳过无效的 SKU 目录: {sku_id}")
            continue
        
        # 收集图片
        image_paths = []
        for img_path in sku_dir.iterdir():
            if img_path.suffix.lower() in image_exts:
                image_paths.append(str(img_path))
        
        if image_paths:
            samples[sku_id_int] = image_paths
            print(f"  ✓ SKU {sku_id_int}: {len(image_paths)} 张图片")
        else:
            print(f"  ⚠️ SKU {sku_id_int}: 无图片")
    
    print(f"✅ 总计: {len(samples)} 个 SKU，{sum(len(imgs) for imgs in samples.values())} 张图片")
    
    return samples


def build_index(
    samples_dir: str,
    output_dir: str,
    model_name: str = "openai/clip-vit-base-patch32",
    batch_size: int = 32,
    use_gpu: bool = False
):
    """
    构建索引
    
    Args:
        samples_dir: 样本目录
        output_dir: 输出目录
        model_name: CLIP 模型名称
        batch_size: 批次大小
        use_gpu: 是否使用 GPU
    """
    samples_dir = Path(samples_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. 收集样本
    samples = collect_samples(samples_dir)
    
    if not samples:
        print("❌ 未找到任何样本，退出")
        return
    
    # 2. 初始化 embedder
    print(f"\n🔧 初始化 CLIP 模型: {model_name}")
    embedder = CLIPEmbedder(
        model_name=model_name,
        device="cuda" if use_gpu else "cpu"
    )
    
    embedding_dim = embedder.get_embedding_dim()
    
    # 3. 提取特征
    print(f"\n🎯 提取图像特征...")
    
    all_embeddings = []
    all_sku_ids = []
    
    for sku_id, image_paths in tqdm(samples.items(), desc="处理 SKU"):
        # 批量提取特征
        embeddings = embedder.extract_batch_features(
            image_paths,
            batch_size=batch_size
        )
        
        all_embeddings.append(embeddings)
        all_sku_ids.extend([sku_id] * len(image_paths))
    
    # 合并所有特征
    all_embeddings = np.vstack(all_embeddings)
    all_sku_ids = np.array(all_sku_ids, dtype=np.int32)
    
    print(f"✅ 特征提取完成")
    print(f"   总向量数: {len(all_embeddings)}")
    print(f"   特征维度: {embedding_dim}")
    
    # 4. 构建 FAISS 索引
    print(f"\n🔨 构建 FAISS 索引...")
    
    faiss_manager = FAISSManager(
        embedding_dim=embedding_dim,
        index_path=str(output_dir / "products.index"),
        metadata_path=str(output_dir / "products_metadata.json")
    )
    
    faiss_manager.build_index(
        embeddings=all_embeddings,
        sku_ids=all_sku_ids,
        use_gpu=use_gpu
    )
    
    # 5. 保存索引
    faiss_manager.save()
    
    # 6. 保存构建信息
    build_info = {
        "model_name": model_name,
        "embedding_dim": embedding_dim,
        "num_skus": len(samples),
        "num_vectors": len(all_embeddings),
        "samples_per_sku": {
            str(sku_id): len(imgs) for sku_id, imgs in samples.items()
        },
        "samples_dir": str(samples_dir),
        "build_time": embedder.get_model_info()
    }
    
    build_info_path = output_dir / "build_info.json"
    with open(build_info_path, 'w', encoding='utf-8') as f:
        json.dump(build_info, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 索引构建完成！")
    print(f"   索引文件: {output_dir / 'products.index'}")
    print(f"   元数据: {output_dir / 'products_metadata.json'}")
    print(f"   构建信息: {build_info_path}")
    
    # 7. 打印统计
    stats = faiss_manager.get_stats()
    print(f"\n📊 索引统计:")
    print(f"   SKU 数量: {stats['num_skus']}")
    print(f"   向量数量: {stats['num_vectors']}")
    print(f"   平均每个 SKU: {stats['avg_samples_per_sku']:.1f} 张图片")


def main():
    parser = argparse.ArgumentParser(description="构建 FAISS 索引")
    parser.add_argument(
        "--samples_dir",
        type=str,
        default="./data/samples",
        help="样本图片目录"
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="./data/index",
        help="输出目录"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="openai/clip-vit-base-patch32",
        choices=[
            "openai/clip-vit-base-patch32",
            "openai/clip-vit-large-patch14",
            "laion/CLIP-ViT-B-32-laion2B-s34B-b79K"
        ],
        help="CLIP 模型"
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=32,
        help="批次大小"
    )
    parser.add_argument(
        "--use_gpu",
        action="store_true",
        help="使用 GPU 加速"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🚀 FAISS 索引构建工具")
    print("=" * 60)
    
    build_index(
        samples_dir=args.samples_dir,
        output_dir=args.output_dir,
        model_name=args.model,
        batch_size=args.batch_size,
        use_gpu=args.use_gpu
    )
    
    print("\n" + "=" * 60)
    print("✅ 完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()

