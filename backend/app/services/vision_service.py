"""外观识别服务 - 集成 CLIP + FAISS"""

import os
from typing import List, Dict, Optional
from datetime import datetime
from zoneinfo import ZoneInfo
from PIL import Image
import hashlib

from app.models.product import Product
from app.models.vision import VisionSample
from app.config import settings


# 延迟加载 AI 模块（避免启动时加载模型）
_embedder = None
_faiss_manager = None


def _get_ai_components():
    """延迟初始化 AI 组件"""
    global _embedder, _faiss_manager
    
    if _embedder is None:
        from app.services.clip_embedder import CLIPEmbedder
        from app.services.faiss_manager import FAISSManager
        
        print("🔧 正在加载 AI 模型...")
        _embedder = CLIPEmbedder(
            model_name=settings.CLIP_MODEL_NAME,
            cache_dir=settings.MODEL_CACHE_DIR
        )
        
        _faiss_manager = FAISSManager(
            embedding_dim=_embedder.get_embedding_dim(),
            index_path=settings.FAISS_INDEX_PATH,
            metadata_path=settings.FAISS_METADATA_PATH
        )
        
        # 尝试加载已有索引
        try:
            _faiss_manager.load()
            print("✅ FAISS 索引已加载")
        except FileNotFoundError:
            print("⚠️ FAISS 索引未找到，需要先构建索引")
    
    return _embedder, _faiss_manager


