"""API Key 认证中间件

开发者在服务器上通过环境变量 API_KEY 设置连接密码：
  API_KEY=mypassword123 uvicorn app.main:app --host 0.0.0.0 --port 8000

设置后，所有 API 请求必须在请求头中携带：
  X-API-Key: mypassword123

不需要密码的路径：
  /health  （健康检查，返回是否需要密码）
  /        （根路径）
  /docs, /openapi.json, /redoc （API 文档）
  /ws      （WebSocket，有自己的认证）
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import settings


# 不需要认证的路径
EXEMPT_PATHS = {"/", "/health", "/docs", "/openapi.json", "/redoc", "/ws"}

# 不需要认证的路径前缀
EXEMPT_PREFIXES = ("/static/",)


class APIKeyMiddleware(BaseHTTPMiddleware):
    """API Key 认证中间件
    
    - API_KEY 未设置 → 所有请求放行
    - API_KEY 已设置 → 请求必须携带正确的 X-API-Key 头
    - 密码由开发者在服务器环境变量中配置，无法通过 API 修改
    """

    async def dispatch(self, request, call_next):
        path = request.url.path

        # 豁免路径
        if path in EXEMPT_PATHS:
            return await call_next(request)

        for prefix in EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # 没设密码，全部放行
        if not settings.API_KEY:
            return await call_next(request)

        # 校验密码
        request_key = request.headers.get("X-API-Key", "")
        if request_key != settings.API_KEY:
            return JSONResponse(
                status_code=401,
                content={"detail": "连接密码错误或未提供"}
            )

        return await call_next(request)
