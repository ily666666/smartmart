/**
 * 应用配置
 * 
 * 支持运行时切换服务器地址：
 * - 默认连接本地 localhost:8000
 * - 用户可在设置页面配置远程服务器地址和连接密码
 * - 配置保存在 localStorage 中，重启后保留
 */

// ==================== localStorage 键名 ====================
const STORAGE_KEYS = {
  HOST: 'smartmart_server_host',
  PORT: 'smartmart_server_port',
  API_KEY: 'smartmart_api_key',
};

// ==================== 默认值 ====================
const DEFAULT_HOST = import.meta.env.VITE_API_HOST || "localhost";
const DEFAULT_PORT = import.meta.env.VITE_API_PORT || "8000";

// ==================== Getter 函数 ====================

/** 获取服务器地址 */
export function getServerHost(): string {
  return localStorage.getItem(STORAGE_KEYS.HOST) || DEFAULT_HOST;
}

/** 获取服务器端口 */
export function getServerPort(): string {
  return localStorage.getItem(STORAGE_KEYS.PORT) || DEFAULT_PORT;
}

/** 获取连接密码 */
export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || "";
}

/** 获取 API 基础地址 */
export function getApiBaseUrl(): string {
  const host = getServerHost();
  const port = getServerPort();
  // 如果 host 已经带协议，直接用
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return `${host}:${port}`;
  }
  return `http://${host}:${port}`;
}

/** 获取 WebSocket 地址 */
export function getWsUrl(): string {
  const host = getServerHost();
  const port = getServerPort();
  if (host.startsWith('https://')) {
    return `wss://${host.replace('https://', '')}:${port}/ws`;
  }
  if (host.startsWith('http://')) {
    return `ws://${host.replace('http://', '')}:${port}/ws`;
  }
  return `ws://${host}:${port}/ws`;
}

/** 判断是否连接本地服务 */
export function isLocalServer(): boolean {
  const host = getServerHost();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

// ==================== 保存配置 ====================

/** 保存服务器配置 */
export function setServerConfig(host: string, port: string, apiKey: string) {
  if (host && host !== DEFAULT_HOST) {
    localStorage.setItem(STORAGE_KEYS.HOST, host.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.HOST);
  }
  if (port && port !== DEFAULT_PORT) {
    localStorage.setItem(STORAGE_KEYS.PORT, port.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.PORT);
  }
  if (apiKey) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  } else {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }

  // 通知其他组件配置变更
  window.dispatchEvent(new CustomEvent('server-config-changed'));
}

/** 重置为默认配置（本地服务器） */
export function resetServerConfig() {
  localStorage.removeItem(STORAGE_KEYS.HOST);
  localStorage.removeItem(STORAGE_KEYS.PORT);
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  window.dispatchEvent(new CustomEvent('server-config-changed'));
}

// ==================== 全局请求封装 ====================

/**
 * 封装的 fetch 方法，自动拼接 baseUrl 和 apiKey
 * 
 * 用法：apiFetch('/products') 替代 fetch(`${API_BASE_URL}/products`)
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;
  const apiKey = getApiKey();

  // 合并 headers，自动加 X-API-Key
  const headers = new Headers(options.headers || {});
  if (apiKey && !headers.has('X-API-Key')) {
    headers.set('X-API-Key', apiKey);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// ==================== 兼容旧代码（逐步废弃） ====================

/** @deprecated 使用 getApiBaseUrl() 代替 */
export const API_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

/** @deprecated 使用 getWsUrl() 代替 */
export const WS_URL = `ws://${DEFAULT_HOST}:${DEFAULT_PORT}/ws`;

// 设备 ID（用于 WebSocket 连接）
export const DEVICE_ID = `desktop-${Date.now()}`;