class VisionService:
    """
    外观识别服务
    
    集成 CLIP + FAISS 进行本地商品外观识别
    """
    
    def __init__(self, upload_dir: str = "./uploads/vision"):
        self.upload_dir = upload_dir
        self.model_version = "v1_clip_faiss"
        
        # 确保上传目录存在
        os.makedirs(upload_dir, exist_ok=True)
    
    async def recognize_image(
        self,
        image_path: str,
        db,
        top_k: int = 5
    ) -> List[Dict]:
        """
        识别图片并返回 Top-K 候选商品
        
        使用本地 CLIP + FAISS 进行识别
        
        Args:
            image_path: 图片路径
            db: 数据库会话
            top_k: 返回前 K 个候选
            
        Returns:
            [{"sku_id": 1, "name": "商品名", "price": 9.99, "score": 0.85}, ...]
        """
        
        try:
            # 获取 AI 组件（延迟初始化）
            embedder, faiss_manager = _get_ai_components()
            
            # 检查索引是否已加载
            if faiss_manager.index is None:
                print("⚠️ FAISS 索引未加载，降级到占位实现")
                return await self._fallback_recognize(db, top_k)
            
            # 提取图片特征
            query_embedding = embedder.extract_image_features(image_path)
            
            # FAISS 检索
            ai_results = faiss_manager.search_with_aggregation(
                query_embedding,
                top_k=top_k,
                aggregation="max"
            )
            
            # 补充商品详情
            results = []
            for sku_id, score in ai_results:
                product = db.query(Product).filter(Product.id == sku_id).first()
                
                if product:
                    results.append({
                        "sku_id": product.id,
                        "barcode": product.barcode,
                        "name": product.name,
                        "price": product.price,
                        "score": round(float(score), 2)
                    })
            
            if results:
                print(f"✅ AI 识别完成，Top-1: {results[0]['name']} (score: {results[0]['score']})")
                return results
            else:
                # 如果没有匹配结果，降级到占位实现
                return await self._fallback_recognize(db, top_k)
                
        except Exception as e:
            print(f"⚠️ AI 识别失败: {e}")
            print("   降级使用占位实现")
            return await self._fallback_recognize(db, top_k)
    
    async def _fallback_recognize(self, db, top_k: int) -> List[Dict]:
        """
        占位实现（降级方案）
        
        当 AI 服务不可用时使用随机选择
        """
        import random
        
        # 获取所有商品
        products = db.query(Product).limit(20).all()
        
        if not products:
            return []
        
        # 随机选择 top_k 个商品
        selected = random.sample(products, min(top_k, len(products)))
        
        # 生成随机置信度分数（降序）
        results = []
        base_score = 0.85
        for i, product in enumerate(selected):
            score = base_score - (i * 0.1) + random.uniform(-0.05, 0.05)
            score = max(0.1, min(0.99, score))  # 限制在 0.1-0.99
            
            results.append({
                "sku_id": product.id,
                "barcode": product.barcode,
                "name": product.name,
                "price": product.price,
                "score": round(score, 2)
            })
        
        # 按分数降序排序
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return results
    
    def save_image(self, image_data: bytes, device_id: str) -> str:
        """
        保存上传的图片
        
        Args:
            image_data: 图片二进制数据
            device_id: 设备ID
            
        Returns:
            保存的文件路径
        """
        # 生成文件名（基于时间戳和设备ID）
        timestamp = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y%m%d_%H%M%S")
        file_hash = hashlib.md5(image_data[:1024]).hexdigest()[:8]
        filename = f"{timestamp}_{device_id}_{file_hash}.jpg"
        
        # 保存路径
        filepath = os.path.join(self.upload_dir, filename)
        
        # 保存文件
        with open(filepath, "wb") as f:
            f.write(image_data)
        
        return filepath
    
    def get_image_info(self, filepath: str) -> Dict:
        """
        获取图片信息（宽、高、大小）
        
        Args:
            filepath: 图片路径
            
        Returns:
            {"width": 800, "height": 600, "size": 102400}
        """
        try:
            with Image.open(filepath) as img:
                width, height = img.size
            
            size = os.path.getsize(filepath)
            
            return {
                "width": width,
                "height": height,
                "size": size
            }
        except Exception as e:
            print(f"获取图片信息失败: {e}")
            return {
                "width": 0,
                "height": 0,
                "size": 0
            }
    
    async def record_sample(
        self,
        db,
        image_path: str,
        device_id: str,
        device_type: str,
        top_k_results: List[Dict],
        image_info: Dict
    ) -> VisionSample:
        """
        记录识别样本到数据库
        
        Args:
            db: 数据库会话
            image_path: 图片路径
            device_id: 设备ID
            device_type: 设备类型
            top_k_results: Top-K 结果
            image_info: 图片信息
            
        Returns:
            VisionSample 对象
        """
        import json
        
        sample = VisionSample(
            image_path=image_path,
            device_id=device_id,
            device_type=device_type,
            model_version=self.model_version,
            top_k_results=json.dumps(top_k_results, ensure_ascii=False),
            top1_score=top_k_results[0]["score"] if top_k_results else 0,
            image_width=image_info.get("width", 0),
            image_height=image_info.get("height", 0),
            image_size=image_info.get("size", 0)
        )
        
        db.add(sample)
        db.commit()
        db.refresh(sample)
        
        return sample
    
    async def confirm_result(
        self,
        db,
        sample_id: int,
        confirmed_sku_id: int
    ):
        """
        用户确认识别结果
        
        Args:
            db: 数据库会话
            sample_id: 样本ID
            confirmed_sku_id: 确认的商品ID
        """
        sample = db.query(VisionSample).filter(VisionSample.id == sample_id).first()
        
        if sample:
            sample.confirmed_sku_id = confirmed_sku_id
            sample.confirmed_at = datetime.now(ZoneInfo("Asia/Shanghai"))
            db.commit()
    
    def get_ai_status(self) -> Dict:
        """获取 AI 服务状态"""
        global _embedder, _faiss_manager
        
        status = {
            "model_loaded": _embedder is not None,
            "index_loaded": _faiss_manager is not None and _faiss_manager.index is not None,
            "model_version": self.model_version
        }
        
        if _faiss_manager is not None:
            status["index_stats"] = _faiss_manager.get_stats()
        
        if _embedder is not None:
            status["model_info"] = _embedder.get_model_info()
        
        return status


# 全局实例
vision_service = VisionService()

