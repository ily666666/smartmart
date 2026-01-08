"""
CLIP Embedding 服务

使用 OpenAI CLIP 模型提取图像特征
- 模型：openai/clip-vit-base-patch32 (可离线运行)
- 特征维度：512
- 优点：零样本识别能力强、通用性好
"""

import os

# 设置 HuggingFace 镜像源（必须在导入 transformers 之前）
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
# 禁用 SSL 验证（解决证书问题）
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from typing import Union, List


class CLIPEmbedder:
    """
    CLIP 图像特征提取器
    
    可选模型方案：
    1. openai/clip-vit-base-patch32 (推荐)
       - 特征维度：512
       - 模型大小：~350MB
       - 推理速度：快
       - 精度：高
    
    2. openai/clip-vit-large-patch14 (高精度)
       - 特征维度：768
       - 模型大小：~890MB
       - 推理速度：较慢
       - 精度：更高
    
    3. laion/CLIP-ViT-B-32-laion2B-s34B-b79K (大数据集训练)
       - 特征维度：512
       - 模型大小：~350MB
       - 适合通用场景
    """
    
    def __init__(
        self,
        model_name: str = "openai/clip-vit-base-patch32",
        device: str = None,
        cache_dir: str = "./models"
    ):
        """
        初始化 CLIP 模型
        
        Args:
            model_name: 模型名称
            device: 设备 (cuda/cpu)，None 时自动检测
            cache_dir: 模型缓存目录
        """
        self.model_name = model_name
        self.cache_dir = cache_dir
        
        # 自动选择设备
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        
        print(f"🔧 初始化 CLIP 模型: {model_name}")
        print(f"📍 设备: {self.device}")
        print(f"💾 缓存目录: {cache_dir}")
        
        # 确保缓存目录存在
        os.makedirs(cache_dir, exist_ok=True)
        
        # 加载模型和处理器（使用快速版本）
        self.processor = CLIPProcessor.from_pretrained(
            model_name,
            cache_dir=cache_dir,
            use_fast=True
        )
        
        self.model = CLIPModel.from_pretrained(
            model_name,
            cache_dir=cache_dir
        ).to(self.device)
        
        self.model.eval()  # 设置为评估模式
        
        # 如果有 GPU，使用半精度加速
        if self.device == "cuda":
            self.model = self.model.half()
            print("⚡ 已启用 FP16 半精度加速")
        
        # 获取特征维度
        self.embedding_dim = self.model.config.projection_dim
        
        print(f"✅ 模型加载完成，特征维度: {self.embedding_dim}")
    
    def extract_image_features(
        self,
        image: Union[str, Image.Image],
        normalize: bool = True
    ) -> np.ndarray:
        """
        提取单张图片的特征向量
        
        Args:
            image: 图片路径或 PIL Image 对象
            normalize: 是否归一化特征向量
            
        Returns:
            特征向量 (1D numpy array)
        """
        # 加载图片
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")
        elif not isinstance(image, Image.Image):
            raise ValueError("image must be a file path or PIL Image")
        
        # 预处理
        inputs = self.processor(
            images=image,
            return_tensors="pt",
            padding=True
        ).to(self.device)
        
        # 提取特征
        with torch.no_grad():
            image_features = self.model.get_image_features(**inputs)
        
        # 转换为 numpy
        features = image_features.cpu().numpy().flatten()
        
        # 归一化
        if normalize:
            features = features / np.linalg.norm(features)
        
        return features.astype(np.float32)
    
    def extract_batch_features(
        self,
        images: List[Union[str, Image.Image]],
        batch_size: int = 32,
        normalize: bool = True
    ) -> np.ndarray:
        """
        批量提取图片特征（提高效率）
        
        Args:
            images: 图片路径或 PIL Image 对象列表
            batch_size: 批次大小
            normalize: 是否归一化
            
        Returns:
            特征矩阵 (N x D)
        """
        all_features = []
        
        for i in range(0, len(images), batch_size):
            batch = images[i:i + batch_size]
            
            # 加载图片
            pil_images = []
            for img in batch:
                if isinstance(img, str):
                    pil_images.append(Image.open(img).convert("RGB"))
                else:
                    pil_images.append(img)
            
            # 预处理
            inputs = self.processor(
                images=pil_images,
                return_tensors="pt",
                padding=True
            ).to(self.device)
            
            # 提取特征
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
            
            # 转换为 numpy
            features = image_features.cpu().numpy()
            
            # 归一化
            if normalize:
                features = features / np.linalg.norm(features, axis=1, keepdims=True)
            
            all_features.append(features)
        
        return np.vstack(all_features).astype(np.float32)
    
    def get_embedding_dim(self) -> int:
        """获取特征维度"""
        return self.embedding_dim
    
    def get_model_info(self) -> dict:
        """获取模型信息"""
        return {
            "model_name": self.model_name,
            "embedding_dim": self.embedding_dim,
            "device": self.device,
            "cache_dir": self.cache_dir
        }


# 全局实例（延迟初始化）
_embedder = None


def get_embedder() -> CLIPEmbedder:
    """获取全局 embedder 实例"""
    global _embedder
    if _embedder is None:
        _embedder = CLIPEmbedder()
    return _embedder

