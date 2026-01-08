"""补充旧订单的 product_name 字段"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'smartmart.db')
print(f"数据库: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 更新旧订单：从 products 表查商品名填入 order_items.product_name
cursor.execute('''
    UPDATE order_items 
    SET product_name = (
        SELECT name FROM products WHERE products.id = order_items.product_id
    )
    WHERE product_name IS NULL AND product_id > 0
''')

updated = cursor.rowcount
conn.commit()
conn.close()

print(f"✅ 已更新 {updated} 条订单明细的商品名称")
