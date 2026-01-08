#!/usr/bin/env python3
"""
准确率评估脚本

从 vision_samples 表中读取已确认的识别记录，计算准确率指标

使用方法：
    cd backend
    python scripts/evaluate.py --db ./smartmart.db
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import argparse
import json
import sqlite3
from pathlib import Path
from typing import List, Dict
from collections import defaultdict


def load_samples(db_path: str) -> List[Dict]:
    """从数据库加载已确认的样本"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            id,
            image_path,
            device_id,
            device_type,
            model_version,
            top_k_results,
            confirmed_sku_id,
            confirmed_score,
            created_at
        FROM vision_samples
        WHERE confirmed_sku_id IS NOT NULL
        ORDER BY created_at DESC
    """)
    
    samples = []
    for row in cursor.fetchall():
        samples.append({
            "id": row[0],
            "image_path": row[1],
            "device_id": row[2],
            "device_type": row[3],
            "model_version": row[4],
            "top_k_results": json.loads(row[5]) if row[5] else [],
            "confirmed_sku_id": row[6],
            "confirmed_score": row[7],
            "created_at": row[8]
        })
    
    conn.close()
    return samples


def calculate_metrics(samples: List[Dict]) -> Dict:
    """计算评估指标"""
    if not samples:
        return None
    
    num_samples = len(samples)
    
    # Top-1 准确率
    top1_correct = 0
    
    # Top-K 准确率
    topk_correct = 0
    
    # MRR (Mean Reciprocal Rank)
    mrr_sum = 0
    
    # 分数统计
    confirmed_scores = []
    top1_scores = []
    
    # 按 SKU 分组统计
    sku_stats = defaultdict(lambda: {"correct": 0, "total": 0})
    
    # 按设备类型分组
    device_stats = defaultdict(lambda: {"correct": 0, "total": 0})
    
    for sample in samples:
        top_k = sample["top_k_results"]
        confirmed_sku = sample["confirmed_sku_id"]
        device_type = sample["device_type"]
        
        if not top_k:
            continue
        
        # Top-1
        if top_k[0]["sku_id"] == confirmed_sku:
            top1_correct += 1
            sku_stats[confirmed_sku]["correct"] += 1
            device_stats[device_type]["correct"] += 1
        
        sku_stats[confirmed_sku]["total"] += 1
        device_stats[device_type]["total"] += 1
        
        # Top-K
        sku_ids = [item["sku_id"] for item in top_k]
        if confirmed_sku in sku_ids:
            topk_correct += 1
            rank = sku_ids.index(confirmed_sku) + 1
            mrr_sum += 1.0 / rank
        
        # 分数统计
        confirmed_scores.append(sample.get("confirmed_score", 0))
        top1_scores.append(top_k[0]["score"])
    
    # 计算指标
    metrics = {
        "num_samples": num_samples,
        "top1_accuracy": top1_correct / num_samples,
        "topk_accuracy": topk_correct / num_samples,
        "mrr": mrr_sum / num_samples,
        "avg_confirmed_score": sum(confirmed_scores) / len(confirmed_scores) if confirmed_scores else 0,
        "avg_top1_score": sum(top1_scores) / len(top1_scores) if top1_scores else 0,
        "sku_stats": dict(sku_stats),
        "device_stats": dict(device_stats)
    }
    
    return metrics


def print_report(metrics: Dict):
    """打印评估报告"""
    print("=" * 70)
    print("📊 识别准确率评估报告")
    print("=" * 70)
    
    if not metrics:
        print("❌ 无可评估的样本（需要用户确认识别结果）")
        return
    
    print(f"\n总体指标 (样本数: {metrics['num_samples']})")
    print("-" * 70)
    print(f"  Top-1 准确率:  {metrics['top1_accuracy']:.2%}")
    print(f"  Top-5 准确率:  {metrics['topk_accuracy']:.2%}")
    print(f"  MRR:          {metrics['mrr']:.3f}")
    print(f"  平均置信度:    {metrics['avg_top1_score']:.2%}")
    
    # 按 SKU 统计
    print(f"\n按商品统计 (Top 10 最多识别)")
    print("-" * 70)
    sku_stats = sorted(
        metrics["sku_stats"].items(),
        key=lambda x: x[1]["total"],
        reverse=True
    )[:10]
    
    for sku_id, stats in sku_stats:
        accuracy = stats["correct"] / stats["total"]
        print(f"  SKU {sku_id:3d}: {accuracy:5.1%} ({stats['correct']}/{stats['total']})")
    
    # 按设备类型统计
    print(f"\n按设备类型统计")
    print("-" * 70)
    for device_type, stats in metrics["device_stats"].items():
        accuracy = stats["correct"] / stats["total"]
        print(f"  {device_type:12s}: {accuracy:5.1%} ({stats['correct']}/{stats['total']})")
    
    # 质量评估
    print(f"\n质量评估")
    print("-" * 70)
    top1_acc = metrics['top1_accuracy']
    
    if top1_acc >= 0.9:
        quality = "🟢 优秀"
    elif top1_acc >= 0.75:
        quality = "🟡 良好"
    elif top1_acc >= 0.6:
        quality = "🟠 一般"
    else:
        quality = "🔴 需改进"
    
    print(f"  模型质量: {quality}")
    
    if top1_acc < 0.75:
        print(f"\n改进建议:")
        print(f"  1. 增加每个 SKU 的样本数量（建议 5-10 张）")
        print(f"  2. 采集多角度、多场景图片")
        print(f"  3. 收集识别错误的困难样本")
        print(f"  4. 考虑使用更大的模型（CLIP-ViT-L/14）")
        print(f"  5. 定期重建索引以优化质量")
    
    print("\n" + "=" * 70)


def analyze_errors(samples: List[Dict], top_n: int = 10):
    """分析识别错误的案例"""
    errors = []
    
    for sample in samples:
        top_k = sample["top_k_results"]
        confirmed_sku = sample["confirmed_sku_id"]
        
        if not top_k:
            continue
        
        # 找出 Top-1 错误
        if top_k[0]["sku_id"] != confirmed_sku:
            errors.append({
                "sample_id": sample["id"],
                "image_path": sample["image_path"],
                "predicted_sku": top_k[0]["sku_id"],
                "predicted_score": top_k[0]["score"],
                "actual_sku": confirmed_sku,
                "rank": next(
                    (i + 1 for i, item in enumerate(top_k) if item["sku_id"] == confirmed_sku),
                    -1
                )
            })
    
    if not errors:
        print("\n🎉 太棒了！所有样本 Top-1 都识别正确！")
        return
    
    print(f"\n❌ 错误案例分析 (共 {len(errors)} 个错误)")
    print("=" * 70)
    
    # 按预测分数降序排序（高置信度错误更需要关注）
    errors.sort(key=lambda x: x["predicted_score"], reverse=True)
    
    for i, error in enumerate(errors[:top_n], 1):
        print(f"\n错误 {i}:")
        print(f"  样本ID:    {error['sample_id']}")
        print(f"  图片路径:  {error['image_path']}")
        print(f"  预测 SKU:  {error['predicted_sku']} (置信度 {error['predicted_score']:.1%})")
        print(f"  实际 SKU:  {error['actual_sku']}")
        if error['rank'] > 0:
            print(f"  实际排名:  第 {error['rank']} 位")
        else:
            print(f"  实际排名:  未在 Top-K 中")
    
    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(description="评估识别准确率")
    parser.add_argument(
        "--db",
        type=str,
        default="./smartmart.db",
        help="数据库文件路径"
    )
    parser.add_argument(
        "--errors",
        action="store_true",
        help="显示错误案例分析"
    )
    parser.add_argument(
        "--top_errors",
        type=int,
        default=10,
        help="显示前 N 个错误案例"
    )
    
    args = parser.parse_args()
    
    # 检查数据库文件
    if not Path(args.db).exists():
        print(f"❌ 数据库文件不存在: {args.db}")
        return
    
    # 加载样本
    print(f"📂 加载数据: {args.db}")
    samples = load_samples(args.db)
    
    if not samples:
        print("❌ 未找到已确认的识别样本")
        print("\n💡 提示:")
        print("   1. 使用小程序拍照识别")
        print("   2. 从候选列表中选择正确商品")
        print("   3. 系统会自动记录确认结果")
        return
    
    print(f"✅ 加载 {len(samples)} 个已确认样本\n")
    
    # 计算指标
    metrics = calculate_metrics(samples)
    
    # 打印报告
    print_report(metrics)
    
    # 错误分析
    if args.errors:
        analyze_errors(samples, top_n=args.top_errors)


if __name__ == "__main__":
    main()

