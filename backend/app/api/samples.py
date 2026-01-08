"""AI 样本管理 API"""

import os

# 设置 HuggingFace 镜像源（必须在导入 transformers 之前）
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.product import Product
from app.config import settings

router = APIRouter()

# 样本目录
SAMPLES_DIR = Path(settings.SAMPLES_DIR)
INDEX_DIR = Path(os.path.dirname(settings.FAISS_INDEX_PATH))


class SampleStatus(BaseModel):
    """商品样本状态"""
    sku_id: int
    barcode: str
    name: str
    price: float
    image_count: int
    status: str  # ready(>=3张), partial(1-2张), empty(0张)
    images: List[str]


class IndexStatus(BaseModel):
    """索引状态"""
    exists: bool
    num_vectors: int = 0
    num_skus: int = 0
    last_built: Optional[str] = None


class BuildProgress(BaseModel):
    """构建进度"""
    status: str  # idle, building, completed, failed
    message: str = ""
    progress: int = 0


# 全局构建状态
_build_status = {"status": "idle", "message": "", "progress": 0}


@router.get("/samples", response_model=List[SampleStatus])
async def get_samples_status(db: Session = Depends(get_db)):
    """
    获取所有商品的样本状态
    
    返回每个商品的图片数量和状态
    """
    # 确保样本目录存在
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    
    products = db.query(Product).all()
    results = []
    
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    
    for product in products:
        sku_dir = SAMPLES_DIR / f"sku_{product.id:03d}"
        
        # 获取图片列表
        images = []
        if sku_dir.exists():
            images = [
                f.name for f in sku_dir.iterdir()
                if f.suffix.lower() in image_exts
            ]
        
        # 计算状态
        count = len(images)
        if count >= 3:
            status = "ready"
        elif count > 0:
            status = "partial"
        else:
            status = "empty"
        
        results.append(SampleStatus(
            sku_id=product.id,
            barcode=product.barcode,
            name=product.name,
            price=product.price,
            image_count=count,
            status=status,
            images=images
        ))
    
    return results


