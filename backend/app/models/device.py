"""设备模型"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import Base


class Device(Base):
    """设备表 - MVP 版本"""
    
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(100), unique=True, index=True, nullable=False)
    device_type = Column(String(50))  # desktop, miniapp, scanner
    device_name = Column(String(200))
    authenticated = Column(Boolean, default=False)  # 是否已通过 Token 认证
    last_seen = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    created_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))


