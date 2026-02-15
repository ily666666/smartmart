"""应用配置"""

import os
import sys
from pathlib import Path


def get_base_dir():
    """获取应用基础目录（支持 PyInstaller 打包）"""
    if getattr(sys, 'frozen', False):
        # 打包后的 exe，使用 exe 所在目录
        return Path(sys.executable).parent
    else:
        # 开发模式，使用当前工作目录
        return Path.cwd()


# 应用基础目录
BASE_DIR = get_base_dir()


class Settings:
    """应用配置"""
    
    # 数据库 - 使用绝对路径
    DATABASE_URL = f"sqlite:///{BASE_DIR / 'smartmart.db'}"
    
    # CORS
    CORS_ORIGINS = ["*"]  # 开发环境允许所有源，生产环境应限制
    
    # 文件上传 - 使用绝对路径
    UPLOAD_DIR = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
    
    # WebSocket
    WS_HEARTBEAT_INTERVAL = 30  # 秒
    
    # ==================== AI 模型配置 ====================
    # CLIP 模型配置
    CLIP_MODEL_NAME = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
    MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", str(BASE_DIR / "models"))
    
    # FAISS 索引配置
    FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", str(BASE_DIR / "data" / "index" / "products.index"))
    FAISS_METADATA_PATH = os.getenv("FAISS_METADATA_PATH", str(BASE_DIR / "data" / "index" / "products_metadata.json"))
    
    # 识别配置
    TOP_K = int(os.getenv("TOP_K", "5"))  # 返回前 K 个最相似的结果
    SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.7"))  # 相似度阈值
    
    # 样本数据目录
    SAMPLES_DIR = os.getenv("SAMPLES_DIR", str(BASE_DIR / "data" / "samples"))
    
    # 静态文件目录
    STATIC_DIR = BASE_DIR / "static"
    
    # API 连接密码（为空表示不需要密码）
    # 设置后，所有 API 请求必须在请求头带上 X-API-Key
    API_KEY = os.getenv("API_KEY", "smartmart2026")
    
    # 调试
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"


settings = Settings()

# 确保必要目录存在
try:
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    Path(settings.MODEL_CACHE_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.SAMPLES_DIR).mkdir(parents=True, exist_ok=True)
    Path(os.path.dirname(settings.FAISS_INDEX_PATH)).mkdir(parents=True, exist_ok=True)
    settings.STATIC_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"⚠️ 创建目录时出错: {e}")
    print(f"   基础目录: {BASE_DIR}")