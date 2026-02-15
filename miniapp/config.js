/**
 * 应用配置
 * 
 * 支持两种服务器地址格式：
 * 1. 局域网 IP: 192.168.1.100:8000
 * 2. 域名（如花生壳映射）: example.oicp.net:12345
 * 3. 带协议的完整地址: http://example.oicp.net:12345
 * 
 * 开发环境：勾选"不校验合法域名"
 * 生产环境：需在小程序后台配置合法域名
 */

// 默认配置
export const DEFAULT_SERVER = ''

/**
 * 解析服务器地址，提取 host 和协议
 * 支持格式：
 * - 192.168.1.100:8000
 * - example.oicp.net:12345
 * - http://example.oicp.net:12345
 * - https://example.oicp.net:12345
 */
function parseServerUrl(serverUrl) {
  if (!serverUrl) return null
  
  let url = serverUrl.trim()
  
  // 如果已经带协议，直接解析
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // 移除尾部斜杠
    return url.replace(/\/+$/, '')
  }
  
  // 没有协议：IP 地址用 http，域名用 https
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)
  return isIP ? `http://${url}` : `https://${url}`
}

/**
 * 获取 API 基础地址
 * @param {string} serverUrl - 服务器地址
 * @returns {string|null} 完整的 API 地址，如 http://example.oicp.net:12345
 */
export function getApiUrl(serverUrl) {
  return parseServerUrl(serverUrl)
}

/**
 * 获取 WebSocket 地址
 * @param {string} serverUrl - 服务器地址
 * @returns {string|null} WebSocket 地址
 */
export function getWsUrl(serverUrl) {
  const apiUrl = parseServerUrl(serverUrl)
  if (!apiUrl) return null
  
  // http -> ws, https -> wss
  return apiUrl.replace(/^http/, 'ws') + '/ws'
}

/**
 * 获取带认证信息的请求头
 * 所有 API 请求都应该使用此方法获取请求头
 * @returns {object} 请求头对象
 */
export function getAuthHeaders() {
  const app = getApp()
  const headers = {}
  if (app && app.globalData && app.globalData.apiKey) {
    headers['X-API-Key'] = app.globalData.apiKey
  }
  return headers
}

/**
 * 验证服务器地址格式
 * @param {string} url - 待验证的地址
 * @returns {boolean} 是否合法
 */
export function isValidServerUrl(url) {
  if (!url || !url.trim()) return false
  
  const trimmed = url.trim()
  
  // 带协议的完整 URL
  if (/^https?:\/\/.+/.test(trimmed)) return true
  
  // IP:端口 格式
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(trimmed)) return true
  
  // 域名:端口 格式（支持花生壳等动态域名）
  if (/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+(\:\d+)?$/.test(trimmed)) return true
  
  return false
}
