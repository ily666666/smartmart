"""AI 分析服务（本地算法，无需联网）"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict
import statistics

from ..models.product import Product
from ..models.transaction import Order, OrderItem


class AnalysisService:
    """本地 AI 分析服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_restock_suggestions(self, days: int = 30, safety_stock_days: int = 7) -> List[Dict]:
        """
        补货建议（基于移动平均）
        
        算法说明：
        1. 计算最近 N 天的日均销量
        2. 计算最近 7 天的日均销量（短期趋势）
        3. 预测未来需求 = max(N天均值, 7天均值)
        4. 安全库存 = 预测日销量 × 安全库存天数
        5. 建议补货量 = 安全库存 - 当前库存
        6. 只建议库存不足的商品
        
        参数：
        - days: 历史统计天数（默认 30 天）
        - safety_stock_days: 安全库存天数（默认 7 天）
        
        Returns:
            [
                {
                    "sku_id": 1,
                    "name": "商品名",
                    "current_stock": 10,
                    "avg_daily_sales_30d": 3.5,
                    "avg_daily_sales_7d": 4.2,
                    "predicted_daily_sales": 4.2,
                    "safety_stock": 29,
                    "suggested_restock": 19,
                    "days_until_stockout": 2.4,
                    "confidence": "high",
                    "reason": "最近7天销量上升，建议补货"
                }
            ]
        """
        now = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        start_date_30d = now - timedelta(days=days)
        start_date_7d = now - timedelta(days=7)
        
        # 1. 获取所有有销售记录的商品
        products_with_sales = self.db.query(Product).join(
            OrderItem, OrderItem.product_id == Product.id
        ).join(Order).filter(
            Order.created_at >= start_date_30d,
            Order.status == "completed"
        ).distinct().all()
        
        suggestions = []
        
        for product in products_with_sales:
            # 计算 30 天销量
            sales_30d = self.db.query(
                func.sum(OrderItem.quantity)
            ).join(Order).filter(
                OrderItem.product_id == product.id,
                Order.created_at >= start_date_30d,
                Order.status == "completed"
            ).scalar() or 0
            
            # 计算 7 天销量
            sales_7d = self.db.query(
                func.sum(OrderItem.quantity)
            ).join(Order).filter(
                OrderItem.product_id == product.id,
                Order.created_at >= start_date_7d,
                Order.status == "completed"
            ).scalar() or 0
            
            # 计算日均销量
            avg_daily_sales_30d = sales_30d / days
            avg_daily_sales_7d = sales_7d / 7
            
            # 预测未来销量（取较大值，保守策略）
            predicted_daily_sales = max(avg_daily_sales_30d, avg_daily_sales_7d)
            
            # 安全库存
            safety_stock = predicted_daily_sales * safety_stock_days
            
            # 建议补货量
            suggested_restock = max(0, safety_stock - product.stock)
            
            # 预计缺货天数
            if predicted_daily_sales > 0:
                days_until_stockout = product.stock / predicted_daily_sales
            else:
                days_until_stockout = 9999
            
            # 判断置信度和原因
            confidence, reason = self._analyze_restock_confidence(
                avg_daily_sales_30d,
                avg_daily_sales_7d,
                product.stock,
                safety_stock,
                days_until_stockout
            )
            
            # 只建议需要补货的商品（库存不足或即将不足）
            if suggested_restock > 0 or days_until_stockout < safety_stock_days:
                suggestions.append({
                    "sku_id": product.id,
                    "name": product.name,
                    "barcode": product.barcode,
                    "price": float(product.price),
                    "current_stock": product.stock,
                    "avg_daily_sales_30d": round(avg_daily_sales_30d, 2),
                    "avg_daily_sales_7d": round(avg_daily_sales_7d, 2),
                    "predicted_daily_sales": round(predicted_daily_sales, 2),
                    "safety_stock": round(safety_stock, 1),
                    "suggested_restock": round(suggested_restock, 1),
                    "days_until_stockout": round(days_until_stockout, 1),
                    "confidence": confidence,
                    "reason": reason
                })
        
        # 按紧急程度排序（库存天数越少越紧急）
        suggestions.sort(key=lambda x: x["days_until_stockout"])
        
        return suggestions
    
    def detect_anomalies(self, days: int = 30, threshold_std: float = 2.0) -> List[Dict]:
        """
        异常检测（基于统计阈值）
        
        算法说明：
        1. 计算每个商品最近 N 天的日销量序列
        2. 计算均值和标准差
        3. 检测异常：|当日销量 - 均值| > threshold × 标准差
        4. 分类：销量突增 / 销量突降 / 零销售
        
        参数：
        - days: 历史统计天数
        - threshold_std: 标准差阈值倍数（默认 2.0，即 95% 置信区间）
        
        Returns:
            [
                {
                    "sku_id": 1,
                    "name": "商品名",
                    "anomaly_type": "surge",  # surge/drop/zero
                    "date": "2024-01-15",
                    "actual_sales": 50,
                    "expected_sales": 10.5,
                    "deviation": 3.8,  # 标准差倍数
                    "severity": "high",  # low/medium/high
                    "possible_reasons": ["促销活动", "节假日", "补货后首日"]
                }
            ]
        """
        now = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        start_date = now - timedelta(days=days)
        
        # 获取有销售记录的商品
        products = self.db.query(Product).join(
            OrderItem, OrderItem.product_id == Product.id
        ).join(Order).filter(
            Order.created_at >= start_date,
            Order.status == "completed"
        ).distinct().all()
        
        anomalies = []
        
        for product in products:
            # 获取每日销量序列
            daily_sales = self._get_daily_sales_series(product.id, start_date, now)
            
            if len(daily_sales) < 7:  # 数据不足，跳过
                continue
            
            sales_values = [s["quantity"] for s in daily_sales]
            
            # 计算统计指标
            mean_sales = statistics.mean(sales_values)
            
            if len(sales_values) > 1:
                std_sales = statistics.stdev(sales_values)
            else:
                std_sales = 0
            
            # 检测最近 7 天的异常
            recent_sales = daily_sales[-7:]
            
            for day_data in recent_sales:
                actual_sales = day_data["quantity"]
                date_str = day_data["date"]
                
                # 零销售检测
                if actual_sales == 0 and mean_sales > 1:
                    anomalies.append({
                        "sku_id": product.id,
                        "name": product.name,
                        "barcode": product.barcode,
                        "anomaly_type": "zero",
                        "date": date_str,
                        "actual_sales": 0,
                        "expected_sales": round(mean_sales, 1),
                        "deviation": None,
                        "severity": "medium",
                        "possible_reasons": ["缺货", "商品下架", "周末或节假日"]
                    })
                    continue
                
                # 计算偏离度
                if std_sales > 0:
                    deviation = abs(actual_sales - mean_sales) / std_sales
                else:
                    deviation = 0
                
                # 异常判定
                if deviation > threshold_std:
                    if actual_sales > mean_sales:
                        anomaly_type = "surge"
                        possible_reasons = ["促销活动", "节假日", "热门商品", "补货后首日"]
                    else:
                        anomaly_type = "drop"
                        possible_reasons = ["缺货", "竞品促销", "需求下降", "价格调整"]
                    
                    # 严重程度
                    if deviation > 3:
                        severity = "high"
                    elif deviation > 2:
                        severity = "medium"
                    else:
                        severity = "low"
                    
                    anomalies.append({
                        "sku_id": product.id,
                        "name": product.name,
                        "barcode": product.barcode,
                        "anomaly_type": anomaly_type,
                        "date": date_str,
                        "actual_sales": actual_sales,
                        "expected_sales": round(mean_sales, 1),
                        "deviation": round(deviation, 2),
                        "severity": severity,
                        "possible_reasons": possible_reasons
                    })
        
        # 按日期和严重程度排序
        severity_order = {"high": 0, "medium": 1, "low": 2}
        anomalies.sort(key=lambda x: (x["date"], severity_order.get(x["severity"], 3)), reverse=True)
        
        return anomalies[:50]  # 返回最多 50 个异常
    
    def _analyze_restock_confidence(
        self,
        avg_30d: float,
        avg_7d: float,
        current_stock: int,
        safety_stock: float,
        days_until_stockout: float
    ) -> tuple:
        """分析补货建议的置信度和原因"""
        
        # 计算趋势
        if avg_7d > avg_30d * 1.5:
            trend = "上升"
            confidence = "high"
        elif avg_7d < avg_30d * 0.5:
            trend = "下降"
            confidence = "medium"
        else:
            trend = "稳定"
            confidence = "high"
        
        # 判断紧急程度
        if days_until_stockout < 3:
            urgency = "紧急"
            confidence = "high"
        elif days_until_stockout < 7:
            urgency = "较紧急"
        else:
            urgency = "正常"
        
        # 生成原因
        reasons = []
        
        if trend == "上升":
            reasons.append(f"最近7天销量{trend}（{avg_7d:.1f}/天 vs {avg_30d:.1f}/天）")
        elif trend == "下降":
            reasons.append(f"最近7天销量{trend}，可适当降低补货量")
        
        if days_until_stockout < 7:
            reasons.append(f"预计{days_until_stockout:.1f}天后缺货，{urgency}补货")
        
        if current_stock < safety_stock * 0.5:
            reasons.append("当前库存低于安全库存的50%")
        
        reason = "；".join(reasons) if reasons else "维持安全库存"
        
        return confidence, reason
    
    def _get_daily_sales_series(self, sku_id: int, start_date, end_date) -> List[Dict]:
        """获取商品的每日销量序列"""
        
        # 查询每日销量
        daily_data = self.db.query(
            func.date(Order.created_at).label("date"),
            func.sum(OrderItem.quantity).label("quantity")
        ).join(Order).filter(
            OrderItem.product_id == sku_id,
            Order.created_at >= start_date,
            Order.created_at < end_date,
            Order.status == "completed"
        ).group_by(func.date(Order.created_at)).all()
        
        # 创建完整的日期序列（包含零销量的日期）
        sales_map = {str(d.date): int(d.quantity) for d in daily_data}
        
        result = []
        current_date = start_date
        while current_date < end_date:
            date_str = str(current_date)
            result.append({
                "date": date_str,
                "quantity": sales_map.get(date_str, 0)
            })
            current_date += timedelta(days=1)
        
        return result


