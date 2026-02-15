"""FastAPI 应用主入口 - 集成 AI 识别"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

from app.database import engine, Base, init_sample_data
from app.api import products, websocket_api, orders, vision, reports, analysis, pairing, recognition, samples, database, settings
from app.middleware import APIKeyMiddleware

# 确保静态文件目录存在
STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "images" / "products").mkdir(parents=True, exist_ok=True)


def warmup_ai_models():
    """预热 AI 模型（避免首次请求慢）"""
    try:
        from app.services.vision_service import _get_ai_components
        print("🔥 预热 AI 模型...")
        embedder, faiss_manager = _get_ai_components()
        if embedder and faiss_manager and faiss_manager.index is not None:
            print("✅ AI 模型预热完成")
        else:
            print("⚠️ AI 模型预热跳过（索引未构建）")
    except Exception as e:
        print(f"⚠️ AI 模型预热失败: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时：创建数据库表
    print("🚀 正在初始化数据库...")
    Base.metadata.create_all(bind=engine)
    
    # 初始化示例数据
    init_sample_data()
    print("✅ 数据库初始化完成")
    
    # 预热 AI 模型
    # 嫌慢可以把这一行注释掉，改为首次识别时再加载
    #warmup_ai_models()
    
    yield
    
    # 关闭时清理
    print("👋 应用关闭")


app = FastAPI(
    title="SmartMart Backend API",
    description="本地超市收银+进销存系统后端（集成 CLIP + FAISS AI 识别）",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # 允许所有请求头（包括 X-API-Key）
)

# API Key 认证中间件（在 CORS 之后添加）
# 设置了连接密码后，所有远程请求都需要携带 X-API-Key 头
app.add_middleware(APIKeyMiddleware)

# 挂载静态文件目录（用于访问上传的图片）
app.mount("/static", StaticFiles(directory="static"), name="static")

# 注册路由
app.include_router(products.router, prefix="/products", tags=["商品管理"])
app.include_router(orders.router, prefix="/orders", tags=["订单管理"])
app.include_router(vision.router, prefix="/vision", tags=["外观识别"])
app.include_router(reports.router, prefix="/reports", tags=["统计报表"])
app.include_router(analysis.router, prefix="/analysis", tags=["AI 分析"])
app.include_router(pairing.router, prefix="/pairing", tags=["设备配对"])
app.include_router(recognition.router, prefix="/api/recognition", tags=["AI 识别"])
app.include_router(samples.router, prefix="/api/samples", tags=["AI 样本管理"])
app.include_router(database.router, prefix="/database", tags=["数据库管理"])
app.include_router(settings.router, tags=["系统设置"])
app.include_router(websocket_api.router, tags=["WebSocket"])


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "SmartMart Backend API - MVP",
        "version": "1.0.0-mvp",
        "docs": "/docs",
        "websocket": "ws://localhost:8000/ws",
        "firewall_note": "请确保防火墙开放 8000 端口",
    }


@app.get("/health")
async def health_check():
    """健康检查（不需要密码）"""
    from app.config import settings as app_settings
    
    return {
        "status": "ok",
        "message": "服务运行正常",
        "auth_required": bool(app_settings.API_KEY)
    }


def get_base_path():
    """获取程序基础路径（支持 PyInstaller 打包）"""
    import sys
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后运行
        return Path(sys.executable).parent
    else:
        # 开发模式运行
        return Path(__file__).parent.parent


if __name__ == "__main__":
    import argparse
    import os
    import uvicorn
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="SmartMart Backend Server")
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址")
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    args = parser.parse_args()
    
    # 切换到正确的工作目录（支持 PyInstaller）
    base_path = get_base_path()
    os.chdir(base_path)
    print(f"📂 工作目录: {base_path}")
    
    # 启动服务器
    print(f"🚀 启动服务器: http://{args.host}:{args.port}")
    
    # 注意：打包后必须直接传入 app 对象，不能用字符串 "app.main:app"
    uvicorn.run(
        app,  # 直接传入 app 对象
        host=args.host,
        port=args.port,
        log_level="info"
    )

