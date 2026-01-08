"""应用配置"""

import os
from pathlib import Path


class Settings:
    """应用配置"""
    
    # 数据库
    DATABASE_URL = "sqlite:///./smartmart.db"
    
    # CORS
    CORS_ORIGINS = ["*"]  # 开发环境允许所有源，生产环境应限制
    
    # 文件上传
    UPLOAD_DIR = Path("./uploads")
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
    
    # WebSocket
    WS_HEARTBEAT_INTERVAL = 30  # 秒
    
    # ==================== AI 模型配置 ====================
    # CLIP 模型配置
    CLIP_MODEL_NAME = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
    MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./models")
    
    # FAISS 索引配置
    FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "./data/index/products.index")
    FAISS_METADATA_PATH = os.getenv("FAISS_METADATA_PATH", "./data/index/products_metadata.json")
    
    # 识别配置
    TOP_K = int(os.getenv("TOP_K", "5"))  # 返回前 K 个最相似的结果
    SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.7"))  # 相似度阈值
    
    # 样本数据目录
    SAMPLES_DIR = os.getenv("SAMPLES_DIR", "./data/samples")
    
    # 调试
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"


settings = Settings()

# 确保必要目录存在
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
Path(settings.MODEL_CACHE_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.SAMPLES_DIR).mkdir(parents=True, exist_ok=True)
Path(os.path.dirname(settings.FAISS_INDEX_PATH)).mkdir(parents=True, exist_ok=True)