"""配对 API"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import socket
from typing import List, Optional
from datetime import datetime

from ..security import get_token_manager, is_local_network_ip
from ..database import get_db
from ..models.device import Device

router = APIRouter()


class PairingInfo(BaseModel):
    """配对信息"""
    http_url: str
    ws_url: str
    token: str
    expires_in: int
    local_ip: str
    all_ips: list[str] = []  # 所有可用的局域网 IP


def get_all_local_ips() -> list[str]:
    """获取本机所有局域网 IP"""
    ips = []
    try:
        # 获取主机名对应的所有 IP
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip != "127.0.0.1" and not ip.startswith("169.254"):
                ips.append(ip)
    except Exception:
        pass
    
    # 备用方法：通过 UDP socket 获取
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
    """获取本机最可能的局域网 IP（优先 192.168.x.x 和 10.x.x.x）"""
    ips = get_all_local_ips()
    
    if not ips:
        return "127.0.0.1"
    
    # 优先级：192.168.x.x > 10.x.x.x > 172.16-31.x.x > 其他
    for ip in ips:
        if ip.startswith("192.168."):
            return ip
    
    for ip in ips:
        if ip.startswith("10."):
            return ip
    
    for ip in ips:
        parts = ip.split(".")
        if len(parts) == 4 and parts[0] == "172":
            second = int(parts[1])
            if 16 <= second <= 31:
                return ip
    
    return ips[0]


@router.post("/generate_pairing_code", response_model=PairingInfo)
async def generate_pairing_code(
    request: Request,
    validity_seconds: int = 300
):
    """
    生成配对二维码信息
    
    **功能**:
    - 生成一次性配对 Token
    - 返回 HTTP/WebSocket 地址
    - 用于小程序扫码配对
    
    **参数**:
    - validity_seconds: Token 有效期（秒），默认 300 秒（5分钟）
    
    **返回**:
    - http_url: HTTP API 地址
    - ws_url: WebSocket 地址
    - token: 配对 Token
    - expires_in: 过期时间（秒）
    - local_ip: 本机局域网 IP
    """
    # 获取本机 IP
    local_ip = get_local_ip()
    all_ips = get_all_local_ips()
    
    # 从配置获取端口（默认 8000）
    port = 8000  # 可以从环境变量或配置文件读取
    
    # 生成 Token
    token_manager = get_token_manager()
    token = token_manager.generate_pairing_token(validity_seconds)
    
    # 构建 URL
    http_url = f"http://{local_ip}:{port}"
    ws_url = f"ws://{local_ip}:{port}/ws"
    
    return PairingInfo(
        http_url=http_url,
        ws_url=ws_url,
        token=token,
        expires_in=validity_seconds,
        local_ip=local_ip,
        all_ips=all_ips
    )


@router.get("/validate_token")
async def validate_token(
    token: str,
    request: Request
):
    """
    验证 Token（用于客户端验证）
    
    **功能**:
    - 验证 Token 是否有效
    - 检查客户端 IP 是否为局域网
    
    **注意**: 不会标记 Token 为已使用
    """
    # 检查客户端 IP
    client_ip = request.client.host
    
    if not is_local_network_ip(client_ip):
        raise HTTPException(
            status_code=403,
            detail="仅允许局域网访问"
        )
    
    # 验证 Token（不标记为已使用）
    token_manager = get_token_manager()
    is_valid = token_manager.validate_token(token, mark_as_used=False)
    
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Token 无效或已过期"
        )
    
    return {
        "valid": True,
        "message": "Token 有效"
    }


@router.get("/pairing_status")
async def get_pairing_status():
    """
    获取配对状态
    
    **功能**:
    - 显示活跃 Token 数量
    - 显示本机 IP
    """
    token_manager = get_token_manager()
    
    return {
        "local_ip": get_local_ip(),
        "active_tokens": token_manager.get_active_tokens_count()
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

