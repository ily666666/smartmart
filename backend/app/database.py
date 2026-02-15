"""数据库配置和连接"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite 特定配置
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """获取数据库会话（依赖注入）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



def init_sample_data():
    """初始化示例数据"""
    from app.models import Product
    
    db = SessionLocal()
    try:
        # 检查是否已有数据
        count = db.query(Product).count()
        if count > 0:
            print(f"📦 数据库已有 {count} 个商品")
            return
        
        # 添加示例商品
        sample_products = [
            # Product(barcode="6901028075831", name="可口可乐 330ml", price=3.50, stock=100),
            # Product(barcode="6925303730086", name="农夫山泉 550ml", price=2.00, stock=200),
            # Product(barcode="6902083895488", name="康师傅红烧牛肉面", price=4.50, stock=50),
            # Product(barcode="6921168509225", name="奥利奥饼干", price=10.50, stock=30),
            Product(barcode="123456789", name="测试商品", price=9.99, stock=10),
        ]
        
        db.add_all(sample_products)
        db.commit()
        print(f"✅ 已添加 {len(sample_products)} 个示例商品")
        
    except Exception as e:
        print(f"⚠️ 初始化示例数据失败: {e}")
        db.rollback()
    finally:
        db.close()

