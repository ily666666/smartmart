"""
FAISS 索引管理器

负责构建、保存、加载和查询 FAISS 索引
"""

import faiss
import numpy as np
import json
import os
from typing import List, Tuple, Dict, Optional
from datetime import datetime
from zoneinfo import ZoneInfo


class FAISSManager:
    """
    FAISS 索引管理器
    
    索引类型：
    - IndexFlatIP: 内积相似度（适合归一化向量）
    - IndexFlatL2: L2 距离
    - IndexIVFFlat: 倒排索引（适合大规模数据）
    """
    
    def __init__(
        self,
        embedding_dim: int = 512,
        index_path: str = "./data/index/products.index",
        metadata_path: str = "./data/index/products_metadata.json"
    ):
        """
        初始化 FAISS 管理器
        
        Args:
            embedding_dim: 特征维度
            index_path: 索引文件路径
            metadata_path: 元数据文件路径
        """
        self.embedding_dim = embedding_dim
        self.index_path = index_path
        self.metadata_path = metadata_path
        
        # 索引和元数据
        self.index = None
        self.id_to_sku = []  # 索引位置 -> sku_id 映射
        self.sku_to_ids = {}  # sku_id -> [索引位置列表] 映射
        
        # 确保目录存在
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
    
    def build_index(
        self,
        embeddings: np.ndarray,
        sku_ids: List[int],
        use_gpu: bool = False
    ):
        """
        构建新索引
        
        Args:
            embeddings: 特征矩阵 (N x D)
            sku_ids: 商品ID列表 (N,)
            use_gpu: 是否使用GPU加速
        """
        print(f"🔨 构建 FAISS 索引...")
        print(f"   样本数量: {len(embeddings)}")
        print(f"   特征维度: {embeddings.shape[1]}")
        
        # 创建索引（使用内积相似度，适合归一化向量）
        self.index = faiss.IndexFlatIP(self.embedding_dim)
        
        # GPU 加速（可选）
        if use_gpu and faiss.get_num_gpus() > 0:
            print("🚀 使用 GPU 加速")
            self.index = faiss.index_cpu_to_all_gpus(self.index)
        
        # 添加向量
        self.index.add(embeddings)
        
        # 构建映射关系
        self.id_to_sku = sku_ids.tolist()
        self._build_sku_mapping()
        
        print(f"✅ 索引构建完成，包含 {self.index.ntotal} 个向量")
    
    def _build_sku_mapping(self):
        """构建 sku_id -> 索引位置 的映射"""
        self.sku_to_ids = {}
        for idx, sku_id in enumerate(self.id_to_sku):
            if sku_id not in self.sku_to_ids:
                self.sku_to_ids[sku_id] = []
            self.sku_to_ids[sku_id].append(idx)
    
    def add_vectors(
        self,
        embeddings: np.ndarray,
        sku_ids: List[int]
    ):
        """
        增量添加向量（用于在线更新）
        
        Args:
            embeddings: 新增特征矩阵
            sku_ids: 对应的商品ID列表
        """
        if self.index is None:
            raise ValueError("索引未初始化，请先调用 build_index")
        
        # 添加向量
        self.index.add(embeddings)
        
        # 更新映射
        self.id_to_sku.extend(sku_ids)
        self._build_sku_mapping()
        
        print(f"✅ 增量添加 {len(embeddings)} 个向量，当前总数: {self.index.ntotal}")
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        return_scores: bool = True
    ) -> List[Tuple[int, float]]:
        """
        搜索最相似的商品
        
        Args:
            query_embedding: 查询向量 (D,)
            top_k: 返回前 K 个结果
            return_scores: 是否返回相似度分数
            
        Returns:
            [(sku_id, score), ...] 列表
        """
        if self.index is None:
            raise ValueError("索引未加载，请先加载或构建索引")
        
        # 确保是 2D 数组
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        # 搜索
        scores, indices = self.index.search(query_embedding, top_k * 2)  # 多搜索一些，用于去重
        
        # 去重（同一商品只保留最高分的）
        results = []
        seen_skus = set()
        
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.id_to_sku):
                continue
            
            sku_id = self.id_to_sku[idx]
            
            if sku_id not in seen_skus:
                seen_skus.add(sku_id)
                results.append((sku_id, float(score)))
            
            if len(results) >= top_k:
                break
        
        return results
    
    def search_with_aggregation(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        aggregation: str = "max"
    ) -> List[Tuple[int, float]]:
        """
        搜索并聚合同一商品的多个样本分数
        
        Args:
            query_embedding: 查询向量
            top_k: 返回前 K 个商品
            aggregation: 聚合方式 (max/mean/sum)
            
        Returns:
            [(sku_id, score), ...] 列表
        """
        if self.index is None:
            raise ValueError("索引未加载")
        
        # 确保是 2D 数组
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        # 搜索所有向量
        num_samples = min(self.index.ntotal, top_k * 10)
        scores, indices = self.index.search(query_embedding, num_samples)
        
        # 按 sku_id 聚合分数
        sku_scores = {}
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.id_to_sku):
                continue
            
            sku_id = self.id_to_sku[idx]
            
            if sku_id not in sku_scores:
                sku_scores[sku_id] = []
            sku_scores[sku_id].append(float(score))
        
        # 聚合
        results = []
        for sku_id, scores_list in sku_scores.items():
            if aggregation == "max":
                agg_score = max(scores_list)
            elif aggregation == "mean":
                agg_score = np.mean(scores_list)
            elif aggregation == "sum":
                agg_score = sum(scores_list)
            else:
                agg_score = max(scores_list)
            
            results.append((sku_id, agg_score))
        
        # 排序并返回 top-k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
    
    def save(self):
        """保存索引和元数据到磁盘"""
        if self.index is None:
            raise ValueError("索引未初始化")
        
        print(f"💾 保存索引到 {self.index_path}")
        
        # 保存 FAISS 索引
        faiss.write_index(self.index, self.index_path)
        
        # 保存元数据
        metadata = {
            "embedding_dim": self.embedding_dim,
            "num_vectors": self.index.ntotal,
            "id_to_sku": self.id_to_sku,
            "sku_to_ids": self.sku_to_ids,
            "created_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
            "version": "1.0"
        }
        
        with open(self.metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 索引已保存，包含 {self.index.ntotal} 个向量")
    
    def load(self):
        """从磁盘加载索引和元数据"""
        if not os.path.exists(self.index_path):
            raise FileNotFoundError(f"索引文件不存在: {self.index_path}")
        
        print(f"📂 加载索引: {self.index_path}")
        
        # 加载 FAISS 索引
        self.index = faiss.read_index(self.index_path)
        
        # 加载元数据
        with open(self.metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        self.id_to_sku = metadata["id_to_sku"]
        self.sku_to_ids = {int(k): v for k, v in metadata["sku_to_ids"].items()}
        
        print(f"✅ 索引已加载，包含 {self.index.ntotal} 个向量")
        print(f"   创建时间: {metadata.get('created_at', 'unknown')}")
    
    def get_stats(self) -> Dict:
        """获取索引统计信息"""
        if self.index is None:
            return {"status": "not_loaded"}
        
        num_skus = len(self.sku_to_ids)
        avg_samples_per_sku = self.index.ntotal / num_skus if num_skus > 0 else 0
        
        return {
            "status": "loaded",
            "num_vectors": self.index.ntotal,
            "num_skus": num_skus,
            "avg_samples_per_sku": round(avg_samples_per_sku, 2),
            "embedding_dim": self.embedding_dim
        }


# 全局实例（延迟初始化）
_faiss_manager = None


def get_faiss_manager(embedding_dim: int = 512) -> FAISSManager:
    """获取全局 FAISS 管理器实例"""
    global _faiss_manager
    if _faiss_manager is None:
        _faiss_manager = FAISSManager(embedding_dim=embedding_dim)
    return _faiss_manager

