"""系统设置 API"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Optional

from app.database import get_db
from app.models.settings import SystemSettings

router = APIRouter(prefix="/settings", tags=["settings"])


# ========== Pydantic 模型 ==========

class SettingsResponse(BaseModel):
    password: str
    security_question: str
    security_answer: str
    page_visibility: Dict[str, bool]

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    password: Optional[str] = None
    security_question: Optional[str] = None
    security_answer: Optional[str] = None
    page_visibility: Optional[Dict[str, bool]] = None


class PasswordVerify(BaseModel):
    password: str


class PasswordReset(BaseModel):
    security_answer: str
    new_password: str


# ========== 辅助函数 ==========

def get_or_create_settings(db: Session) -> SystemSettings:
    """获取或创建设置记录（确保只有一条记录）"""
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(
            id=1,
            password="admin",
            security_question="您的出生城市是？",
            security_answer="",
            page_visibility="{}"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def settings_to_response(settings: SystemSettings) -> SettingsResponse:
    """将数据库模型转换为响应模型"""
    try:
        page_visibility = json.loads(settings.page_visibility) if settings.page_visibility else {}
    except json.JSONDecodeError:
        page_visibility = {}
    
    return SettingsResponse(
        password=settings.password,
        security_question=settings.security_question,
        security_answer=settings.security_answer or "",
        page_visibility=page_visibility
    )


# ========== API 路由 ==========

@router.get("", response_model=SettingsResponse)
async def get_settings(db: Session = Depends(get_db)):
    """获取系统设置"""
    settings = get_or_create_settings(db)
    return settings_to_response(settings)


@router.put("", response_model=SettingsResponse)
async def update_settings(update: SettingsUpdate, db: Session = Depends(get_db)):
    """更新系统设置"""
    settings = get_or_create_settings(db)
    
    if update.password is not None:
        settings.password = update.password
    if update.security_question is not None:
        settings.security_question = update.security_question
    if update.security_answer is not None:
        settings.security_answer = update.security_answer
    if update.page_visibility is not None:
        settings.page_visibility = json.dumps(update.page_visibility)
    
    db.commit()
    db.refresh(settings)
    return settings_to_response(settings)


@router.post("/verify-password")
async def verify_password(data: PasswordVerify, db: Session = Depends(get_db)):
    """验证密码"""
    settings = get_or_create_settings(db)
    if data.password == settings.password:
        return {"success": True, "message": "密码正确"}
    else:
        raise HTTPException(status_code=401, detail="密码错误")


@router.post("/reset-password")
async def reset_password(data: PasswordReset, db: Session = Depends(get_db)):
    """通过密保问题重置密码"""
    settings = get_or_create_settings(db)
    
    # 检查是否设置了密保
    if not settings.security_answer:
        raise HTTPException(status_code=400, detail="未设置密保问题")
    
    # 验证密保答案（不区分大小写）
    if data.security_answer.lower() != settings.security_answer.lower():
        raise HTTPException(status_code=401, detail="密保答案错误")
    
    # 重置密码
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="密码至少4位")
    
    settings.password = data.new_password
    db.commit()
    
    return {"success": True, "message": "密码已重置"}


@router.post("/reset-to-default")
async def reset_to_default(db: Session = Depends(get_db)):
    """重置密码为默认值（未设置密保时使用）"""
    settings = get_or_create_settings(db)
    settings.password = "admin"
    db.commit()
    return {"success": True, "message": "密码已重置为默认值 admin"}
