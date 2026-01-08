"""AI 分析 API"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.analysis_service import AnalysisService

router = APIRouter()


@router.get("/restock_suggestion")
async def get_restock_suggestions(
    days: int = Query(30, ge=7, le=90, description="历史统计天数"),
    safety_stock_days: int = Query(7, ge=1, le=30, description="安全库存天数"),
    db: Session = Depends(get_db)
):
    """
    智能补货建议
    
    **算法**:
    1. 计算最近 N 天的日均销量
    2. 计算最近 7 天的日均销量（短期趋势）
    3. 预测未来需求 = max(N天均值, 7天均值)
    4. 安全库存 = 预测日销量 × 安全库存天数
    5. 建议补货量 = 安全库存 - 当前库存
    
    **返回**:
    - 只返回需要补货的商品
    - 按紧急程度排序（预计缺货天数越少越紧急）
    - 包含置信度和原因说明
    
    **示例**: `/analysis/restock_suggestion?days=30&safety_stock_days=7`
    """
    service = AnalysisService(db)
    return service.get_restock_suggestions(days, safety_stock_days)


@router.get("/anomaly_detection")
async def detect_anomalies(
    days: int = Query(30, ge=7, le=90, description="历史统计天数"),
    threshold_std: float = Query(2.0, ge=1.0, le=5.0, description="标准差阈值倍数"),
    db: Session = Depends(get_db)
):
    """
    销量异常检测
    
    **算法**:
    1. 计算每个商品最近 N 天的日销量均值和标准差
    2. 检测最近 7 天的异常：|当日销量 - 均值| > threshold × 标准差
    3. 分类：销量突增、销量突降、零销售
    
    **异常类型**:
    - `surge`: 销量突增（可能是促销、节假日等）
    - `drop`: 销量突降（可能是缺货、竞品促销等）
    - `zero`: 零销售（可能是缺货、下架等）
    
    **严重程度**:
    - `high`: 偏离 > 3 倍标准差
    - `medium`: 偏离 2-3 倍标准差
    - `low`: 偏离 1-2 倍标准差
    
    **示例**: `/analysis/anomaly_detection?days=30&threshold_std=2.0`
    """
    service = AnalysisService(db)
    return service.detect_anomalies(days, threshold_std)


