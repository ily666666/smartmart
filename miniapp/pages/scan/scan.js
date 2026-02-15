// pages/scan/scan.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    desktopConnected: false,  // 桌面端 WebSocket 是否连接
    serverConfigured: false,  // 服务器是否已配置（不要求桌面端在线）
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
      desktopConnected: !!app.globalData.socketTask,
      serverConfigured: !!app.globalData.serverUrl
    })
    
    // 检查隐私授权后再初始化相机
    this.checkPrivacyAndInitCamera()
  },
  
  // 检查隐私授权
  checkPrivacyAndInitCamera() {
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: (res) => {
          console.log('隐私授权状态:', res)
          if (res.needAuthorization) {
            // 需要授权，主动弹出隐私协议
            wx.requirePrivacyAuthorize({
              success: () => {
                console.log('✅ 用户同意隐私协议')
                this.initCamera()
              },
              fail: (err) => {
                console.error('❌ 用户拒绝隐私协议:', err)
                wx.showModal({
                  title: '需要同意隐私协议',
                  content: '使用相机扫码功能需要同意隐私协议，您可以点击"系统扫码"继续使用',
                  showCancel: false
                })
              }
            })
          } else {
            // 已授权，直接初始化相机
            this.initCamera()
          }
        },
        fail: () => {
          // 获取失败，尝试直接初始化
          this.initCamera()
        }
      })
    } else {
      // 低版本基础库，直接初始化
      this.initCamera()
    }
  },
  
  // 初始化相机
  initCamera() {
    setTimeout(() => {
      this.setData({ cameraReady: true })
    }, 300)
  },

  onShow() {
    // scan 页面不再是 Tab 页面，从采集中心进入
    this.setData({
      desktopConnected: !!app.globalData.socketTask,
      serverConfigured: !!app.globalData.serverUrl
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
    
    // 创建历史记录条目
    const historyItem = {
      id: ++this._historyIdCounter,
      code: code,
      time: timeStr,
      name: null,
      price: null,
      success: null
    }
    
    // 尝试发送到桌面端（可选，不影响主流程）
    const sent = this.sendScanEvent(code)
    
    if (sent) {
      this.setData({ sendSuccess: true })
      wx.showToast({
        title: '已发送到桌面端',
        icon: 'success',
        duration: 800
      })
    } else {
      console.log('⚠️ 桌面端未连接，跳过同步')
      wx.showToast({
        title: '已扫码（桌面端未连接）',
        icon: 'none',
        duration: 2000
      })
    }
    
    // 不管桌面端有没有连，都查询商品信息
    this.fetchProductInfo(code, historyItem)
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
    
    const apiUrl = getApiUrl(serverUrl)
    app.request({
      url: `${apiUrl}/products/by_barcode`,
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
    
    if (!socketTask) {
      console.log('⚠️ 桌面端 WebSocket 未连接，跳过发送')
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
    if (!app.globalData.serverUrl) {
      wx.showToast({
        title: '请先配置服务器',
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

  goSettings() {
    wx.switchTab({
      url: '/pages/settings/settings'
    })
  },

  // 切换到AI识别
  switchToVision() {
    wx.redirectTo({
      url: '/pages/vision/vision'
    })
  }
})
