"""初始化测试数据"""

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, engine, Base
from app.models.product import Product
from datetime import datetime

def init_test_products():
    """初始化测试商品数据"""
    db = SessionLocal()
    
    try:
        # 检查是否已有商品
        existing_count = db.query(Product).count()
        if existing_count > 0:
            print(f"✅ 数据库已有 {existing_count} 个商品，跳过初始化")
            return
        
        # 测试商品数据
        test_products = [
            {
                "barcode": "6901234567890",
                "name": "可口可乐 330ml",
                "price": 3.50,
                "cost": 2.00,
                "stock": 100,
                "category": "饮料",
            },
            {
                "barcode": "6901234567891",
                "name": "百事可乐 330ml",
                "price": 3.00,
                "cost": 1.80,
                "stock": 80,
                "category": "饮料",
            },
            {
                "barcode": "6901234567892",
                "name": "康师傅冰红茶 500ml",
                "price": 3.50,
                "cost": 2.20,
                "stock": 120,
                "category": "饮料",
            },
            {
                "barcode": "6901234567893",
                "name": "统一绿茶 500ml",
                "price": 3.50,
                "cost": 2.20,
                "stock": 90,
                "category": "饮料",
            },
            {
                "barcode": "6901234567894",
                "name": "乐事薯片 原味 70g",
                "price": 6.50,
                "cost": 4.00,
                "stock": 50,
                "category": "零食",
            },
            {
                "barcode": "6901234567895",
                "name": "奥利奥饼干 原味 116g",
                "price": 7.90,
                "cost": 5.50,
                "stock": 60,
                "category": "零食",
            },
            {
                "barcode": "6901234567896",
                "name": "德芙巧克力 丝滑牛奶 80g",
                "price": 15.90,
                "cost": 11.00,
                "stock": 40,
                "category": "零食",
            },
            {
                "barcode": "6901234567897",
                "name": "三只松鼠每日坚果 25g*7袋",
                "price": 49.90,
                "cost": 35.00,
                "stock": 30,
                "category": "零食",
            },
            {
                "barcode": "6901234567898",
                "name": "康师傅红烧牛肉面 5连包",
                "price": 12.90,
                "cost": 9.00,
                "stock": 70,
                "category": "方便食品",
            },
            {
                "barcode": "6901234567899",
                "name": "统一老坛酸菜面 5连包",
                "price": 13.50,
                "cost": 9.50,
                "stock": 65,
                "category": "方便食品",
            },
            {
                "barcode": "6901234567900",
                "name": "蒙牛纯牛奶 250ml*16",
                "price": 45.00,
                "cost": 35.00,
                "stock": 25,
                "category": "乳制品",
            },
            {
                "barcode": "6901234567901",
                "name": "伊利安慕希酸奶 原味 230g*10",
                "price": 52.00,
                "cost": 40.00,
                "stock": 20,
                "category": "乳制品",
            },
            {
                "barcode": "6901234567902",
                "name": "农夫山泉 550ml",
                "price": 2.00,
                "cost": 1.20,
                "stock": 200,
                "category": "饮料",
            },
            {
                "barcode": "6901234567903",
                "name": "怡宝矿泉水 555ml",
                "price": 2.00,
                "cost": 1.20,
                "stock": 180,
                "category": "饮料",
            },
            {
                "barcode": "6901234567904",
                "name": "旺旺大礼包 628g",
                "price": 39.90,
                "cost": 28.00,
                "stock": 35,
                "category": "零食",
            },
        ]
        
        # 批量插入
        for product_data in test_products:
            product = Product(**product_data)
            db.add(product)
        
        db.commit()
        print(f"✅ 成功初始化 {len(test_products)} 个测试商品！")
        
        # 显示部分商品
        print("\n📦 示例商品：")
        for i, p in enumerate(test_products[:5], 1):
            print(f"  {i}. {p['name']} - 条码: {p['barcode']} - 价格: ¥{p['price']}")
        print(f"  ... 以及其他 {len(test_products) - 5} 个商品")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 开始初始化测试数据...")
    print("=" * 50)
    
    # 确保数据库表已创建
    Base.metadata.create_all(bind=engine)
    
    # 初始化商品
    init_test_products()
    
    print("=" * 50)
    print("✅ 测试数据初始化完成！")
    print("\n💡 提示：")
    print("  - 现在可以使用条码 6901234567890-6901234567904 进行测试")
    print("  - 访问 http://localhost:8000/docs 查看 API 文档")
    print("  - 在收银台输入任意测试条码即可添加到购物车")

