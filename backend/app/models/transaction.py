"""订单模型"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import Base


class Order(Base):
    """订单记录 - MVP 版本"""
    
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    total_amount = Column(Float, nullable=False, default=0)
    status = Column(String(20), default="pending")  # pending, completed, cancelled
    cashier = Column(String(100))  # 收银员
    created_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))


class OrderItem(Base):
    """订单明细 - MVP 版本"""
    
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, nullable=False, default=0)  # 0 表示称重商品
    product_name = Column(String(200), nullable=True)  # 商品名称，称重商品必填
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

