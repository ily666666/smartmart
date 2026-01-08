"""AI 识别 API - 直接本地识别"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
import os
import tempfile

from app.database import get_db
from app.services.vision_service import vision_service
from app.config import settings

router = APIRouter()


@router.post("/recognize")
async def recognize(
    file: UploadFile = File(..., description="商品图片"),
    top_k: int = Form(default=5, description="返回前 K 个结果"),
    db: Session = Depends(get_db)
):
    """
    图像识别接口（本地 CLIP + FAISS）
    
    **功能**: 上传图片，返回 Top-K 相似商品
    
    **请求**:
    - file: 图片文件
    - top_k: 返回数量
    
    **响应**:
    ```json
    {
      "results": [
        {"sku_id": 1, "barcode": "xxx", "name": "商品名", "price": 9.99, "score": 0.85},
        {"sku_id": 2, "barcode": "xxx", "name": "商品名", "price": 5.50, "score": 0.72}
      ]
    }
    ```
    """
    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="文件必须是图片格式")
    
    try:
        # 1. 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # 2. 识别图片
        results = await vision_service.recognize_image(
            image_path=tmp_path,
            db=db,
            top_k=top_k
        )
        
        # 3. 清理临时文件
        os.unlink(tmp_path)
        
        # 4. 返回结果
        return {"results": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_ai_status():
    """
    获取 AI 服务状态
    
    **响应**:
    ```json
    {
      "model_loaded": true,
      "index_loaded": true,
      "model_version": "v1_clip_faiss",
      "index_stats": {
        "status": "loaded",
        "num_vectors": 100,
        "num_skus": 20,
        "avg_samples_per_sku": 5.0,
        "embedding_dim": 512
      },
      "model_info": {
        "model_name": "openai/clip-vit-base-patch32",
        "embedding_dim": 512,
        "device": "cpu",
        "cache_dir": "./models"
      }
    }
    ```
    """
    return vision_service.get_ai_status()


@router.post("/preload")
async def preload_model():
    """
    预加载 AI 模型
    
    手动触发模型预加载，避免首次识别时等待
    """
    try:
        from app.services.vision_service import _get_ai_components
        embedder, faiss_manager = _get_ai_components()
        
        return {
            "status": "success",
            "message": "模型已预加载",
            "model_info": embedder.get_model_info() if embedder else None,
            "index_stats": faiss_manager.get_stats() if faiss_manager else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预加载失败: {str(e)}")

