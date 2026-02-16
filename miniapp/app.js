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
    
    // 如果有保存的服务器地址，自动检查连接并启动定时重连
    if (serverUrl) {
      this.checkServerHealth()
      this.startAutoReconnect()
    }
  },

  onShow() {
    console.log('小程序显示')
    // 每次小程序回到前台，立即检查并确保定时重连在运行
    if (this.globalData.serverUrl) {
      this.checkServerHealth()
      this.startAutoReconnect()
    }
  },

  onHide() {
    console.log('小程序隐藏')
    this.stopAutoReconnect()
  },

  onError(error) {
    console.error('小程序错误:', error)
  },

  // 生成设备ID
  generateDeviceId() {
    return 'miniapp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)
  },

  // ==================== 自动重连机制 ====================
  _reconnectTimer: null,

  /**
   * 启动定时健康检查（自动重连）
   * - 连接正常时：每 30 秒检查一次
   * - 连接断开时：每 5 秒检查一次（快速重连）
   */
  startAutoReconnect() {
    this.stopAutoReconnect()
    this._reconnectTimer = setInterval(() => {
      if (!this.globalData.serverUrl) return
      const wasConnected = this.globalData.wsConnected
      this.checkServerHealth().then((connected) => {
        if (!wasConnected && connected) {
          console.log('🔄 服务器重连成功')
        }
      })
    }, this.globalData.wsConnected ? 30000 : 5000)
  },

  stopAutoReconnect() {
    if (this._reconnectTimer) {
      clearInterval(this._reconnectTimer)
      this._reconnectTimer = null
    }
  },

  /**
   * 全局请求方法，自动注入 API Key、处理 401、连接失败自动重试
   * 用法：app.request({...}) 替代 wx.request({...})
   * @param {object} options - wx.request 参数
   * @param {number} _retryCount - 内部使用，当前重试次数
   */
  request(options, _retryCount = 0) {
    const MAX_RETRY = 1  // 最多重试 1 次（共 2 次尝试），对普通请求够用
    const header = options.header || {}
    // 自动添加 API Key
    if (!header['X-API-Key'] && this.globalData.apiKey) {
      header['X-API-Key'] = this.globalData.apiKey
    }

    // 包装 success 回调，统一处理 401
    const originalSuccess = options.success
    const wrappedSuccess = (res) => {
      // 请求成功说明服务器可达，更新连接状态
      if (res.statusCode !== 401) {
        this.globalData.wsConnected = true
      }
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

    // 包装 fail 回调，连接错误自动重试
    const originalFail = options.fail
    const wrappedFail = (error) => {
      const errMsg = (error.errMsg || '').toLowerCase()
      const isConnectionError = errMsg.includes('refused') ||
                                errMsg.includes('timeout') ||
                                errMsg.includes('fail')

      if (isConnectionError && _retryCount < MAX_RETRY) {
        const delay = (_retryCount + 1) * 2000
        console.log(`🔄 请求失败，${delay/1000}秒后重试 (${_retryCount + 1}/${MAX_RETRY})`)
        this.globalData.wsConnected = false
        // 加速重连检测
        this.startAutoReconnect()
        setTimeout(() => {
          this.request(
            { ...options, header, success: originalSuccess, fail: originalFail },
            _retryCount + 1
          )
        }, delay)
        return
      }

      // 重试用尽，标记断开
      this.globalData.wsConnected = false
      this.startAutoReconnect()
      if (originalFail) originalFail(error)
    }

    return wx.request({
      ...options,
      header,
      success: wrappedSuccess,
      fail: wrappedFail
    })
  },

  /**
   * 全局上传方法，自动注入 API Key
   * 用法：app.uploadFile({...}) 替代 wx.uploadFile({...})
   */
  uploadFile(options) {
    const header = options.header || {}
    if (!header['X-API-Key'] && this.globalData.apiKey) {
      header['X-API-Key'] = this.globalData.apiKey
    }
    return wx.uploadFile({
      ...options,
      header
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
            if (!this.globalData.wsConnected) {
              console.log('✅ 服务器连接恢复')
            }
            this.globalData.wsConnected = true
            resolve(true)
          } else {
            console.warn('⚠️ 服务器响应异常:', res.statusCode)
            this.globalData.wsConnected = false
            resolve(false)
          }
        },
        fail: (error) => {
          if (this.globalData.wsConnected) {
            console.error('❌ 服务器连接断开:', error.errMsg)
          }
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
