"""
Backend 打包脚本

使用 PyInstaller 打包 FastAPI 应用为独立的 exe 文件

使用方法：
    python build_exe.py

输出：
    dist/smartmart-backend.exe  <- 主程序（单文件）

运行时目录结构：
    安装目录/
    ├── smartmart-backend.exe   <- 主程序
    ├── smartmart.db            <- 数据库（首次运行自动创建）
    ├── data/                   <- 数据目录（索引、样本）
    ├── models/                 <- AI 模型缓存（首次运行自动下载）
    ├── static/                 <- 静态文件
    └── uploads/                <- 上传文件

注意：
    - 使用单文件模式便于 Tauri 打包
    - 数据目录在 exe 同级目录，支持持久化
    - 打包后约 200-400MB（不含 PyTorch）
    - 如需 AI 功能，首次启动会自动下载模型
"""

import PyInstaller.__main__
import os
import shutil


def build():
    """构建 backend.exe（单文件模式）"""
    
    print("=" * 60)
    print("🚀 开始打包 Backend 服务...")
    print("=" * 60)
    
    # 清理旧的构建文件
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    if os.path.exists("build"):
        shutil.rmtree("build")
    
    # PyInstaller 配置
    PyInstaller.__main__.run([
        'app/main.py',                    # 主程序入口
        '--name=smartmart-backend',       # 程序名称
        '--onefile',                      # 单文件模式
        '--console',                      # 显示控制台（方便调试）
        '--noconfirm',                    # 覆盖已存在的输出
        
        # ========== uvicorn 依赖 ==========
        '--hidden-import=uvicorn.logging',
        '--hidden-import=uvicorn.loops',
        '--hidden-import=uvicorn.loops.auto',
        '--hidden-import=uvicorn.protocols',
        '--hidden-import=uvicorn.protocols.http',
        '--hidden-import=uvicorn.protocols.http.auto',
        '--hidden-import=uvicorn.protocols.websockets',
        '--hidden-import=uvicorn.protocols.websockets.auto',
        '--hidden-import=uvicorn.lifespan',
        '--hidden-import=uvicorn.lifespan.on',
        
        # ========== 核心依赖 ==========
        '--hidden-import=PIL',
        '--hidden-import=PIL.Image',
        '--hidden-import=numpy',
        
        # ========== AI 相关依赖（可选） ==========
        '--hidden-import=transformers',
        '--hidden-import=torch',
        '--hidden-import=torchvision',
        '--hidden-import=faiss',
        '--hidden-import=tqdm',
        
        # ========== 收集依赖包 ==========
        '--collect-all=uvicorn',
        '--collect-all=fastapi',
        '--collect-all=sqlalchemy',
        '--collect-all=pydantic',
        '--collect-all=PIL',
        '--collect-all=tzdata',  # Windows 时区数据
    ])
    
    exe_path = "dist/smartmart-backend.exe"
    
    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        
        print("\n" + "=" * 60)
        print("✅ 打包完成！")
        print("=" * 60)
        print(f"📦 输出文件: {exe_path}")
        print(f"📏 文件大小: {size_mb:.1f} MB")
        print(f"📝 使用方法: smartmart-backend.exe --host 0.0.0.0 --port 8000")
        print("=" * 60)
        print("")
        print("⚠️  部署说明:")
        print("   程序会在运行目录自动创建以下子目录:")
        print("   - data/       (AI 索引和样本)")
        print("   - models/     (AI 模型缓存)")
        print("   - static/     (静态文件)")
        print("   - uploads/    (上传文件)")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ 打包失败！")
        print("=" * 60)


if __name__ == "__main__":
    build()


