// app.js
import { getApiUrl } from './config'

App({
  onLaunch() {
    console.log('SmartMart 小程序启动')
    
    // 从本地存储读取配置
    const serverUrl = wx.getStorageSync('serverUrl') || ''
    const apiKey = wx.getStorageSync('apiKey') || ''
    const deviceId = wx.getStorageSync('deviceId') || this.generateDeviceId()
    
    // 保存设备ID
    if (!wx.getStorageSync('deviceId')) {
      wx.setStorageSync('deviceId', deviceId)
    }
    
    this.globalData.serverUrl = serverUrl
    this.globalData.apiKey = apiKey
    this.globalData.deviceId = deviceId
    
    console.log('设备ID:', deviceId)
    console.log('服务器地址:', serverUrl)
    console.log('连接密码:', apiKey ? '已设置' : '未设置')
    
    // 如果有保存的服务器地址，自动检查连接
    if (serverUrl) {
      this.checkServerHealth()
    }
  },

  onShow() {
    console.log('小程序显示')
    // 每次小程序回到前台，重新检查服务器连接
    if (this.globalData.serverUrl) {
      this.checkServerHealth()
    }
  },

  onHide() {
    console.log('小程序隐藏')
  },

  onError(error) {
    console.error('小程序错误:', error)
  },

  // 生成设备ID
  generateDeviceId() {
    return 'miniapp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)
  },

  /**
   * 全局请求方法，自动注入 API Key 并处理 401
   * 用法：app.request({...}) 替代 wx.request({...})
   */
  request(options) {
    const header = options.header || {}
    // 自动添加 API Key
    if (!header['X-API-Key'] && this.globalData.apiKey) {
      header['X-API-Key'] = this.globalData.apiKey
    }

    // 包装 success 回调，统一处理 401
    const originalSuccess = options.success
    const wrappedSuccess = (res) => {
      if (res.statusCode === 401) {
        wx.showModal({
          title: '认证失败',
          content: '连接密码错误，请在设置中检查密码是否正确',
          confirmText: '去设置',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.switchTab({ url: '/pages/settings/settings' })
            }
          }
        })
      }
      if (originalSuccess) {
        originalSuccess(res)
      }
    }

    return wx.request({
      ...options,
      header,
      success: wrappedSuccess
    })
  },

  /**
   * 检查服务器健康状态（HTTP 方式）
   * /health 接口不需要密码
   * @returns {Promise<boolean>} 是否连接成功
   */
  checkServerHealth() {
    return new Promise((resolve) => {
      const apiUrl = getApiUrl(this.globalData.serverUrl)
      if (!apiUrl) {
        this.globalData.wsConnected = false
        resolve(false)
        return
      }

      wx.request({
        url: `${apiUrl}/health`,
        method: 'GET',
        timeout: 5000,
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.status === 'ok') {
            console.log('✅ 服务器连接正常')
            this.globalData.wsConnected = true
            resolve(true)
          } else {
            console.warn('⚠️ 服务器响应异常:', res.statusCode)
            this.globalData.wsConnected = false
            resolve(false)
          }
        },
        fail: (error) => {
          console.error('❌ 服务器连接失败:', error)
          this.globalData.wsConnected = false
          resolve(false)
        }
      })
    })
  },

  globalData: {
    serverUrl: '',        // 服务器地址
    apiKey: '',           // 连接密码（API Key）
    deviceId: '',         // 设备ID
    wsConnected: false,   // 服务器连接状态（true = 服务器可达）
    socketTask: null      // WebSocket 实例（桌面端同步用，可选）
  }
})
