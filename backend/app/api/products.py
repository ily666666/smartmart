"""商品管理 API - MVP 版本"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io
import os
import shutil
from pathlib import Path
import uuid
import logging

from app.database import get_db
from app.models.product import Product, PRODUCT_CATEGORIES
from app.config import settings
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ==================== 商品图片 → AI 样本同步 ====================

def _sync_image_to_samples(product_id: int, image_file_path: Path):
    """
    将商品图片自动复制到 AI 样本目录
    
    使用固定文件名 product_img.xxx，这样：
    - 首次上传：在样本目录新增一张来自商品图片的样本
    - 更新图片：自动替换掉旧的，不会产生冗余错误样本
    - 手动上传的样本（img_01, img_02...）不受影响
    
    - **product_id**: 商品ID
    - **image_file_path**: 商品图片在 static/images/products/ 下的完整路径
    """
    try:
        samples_dir = Path(settings.SAMPLES_DIR) / f"sku_{product_id:03d}"
        samples_dir.mkdir(parents=True, exist_ok=True)
        
        # 获取图片扩展名
        ext = image_file_path.suffix.lower()
        
        # 先删除旧的 product_img.* 文件（可能扩展名不同，如 .jpg → .png）
        image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        for old_file in samples_dir.iterdir():
            if old_file.stem == "product_img" and old_file.suffix.lower() in image_exts:
                old_file.unlink()
                logger.info(f"🔄 已移除旧的商品图片样本: {old_file.name}")
        
        # 用固定文件名保存，方便后续替换识别
        new_filename = f"product_img{ext}"
        target_path = samples_dir / new_filename
        
        # 复制文件到样本目录
        shutil.copy2(image_file_path, target_path)
        
        # 统计当前样本总数
        total_samples = sum(
            1 for f in samples_dir.iterdir()
            if f.suffix.lower() in image_exts
        )
        
        logger.info(
            f"✅ 商品图片已同步到 AI 样本: product_id={product_id}, "
            f"样本文件={new_filename}, 当前样本总数={total_samples}"
        )
        return True
    except Exception as e:
        # 同步失败不影响主流程，仅记录日志
        logger.warning(f"⚠️ 商品图片同步到 AI 样本失败: product_id={product_id}, 错误={e}")
        return False


def _remove_synced_sample(product_id: int):
    """
    删除 AI 样本目录中由商品图片自动同步的那张样本（product_img.*）
    
    当用户删除商品图片时调用，确保错误的图片不会残留在样本中。
    手动上传的样本（img_01, img_02...）不受影响。
    """
    try:
        samples_dir = Path(settings.SAMPLES_DIR) / f"sku_{product_id:03d}"
        if not samples_dir.exists():
            return
        
        image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        for old_file in samples_dir.iterdir():
            if old_file.stem == "product_img" and old_file.suffix.lower() in image_exts:
                old_file.unlink()
                logger.info(f"🗑️ 已删除商品图片对应的 AI 样本: product_id={product_id}, 文件={old_file.name}")
    except Exception as e:
        logger.warning(f"⚠️ 删除商品图片样本失败: product_id={product_id}, 错误={e}")


# ==================== OCR 引擎（延迟加载单例） ====================
_ocr_engine = None


def _get_ocr_engine():
    """获取 OCR 引擎（延迟加载，首次调用时初始化）"""
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from rapidocr import RapidOCR
            _ocr_engine = RapidOCR()
            logger.info("✅ OCR 引擎初始化成功")
        except ImportError:
            logger.warning("⚠️ rapidocr-onnxruntime 未安装，OCR 功能不可用")
            return None
        except Exception as e:
            logger.error(f"❌ OCR 引擎初始化失败: {e}")
            return None
    return _ocr_engine

# 使用配置中的静态文件目录
STATIC_DIR = settings.STATIC_DIR
IMAGES_DIR = STATIC_DIR / "images" / "products"
try:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"⚠️ 创建图片目录失败: {e}")

router = APIRouter()


class ProductResponse(BaseModel):
    """商品响应模型"""
    sku_id: int
    barcode: str
    name: str
    category: str = "其他"
    price: float
    cost_price: Optional[float] = None
    stock: int
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True


@router.get("/categories")
async def get_categories():
    """获取所有商品分类"""
    return {"categories": PRODUCT_CATEGORIES}


@router.get("/search")
async def search_products(
    q: str = Query(..., description="搜索关键词（条码或名称）"),
    db: Session = Depends(get_db)
):
    """
    搜索商品（支持条码或名称）
    
    - **q**: 搜索关键词，可以是条码或商品名称
    - **返回**: 商品列表
    """
    # 先尝试精确匹配条码
    product = db.query(Product).filter(Product.barcode == q).first()
    
    if product:
        # 精确匹配到条码，返回单个商品
        return {
            "type": "exact",
            "products": [{
                "sku_id": product.id,
                "barcode": product.barcode,
                "name": product.name,
                "category": product.category or "其他",
                "price": product.price,
                "cost_price": product.cost_price,
                "stock": product.stock,
                "image_url": product.image_url,
            }]
        }
    
    # 模糊匹配名称
    products = db.query(Product).filter(
        Product.name.like(f"%{q}%")
    ).limit(10).all()
    
    return {
        "type": "fuzzy",
        "products": [
            {
                "sku_id": p.id,
                "barcode": p.barcode,
                "name": p.name,
                "category": p.category or "其他",
                "price": p.price,
                "cost_price": p.cost_price,
                "stock": p.stock,
                "image_url": p.image_url,
            }
            for p in products
        ]
    }


@router.get("/by_barcode")
async def get_product_by_barcode(
    code: str = Query(..., description="商品条码"),
    db: Session = Depends(get_db)
):
    """
    根据条码查询商品（向后兼容）
    
    - **code**: 商品条码
    - **返回**: {sku_id, barcode, name, price, stock}
    """
    product = db.query(Product).filter(Product.barcode == code).first()
    
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"未找到条码为 {code} 的商品"
        )
    
    return {
        "sku_id": product.id,
        "barcode": product.barcode,
        "name": product.name,
        "price": product.price,
        "stock": product.stock,
    }


@router.post("/import_csv")
async def import_products_csv(
    file: UploadFile = File(..., description="CSV 文件（barcode,name,price）"),
    db: Session = Depends(get_db)
):
    """
    批量导入商品（CSV 格式）
    
    **CSV 格式要求**:
    - 第一行：barcode,name,price
    - 后续行：商品数据
    
    **示例**:
    ```
    barcode,name,price
    6901028075831,可口可乐,3.50
    6925303730086,农夫山泉,2.00
    ```
    """
    # 验证文件类型
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="文件必须是 CSV 格式")
    
    # 读取文件内容
    content = await file.read()
    content_str = content.decode('utf-8-sig')  # 支持 BOM
    
    # 解析 CSV
    csv_reader = csv.DictReader(io.StringIO(content_str))
    
    # 验证列名
    required_fields = {'barcode', 'name', 'price'}
    if not required_fields.issubset(set(csv_reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail=f"CSV 必须包含列: {', '.join(required_fields)}"
        )
    
    success_count = 0
    error_count = 0
    errors = []
    
    for row_num, row in enumerate(csv_reader, start=2):  # 从第2行开始（第1行是表头）
        try:
            barcode = row['barcode'].strip()
            name = row['name'].strip()
            price = float(row['price'].strip())
            
            if not barcode or not name:
                raise ValueError("条码和名称不能为空")
            
            if price <= 0:
                raise ValueError("价格必须大于0")
            
            # 检查是否已存在
            existing = db.query(Product).filter(Product.barcode == barcode).first()
            if existing:
                # 更新现有商品
                existing.name = name
                existing.price = price
            else:
                # 创建新商品
                product = Product(barcode=barcode, name=name, price=price, stock=0)
                db.add(product)
            
            success_count += 1
            
        except Exception as e:
            error_count += 1
            errors.append(f"第 {row_num} 行: {str(e)}")
            if len(errors) >= 10:  # 最多记录10个错误
                errors.append(f"... 还有 {error_count - 10} 个错误未显示")
                break
    
    # 提交事务
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库提交失败: {str(e)}")
    
    return {
        "message": "导入完成",
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors if errors else None,
    }


@router.get("/")
async def list_products(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = Query(None, description="按分类筛选"),
    db: Session = Depends(get_db)
):
    """获取商品列表，支持按分类筛选和分页"""
    query = db.query(Product)
    
    if category:
        query = query.filter(Product.category == category)
    
    # 获取总数
    total_count = query.count()
    
    # 获取分页数据
    products = query.offset(skip).limit(limit).all()
    
    return {
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "products": [
            {
                "sku_id": p.id,
                "barcode": p.barcode,
                "name": p.name,
                "category": p.category or "其他",
                "price": p.price,
                "cost_price": p.cost_price,
                "stock": p.stock,
                "image_url": p.image_url,
            }
            for p in products
        ]
    }


@router.post("/upload_image")
async def upload_image(file: UploadFile = File(...)):
    """
    上传商品图片（通用接口，返回图片URL）
    
    - **file**: 图片文件（支持 jpg, jpeg, png, gif, webp）
    - **返回**: 图片URL，供创建或更新商品时使用
    """
    # 验证文件类型
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else '.jpg'
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。允许的格式: {', '.join(allowed_extensions)}"
        )
    
    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = IMAGES_DIR / unique_filename
    
    # 保存图片
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")
    
    # 返回图片URL
    image_url = f"/static/images/products/{unique_filename}"
    return {
        "message": "图片上传成功",
        "image_url": image_url
    }


@router.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    """
    对上传的图片进行文字识别（OCR）
    
    用于从商品图片中识别文字，辅助填写商品名称。
    
    - **file**: 图片文件（支持 jpg, jpeg, png, gif, webp）
    - **返回**: 识别到的文字列表和建议的商品名称
    """
    # 验证文件类型
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else '.jpg'
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。允许的格式: {', '.join(allowed_extensions)}"
        )
    
    # 获取 OCR 引擎
    engine = _get_ocr_engine()
    if engine is None:
        raise HTTPException(
            status_code=501,
            detail="OCR 功能未安装，请安装 rapidocr-onnxruntime: pip install rapidocr-onnxruntime"
        )
    
    # 读取图片数据
    image_data = await file.read()
    
    try:
        import numpy as np
        from PIL import Image
        
        # 将上传的图片转为 numpy 数组
        img = Image.open(io.BytesIO(image_data))
        # 确保是 RGB 模式（OCR 不支持 RGBA 等）
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img_array = np.array(img)
        
        # 执行 OCR 识别（新版返回 RapidOCROutput 对象）
        output = engine(img_array)
        
        # 新版 API：通过属性访问结果
        if not output or not output.txts:
            return {"texts": [], "suggested_name": "", "message": "未识别到文字"}
        
        # 提取识别结果
        texts = []
        for txt, score in zip(output.txts, output.scores):
            text = txt.strip()
            confidence = float(score)
            if text:  # 过滤空文本
                texts.append({"text": text, "confidence": round(confidence, 3)})
        
        # 按置信度降序排列
        texts.sort(key=lambda x: x["confidence"], reverse=True)
        
        # 智能推荐商品名称：
        # 选择置信度最高且长度 >= 2 的文本作为建议名称
        suggested_name = ""
        for t in texts:
            if len(t["text"]) >= 2:
                suggested_name = t["text"]
                break
        
        logger.info(f"OCR 识别完成: 共识别 {len(texts)} 条文字, 建议名称: {suggested_name}, 耗时: {output.elapse}")
        
        return {
            "texts": texts,
            "suggested_name": suggested_name,
            "message": f"识别到 {len(texts)} 条文字"
        }
        
    except Exception as e:
        logger.error(f"OCR 识别失败: {e}")
        raise HTTPException(status_code=500, detail=f"文字识别失败: {str(e)}")


@router.post("/upload_image/{product_id}")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传商品图片
    
    - **product_id**: 商品ID
    - **file**: 图片文件（支持 jpg, jpeg, png, gif, webp）
    """
    # 验证商品是否存在
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 验证文件类型
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。允许的格式: {', '.join(allowed_extensions)}"
        )
    
    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = IMAGES_DIR / unique_filename
    
    # 删除旧图片（如果存在）
    if product.image_url:
        old_file = IMAGES_DIR / os.path.basename(product.image_url)
        if old_file.exists():
            old_file.unlink()
    
    # 保存新图片
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片保存失败: {str(e)}")
    
    # 更新数据库
    image_url = f"/static/images/products/{unique_filename}"
    product.image_url = image_url
    db.commit()
    
    # 自动同步到 AI 样本目录（商品图片也作为 AI 识别样本）
    sample_synced = _sync_image_to_samples(product_id, file_path)
    
    return {
        "message": "图片上传成功",
        "image_url": image_url,
        "product_id": product_id,
        "sample_synced": sample_synced
    }


