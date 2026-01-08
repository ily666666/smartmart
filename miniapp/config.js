/**
 * 应用配置
 * 
 * 注意：小程序对局域网IP的访问限制
 * 1. 开发环境：可以勾选"不校验合法域名"来使用 ws://IP:PORT
 * 2. 生产环境：需要配置域名 + WSS (HTTPS)
 */

// 默认配置（可在首页修改）
export const DEFAULT_SERVER = '127.0.0.1:8000'

// 根据服务器地址生成 URL
export function getApiUrl(serverUrl) {
  if (!serverUrl) return null
  return `http://${serverUrl}`
}

export function getWsUrl(serverUrl) {
  if (!serverUrl) return null
  return `ws://${serverUrl}/ws`
}

