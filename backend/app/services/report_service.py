"""报表服务"""

from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict, Optional
import json

from ..models.product import Product
from ..models.transaction import Order, OrderItem
from ..models.inventory import InventoryMove


class ReportService:
    """报表服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_daily_sales_report(self, date: str) -> Dict:
        """
        日销售报表
        
        口径说明：
        - 统计指定日期的订单数据
        - 销售额 = SUM(order_items.quantity * order_items.unit_price)
        - 订单数 = COUNT(DISTINCT orders.id)
        - 商品销量 = SUM(order_items.quantity)
        - 客单价 = 销售额 / 订单数
        
        Args:
            date: 日期 (YYYY-MM-DD)
            
        Returns:
            {
                "date": "2024-01-01",
                "total_revenue": 1234.56,
                "order_count": 10,
                "item_count": 25,
                "avg_order_value": 123.45,
                "top_products": [...],
                "hourly_distribution": [...]
            }
        """
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        next_date = target_date + timedelta(days=1)
        
        # 1. 总销售额和订单数
        revenue_query = self.db.query(
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
            func.count(func.distinct(Order.id)).label("order_count"),
            func.sum(OrderItem.quantity).label("item_count")
        ).join(Order).filter(
            Order.created_at >= target_date,
            Order.created_at < next_date,
            Order.status == "completed"
        ).first()
        
        total_revenue = float(revenue_query.revenue or 0)
        order_count = revenue_query.order_count or 0
        item_count = revenue_query.item_count or 0
        avg_order_value = total_revenue / order_count if order_count > 0 else 0
        
        # 2. 当日热销商品 Top 10
        top_products = self.db.query(
            Product.id,
            Product.name,
            Product.barcode,
            func.sum(OrderItem.quantity).label("quantity"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
        ).join(OrderItem, OrderItem.product_id == Product.id)\
         .join(Order)\
         .filter(
            Order.created_at >= target_date,
            Order.created_at < next_date,
            Order.status == "completed"
        ).group_by(Product.id)\
         .order_by(desc("quantity"))\
         .limit(10)\
         .all()
        
        top_products_list = [
            {
                "sku_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "quantity": int(p.quantity),
                "revenue": float(p.revenue)
            }
            for p in top_products
        ]
        
        # 3. 按小时销售分布（0-23）
        hourly_distribution = self._get_hourly_distribution(target_date)
        
        return {
            "date": date,
            "total_revenue": round(total_revenue, 2),
            "order_count": order_count,
            "item_count": item_count,
            "avg_order_value": round(avg_order_value, 2),
            "top_products": top_products_list,
            "hourly_distribution": hourly_distribution
        }
    
    def get_monthly_sales_report(self, month: str) -> Dict:
        """
        月销售报表
        
        口径说明：
        - 统计指定月份的订单数据
        - 销售额趋势：按日汇总
        - 商品销售排行：整月统计
        - 同比/环比：需要历史数据
        
        Args:
            month: 月份 (YYYY-MM)
            
        Returns:
            {
                "month": "2024-01",
                "total_revenue": 12345.67,
                "order_count": 100,
                "item_count": 250,
                "daily_trend": [...],
                "top_products": [...]
            }
        """
        year, month_num = map(int, month.split("-"))
        start_date = datetime(year, month_num, 1).date()
        
        # 计算下个月第一天
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1).date()
        else:
            end_date = datetime(year, month_num + 1, 1).date()
        
        # 1. 月度总计
        revenue_query = self.db.query(
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
            func.count(func.distinct(Order.id)).label("order_count"),
            func.sum(OrderItem.quantity).label("item_count")
        ).join(Order).filter(
            Order.created_at >= start_date,
            Order.created_at < end_date,
            Order.status == "completed"
        ).first()
        
        total_revenue = float(revenue_query.revenue or 0)
        order_count = revenue_query.order_count or 0
        item_count = revenue_query.item_count or 0
        
        # 2. 按日趋势
        daily_trend = self._get_daily_trend(start_date, end_date)
        
        # 3. 月度热销商品 Top 20
        top_products = self.db.query(
            Product.id,
            Product.name,
            Product.barcode,
            func.sum(OrderItem.quantity).label("quantity"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
        ).join(OrderItem, OrderItem.product_id == Product.id)\
         .join(Order)\
         .filter(
            Order.created_at >= start_date,
            Order.created_at < end_date,
            Order.status == "completed"
        ).group_by(Product.id)\
         .order_by(desc("quantity"))\
         .limit(20)\
         .all()
        
        top_products_list = [
            {
                "sku_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "quantity": int(p.quantity),
                "revenue": float(p.revenue)
            }
            for p in top_products
        ]
        
        return {
            "month": month,
            "total_revenue": round(total_revenue, 2),
            "order_count": order_count,
            "item_count": item_count,
            "avg_order_value": round(total_revenue / order_count, 2) if order_count > 0 else 0,
            "daily_trend": daily_trend,
            "top_products": top_products_list
        }
    
    def get_top_products(self, days: int = 30) -> List[Dict]:
        """
        热销商品排行
        
        口径说明：
        - 统计最近 N 天的销售数据
        - 排序依据：销量（quantity）
        - 包含：销量、销售额、订单数、库存
        
        Args:
            days: 天数
            
        Returns:
            [
                {
                    "sku_id": 1,
                    "name": "商品名",
                    "barcode": "6901234567890",
                    "quantity": 100,
                    "revenue": 1234.56,
                    "order_count": 10,
                    "current_stock": 50,
                    "avg_daily_sales": 3.33
                }
            ]
        """
        start_date = datetime.now(ZoneInfo("Asia/Shanghai")).date() - timedelta(days=days)
        
        top_products = self.db.query(
            Product.id,
            Product.name,
            Product.barcode,
            Product.price,
            Product.stock,
            func.sum(OrderItem.quantity).label("quantity"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
            func.count(func.distinct(Order.id)).label("order_count")
        ).join(OrderItem, OrderItem.product_id == Product.id)\
         .join(Order)\
         .filter(
            Order.created_at >= start_date,
            Order.status == "completed"
        ).group_by(Product.id)\
         .order_by(desc("quantity"))\
         .limit(50)\
         .all()
        
        result = []
        for p in top_products:
            quantity = int(p.quantity)
            avg_daily_sales = quantity / days
            
            result.append({
                "sku_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "price": float(p.price),
                "quantity": quantity,
                "revenue": float(p.revenue),
                "order_count": p.order_count,
                "current_stock": p.stock,
                "avg_daily_sales": round(avg_daily_sales, 2)
            })
        
        return result
    
    def get_slow_movers(self, days: int = 30, min_stock: int = 0) -> List[Dict]:
        """
        滞销商品分析
        
        口径说明：
        - 滞销定义：最近 N 天销量为 0 或极低
        - 库存积压：当前库存 > min_stock
        - 库存周转天数 = 当前库存 / 日均销量
        
        Args:
            days: 统计天数
            min_stock: 最低库存过滤（只统计库存>=该值的商品）
            
        Returns:
            [
                {
                    "sku_id": 1,
                    "name": "商品名",
                    "barcode": "6901234567890",
                    "current_stock": 100,
                    "quantity_sold": 5,
                    "revenue": 49.5,
                    "days_of_stock": 600,  # 库存可卖天数
                    "last_sale_date": "2024-01-01"
                }
            ]
        """
        start_date = datetime.now(ZoneInfo("Asia/Shanghai")).date() - timedelta(days=days)
        
        # 1. 获取所有商品及其销售情况
        products_with_sales = self.db.query(
            Product.id,
            Product.name,
            Product.barcode,
            Product.price,
            Product.stock,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0).label("revenue"),
            func.max(Order.created_at).label("last_sale_date")
        ).outerjoin(OrderItem, OrderItem.product_id == Product.id)\
        .outerjoin(Order, (Order.id == OrderItem.order_id) & (Order.created_at >= start_date) & (Order.status == "completed"))\
        .filter(Product.stock >= min_stock)\
        .group_by(Product.id)\
        .having(func.coalesce(func.sum(OrderItem.quantity), 0) < (days / 2))\
        .order_by(Product.stock.desc())\
        .limit(50)\
        .all()
        
        result = []
        for p in products_with_sales:
            quantity = int(p.quantity)
            avg_daily_sales = quantity / days if days > 0 else 0
            
            # 计算库存可卖天数
            if avg_daily_sales > 0:
                days_of_stock = p.stock / avg_daily_sales
            else:
                days_of_stock = 9999  # 无销量，理论无限天
            
            result.append({
                "sku_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "price": float(p.price),
                "current_stock": p.stock,
                "quantity_sold": quantity,
                "revenue": float(p.revenue),
                "avg_daily_sales": round(avg_daily_sales, 2),
                "days_of_stock": round(days_of_stock, 1),
                "last_sale_date": p.last_sale_date.strftime("%Y-%m-%d") if p.last_sale_date else None
            })
        
        return result
    
    def _get_hourly_distribution(self, target_date) -> List[Dict]:
        """获取按小时销售分布"""
        next_date = target_date + timedelta(days=1)
        
        orders = self.db.query(Order).filter(
            Order.created_at >= target_date,
            Order.created_at < next_date,
            Order.status == "completed"
        ).all()
        
        # 初始化 24 小时
        hourly_data = {i: {"hour": i, "order_count": 0, "revenue": 0} for i in range(24)}
        
        for order in orders:
            hour = order.created_at.hour
            
            # 计算该订单的总金额
            order_revenue = self.db.query(
                func.sum(OrderItem.quantity * OrderItem.unit_price)
            ).filter(OrderItem.order_id == order.id).scalar() or 0
            
            hourly_data[hour]["order_count"] += 1
            hourly_data[hour]["revenue"] += float(order_revenue)
        
        return [
            {
                "hour": h,
                "order_count": data["order_count"],
                "revenue": round(data["revenue"], 2)
            }
            for h, data in sorted(hourly_data.items())
        ]
    
    def _get_daily_trend(self, start_date, end_date) -> List[Dict]:
        """获取按日销售趋势"""
        orders = self.db.query(
            func.date(Order.created_at).label("date"),
            func.count(Order.id).label("order_count")
        ).filter(
            Order.created_at >= start_date,
            Order.created_at < end_date,
            Order.status == "completed"
        ).group_by(func.date(Order.created_at)).all()
        
        # 创建日期到订单数的映射
        order_count_map = {str(o.date): o.order_count for o in orders}
        
        # 获取每日收入
        order_items = self.db.query(
            func.date(Order.created_at).label("date"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
        ).join(Order).filter(
            Order.created_at >= start_date,
            Order.created_at < end_date,
            Order.status == "completed"
        ).group_by(func.date(Order.created_at)).all()
        
        revenue_map = {str(o.date): float(o.revenue) for o in order_items}
        
        # 生成完整的日期范围
        result = []
        current_date = start_date
        while current_date < end_date:
            date_str = str(current_date)
            result.append({
                "date": date_str,
                "order_count": order_count_map.get(date_str, 0),
                "revenue": round(revenue_map.get(date_str, 0), 2)
            })
            current_date += timedelta(days=1)
        
        return result
    
    def get_profit_report(self, days: int = None, start_date: str = None, end_date: str = None, include_no_cost: bool = True) -> Dict:
        """
        盈利分析报表
        
        口径说明：
        - 利润 = 销售额 - 成本
        - 成本 = 进价 × 销量（未设置进价的商品不计入成本）
        - 利润率 = 利润 / 销售额 × 100%
        
        Args:
            days: 统计天数（与日期范围二选一）
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            include_no_cost: 是否包含未设置进价的商品
            
        Returns:
            {
                "days": 30,
                "total_revenue": 12345.67,  # 总销售额
                "total_cost": 8000.00,      # 总成本
                "total_profit": 4345.67,    # 总利润
                "profit_margin": 35.2,      # 利润率 %
                "products_with_cost": 50,   # 有进价的商品数
                "products_without_cost": 10, # 无进价的商品数
                "top_profit_products": [...], # 利润最高的商品
                "daily_trend": [...]         # 每日利润趋势
            }
        """
        # 确定日期范围
        if start_date and end_date:
            query_start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            query_end_date = datetime.strptime(end_date, "%Y-%m-%d").date() + timedelta(days=1)
            actual_days = (query_end_date - query_start_date).days
        else:
            actual_days = days if days else 30
            query_start_date = datetime.now(ZoneInfo("Asia/Shanghai")).date() - timedelta(days=actual_days)
            query_end_date = datetime.now(ZoneInfo("Asia/Shanghai")).date() + timedelta(days=1)
        
        # 1. 查询所有订单商品及其进价
        profit_data = self.db.query(
            Product.id,
            Product.name,
            Product.barcode,
            Product.price,
            Product.cost_price,
            func.sum(OrderItem.quantity).label("quantity"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
        ).join(OrderItem, OrderItem.product_id == Product.id)\
         .join(Order)\
         .filter(
            Order.created_at >= query_start_date,
            Order.created_at < query_end_date,
            Order.status == "completed"
        ).group_by(Product.id)\
         .all()
        
        total_revenue = 0.0
        total_cost = 0.0
        products_with_cost = 0
        products_without_cost = 0
        product_profits = []
        
        for p in profit_data:
            revenue = float(p.revenue or 0)
            quantity = int(p.quantity or 0)
            cost_price = p.cost_price
            
            if cost_price is not None and cost_price > 0:
                # 有进价的商品
                cost = cost_price * quantity
                profit = revenue - cost
                profit_margin = (profit / revenue * 100) if revenue > 0 else 0
                products_with_cost += 1
                total_cost += cost
                total_revenue += revenue
                
                product_profits.append({
                    "sku_id": p.id,
                    "name": p.name,
                    "barcode": p.barcode,
                    "quantity": quantity,
                    "revenue": round(revenue, 2),
                    "cost": round(cost, 2),
                    "profit": round(profit, 2),
                    "profit_margin": round(profit_margin, 1),
                    "cost_price": float(cost_price),
                    "sell_price": float(p.price)
                })
            else:
                # 无进价的商品
                products_without_cost += 1
                if include_no_cost:
                    # 包含无进价商品时，只计入销售额，成本为0
                    total_revenue += revenue
                    product_profits.append({
                        "sku_id": p.id,
                        "name": p.name,
                        "barcode": p.barcode,
                        "quantity": quantity,
                        "revenue": round(revenue, 2),
                        "cost": 0,
                        "profit": round(revenue, 2),  # 无进价时利润=销售额
                        "profit_margin": 100.0,  # 无进价时利润率100%
                        "cost_price": 0,
                        "sell_price": float(p.price),
                        "no_cost": True  # 标记无进价
                    })
        
        # 按利润排序
        product_profits.sort(key=lambda x: x["profit"], reverse=True)
        
        total_profit = total_revenue - total_cost
        overall_profit_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # 2. 每日利润趋势
        daily_trend = self._get_daily_profit_trend(query_start_date, actual_days)
        
        return {
            "days": actual_days,
            "start_date": str(query_start_date),
            "end_date": str(query_end_date - timedelta(days=1)),
            "include_no_cost": include_no_cost,
            "total_revenue": round(total_revenue, 2),
            "total_cost": round(total_cost, 2),
            "total_profit": round(total_profit, 2),
            "profit_margin": round(overall_profit_margin, 1),
            "products_with_cost": products_with_cost,
            "products_without_cost": products_without_cost,
            "top_profit_products": product_profits[:20],
            "daily_trend": daily_trend
        }
    
    def _get_daily_profit_trend(self, start_date, days: int) -> List[Dict]:
        """获取每日利润趋势"""
        end_date = datetime.now(ZoneInfo("Asia/Shanghai")).date() + timedelta(days=1)
        
        # 获取每日销售明细
        daily_data = self.db.query(
            func.date(Order.created_at).label("date"),
            Product.cost_price,
            func.sum(OrderItem.quantity).label("quantity"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
        ).join(OrderItem, OrderItem.product_id == Product.id)\
         .join(Order)\
         .filter(
            Order.created_at >= start_date,
            Order.status == "completed"
        ).group_by(func.date(Order.created_at), Product.id)\
         .all()
        
        # 按日期汇总
        date_profits = {}
        for row in daily_data:
            date_str = str(row.date)
            if date_str not in date_profits:
                date_profits[date_str] = {"revenue": 0, "cost": 0}
            
            revenue = float(row.revenue or 0)
            quantity = int(row.quantity or 0)
            cost_price = row.cost_price
            
            date_profits[date_str]["revenue"] += revenue
            if cost_price is not None and cost_price > 0:
                date_profits[date_str]["cost"] += cost_price * quantity
        
        # 生成完整日期范围
        result = []
        current_date = start_date
        while current_date < end_date:
            date_str = str(current_date)
            data = date_profits.get(date_str, {"revenue": 0, "cost": 0})
            profit = data["revenue"] - data["cost"]
            
            result.append({
                "date": date_str,
                "revenue": round(data["revenue"], 2),
                "cost": round(data["cost"], 2),
                "profit": round(profit, 2)
            })
            current_date += timedelta(days=1)
        
        return result


