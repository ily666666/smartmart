"""配对 API

配对流程：
1. 桌面端调用 /generate_pairing_code 获取一次性 Token
2. 桌面端将 { server_url, api_key, token } 编码为 QR 码
3. 小程序扫码 → 自动保存服务器地址和密码 → 用 Token 注册 WebSocket
4. Token 验证通过后，小程序与桌面端实时联动

说明：
- server_url 和 api_key 由桌面端自己的配置决定，不在后端生成
- 后端只负责生成和验证 Token
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import socket

from ..security import get_token_manager
from ..database import get_db
from ..models.device import Device

router = APIRouter()


def get_all_local_ips() -> list[str]:
    """获取本机所有局域网 IP"""
    ips = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip != "127.0.0.1" and not ip.startswith("169.254"):
                ips.append(ip)
    except Exception:
        pass
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip not in ips and ip != "127.0.0.1":
            ips.append(ip)
    except Exception:
        pass
    
    return list(set(ips))


def get_local_ip() -> str:
    """获取本机最可能的局域网 IP（优先 192.168.x.x）"""
    ips = get_all_local_ips()
    if not ips:
        return "127.0.0.1"
    for ip in ips:
        if ip.startswith("192.168."):
            return ip
    for ip in ips:
        if ip.startswith("10."):
            return ip
    return ips[0]


@router.post("/generate_pairing_code")
async def generate_pairing_code(
    validity_seconds: int = 300
):
    """
    生成配对 Token + 本机局域网 IP
    
    **返回**:
    - token: 配对 Token（一次性，5分钟有效）
    - expires_in: 过期时间（秒）
    - local_ip: 推荐的局域网 IP
    - all_ips: 所有可用的局域网 IP（供桌面端选择）
    """
    token_manager = get_token_manager()
    token = token_manager.generate_pairing_token(validity_seconds)
    
    return {
        "token": token,
        "expires_in": validity_seconds,
        "local_ip": get_local_ip(),
        "all_ips": get_all_local_ips(),
    }


class DeviceInfo(BaseModel):
    """设备信息"""
    id: int
    device_id: str
    device_type: Optional[str] = None
    device_name: Optional[str] = None
    authenticated: bool = False
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


@router.get("/devices", response_model=List[DeviceInfo])
async def get_paired_devices(
    db: Session = Depends(get_db)
):
    """
    获取已配对设备列表
    
    **功能**:
    - 返回所有已注册的设备
    - 包含设备类型、名称、最后活跃时间等信息
    
    **返回**:
    - 设备列表
    """
    devices = db.query(Device).order_by(Device.last_seen.desc()).all()
    return devices


@router.delete("/devices/{device_id}")
async def delete_device(
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    删除已配对设备
    
    **功能**:
    - 根据 device_id 删除设备
    - 删除后该设备需要重新配对
    
    **参数**:
    - device_id: 设备唯一标识
    
    **返回**:
    - 删除结果
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=404,
            detail="设备不存在"
        )
    
    db.delete(device)
    db.commit()
    
    return {
        "success": True,
        "message": f"设备 {device_id} 已删除"
    }


@router.get("/devices/{device_id}", response_model=DeviceInfo)
async def get_device(
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    获取单个设备信息
    
    **参数**:
    - device_id: 设备唯一标识
    
    **返回**:
    - 设备信息
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=404,
            detail="设备不存在"
        )
    
    return device

