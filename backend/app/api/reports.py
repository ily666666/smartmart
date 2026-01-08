"""报表 API"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..services.report_service import ReportService

router = APIRouter()


@router.get("/sales_daily")
async def get_daily_sales_report(
    date: str = Query(..., description="日期 (YYYY-MM-DD)", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db)
):
    """
    日销售报表
    
    **功能**:
    - 统计指定日期的销售数据
    - 包含总销售额、订单数、热销商品、小时分布等
    
    **示例**: `/reports/sales_daily?date=2024-01-15`
    """
    service = ReportService(db)
    return service.get_daily_sales_report(date)


@router.get("/sales_monthly")
async def get_monthly_sales_report(
    month: str = Query(..., description="月份 (YYYY-MM)", pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db)
):
    """
    月销售报表
    
    **功能**:
    - 统计指定月份的销售数据
    - 包含月度总计、每日趋势、热销商品排行等
    
    **示例**: `/reports/sales_monthly?month=2024-01`
    """
    service = ReportService(db)
    return service.get_monthly_sales_report(month)


@router.get("/top_products")
async def get_top_products(
    days: int = Query(30, ge=1, le=365, description="统计天数"),
    db: Session = Depends(get_db)
):
    """
    热销商品排行
    
    **功能**:
    - 统计最近 N 天的热销商品
    - 按销量降序排列
    - 包含销量、销售额、订单数、当前库存等
    
    **示例**: `/reports/top_products?days=30`
    """
    service = ReportService(db)
    return service.get_top_products(days)


@router.get("/slow_movers")
async def get_slow_movers(
    days: int = Query(30, ge=1, le=365, description="统计天数"),
    min_stock: int = Query(0, ge=0, description="最低库存过滤"),
    db: Session = Depends(get_db)
):
    """
    滞销商品分析
    
    **功能**:
    - 统计最近 N 天的滞销商品
    - 滞销定义：销量低于平均每天 0.5 个
    - 包含库存积压情况、库存周转天数等
    
    **示例**: `/reports/slow_movers?days=30&min_stock=10`
    """
    service = ReportService(db)
    return service.get_slow_movers(days, min_stock)


@router.get("/profit")
async def get_profit_report(
    days: int = Query(None, ge=1, le=365, description="统计天数（与日期范围二选一）"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    include_no_cost: bool = Query(True, description="是否包含未设置进价的商品"),
    db: Session = Depends(get_db)
):
    """
    盈利分析报表
    
    **功能**:
    - 统计指定时间范围的盈利数据
    - 包含总销售额、总成本、总利润、利润率
    - 按商品统计利润排行
    
    **参数**:
    - days: 最近N天（与日期范围二选一，默认30天）
    - start_date/end_date: 自定义日期范围
    - include_no_cost: 是否包含未设置进价的商品（默认包含）
    
    **示例**: 
    - `/reports/profit?days=30`
    - `/reports/profit?start_date=2024-01-01&end_date=2024-01-31`
    """
    service = ReportService(db)
    return service.get_profit_report(
        days=days, 
        start_date=start_date, 
        end_date=end_date, 
        include_no_cost=include_no_cost
    )

