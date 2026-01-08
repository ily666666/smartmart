"""
数据库迁移：为 devices 表添加 authenticated 字段
运行方式: python migrate_add_authenticated.py
"""

import sqlite3
import os

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(__file__), "smartmart.db")

def migrate():
    print(f"📂 数据库路径: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("❌ 数据库文件不存在")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(devices)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "authenticated" in columns:
            print("✅ authenticated 字段已存在，无需迁移")
        else:
            # 添加字段
            cursor.execute("ALTER TABLE devices ADD COLUMN authenticated BOOLEAN DEFAULT 0")
            conn.commit()
            print("✅ 成功添加 authenticated 字段")
        
        # 显示当前表结构
        cursor.execute("PRAGMA table_info(devices)")
        print("\n📋 devices 表结构:")
        for col in cursor.fetchall():
            print(f"   - {col[1]} ({col[2]})")
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
