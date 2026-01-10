"""库存模型"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import Base


class InventoryMove(Base):
    """库存变动记录 - MVP 版本"""
    
    __tablename__ = "inventory_moves"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    move_type = Column(String(20), nullable=False)  # in: 进货, out: 出货, adjust: 调整
    quantity = Column(Integer, nullable=False)
    operator = Column(String(100))  # 操作员
    note = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))

