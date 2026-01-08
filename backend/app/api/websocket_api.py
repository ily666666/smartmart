"""WebSocket API - MVP 版本"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import SessionLocal
from app.models.product import Product
from app.models.device import Device
from app.security import get_token_manager

router = APIRouter()


class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    def is_device_authenticated(self, device_id: str) -> bool:
        """检查设备是否已认证（从数据库查询）"""
        db = SessionLocal()
        try:
            device = db.query(Device).filter(Device.device_id == device_id).first()
            return device is not None and device.authenticated
        finally:
            db.close()
    
    def mark_device_authenticated(self, device_id: str, device_type: str):
        """标记设备为已认证（保存到数据库）"""
        db = SessionLocal()
        try:
            device = db.query(Device).filter(Device.device_id == device_id).first()
            if device:
                device.authenticated = True
                device.device_type = device_type
                device.last_seen = datetime.now(ZoneInfo("Asia/Shanghai"))
            else:
                device = Device(
                    device_id=device_id,
                    device_type=device_type,
                    device_name=device_id,
                    authenticated=True
                )
                db.add(device)
            db.commit()
            print(f"💾 设备 {device_id} 已标记为已认证")
        except Exception as e:
            print(f"⚠️ 标记设备认证状态失败: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def connect(self, device_id: str, websocket: WebSocket):
        """接受连接"""
        await websocket.accept()
        self.active_connections[device_id] = websocket
        print(f"✅ 设备 {device_id} 已连接，当前在线: {len(self.active_connections)}")
        
        # 更新设备记录
        self._update_device(device_id)
    
    def disconnect(self, device_id: str):
        """断开连接"""
        if device_id in self.active_connections:
            del self.active_connections[device_id]
            print(f"❌ 设备 {device_id} 已断开，当前在线: {len(self.active_connections)}")
    
    async def send_to_device(self, device_id: str, message: dict):
        """发送消息给指定设备"""
        if device_id in self.active_connections:
            try:
                await self.active_connections[device_id].send_json(message)
            except Exception as e:
                print(f"⚠️ 发送消息到 {device_id} 失败: {e}")
    
    async def broadcast(self, message: dict, exclude: str = None):
        """广播消息给所有连接的设备"""
        for device_id, connection in list(self.active_connections.items()):
            if device_id != exclude:  # 排除发送者
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"⚠️ 广播到 {device_id} 失败: {e}")
    
    def _update_device(self, device_id: str):
        """更新设备最后在线时间"""
        db = SessionLocal()
        try:
            device = db.query(Device).filter(Device.device_id == device_id).first()
            if device:
                device.last_seen = datetime.now(ZoneInfo("Asia/Shanghai"))
            else:
                device = Device(
                    device_id=device_id,
                    device_type="unknown",
                    device_name=device_id
                )
                db.add(device)
            db.commit()
        except Exception as e:
            print(f"⚠️ 更新设备记录失败: {e}")
            db.rollback()
        finally:
            db.close()


# 全局连接管理器
manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 连接端点
    
    **支持的消息格式**:
    
    1. 客户端发送 - 扫码事件:
    ```json
    {
        "type": "SCAN_BARCODE",
        "code": "6901028075831",
        "device_id": "desktop-001",
        "ts": 1234567890
    }
    ```
    
    2. 服务端响应 - 商品找到:
    ```json
    {
        "type": "PRODUCT_FOUND",
        "sku_id": 1,
        "name": "可口可乐",
        "price": 3.50,
        "code": "6901028075831",
        "source": "desktop-001",
        "ts": 1234567890
    }
    ```
    
    3. 服务端响应 - 商品未找到:
    ```json
    {
        "type": "PRODUCT_NOT_FOUND",
        "code": "123456",
        "source": "desktop-001",
        "ts": 1234567890
    }
    ```
    """
    device_id = None
    
    authenticated = False  # 是否已通过 Token 验证
    
    try:
        # 接受连接
        await websocket.accept()
        
        # 发送欢迎消息，要求注册
        await websocket.send_json({
            "type": "CONNECTED",
            "message": "WebSocket 连接成功，请发送 REGISTER 消息完成注册",
            "require_token": True,
            "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
        })
        
        while True:
            # 接收消息
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            
            # 处理设备注册（带 Token 验证）
            if msg_type == "REGISTER":
                device_id = message.get("device_id")
                token = message.get("token")
                device_type = message.get("device_type", "unknown")
                
                if not device_id:
                    await websocket.send_json({
                        "type": "REGISTER_FAILED",
                        "message": "缺少 device_id",
                        "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                    })
                    continue
                
                # 验证 Token（桌面端不需要 Token，小程序需要）
                if device_type == "miniapp":
                    # 检查是否是已认证过的设备（从数据库查询，允许重连）
                    if manager.is_device_authenticated(device_id):
                        authenticated = True
                        print(f"🔄 设备重连: {device_id}（已认证，跳过 Token 验证）")
                    elif token:
                        # 首次连接，验证 Token
                        token_manager = get_token_manager()
                        if token_manager.validate_token(token, mark_as_used=True):
                            authenticated = True
                            manager.mark_device_authenticated(device_id, device_type)
                            print(f"🔐 Token 验证成功: {device_id}")
                        else:
                            await websocket.send_json({
                                "type": "REGISTER_FAILED",
                                "message": "Token 无效或已过期，请重新扫码",
                                "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                            })
                            print(f"❌ Token 验证失败: {device_id}")
                            continue
                    else:
                        # 没有 Token 且不是已认证设备
                        await websocket.send_json({
                            "type": "REGISTER_FAILED",
                            "message": "需要配对 Token，请扫码配对",
                            "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                        })
                        print(f"❌ 缺少 Token: {device_id}")
                        continue
                elif device_type == "desktop":
                    # 桌面端不需要 Token 验证
                    authenticated = True
                    manager.mark_device_authenticated(device_id, device_type)
                else:
                    # 未知设备类型，拒绝连接
                    await websocket.send_json({
                        "type": "REGISTER_FAILED",
                        "message": "未知设备类型",
                        "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                    })
                    continue
                
                manager.active_connections[device_id] = websocket
                manager._update_device(device_id)
                
                await websocket.send_json({
                    "type": "REGISTER_SUCCESS",
                    "device_id": device_id,
                    "authenticated": authenticated,
                    "message": "注册成功",
                    "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                })
                print(f"✅ 设备 {device_id} 已注册 (authenticated={authenticated})")
                continue
            
            # 未注册的设备不允许发送其他消息
            if not authenticated:
                await websocket.send_json({
                    "type": "ERROR",
                    "message": "请先发送 REGISTER 消息完成注册",
                    "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                })
                continue
            
            # 处理扫码事件
            if msg_type == "SCAN_BARCODE":
                await handle_scan_barcode(message, device_id or "unknown")
            
            # 处理添加商品事件（外观识别确认）
            elif msg_type == "ADD_ITEM":
                await handle_add_item(message, device_id or "unknown")
            
            # 处理心跳
            elif msg_type == "PING":
                await websocket.send_json({
                    "type": "PONG",
                    "ts": int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp())
                })
    
    except WebSocketDisconnect:
        if device_id:
            manager.disconnect(device_id)
        print(f"❌ WebSocket 连接断开: {device_id or 'unknown'}")
    
    except Exception as e:
        print(f"⚠️ WebSocket 错误: {e}")
        if device_id:
            manager.disconnect(device_id)


async def handle_scan_barcode(message: dict, device_id: str):
    """
    处理扫码事件
    
    Args:
        message: 扫码消息 {type, code, device_id, ts}
        device_id: 发送设备 ID
    """
    code = message.get("code")
    ts = message.get("ts", int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp()))
    
    if not code:
        print("⚠️ 扫码消息缺少 code 字段")
        return
    
    print(f"📱 收到扫码: {code} (来自: {device_id})")
    
    # 查询商品
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.barcode == code).first()
        
        if product:
            # 商品找到
            response = {
                "type": "PRODUCT_FOUND",
                "sku_id": product.id,
                "name": product.name,
                "price": product.price,
                "stock": product.stock,
                "code": code,
                "source": device_id,
                "ts": ts
            }
            print(f"✅ 找到商品: {product.name}")
        else:
            # 商品未找到
            response = {
                "type": "PRODUCT_NOT_FOUND",
                "code": code,
                "source": device_id,
                "ts": ts
            }
            print(f"❌ 未找到商品: {code}")
        
        # 广播给所有连接的设备
        await manager.broadcast(response)
        
    except Exception as e:
        print(f"⚠️ 查询商品失败: {e}")
    finally:
        db.close()


async def handle_add_item(message: dict, device_id: str):
    """
    处理添加商品事件（外观识别确认）
    
    Args:
        message: 添加商品消息 {type, sku_id, qty, source, ts}
        device_id: 发送设备 ID
    """
    sku_id = message.get("sku_id")
    qty = message.get("qty", 1)
    source = message.get("source", "vision_confirm")
    ts = message.get("ts", int(datetime.now(ZoneInfo("Asia/Shanghai")).timestamp()))
    
    if not sku_id:
        print("⚠️ 添加商品消息缺少 sku_id 字段")
        return
    
    print(f"📱 收到添加商品: sku_id={sku_id}, qty={qty} (来自: {device_id}, 来源: {source})")
    
    # 查询商品
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == sku_id).first()
        
        if product:
            # 商品找到
            response = {
                "type": "ADD_ITEM_SUCCESS",
                "sku_id": product.id,
                "barcode": product.barcode,
                "name": product.name,
                "price": product.price,
                "qty": qty,
                "source": source,
                "device_id": device_id,
                "ts": ts
            }
            print(f"✅ 添加商品: {product.name} x{qty}")
        else:
            # 商品未找到
            response = {
                "type": "ADD_ITEM_FAILED",
                "sku_id": sku_id,
                "message": "商品不存在",
                "source": source,
                "device_id": device_id,
                "ts": ts
            }
            print(f"❌ 商品不存在: sku_id={sku_id}")
        
        # 广播给所有连接的设备
        await manager.broadcast(response)
        
    except Exception as e:
        print(f"⚠️ 处理添加商品失败: {e}")
    finally:
        db.close()

