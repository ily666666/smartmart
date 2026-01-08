"""订单管理 API - MVP 版本"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.database import get_db
from app.models.transaction import Order, OrderItem
from app.models.product import Product

router = APIRouter()


class OrderItemRequest(BaseModel):
    """订单商品项"""
    product_id: int  # 0 表示称重商品
    barcode: str
    name: Optional[str] = None  # 商品名称（称重商品必填）
    quantity: int
    price: float


class CreateOrderRequest(BaseModel):
    """创建订单请求"""
    items: List[OrderItemRequest]
    total_amount: float
    cashier: str = "收银员"


@router.post("/create")
async def create_order(
    request: CreateOrderRequest,
    db: Session = Depends(get_db)
):
    """
    创建订单
    
    **请求示例**:
    ```json
    {
      "items": [
        {
          "product_id": 1,
          "barcode": "6901028075831",
          "quantity": 2,
          "price": 3.5
        }
      ],
      "total_amount": 7.0,
      "cashier": "收银员01"
    }
    ```
    
    **返回**:
    ```json
    {
      "order_id": 1,
      "order_no": "ORD20250101120000",
      "total_amount": 7.0,
      "status": "completed",
      "items_count": 1,
      "message": "订单创建成功"
    }
    ```
    """
    if not request.items:
        raise HTTPException(status_code=400, detail="订单商品不能为空")
    
    # 生成订单号
    order_no = f"ORD{datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d%H%M%S')}"
    
    # 创建订单（确保金额精度）
    order = Order(
        order_no=order_no,
        total_amount=round(request.total_amount, 2),
        status="completed",
        cashier=request.cashier
    )
    db.add(order)
    db.flush()  # 获取订单 ID
    
    # 创建订单明细并扣减库存
    for item_data in request.items:
        # 判断是否为称重商品（product_id = 0 或条码以 manual_ 开头）
        is_manual_item = item_data.product_id == 0 or item_data.barcode.startswith("manual_")
        
        if is_manual_item:
            # 称重商品：不验证库存，直接添加
            order_item = OrderItem(
                order_id=order.id,
                product_id=0,  # 称重商品用 0 表示
                product_name=item_data.name or "称重商品",
                quantity=item_data.quantity,
                unit_price=item_data.price,
                subtotal=round(item_data.price * item_data.quantity, 2)  # 保留2位小数
            )
            db.add(order_item)
        else:
            # 普通商品：验证存在并扣减库存
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                db.rollback()
                raise HTTPException(
                    status_code=404,
                    detail=f"商品 ID {item_data.product_id} 不存在"
                )
            
            # 检查库存
            if product.stock < item_data.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"商品 '{product.name}' 库存不足（库存: {product.stock}, 需要: {item_data.quantity}）"
                )
            
            # 创建订单明细
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data.product_id,
                product_name=product.name,
                quantity=item_data.quantity,
                unit_price=item_data.price,
                subtotal=round(item_data.price * item_data.quantity, 2)  # 保留2位小数
            )
            db.add(order_item)
            
            # 扣减库存
            product.stock -= item_data.quantity
    
    # 提交事务
    try:
        db.commit()
        db.refresh(order)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建订单失败: {str(e)}")
    
    return {
        "order_id": order.id,
        "order_no": order.order_no,
        "total_amount": order.total_amount,
        "status": order.status,
        "items_count": len(request.items),
        "message": "订单创建成功"
    }


@router.get("/list")
async def list_orders(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="页码（从1开始）"),
    page_size: int = Query(20, ge=1, le=100, description="每页记录数"),
    db: Session = Depends(get_db)
):
    """
    获取订单列表（支持分页）
    
    **参数**:
    - start_date: 开始日期 (YYYY-MM-DD)，可选
    - end_date: 结束日期 (YYYY-MM-DD)，可选
    - page: 页码，从1开始（默认 1）
    - page_size: 每页记录数（默认 20，最大 100）
    
    **示例**: `/orders/list?start_date=2025-01-01&end_date=2025-01-31&page=1&page_size=20`
    
    **返回**:
    ```json
    {
      "items": [...],
      "total": 100,
      "page": 1,
      "page_size": 20,
      "total_pages": 5,
      "total_amount": 12345.67
    }
    ```
    """
    query = db.query(Order)
    
    # 日期范围筛选
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Order.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误，应为 YYYY-MM-DD")
    
    if end_date:
        try:
            # 结束日期包含当天，所以加一天
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Order.created_at < end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误，应为 YYYY-MM-DD")
    
    # 获取总数
    total = query.count()
    
    # 计算总金额（在分页前）
    total_amount_result = query.with_entities(func.sum(Order.total_amount)).scalar()
    total_amount = float(total_amount_result) if total_amount_result else 0.0
    
    # 分页查询
    skip = (page - 1) * page_size
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(page_size).all()
    
    # 计算总页数
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": [
            {
                "id": o.id,
                "order_no": o.order_no,
                "total_amount": round(o.total_amount, 2),
                "status": o.status,
                "cashier": o.cashier,
                "created_at": o.created_at.isoformat()
            }
            for o in orders
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "total_amount": round(total_amount, 2)
    }


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    """获取订单详情（包含商品名称）"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    # 获取订单明细
    items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    
    return {
        "id": order.id,
        "order_no": order.order_no,
        "total_amount": round(order.total_amount, 2),
        "status": order.status,
        "cashier": order.cashier,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name or "未知商品",
                "quantity": item.quantity,
                "unit_price": round(item.unit_price, 2),
                "subtotal": round(item.subtotal, 2)
            }
            for item in items
        ]
    }


