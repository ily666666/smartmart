"""外观识别 API"""

import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services.vision_service import vision_service

router = APIRouter()


@router.post("/query")
async def vision_query(
    image: UploadFile = File(..., description="商品图片"),
    device_id: str = Form(..., description="设备ID"),
    device_type: str = Form(default="miniapp", description="设备类型"),
    top_k: int = Form(default=5, description="返回候选数量"),
    db: Session = Depends(get_db)
):
    """
    外观识别查询
    
    **功能**: 上传商品图片，返回 Top-K 候选商品列表
    
    **请求**:
    - image: 图片文件（multipart/form-data）
    - device_id: 设备ID
    - device_type: 设备类型（miniapp/desktop）
    - top_k: 返回前 K 个候选（默认 5）
    
    **响应**:
    ```json
    {
      "sample_id": 1,
      "candidates": [
        {
          "sku_id": 1,
          "barcode": "6901028075831",
          "name": "可口可乐 330ml",
          "price": 3.5,
          "score": 0.85
        },
        ...
      ],
      "model_version": "v1_placeholder",
      "message": "识别完成"
    }
    ```
    
    **说明**:
    - 当前为占位实现（随机返回候选）
    - 真实模型接入位置在 `vision_service.recognize_image`
    - 所有识别记录都会保存到 `vision_samples` 表
    """
    
    # 验证文件类型
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="文件必须是图片格式")
    
    # 验证文件大小（限制 10MB）
    image_data = await image.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 10MB")
    
    try:
        # 1. 保存图片
        image_path = vision_service.save_image(image_data, device_id)
        print(f"✅ 图片已保存: {image_path}")
        
        # 2. 获取图片信息
        image_info = vision_service.get_image_info(image_path)
        
        # 3. 识别图片（占位实现/真实模型）
        candidates = await vision_service.recognize_image(
            image_path=image_path,
            db=db,
            top_k=top_k
        )
        
        if not candidates:
            raise HTTPException(status_code=404, detail="未找到匹配的商品")
        
        # 4. 记录样本（不保存图片路径，因为会立即删除）
        sample = await vision_service.record_sample(
            db=db,
            #如果不删除图片，则需要修改记录样本的代码，image_path=image_path
            image_path="[已删除]",  # 图片识别后立即删除，不保留
            device_id=device_id,
            device_type=device_type,
            top_k_results=candidates,
            image_info=image_info
        )
        
        #如果不删除，需要注释或者删除这段代码
        # 5. 删除临时图片（识别完成后不再需要）
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
                print(f"🗑️ 临时图片已删除: {image_path}")
        except Exception as del_e:
            print(f"⚠️ 删除临时图片失败: {del_e}")
        
        print(f"✅ 识别完成，Top-1: {candidates[0]['name']} (score: {candidates[0]['score']})")
        
        return {
            "sample_id": sample.id,
            "candidates": candidates,
            "model_version": vision_service.model_version,
            "message": "识别完成"
        }
        
    except Exception as e:
        print(f"❌ 识别失败: {e}")
        # 识别失败时也尝试清理临时图片
        try:
            if 'image_path' in locals() and os.path.exists(image_path):
                os.remove(image_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")


@router.post("/confirm")
async def confirm_result(
    sample_id: int = Form(..., description="样本ID"),
    sku_id: int = Form(..., description="确认的商品ID"),
    db: Session = Depends(get_db)
):
    """
    确认识别结果
    
    **功能**: 用户确认选择的商品，更新样本记录
    
    **请求**:
    - sample_id: 识别样本ID（从 /vision/query 返回）
    - sku_id: 用户确认的商品ID
    
    **响应**:
    ```json
    {
      "message": "确认成功",
      "sample_id": 1,
      "confirmed_sku_id": 5
    }
    ```
    """
    try:
        await vision_service.confirm_result(
            db=db,
            sample_id=sample_id,
            confirmed_sku_id=sku_id
        )
        
        return {
            "message": "确认成功",
            "sample_id": sample_id,
            "confirmed_sku_id": sku_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"确认失败: {str(e)}")


@router.get("/samples")
async def list_samples(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """获取识别样本列表"""
    from app.models.vision import VisionSample
    
    samples = db.query(VisionSample).order_by(
        VisionSample.upload_time.desc()
    ).offset(skip).limit(limit).all()
    
    return [
        {
            "id": s.id,
            "image_path": s.image_path,
            "upload_time": s.upload_time.isoformat(),
            "device_id": s.device_id,
            "confirmed_sku_id": s.confirmed_sku_id,
            "top1_score": s.top1_score,
            "model_version": s.model_version
        }
        for s in samples
    ]