@router.get("/{product_id}")
async def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    获取单个商品详情
    
    - **product_id**: 商品ID
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    return {
        "id": product.id,
        "sku_id": product.id,
        "barcode": product.barcode,
        "name": product.name,
        "category": product.category or "其他",
        "price": product.price,
        "cost_price": product.cost_price,
        "stock": product.stock,
        "image_url": product.image_url,
    }


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    删除商品
    
    - **product_id**: 商品ID
    - **注意**: 删除商品会同时删除关联的图片文件和AI样本目录
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 删除关联的图片文件
    if product.image_url:
        image_file = IMAGES_DIR / os.path.basename(product.image_url)
        if image_file.exists():
            try:
                image_file.unlink()
            except Exception as e:
                print(f"警告: 删除图片文件失败: {e}")
    
    # 删除AI样本目录
    samples_dir = Path(settings.SAMPLES_DIR) / f"sku_{product_id:03d}"
    if samples_dir.exists():
        try:
            shutil.rmtree(samples_dir)
            print(f"✓ 已删除AI样本目录: {samples_dir}")
        except Exception as e:
            print(f"警告: 删除AI样本目录失败: {e}")
    
    # 删除商品
    db.delete(product)
    db.commit()
    
    return {
        "message": "商品删除成功",
        "product_id": product_id,
        "samples_deleted": samples_dir.exists() == False
    }


