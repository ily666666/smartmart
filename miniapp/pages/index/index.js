// pages/index/index.js
import { getWsUrl } from '../../config'

const app = getApp()

Page({
  data: {
    serverUrl: '',         // 服务器地址（已保存的）
    inputServerUrl: '',    // 输入框中的地址
    inputToken: '',        // 输入框中的 Token
    deviceId: '',          // 设备ID
    wsConnected: false,    // 连接状态
    connecting: false,     // 连接中
    lastMessage: '',       // 最后一条消息
    showManualInput: false, // 是否显示手动输入
    hasConnectedOnce: false // 本次会话是否成功连接过（用于判断是否自动重连）
  },

  onLoad() {
    console.log('首页加载')
    this.setData({
      serverUrl: app.globalData.serverUrl,
      deviceId: app.globalData.deviceId
    })
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    
    // 更新连接状态
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
    
    // 有保存的地址且未连接，自动尝试快速重连一次
    if (this.data.serverUrl && !app.globalData.wsConnected && !this.data.connecting) {
      console.log('🔄 自动快速重连...')
      this.connectWebSocket()
    }
  },

  // 切换手动输入显示
  toggleManualInput() {
    const newState = !this.data.showManualInput
    this.setData({
      showManualInput: newState,
      // 展开时预填当前地址
      inputServerUrl: newState ? this.data.serverUrl : ''
    })
  },

  // 扫码连接
  scanToConnect() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        console.log('扫码结果:', res.result)
        this.parseQRCode(res.result)
      },
      fail: (error) => {
        console.error('扫码失败:', error)
        if (!error.errMsg.includes('cancel')) {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 解析二维码内容
  parseQRCode(content) {
    console.log('解析二维码:', content)
    
    let serverUrl = ''
    let pairingToken = ''
    
    // 尝试解析 JSON 格式（桌面端生成的配对码）
    try {
      const data = JSON.parse(content)
      
      // SmartMart 配对码格式
      if (data.type === 'smartmart_pairing') {
        const { http_url, token } = data
        
        // 从 http_url 提取 IP:端口
        const match = http_url.match(/https?:\/\/([^\/]+)/)
        if (match) {
          serverUrl = match[1]
          pairingToken = token || ''
          console.log('✅ 解析配对码成功:', serverUrl, 'Token:', pairingToken ? '有' : '无')
        }
      }
    } catch (e) {
      // 不是 JSON，尝试其他格式
      console.log('非 JSON 格式，尝试其他解析方式')
    }
    
    // 如果 JSON 解析失败，尝试其他格式
    if (!serverUrl) {
      // 支持格式:
      // 1. smartmart://connect?server=192.168.1.100:8000
      // 2. http://192.168.1.100:8000
      // 3. 192.168.1.100:8000 (纯地址)
      
      if (content.startsWith('smartmart://')) {
        const match = content.match(/server=([^&]+)/)
        if (match) {
          serverUrl = match[1]
        }
      } else if (content.startsWith('http://') || content.startsWith('https://')) {
        const match = content.match(/https?:\/\/([^\/]+)/)
        if (match) {
          serverUrl = match[1]
        }
      } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(content)) {
        serverUrl = content
      }
    }
    
    if (serverUrl) {
      console.log('解析到服务器地址:', serverUrl)
      
      // 保存配置
      this.setData({ serverUrl })
      wx.setStorageSync('serverUrl', serverUrl)
      app.globalData.serverUrl = serverUrl
      
      // 如果有配对 Token，也保存
      if (pairingToken) {
        wx.setStorageSync('pairingToken', pairingToken)
        app.globalData.pairingToken = pairingToken
      }
      
      wx.showToast({
        title: '扫码成功',
        icon: 'success',
        duration: 1000
      })
      
      // 延迟连接，让用户看到提示
      setTimeout(() => {
        this.connectWebSocket()
      }, 500)
    } else {
      wx.showModal({
        title: '无效的二维码',
        content: '请扫描桌面端 SmartMart 显示的连接二维码',
        showCancel: false
      })
    }
  },

  // 仅断开连接（保留服务器地址）
  disconnectOnly() {
    const socketTask = app.globalData.socketTask
    if (socketTask) {
      socketTask.close()
      app.globalData.socketTask = null
    }
    
    // 手动断开时，停止自动重连
    this.setData({ 
      wsConnected: false,
      hasConnectedOnce: false  // 重置，不再自动重连
    })
    app.globalData.wsConnected = false
    
    wx.showToast({
      title: '已断开',
      icon: 'success'
    })
  },

  // 清除保存的服务器地址
  clearSavedServer() {
    wx.showModal({
      title: '清除服务器记录',
      content: '清除后需要重新扫码配对',
      confirmText: '清除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          // 断开连接
          const socketTask = app.globalData.socketTask
          if (socketTask) {
            socketTask.close()
            app.globalData.socketTask = null
          }
          app.globalData.wsConnected = false
          
          // 清除存储
          wx.removeStorageSync('serverUrl')
          wx.removeStorageSync('pairingToken')
          app.globalData.serverUrl = ''
          app.globalData.pairingToken = ''
          
          this.setData({
            serverUrl: '',
            wsConnected: false,
            showManualInput: false,
            hasConnectedOnce: false  // 重置
          })
          
          wx.showToast({
            title: '已清除',
            icon: 'success'
          })
        }
      }
    })
  },

  // 断开并重置（兼容旧方法）
  disconnectAndReset() {
    this.clearSavedServer()
  },

  // 显示连接错误提示
  showConnectionError() {
    wx.showModal({
      title: '连接失败',
      content: `无法连接到 ${this.data.serverUrl}\n\n请检查：\n1. 电脑和手机是否在同一WiFi\n2. 服务器地址是否正确\n3. 桌面端是否已启动`,
      confirmText: '重新扫码',
      cancelText: '手动输入',
      success: (res) => {
        if (res.confirm) {
          // 重新扫码
          this.scanToConnect()
        } else if (res.cancel) {
          // 手动输入
          this.setData({
            showManualInput: true,
            inputServerUrl: this.data.serverUrl
          })
        }
      }
    })
  },

  // 前往识别页
  goToVision() {
    wx.navigateTo({
      url: '/pages/vision/vision'
    })
  },

  // 输入服务器地址
  onServerUrlInput(e) {
    this.setData({
      inputServerUrl: e.detail.value
    })
  },
  
  // 输入 Token
  onTokenInput(e) {
    this.setData({
      inputToken: e.detail.value
    })
  },

  // 保存配置
  saveConfig() {
    const inputUrl = this.data.inputServerUrl || this.data.serverUrl
    const inputToken = this.data.inputToken || ''
    
    if (!inputUrl) {
      wx.showToast({
        title: '请输入服务器地址',
        icon: 'none'
      })
      return
    }
    
    // 验证格式（IP:端口）
    const regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/
    if (!regex.test(inputUrl)) {
      wx.showToast({
        title: '地址格式错误（如：192.168.1.100:8000）',
        icon: 'none',
        duration: 3000
      })
      return
    }
    
    // 保存到本地存储
    wx.setStorageSync('serverUrl', inputUrl)
    app.globalData.serverUrl = inputUrl
    
    // 如果输入了 Token，保存它
    if (inputToken) {
      wx.setStorageSync('pairingToken', inputToken)
      app.globalData.pairingToken = inputToken
    }
    
    this.setData({
      serverUrl: inputUrl,
      showManualInput: false,
      inputToken: ''  // 清空输入框
    })
    
    wx.showToast({
      title: '配置已保存',
      icon: 'success'
    })
    
    // 自动连接
    this.connectWebSocket()
  },

  // 连接 WebSocket
  connectWebSocket() {
    const { serverUrl, deviceId } = this.data
    
    if (!serverUrl) {
      wx.showToast({
        title: '请先配置服务器地址',
        icon: 'none'
      })
      return
    }
    
    if (this.data.connecting) {
      console.log('正在连接中...')
      return
    }
    
    this.setData({ connecting: true })
    
    const wsUrl = getWsUrl(serverUrl)
    console.log('连接到:', wsUrl)
    
    wx.showLoading({ title: '连接中...' })
    
    // 设置连接超时（3秒）
    const connectionTimeout = setTimeout(() => {
      if (this.data.connecting && !this.data.wsConnected) {
        console.log('❌ 连接超时')
        wx.hideLoading()
        this.setData({ connecting: false })
        
        // 关闭可能挂起的连接
        if (app.globalData.socketTask) {
          app.globalData.socketTask.close()
          app.globalData.socketTask = null
        }
        
        // 首次连接超时，提示错误
        if (!this.data.hasConnectedOnce) {
          this.showConnectionError()
        }
      }
    }, 3000)
    
    const socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => {
        console.log('WebSocket 连接请求已发送')
      },
      fail: (error) => {
        console.error('WebSocket 连接失败:', error)
        clearTimeout(connectionTimeout)
        wx.hideLoading()
        this.setData({ connecting: false })
        
        // 首次连接失败，提示重新输入
        this.showConnectionError()
      }
    })
    
    // 保存超时定时器引用，以便在成功时清除
    this._connectionTimeout = connectionTimeout
    
    socketTask.onOpen(() => {
      console.log('✅ WebSocket 已连接')
      
      // 清除连接超时定时器
      if (this._connectionTimeout) {
        clearTimeout(this._connectionTimeout)
        this._connectionTimeout = null
      }
      
      wx.hideLoading()
      
      this.setData({
        wsConnected: true,
        connecting: false,
        hasConnectedOnce: true  // 标记本次会话已成功连接过
      })
      
      app.globalData.wsConnected = true
      app.globalData.socketTask = socketTask
      
      // 发送设备注册消息（带 Token 验证）
      const pairingToken = wx.getStorageSync('pairingToken') || app.globalData.pairingToken || ''
      this.sendMessage({
        type: 'REGISTER',
        device_id: deviceId,
        device_type: 'miniapp',
        token: pairingToken,
        ts: Date.now()
      })
      
      wx.showToast({
        title: '连接成功',
        icon: 'success'
      })
    })
    
    socketTask.onMessage((res) => {
      const data = JSON.parse(res.data)
      console.log('📨 收到消息:', data)
      
      this.setData({
        lastMessage: JSON.stringify(data, null, 2)
      })
      
      // 处理商品找到
      if (data.type === 'PRODUCT_FOUND') {
        wx.showToast({
          title: `${data.name} ¥${data.price}`,
          icon: 'success',
          duration: 2000
        })
      }
      
      // 处理商品未找到
      if (data.type === 'PRODUCT_NOT_FOUND') {
        wx.showToast({
          title: `商品未找到: ${data.code}`,
          icon: 'none',
          duration: 2000
        })
      }
      
      // 处理注册成功
      if (data.type === 'REGISTER_SUCCESS') {
        console.log('✅ 设备注册成功:', data)
        // 清除已使用的 Token
        wx.removeStorageSync('pairingToken')
        app.globalData.pairingToken = ''
      }
      
      // 处理注册失败（Token 无效）
      if (data.type === 'REGISTER_FAILED') {
        console.error('❌ 设备注册失败:', data.message)
        wx.hideLoading()
        
        // 清除无效的 Token
        wx.removeStorageSync('pairingToken')
        app.globalData.pairingToken = ''
        
        // 断开连接
        if (app.globalData.socketTask) {
          app.globalData.socketTask.close()
          app.globalData.socketTask = null
        }
        
        this.setData({
          wsConnected: false,
          connecting: false,
          hasConnectedOnce: false
        })
        app.globalData.wsConnected = false
        
        // 提示用户重新扫码
        wx.showModal({
          title: '认证失败',
          content: data.message || 'Token 无效或已过期，请重新扫码配对',
          confirmText: '重新扫码',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.scanToConnect()
            }
          }
        })
      }
    })
    
    socketTask.onError((error) => {
      console.error('❌ WebSocket 错误:', error)
      
      // 清除连接超时定时器
      if (this._connectionTimeout) {
        clearTimeout(this._connectionTimeout)
        this._connectionTimeout = null
      }
      
      wx.hideLoading()
      
      const wasConnected = this.data.hasConnectedOnce
      
      this.setData({
        wsConnected: false,
        connecting: false
      })
      app.globalData.wsConnected = false
      
      // 首次连接就失败，提示地址错误
      if (!wasConnected) {
        this.showConnectionError()
      } else {
        // 之前连过，只是断了，静默处理（会自动重连）
        wx.showToast({
          title: '连接已断开',
          icon: 'none'
        })
      }
    })
    
    socketTask.onClose(() => {
      console.log('❌ WebSocket 已断开')
      
      // 清除连接超时定时器
      if (this._connectionTimeout) {
        clearTimeout(this._connectionTimeout)
        this._connectionTimeout = null
      }
      
      this.setData({
        wsConnected: false,
        connecting: false
      })
      app.globalData.wsConnected = false
      
      // 只有之前成功连接过才自动重连（5秒后）
      if (this.data.hasConnectedOnce && this.data.serverUrl) {
        console.log('🔄 5秒后尝试自动重连...')
        setTimeout(() => {
          if (!this.data.wsConnected && this.data.serverUrl && this.data.hasConnectedOnce) {
            this.connectWebSocket()
          }
        }, 5000)
      }
    })
  },

  // 断开连接
  disconnectWebSocket() {
    const socketTask = app.globalData.socketTask
    if (socketTask) {
      socketTask.close()
      app.globalData.socketTask = null
    }
    
    this.setData({ wsConnected: false })
    app.globalData.wsConnected = false
    
    wx.showToast({
      title: '已断开连接',
      icon: 'success'
    })
  },

  // 发送消息
  sendMessage(data) {
    const socketTask = app.globalData.socketTask
    if (!socketTask || !this.data.wsConnected) {
      console.error('WebSocket 未连接')
      return false
    }
    
    socketTask.send({
      data: JSON.stringify(data),
      success: () => {
        console.log('✅ 消息已发送:', data)
      },
      fail: (error) => {
        console.error('❌ 消息发送失败:', error)
      }
    })
    
    return true
  },

  // 前往扫码页
  goToScan() {
    if (!this.data.serverUrl) {
      wx.showToast({
        title: '请先配置服务器地址',
        icon: 'none'
      })
      return
    }
    
    // scan 页面不在 tabBar 中，使用 navigateTo
    wx.navigateTo({
      url: '/pages/scan/scan'
    })
  },

  // 复制设备ID
  copyDeviceId() {
    wx.setClipboardData({
      data: this.data.deviceId,
      success: () => {
        wx.showToast({
          title: '设备ID已复制',
          icon: 'success'
        })
      }
    })
  }
})

