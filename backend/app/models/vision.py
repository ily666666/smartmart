"""外观识别模型"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import Base


class VisionSample(Base):
    """外观识别样本记录表"""
    
    __tablename__ = "vision_samples"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    image_path = Column(String(500), nullable=False)  # 图片存储路径
    upload_time = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))  # 上传时间
    device_id = Column(String(100))  # 设备ID
    device_type = Column(String(50))  # 设备类型（miniapp/desktop）
    
    # 识别结果
    confirmed_sku_id = Column(Integer)  # 用户确认的商品ID
    model_version = Column(String(50), default="v1_placeholder")  # 模型版本
    top_k_results = Column(Text)  # Top-K 结果（JSON 格式）
    top1_score = Column(Float)  # Top-1 置信度
    
    # 识别元数据
    image_width = Column(Integer)  # 图片宽度
    image_height = Column(Integer)  # 图片高度
    image_size = Column(Integer)  # 图片大小（字节）
    
    # 确认时间
    confirmed_at = Column(DateTime)  # 用户确认时间
    
    # 备注
    note = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))


