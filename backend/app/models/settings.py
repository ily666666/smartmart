"""系统设置模型"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class SystemSettings(Base):
    """系统设置表 - 单行存储所有设置"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, default=1)
    # 安全设置
    password = Column(String(100), default="admin")
    security_question = Column(String(200), default="您的出生城市是？")
    security_answer = Column(String(100), default="")
    # 页面可见性（JSON 字符串存储）
    page_visibility = Column(Text, default="{}")
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SystemSettings id={self.id}>"
