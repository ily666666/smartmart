"""商品模型"""

from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import Base


# 预定义的商品分类
PRODUCT_CATEGORIES = [
    "休闲食品",
    "饮料冲调",
    "烟酒茶叶",
    "零食糖果",
    "生鲜果蔬",
    "粮油调味",
    "日用百货",
    "个护清洁",
    "母婴用品",
    "文具办公",
    "其他"
]


class Product(Base):
    """商品表"""
    
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    barcode = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), default="其他", index=True)  # 商品分类
    price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)  # 进价
    stock = Column(Integer, default=0)
    image_url = Column(String(500), nullable=True)  # 商品图片URL
    created_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    updated_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")), onupdate=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))