@router.get("/samples/{sku_id}", response_model=SampleStatus)
async def get_sample_detail(sku_id: int, db: Session = Depends(get_db)):
    """获取单个商品的样本详情"""
    product = db.query(Product).filter(Product.id == sku_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    sku_dir = SAMPLES_DIR / f"sku_{sku_id:03d}"
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    
    images = []
    if sku_dir.exists():
        images = [f.name for f in sku_dir.iterdir() if f.suffix.lower() in image_exts]
    
    count = len(images)
    status = "ready" if count >= 3 else ("partial" if count > 0 else "empty")
    
    return SampleStatus(
        sku_id=product.id,
        barcode=product.barcode,
        name=product.name,
        price=product.price,
        image_count=count,
        status=status,
        images=images
    )


@router.post("/samples/{sku_id}/upload")
async def upload_sample_image(
    sku_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传商品样本图片
    
    支持 jpg/png/webp 格式
    """
    # 验证商品存在
    product = db.query(Product).filter(Product.id == sku_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")
    
    # 创建目录
    sku_dir = SAMPLES_DIR / f"sku_{sku_id:03d}"
    sku_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成文件名
    ext = Path(file.filename).suffix.lower() or ".jpg"
    existing = list(sku_dir.glob("*"))
    new_index = len(existing) + 1
    new_filename = f"img_{new_index:02d}{ext}"
    
    # 保存文件
    file_path = sku_dir / new_filename
    content = await file.read()
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # 统计当前图片数
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    images = [f.name for f in sku_dir.iterdir() if f.suffix.lower() in image_exts]
    
    return {
        "message": "上传成功",
        "filename": new_filename,
        "sku_id": sku_id,
        "product_name": product.name,
        "total_images": len(images)
    }


@router.post("/samples/{sku_id}/upload_multiple")
async def upload_multiple_images(
    sku_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """批量上传商品样本图片"""
    # 验证商品存在
    product = db.query(Product).filter(Product.id == sku_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    # 创建目录
    sku_dir = SAMPLES_DIR / f"sku_{sku_id:03d}"
    sku_dir.mkdir(parents=True, exist_ok=True)
    
    # 获取现有文件数
    existing = list(sku_dir.glob("*"))
    start_index = len(existing) + 1
    
    uploaded = []
    for i, file in enumerate(files):
        if not file.content_type.startswith("image/"):
            continue
        
        ext = Path(file.filename).suffix.lower() or ".jpg"
        new_filename = f"img_{start_index + i:02d}{ext}"
        
        file_path = sku_dir / new_filename
        content = await file.read()
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        uploaded.append(new_filename)
    
    # 统计当前图片数
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    images = [f.name for f in sku_dir.iterdir() if f.suffix.lower() in image_exts]
    
    return {
        "message": f"成功上传 {len(uploaded)} 张图片",
        "uploaded": uploaded,
        "sku_id": sku_id,
        "product_name": product.name,
        "total_images": len(images)
    }


@router.delete("/samples/{sku_id}/{filename}")
async def delete_sample_image(sku_id: int, filename: str):
    """删除样本图片"""
    sku_dir = SAMPLES_DIR / f"sku_{sku_id:03d}"
    file_path = sku_dir / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="图片不存在")
    
    # 安全检查：确保文件在样本目录内
    if not str(file_path.resolve()).startswith(str(SAMPLES_DIR.resolve())):
        raise HTTPException(status_code=403, detail="非法路径")
    
    os.remove(file_path)
    
    return {"message": "删除成功", "filename": filename}


@router.get("/samples/{sku_id}/images/{filename}")
async def get_sample_image(sku_id: int, filename: str):
    """获取样本图片"""
    sku_dir = SAMPLES_DIR / f"sku_{sku_id:03d}"
    file_path = sku_dir / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="图片不存在")
    
    return FileResponse(file_path)


@router.get("/index_status", response_model=IndexStatus)
async def get_index_status():
    """获取索引状态"""
    index_path = Path(settings.FAISS_INDEX_PATH)
    metadata_path = Path(settings.FAISS_METADATA_PATH)
    
    if not index_path.exists():
        return IndexStatus(exists=False)
    
    # 读取元数据
    import json
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        return IndexStatus(
            exists=True,
            num_vectors=metadata.get("num_vectors", 0),
            num_skus=len(metadata.get("sku_to_ids", {})),
            last_built=metadata.get("created_at")
        )
    except Exception:
        return IndexStatus(exists=True)


@router.get("/build_status", response_model=BuildProgress)
async def get_build_status():
    """获取索引构建状态"""
    return BuildProgress(**_build_status)


def _run_build_index():
    """后台运行索引构建"""
    global _build_status
    
    try:
        _build_status = {"status": "building", "message": "正在加载 CLIP 模型（首次需要下载）...", "progress": 10}
        
        # 直接导入并运行，避免 subprocess 环境问题
        from app.services.clip_embedder import CLIPEmbedder
        from app.services.faiss_manager import FAISSManager
        import numpy as np
        
        # 收集样本
        _build_status = {"status": "building", "message": "扫描样本目录...", "progress": 15}
        
        image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        samples = {}
        
        for sku_dir in sorted(SAMPLES_DIR.iterdir()):
            if not sku_dir.is_dir() or not sku_dir.name.startswith('sku_'):
                continue
            
            try:
                sku_id = int(sku_dir.name.replace('sku_', ''))
            except ValueError:
                continue
            
            image_paths = [
                str(f) for f in sku_dir.iterdir() 
                if f.suffix.lower() in image_exts
            ]
            
            if image_paths:
                samples[sku_id] = image_paths
        
        if not samples:
            _build_status = {"status": "failed", "message": "没有找到任何样本图片", "progress": 0}
            return
        
        total_images = sum(len(imgs) for imgs in samples.values())
        _build_status = {"status": "building", "message": f"找到 {len(samples)} 个商品，{total_images} 张图片", "progress": 20}
        
        # 初始化模型
        _build_status = {"status": "building", "message": "加载 CLIP 模型...", "progress": 25}
        embedder = CLIPEmbedder(
            model_name="openai/clip-vit-base-patch32",
            cache_dir=str(Path(settings.MODEL_CACHE_DIR))
        )
        
        # 提取特征
        _build_status = {"status": "building", "message": "提取图像特征...", "progress": 40}
        
        all_embeddings = []
        all_sku_ids = []
        processed = 0
        
        for sku_id, image_paths in samples.items():
            embeddings = embedder.extract_batch_features(image_paths, batch_size=16)
            all_embeddings.append(embeddings)
            all_sku_ids.extend([sku_id] * len(image_paths))
            
            processed += len(image_paths)
            progress = 40 + int(40 * processed / total_images)
            _build_status = {"status": "building", "message": f"处理中 {processed}/{total_images}...", "progress": progress}
        
        all_embeddings = np.vstack(all_embeddings)
        all_sku_ids = np.array(all_sku_ids, dtype=np.int32)
        
        # 构建索引
        _build_status = {"status": "building", "message": "构建 FAISS 索引...", "progress": 85}
        
        INDEX_DIR.mkdir(parents=True, exist_ok=True)
        
        faiss_manager = FAISSManager(
            embedding_dim=embedder.get_embedding_dim(),
            index_path=str(INDEX_DIR / "products.index"),
            metadata_path=str(INDEX_DIR / "products_metadata.json")
        )
        
        faiss_manager.build_index(embeddings=all_embeddings, sku_ids=all_sku_ids)
        faiss_manager.save()
        
        # 重置全局 AI 组件以便重新加载
        _build_status = {"status": "building", "message": "重新加载索引...", "progress": 95}
        
        try:
            import app.services.vision_service as vs
            vs._embedder = None
            vs._faiss_manager = None
        except Exception:
            pass
        
        _build_status = {
            "status": "completed", 
            "message": f"索引构建完成！包含 {len(samples)} 个商品，{len(all_embeddings)} 个向量", 
            "progress": 100
        }
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"构建索引失败: {error_msg}")
        print(traceback.format_exc())
        _build_status = {"status": "failed", "message": f"构建失败: {error_msg}", "progress": 0}


@router.post("/build_index")
async def build_index(background_tasks: BackgroundTasks):
    """
    重建 FAISS 索引
    
    在后台异步执行，通过 /build_status 查询进度
    """
    global _build_status
    
    # 检查是否正在构建
    if _build_status["status"] == "building":
        raise HTTPException(status_code=409, detail="索引正在构建中，请稍候")
    
    # 检查样本状态
    image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    total_images = 0
    ready_skus = 0
    
    if SAMPLES_DIR.exists():
        for sku_dir in SAMPLES_DIR.iterdir():
            if sku_dir.is_dir() and sku_dir.name.startswith("sku_"):
                images = [f for f in sku_dir.iterdir() if f.suffix.lower() in image_exts]
                if len(images) >= 1:
                    ready_skus += 1
                    total_images += len(images)
    
    if total_images == 0:
        raise HTTPException(status_code=400, detail="没有可用的样本图片，请先上传")
    
    # 启动后台构建
    _build_status = {"status": "building", "message": "开始构建索引...", "progress": 5}
    background_tasks.add_task(_run_build_index)
    
    return {
        "message": "索引构建已启动",
        "ready_skus": ready_skus,
        "total_images": total_images
    }


@router.post("/create_directories")
async def create_sample_directories(db: Session = Depends(get_db)):
    """为所有商品创建样本目录"""
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    
    products = db.query(Product).all()
    created = []
    
    for product in products:
        sku_dir = SAMPLES_DIR / f"sku_{product.id:03d}"
        if not sku_dir.exists():
            sku_dir.mkdir(parents=True, exist_ok=True)
            created.append(f"sku_{product.id:03d}")
    
    return {
        "message": f"创建了 {len(created)} 个目录",
        "created": created,
        "total_products": len(products)
    }