@router.delete("/{product_id}/image")
async def delete_product_image(
    product_id: int,
    db: Session = Depends(get_db)
):
    """删除商品图片（仅删除图片，保留商品）"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    if not product.image_url:
        raise HTTPException(status_code=404, detail="商品没有图片")
    
    # 删除文件
    file_path = IMAGES_DIR / os.path.basename(product.image_url)
    if file_path.exists():
        file_path.unlink()
    
    # 同时删除 AI 样本目录中由商品图片自动同步的那张样本
    _remove_synced_sample(product_id)
    
    # 更新数据库
    product.image_url = None
    db.commit()
    
    return {"message": "图片已删除"}


@router.put("/{product_id}")
async def update_product(
    product_id: int,
    barcode: str = Form(None),
    name: str = Form(None),
    category: str = Form(None),
    price: float = Form(None),
    cost_price: float = Form(None),
    stock: int = Form(None),
    image_url: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    更新商品信息
    
    - **product_id**: 商品ID
    - **barcode**: 商品条码（可选）
    - **name**: 商品名称（可选）
    - **category**: 商品分类（可选）
    - **price**: 商品价格（可选）
    - **stock**: 商品库存（可选）
    - **image_url**: 商品图片URL（可选）
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 更新字段
    if barcode is not None:
        # 检查条码是否被其他商品使用
        existing = db.query(Product).filter(
            Product.barcode == barcode,
            Product.id != product_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="条码已被其他商品使用")
        product.barcode = barcode
    
    if name is not None:
        product.name = name
    
    if category is not None:
        product.category = category
    
    if price is not None:
        if price <= 0:
            raise HTTPException(status_code=400, detail="价格必须大于0")
        product.price = price
    
    if cost_price is not None:
        if cost_price < 0:
            raise HTTPException(status_code=400, detail="进价不能为负数")
        product.cost_price = cost_price
    
    if stock is not None:
        if stock < 0:
            raise HTTPException(status_code=400, detail="库存不能为负数")
        product.stock = stock
    
    # 记录图片是否发生变更
    image_changed = False
    if image_url is not None:
        image_changed = (product.image_url != image_url)
        product.image_url = image_url
    
    db.commit()
    db.refresh(product)
    
    # 如果商品图片发生了变更，自动同步新图片到 AI 样本目录
    sample_synced = False
    if image_changed and product.image_url:
        image_filename = os.path.basename(product.image_url)
        image_file_path = IMAGES_DIR / image_filename
        if image_file_path.exists():
            sample_synced = _sync_image_to_samples(product.id, image_file_path)
    
    return {
        "message": "商品更新成功",
        "product": {
            "sku_id": product.id,
            "barcode": product.barcode,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "cost_price": product.cost_price,
            "stock": product.stock,
            "image_url": product.image_url,
        },
        "sample_synced": sample_synced
    }


@router.post("/")
async def create_product(
    barcode: str = Form(...),
    name: str = Form(...),
    category: str = Form("其他"),
    price: float = Form(...),
    cost_price: Optional[float] = Form(None),
    stock: int = Form(0),
    image_url: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """创建单个商品（支持表单提交）"""
    # 检查条码是否已存在
    existing = db.query(Product).filter(Product.barcode == barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail="条码已存在")
    
    product = Product(barcode=barcode, name=name, category=category, price=price, cost_price=cost_price, stock=stock, image_url=image_url)
    db.add(product)
    db.commit()
    db.refresh(product)
    
    # 如果创建商品时带了图片，自动同步到 AI 样本目录
    sample_synced = False
    if product.image_url:
        image_filename = os.path.basename(product.image_url)
        image_file_path = IMAGES_DIR / image_filename
        if image_file_path.exists():
            sample_synced = _sync_image_to_samples(product.id, image_file_path)
    
    return {
        "sku_id": product.id,
        "barcode": product.barcode,
        "name": product.name,
        "category": product.category,
        "price": product.price,
        "cost_price": product.cost_price,
        "stock": product.stock,
        "image_url": product.image_url,
        "sample_synced": sample_synced,
    }