@router.delete("/{order_id}")
async def delete_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    删除订单（不恢复库存）
    
    用于删除错误订单或测试数据
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    # 删除订单明细
    db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
    
    # 删除订单
    db.delete(order)
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除订单失败: {str(e)}")
    
    return {
        "message": "订单删除成功",
        "order_id": order_id,
        "order_no": order.order_no
    }


@router.post("/{order_id}/revoke")
async def revoke_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    撤销订单（恢复库存，返回商品信息）
    
    用于误操作后撤销订单，将商品返回收银台继续编辑
    
    **返回**:
    ```json
    {
      "message": "订单撤销成功",
      "order_id": 1,
      "order_no": "ORD20250101120000",
      "items": [
        {
          "product_id": 1,
          "barcode": "6901028075831",
          "name": "可口可乐",
          "price": 3.5,
          "quantity": 2,
          "stock": 100
        }
      ]
    }
    ```
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    # 获取订单明细
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    
    # 恢复库存并收集商品信息
    items_for_cart = []
    for item in order_items:
        if item.product_id and item.product_id > 0:
            # 普通商品：恢复库存
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.stock += item.quantity
                items_for_cart.append({
                    "product_id": product.id,
                    "barcode": product.barcode,
                    "name": product.name,
                    "price": round(item.unit_price, 2),
                    "quantity": item.quantity,
                    "stock": product.stock
                })
            else:
                # 商品已删除，仍然返回信息但标记为手动商品
                items_for_cart.append({
                    "product_id": 0,
                    "barcode": f"manual_{datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d%H%M%S')}_{len(items_for_cart)}",
                    "name": item.product_name or "未知商品",
                    "price": round(item.unit_price, 2),
                    "quantity": item.quantity,
                    "stock": 999
                })
        else:
            # 称重/手动商品：直接返回信息
            items_for_cart.append({
                "product_id": 0,
                "barcode": f"manual_{datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d%H%M%S')}_{len(items_for_cart)}",
                "name": item.product_name or "称重商品",
                "price": round(item.unit_price, 2),
                "quantity": item.quantity,
                "stock": 999
            })
    
    # 删除订单明细
    db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
    
    # 删除订单
    order_no = order.order_no
    db.delete(order)
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"撤销订单失败: {str(e)}")
    
    return {
        "message": "订单撤销成功，商品已返回收银台",
        "order_id": order_id,
        "order_no": order_no,
        "items": items_for_cart
    }
