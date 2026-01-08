// app.js
App({
  onLaunch() {
    console.log('SmartMart 小程序启动')
    
    // 从本地存储读取配置
    const serverUrl = wx.getStorageSync('serverUrl') || ''
    const deviceId = wx.getStorageSync('deviceId') || this.generateDeviceId()
    
    // 保存设备ID
    if (!wx.getStorageSync('deviceId')) {
      wx.setStorageSync('deviceId', deviceId)
    }
    
    this.globalData.serverUrl = serverUrl
    this.globalData.deviceId = deviceId
    
    console.log('设备ID:', deviceId)
    console.log('服务器地址:', serverUrl)
  },

  onShow() {
    console.log('小程序显示')
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

  globalData: {
    serverUrl: '',        // 服务器地址（格式：192.168.1.100:8000）
    deviceId: '',         // 设备ID
    wsConnected: false,   // WebSocket 连接状态
    socketTask: null      // WebSocket 实例
  }
})

