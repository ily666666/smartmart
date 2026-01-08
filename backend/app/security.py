"""安全认证模块"""

import secrets
import time
from typing import Optional, Dict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


class TokenManager:
    """Token 管理器（简单实现）"""
    
    def __init__(self):
        self.tokens: Dict[str, dict] = {}  # token -> {created_at, expires_at, used}
        self.token_validity = 300  # Token 有效期（秒），默认 5 分钟
    
    def generate_pairing_token(self, validity_seconds: int = 300) -> str:
        """
        生成配对 Token
        
        Args:
            validity_seconds: Token 有效期（秒）
            
        Returns:
            Token 字符串
        """
        token = secrets.token_urlsafe(32)
        
        now = datetime.now(ZoneInfo("Asia/Shanghai"))
        expires_at = now + timedelta(seconds=validity_seconds)
        
        self.tokens[token] = {
            "created_at": now,
            "expires_at": expires_at,
            "used": False,
            "type": "pairing"
        }
        
        # 清理过期 token
        self._cleanup_expired_tokens()
        
        return token
    
    def validate_token(self, token: str, mark_as_used: bool = True) -> bool:
        """
        验证 Token
        
        Args:
            token: Token 字符串
            mark_as_used: 是否标记为已使用（一次性 Token）
            
        Returns:
            是否有效
        """
        if token not in self.tokens:
            return False
        
        token_info = self.tokens[token]
        
        # 检查是否过期
        if datetime.now(ZoneInfo("Asia/Shanghai")) > token_info["expires_at"]:
            del self.tokens[token]
            return False
        
        # 检查是否已使用（一次性 Token）
        if token_info.get("used", False):
            return False
        
        # 标记为已使用
        if mark_as_used:
            token_info["used"] = True
        
        return True
    
    def revoke_token(self, token: str):
        """撤销 Token"""
        if token in self.tokens:
            del self.tokens[token]
    
    def _cleanup_expired_tokens(self):
        """清理过期的 Token"""
        now = datetime.now(ZoneInfo("Asia/Shanghai"))
        expired_tokens = [
            token for token, info in self.tokens.items()
            if now > info["expires_at"]
        ]
        
        for token in expired_tokens:
            del self.tokens[token]
    
    def get_active_tokens_count(self) -> int:
        """获取活跃 Token 数量"""
        self._cleanup_expired_tokens()
        return len([t for t in self.tokens.values() if not t.get("used", False)])


# 全局 Token 管理器
token_manager = TokenManager()


def get_token_manager() -> TokenManager:
    """获取全局 Token 管理器"""
    return token_manager


def is_local_network_ip(ip: str) -> bool:
    """
    判断是否为局域网 IP
    
    局域网 IP 范围：
    - 10.0.0.0 - 10.255.255.255
    - 172.16.0.0 - 172.31.255.255
    - 192.168.0.0 - 192.168.255.255
    - 127.0.0.1 (localhost)
    """
    if ip == "127.0.0.1" or ip == "localhost":
        return True
    
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    
    try:
        a, b, c, d = map(int, parts)
    except ValueError:
        return False
    
    # 10.0.0.0/8
    if a == 10:
        return True
    
    # 172.16.0.0/12
    if a == 172 and 16 <= b <= 31:
        return True
    
    # 192.168.0.0/16
    if a == 192 and b == 168:
        return True
    
    return False


