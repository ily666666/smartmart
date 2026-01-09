"""数据库管理 API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database import get_db
from app.models.product import Product
from app.models.transaction import Order, OrderItem
from app.models.device import Device
from app.models.settings import SystemSettings

router = APIRouter()


# 表名到模型的映射
TABLE_MODELS = {
    "products": Product,
    "orders": Order,
    "order_items": OrderItem,
    "devices": Device,
    "system_settings": SystemSettings,
}

# 表的中文名称
TABLE_NAMES_CN = {
    "products": "商品表",
    "orders": "订单表",
    "order_items": "订单明细表",
    "devices": "设备表",
    "system_settings": "系统设置表",
}


@router.get("/tables")
async def get_tables(db: Session = Depends(get_db)):
    """获取所有数据表信息"""
    inspector = inspect(db.bind)
    tables = []
    
    for table_name in inspector.get_table_names():
        if table_name in TABLE_MODELS:
            model = TABLE_MODELS[table_name]
            count = db.query(model).count()
            
            # 获取列信息
            columns = []
            for column in inspector.get_columns(table_name):
                columns.append({
                    "name": column["name"],
                    "type": str(column["type"]),
                    "nullable": column.get("nullable", True),
                })
            
            tables.append({
                "name": table_name,
                "name_cn": TABLE_NAMES_CN.get(table_name, table_name),
                "count": count,
                "columns": columns,
            })
    
    return {"tables": tables}


@router.get("/tables/{table_name}")
async def get_table_data(
    table_name: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """获取指定表的数据"""
    if table_name not in TABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
    
    model = TABLE_MODELS[table_name]
    
    # 获取总数
    total = db.query(model).count()
    
    # 获取数据
    records = db.query(model).offset(skip).limit(limit).all()
    
    # 转换为字典
    data = []
    for record in records:
        record_dict = {}
        for column in record.__table__.columns:
            value = getattr(record, column.name)
            # 处理日期时间类型
            if isinstance(value, datetime):
                value = value.isoformat()
            record_dict[column.name] = value
        data.append(record_dict)
    
    return {
        "table": table_name,
        "table_cn": TABLE_NAMES_CN.get(table_name, table_name),
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": data,
    }


@router.delete("/tables/{table_name}/records/{record_id}")
async def delete_record(
    table_name: str,
    record_id: int,
    db: Session = Depends(get_db)
):
    """删除指定记录"""
    if table_name not in TABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
    
    model = TABLE_MODELS[table_name]
    record = db.query(model).filter(model.id == record_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail=f"记录 ID={record_id} 不存在")
    
    db.delete(record)
    db.commit()
    
    return {"success": True, "message": f"记录 ID={record_id} 已删除"}


@router.delete("/tables/{table_name}/records")
async def delete_multiple_records(
    table_name: str,
    ids: str = Query(..., description="逗号分隔的ID列表"),
    db: Session = Depends(get_db)
):
    """批量删除记录"""
    if table_name not in TABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
    
    try:
        id_list = [int(id.strip()) for id in ids.split(",") if id.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ID 格式错误")
    
    if not id_list:
        raise HTTPException(status_code=400, detail="未提供有效的 ID")
    
    model = TABLE_MODELS[table_name]
    deleted_count = db.query(model).filter(model.id.in_(id_list)).delete(synchronize_session=False)
    db.commit()
    
    return {"success": True, "deleted_count": deleted_count, "message": f"已删除 {deleted_count} 条记录"}


@router.delete("/tables/{table_name}/clear")
async def clear_table(
    table_name: str,
    confirm: str = Query(..., description="确认码，必须是 'CONFIRM_CLEAR'"),
    db: Session = Depends(get_db)
):
    """清空表数据（危险操作）"""
    if table_name not in TABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
    
    if confirm != "CONFIRM_CLEAR":
        raise HTTPException(status_code=400, detail="确认码错误，请输入 'CONFIRM_CLEAR'")
    
    model = TABLE_MODELS[table_name]
    
    # 如果是订单表，需要先清除订单明细
    if table_name == "orders":
        db.query(OrderItem).delete()
    
    deleted_count = db.query(model).delete()
    db.commit()
    
    return {
        "success": True, 
        "deleted_count": deleted_count, 
        "message": f"表 {table_name} 已清空，删除了 {deleted_count} 条记录"
    }


@router.get("/tables/{table_name}/export")
async def export_table(
    table_name: str,
    format: str = Query("json", description="导出格式: json 或 csv"),
    db: Session = Depends(get_db)
):
    """导出表数据"""
    if table_name not in TABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
    
    model = TABLE_MODELS[table_name]
    records = db.query(model).all()
    
    # 转换为字典列表
    data = []
    columns = []
    
    for record in records:
        record_dict = {}
        for column in record.__table__.columns:
            if not columns:
                columns.append(column.name)
            value = getattr(record, column.name)
            if isinstance(value, datetime):
                value = value.isoformat()
            record_dict[column.name] = value
        data.append(record_dict)
        if columns:
            columns = list(record_dict.keys())
    
    if format == "csv":
        # 生成 CSV 格式
        if not data:
            return {"format": "csv", "content": ""}
        
        lines = [",".join(columns)]
        for row in data:
            values = []
            for col in columns:
                val = row.get(col, "")
                if val is None:
                    val = ""
                # 处理包含逗号或引号的值
                val_str = str(val)
                if "," in val_str or '"' in val_str or "\n" in val_str:
                    val_str = '"' + val_str.replace('"', '""') + '"'
                values.append(val_str)
            lines.append(",".join(values))
        
        return {
            "format": "csv",
            "table": table_name,
            "content": "\n".join(lines),
            "filename": f"{table_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    
    return {
        "format": "json",
        "table": table_name,
        "total": len(data),
        "columns": columns,
        "data": data,
        "filename": f"{table_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    }


@router.get("/stats")
async def get_database_stats(db: Session = Depends(get_db)):
    """获取数据库统计信息"""
    stats = {
        "tables": {},
        "total_records": 0,
    }
    
    for table_name, model in TABLE_MODELS.items():
        count = db.query(model).count()
        stats["tables"][table_name] = {
            "name_cn": TABLE_NAMES_CN.get(table_name, table_name),
            "count": count,
        }
        stats["total_records"] += count
    
    return stats
