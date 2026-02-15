# ============================================================
# SmartMart AI Backend - GPU Docker Image
# 基于 NVIDIA CUDA 12.6 + Miniconda + FastAPI
# ============================================================

FROM nvidia/cuda:12.6.3-runtime-ubuntu24.04

# 避免交互式安装提示
ENV DEBIAN_FRONTEND=noninteractive

# ==================== 系统依赖 ====================
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    git \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# 时区设置
ENV TZ=Asia/Shanghai

# ==================== 安装 Miniconda ====================
ENV CONDA_DIR=/opt/conda
ENV PATH=$CONDA_DIR/bin:$PATH

RUN wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh && \
    bash /tmp/miniconda.sh -b -p $CONDA_DIR && \
    rm /tmp/miniconda.sh && \
    conda clean -afy

# 接受 conda 服务条款 + 创建 Python 3.11 环境
RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main && \
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r && \
    conda create -n smartmart python=3.11 -y && \
    conda clean -afy

# 激活环境（让后续命令都在 smartmart 环境中执行）
ENV PATH=$CONDA_DIR/envs/smartmart/bin:$PATH
ENV CONDA_DEFAULT_ENV=smartmart

# ==================== conda 网络配置：超时 600s，重试 5 次 ====================
RUN conda config --set remote_connect_timeout_secs 600 && \
    conda config --set remote_read_timeout_secs 600 && \
    conda config --set remote_max_retries 5

# ==================== 第1层：PyTorch + FAISS（最大，约 2GB，很少改动） ====================
RUN conda install -n smartmart -c pytorch -c nvidia -c conda-forge \
    pytorch torchvision torchaudio pytorch-cuda=12.4 \
    faiss-gpu \
    -y && \
    conda clean -afy

# ==================== 第2层：transformers（较小，改版本不用重下 PyTorch） ====================
RUN conda install -n smartmart -c huggingface -c conda-forge \
    "transformers>=4.36,<5" \
    -y && \
    conda clean -afy

# ==================== 安装其他项目依赖（pip） ====================
WORKDIR /app

COPY pyproject.toml ./

RUN pip install --no-cache-dir \
    "fastapi>=0.109.0" \
    "uvicorn[standard]>=0.27.0" \
    "pydantic>=2.5.0" \
    "pydantic-settings>=2.1.0" \
    "sqlalchemy>=2.0.25" \
    "python-multipart>=0.0.6" \
    "pillow>=10.2.0" \
    "websockets>=12.0" \
    "numpy>=1.26.0" \
    "httpx>=0.25.0" \
    "tqdm>=4.66.0"

# ==================== 复制应用代码 ====================
COPY . .

# ==================== 环境变量 ====================
ENV DEBUG=false
ENV API_KEY=smartmart2026

# ==================== 暴露端口 ====================
EXPOSE 8000

# ==================== 启动命令 ====================
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
