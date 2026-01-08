// pages/scan/scan.js
const app = getApp()

Page({
  data: {
    wsConnected: false,
    cameraReady: false,
    flashMode: 'off',
    lastCode: '',
    lastScanTime: '',
    scanCount: 0,
    sendSuccess: false,
    scanHistory: []        // 扫描历史
  },
  
  // 已扫描的条码锁定表
  _scannedCodes: {},
  _currentVisibleCode: null,
  _visibleCodeTimer: null,
  _historyIdCounter: 0,

  onLoad() {
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
    
    // 延迟初始化相机
    setTimeout(() => {
      this.setData({ cameraReady: true })
    }, 300)
  },

  onShow() {
    // scan 页面不再是 Tab 页面，从采集中心进入
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
  },

  onHide() {
    this.setData({ flashMode: 'off' })
    
    if (this._visibleCodeTimer) {
      clearTimeout(this._visibleCodeTimer)
      this._visibleCodeTimer = null
    }
    this._scannedCodes = {}
    this._currentVisibleCode = null
  },
  
  onUnload() {
    if (this._visibleCodeTimer) {
      clearTimeout(this._visibleCodeTimer)
    }
  },

  // 相机扫码回调
  onScanCode(e) {
    const { result } = e.detail
    if (!result) return
    
    this._currentVisibleCode = result
    
    if (this._visibleCodeTimer) {
      clearTimeout(this._visibleCodeTimer)
    }
    
    this._visibleCodeTimer = setTimeout(() => {
      if (this._currentVisibleCode && this._scannedCodes[this._currentVisibleCode]) {
        delete this._scannedCodes[this._currentVisibleCode]
      }
      this._currentVisibleCode = null
    }, 800)
    
    if (this._scannedCodes[result]) {
      return
    }
    
    console.log('✅ 扫码成功:', result)
    this._scannedCodes[result] = true
    this.handleScanResult(result)
  },

  onCameraError(e) {
    console.error('相机错误:', e.detail)
    wx.showModal({
      title: '相机错误',
      content: '无法访问相机，请检查权限设置',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting()
        }
      }
    })
  },

  // 处理扫码结果
  handleScanResult(code) {
    if (!code) return
    
    wx.vibrateShort({ type: 'medium' })
    
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    
    this.setData({
      lastCode: code,
      lastScanTime: timeStr,
      scanCount: this.data.scanCount + 1,
      sendSuccess: false
    })
    
    // 创建历史记录条目（先加入，稍后更新商品信息）
    const historyItem = {
      id: ++this._historyIdCounter,
      code: code,
      time: timeStr,
      name: null,
      price: null,
      success: null  // 待定
    }
    
    // 发送扫码事件
    const sent = this.sendScanEvent(code)
    
    if (sent) {
      this.setData({ sendSuccess: true })
      
      // 同时查询商品信息
      this.fetchProductInfo(code, historyItem)
      
      wx.showToast({
        title: '已发送',
        icon: 'success',
        duration: 800
      })
    } else {
      historyItem.success = false
      this.addToHistory(historyItem)
      
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      })
    }
  },

  // 查询商品信息
  fetchProductInfo(code, historyItem) {
    const serverUrl = app.globalData.serverUrl
    
    if (!serverUrl) {
      historyItem.success = true
      historyItem.name = null  // 无法获取商品信息
      this.addToHistory(historyItem)
      return
    }
    
    wx.request({
      url: `http://${serverUrl}/products/by_barcode`,
      method: 'GET',
      data: { code: code },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          historyItem.success = true
          historyItem.name = res.data.name
          historyItem.price = res.data.price
          console.log('✅ 获取商品信息:', res.data.name)
        } else {
          historyItem.success = false
          historyItem.name = '未找到商品'
        }
        this.addToHistory(historyItem)
      },
      fail: (error) => {
        console.error('获取商品信息失败:', error)
        historyItem.success = true  // 发送成功，只是获取信息失败
        this.addToHistory(historyItem)
      }
    })
  },

  // 添加到历史记录
  addToHistory(item) {
    const history = [item, ...this.data.scanHistory]
    // 最多保留 20 条
    if (history.length > 20) {
      history.pop()
    }
    this.setData({ scanHistory: history })
  },

  // 清空历史
  clearHistory() {
    this.setData({ scanHistory: [] })
  },

  // 发送扫码事件
  sendScanEvent(code) {
    const socketTask = app.globalData.socketTask
    const deviceId = app.globalData.deviceId
    
    if (!socketTask || !app.globalData.wsConnected) {
      console.error('❌ WebSocket 未连接')
      this.setData({ wsConnected: false })
      return false
    }
    
    const message = {
      type: 'SCAN_BARCODE',
      code: code,
      device_id: deviceId,
      source: 'miniapp',
      ts: Date.now()
    }
    
    console.log('📤 发送消息:', message)
    
    socketTask.send({
      data: JSON.stringify(message),
      success: () => {
        console.log('✅ 扫码事件已发送')
      },
      fail: (error) => {
        console.error('❌ 发送失败:', error)
      }
    })
    
    return true
  },

  toggleFlash() {
    this.setData({
      flashMode: this.data.flashMode === 'off' ? 'on' : 'off'
    })
  },

  manualScan() {
    if (!app.globalData.wsConnected) {
      wx.showToast({
        title: '请先连接服务器',
        icon: 'none'
      })
      return
    }
    
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        console.log('✅ 系统扫码成功:', res.result)
        this.handleScanResult(res.result)
      },
      fail: (error) => {
        if (!error.errMsg.includes('cancel')) {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          })
        }
      }
    })
  },

  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 切换到AI识别
  switchToVision() {
    wx.redirectTo({
      url: '/pages/vision/vision'
    })
  }
})
