#!/usr/bin/env python3
"""
样本数据准备辅助脚本

功能：
1. 从后端数据库读取商品信息
2. 创建样本目录结构
3. 生成商品元数据文件

使用方法：
    cd backend
    python scripts/prepare_samples.py --db ./smartmart.db --output ./data/samples
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import argparse
import sqlite3
import json
from pathlib import Path
from typing import List, Dict


def load_products_from_db(db_path: str) -> List[Dict]:
    """从数据库加载商品信息"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, barcode, name, price, stock
        FROM products
        WHERE stock > 0
        ORDER BY id
    """)
    
    products = []
    for row in cursor.fetchall():
        products.append({
            "sku_id": row[0],
            "barcode": row[1],
            "name": row[2],
            "price": row[3],
            "stock": row[4]
        })
    
    conn.close()
    return products


def create_sample_structure(products: List[Dict], output_dir: Path):
    """创建样本目录结构"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📁 创建样本目录: {output_dir}")
    
    # 为每个 SKU 创建目录
    for product in products:
        sku_id = product["sku_id"]
        sku_dir = output_dir / f"sku_{sku_id:03d}"
        sku_dir.mkdir(exist_ok=True)
        
        # 创建 README
        readme_path = sku_dir / "README.txt"
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(f"商品ID: {sku_id}\n")
            f.write(f"商品名称: {product['name']}\n")
            f.write(f"条形码: {product['barcode']}\n")
            f.write(f"价格: ¥{product['price']}\n")
            f.write(f"\n")
            f.write(f"请在此目录下放置该商品的样本图片，建议：\n")
            f.write(f"- 正面照片: front.jpg\n")
            f.write(f"- 侧面照片: side.jpg\n")
            f.write(f"- 俯视照片: top.jpg\n")
            f.write(f"- 其他角度: detail_01.jpg, detail_02.jpg, ...\n")
            f.write(f"\n")
            f.write(f"图片要求：\n")
            f.write(f"- 格式: JPG/PNG\n")
            f.write(f"- 分辨率: 建议 800x800 以上\n")
            f.write(f"- 背景: 简洁、光线均匀\n")
            f.write(f"- 数量: 每个 SKU 至少 3 张，推荐 5-10 张\n")
        
        print(f"  ✓ {sku_dir.name}")
    
    # 创建商品元数据
    metadata_path = output_dir / "products_metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump({
            "products": products,
            "num_products": len(products),
            "created_by": "prepare_samples.py"
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 目录结构创建完成")
    print(f"   商品数量: {len(products)}")
    print(f"   元数据: {metadata_path}")
    
    # 打印下一步操作
    print(f"\n📝 下一步操作:")
    print(f"   1. 为每个 SKU 目录添加商品图片")
    print(f"   2. 每个 SKU 至少 3 张，推荐 5-10 张")
    print(f"   3. 建议命名: front.jpg, side.jpg, top.jpg, detail_01.jpg, ...")
    print(f"   4. 完成后运行: python scripts/build_index.py")


def check_samples_status(samples_dir: Path):
    """检查样本准备状态"""
    if not samples_dir.exists():
        print(f"❌ 样本目录不存在: {samples_dir}")
        return
    
    print(f"\n📊 样本准备状态检查")
    print("=" * 70)
    
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    
    total_skus = 0
    ready_skus = 0
    total_images = 0
    
    for sku_dir in sorted(samples_dir.iterdir()):
        if not sku_dir.is_dir() or not sku_dir.name.startswith('sku_'):
            continue
        
        total_skus += 1
        
        # 统计图片数量
        images = [f for f in sku_dir.iterdir() if f.suffix.lower() in image_exts]
        num_images = len(images)
        total_images += num_images
        
        status = ""
        if num_images == 0:
            status = "❌ 无图片"
        elif num_images < 3:
            status = f"⚠️  {num_images} 张（建议至少 3 张）"
        else:
            status = f"✅ {num_images} 张"
            ready_skus += 1
        
        print(f"  {sku_dir.name}: {status}")
    
    print("=" * 70)
    print(f"总计: {ready_skus}/{total_skus} 个 SKU 准备就绪")
    print(f"图片总数: {total_images} 张")
    print(f"平均每个 SKU: {total_images/total_skus:.1f} 张" if total_skus > 0 else "")
    
    if ready_skus >= total_skus * 0.8:
        print(f"\n🎉 样本准备充足，可以开始构建索引！")
        print(f"   运行命令: python scripts/build_index.py")
    else:
        print(f"\n⚠️  建议补充更多样本图片后再构建索引")


def main():
    parser = argparse.ArgumentParser(description="准备样本数据")
    parser.add_argument(
        "--db",
        type=str,
        default="./smartmart.db",
        help="数据库文件路径"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./data/samples",
        help="样本输出目录"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="检查样本准备状态"
    )
    
    args = parser.parse_args()
    
    output_dir = Path(args.output)
    
    if args.check:
        # 只检查状态
        check_samples_status(output_dir)
        return
    
    print("=" * 70)
    print("🚀 样本数据准备工具")
    print("=" * 70)
    
    # 检查数据库
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ 数据库文件不存在: {db_path}")
        return
    
    # 加载商品
    print(f"\n📂 加载商品数据: {db_path}")
    products = load_products_from_db(str(db_path))
    
    if not products:
        print("❌ 未找到任何商品")
        return
    
    print(f"✅ 加载 {len(products)} 个商品\n")
    
    # 创建目录结构
    create_sample_structure(products, output_dir)
    
    print("\n" + "=" * 70)
    print("✅ 完成！")
    print("=" * 70)


if __name__ == "__main__":
    main()

