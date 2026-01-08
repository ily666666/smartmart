#!/usr/bin/env python3
"""
推理脚本

对输入图片提取特征并检索 Top-K 相似商品

使用方法：
    cd backend
    python scripts/infer.py --image ./test.jpg --index_dir ./data/index --top_k 5
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import argparse
from pathlib import Path
import json

from app.services.clip_embedder import CLIPEmbedder
from app.services.faiss_manager import FAISSManager


def infer(
    image_path: str,
    index_dir: str,
    top_k: int = 5,
    aggregation: str = "max",
    model_name: str = None
) -> list:
    """
    推理单张图片
    
    Args:
        image_path: 输入图片路径
        index_dir: 索引目录
        top_k: 返回前 K 个结果
        aggregation: 聚合方式 (max/mean)
        model_name: CLIP 模型名称（None 时从 build_info 读取）
        
    Returns:
        [(sku_id, score), ...]
    """
    index_dir = Path(index_dir)
    
    # 1. 读取构建信息
    build_info_path = index_dir / "build_info.json"
    if build_info_path.exists():
        with open(build_info_path, 'r', encoding='utf-8') as f:
            build_info = json.load(f)
        
        if model_name is None:
            model_name = build_info.get("model_name", "openai/clip-vit-base-patch32")
        
        embedding_dim = build_info.get("embedding_dim", 512)
        
        print(f"📋 索引信息:")
        print(f"   模型: {model_name}")
        print(f"   特征维度: {embedding_dim}")
        print(f"   SKU 数量: {build_info.get('num_skus', 'unknown')}")
    else:
        if model_name is None:
            model_name = "openai/clip-vit-base-patch32"
        embedding_dim = 512
        print("⚠️ 未找到 build_info.json，使用默认配置")
    
    # 2. 初始化 embedder
    print(f"\n🔧 加载 CLIP 模型...")
    embedder = CLIPEmbedder(model_name=model_name)
    
    # 3. 加载 FAISS 索引
    print(f"\n📂 加载 FAISS 索引...")
    faiss_manager = FAISSManager(
        embedding_dim=embedding_dim,
        index_path=str(index_dir / "products.index"),
        metadata_path=str(index_dir / "products_metadata.json")
    )
    faiss_manager.load()
    
    # 4. 提取查询图片特征
    print(f"\n🎯 提取查询图片特征: {image_path}")
    query_embedding = embedder.extract_image_features(image_path)
    
    # 5. 检索
    print(f"\n🔍 检索 Top-{top_k} 相似商品...")
    
    if aggregation == "none":
        results = faiss_manager.search(query_embedding, top_k=top_k)
    else:
        results = faiss_manager.search_with_aggregation(
            query_embedding,
            top_k=top_k,
            aggregation=aggregation
        )
    
    # 6. 输出结果
    print(f"\n📊 检索结果:")
    print("-" * 60)
    for rank, (sku_id, score) in enumerate(results, 1):
        confidence = score * 100  # 转换为百分比
        print(f"  {rank}. SKU {sku_id:3d} | 相似度: {confidence:5.1f}% | 分数: {score:.4f}")
    print("-" * 60)
    
    return results


def main():
    parser = argparse.ArgumentParser(description="图像识别推理")
    parser.add_argument(
        "--image",
        type=str,
        required=True,
        help="输入图片路径"
    )
    parser.add_argument(
        "--index_dir",
        type=str,
        default="./data/index",
        help="索引目录"
    )
    parser.add_argument(
        "--top_k",
        type=int,
        default=5,
        help="返回前 K 个结果"
    )
    parser.add_argument(
        "--aggregation",
        type=str,
        default="max",
        choices=["none", "max", "mean"],
        help="同一商品多样本的聚合方式"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="CLIP 模型（None 时从索引信息读取）"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🔍 图像识别推理工具")
    print("=" * 60)
    
    # 检查文件
    if not Path(args.image).exists():
        print(f"❌ 图片文件不存在: {args.image}")
        return
    
    if not Path(args.index_dir).exists():
        print(f"❌ 索引目录不存在: {args.index_dir}")
        return
    
    # 执行推理
    results = infer(
        image_path=args.image,
        index_dir=args.index_dir,
        top_k=args.top_k,
        aggregation=args.aggregation,
        model_name=args.model
    )
    
    # 输出 JSON 格式（可用于集成）
    print(f"\n📤 JSON 输出:")
    print(json.dumps([
        {"sku_id": sku_id, "score": float(score)}
        for sku_id, score in results
    ], indent=2))
    
    print("\n" + "=" * 60)
    print("✅ 完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()

