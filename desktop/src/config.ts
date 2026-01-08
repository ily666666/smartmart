/**
 * 应用配置
 * 
 * 配置说明：
 * - 开发环境：使用 localhost
 * - 局域网环境：修改为局域网 IP，例如 192.168.1.100
 * - 也可以通过环境变量配置（见 .env 文件）
 */

// 从环境变量读取，如果没有则使用默认值
const API_HOST = import.meta.env.VITE_API_HOST || "localhost";
const API_PORT = import.meta.env.VITE_API_PORT || "8000";

export const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;
export const WS_URL = `ws://${API_HOST}:${API_PORT}/ws`;

// 设备 ID（用于 WebSocket 连接）
export const DEVICE_ID = `desktop-${Date.now()}`;

