// pages/collect/collect.js
const app = getApp()

Page({
  data: {
    wsConnected: false,
    features: [
      {
        id: 'scan',
        icon: '📷',
        title: '扫码录入',
        desc: '扫描商品条码',
        url: '/pages/scan/scan',
        isTab: true
      },
      {
        id: 'vision',
        icon: '🧠',
        title: 'AI 识别',
        desc: '拍照识别商品',
        url: '/pages/vision/vision',
        isTab: false
      },
      {
        id: 'samples',
        icon: '🎓',
        title: 'AI 样本',
        desc: '管理识别样本',
        url: '/pages/samples/samples',
        isTab: false
      }
    ]
  },

  onLoad() {
    // 
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    
    // 更新连接状态
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
  },

  // 导航到功能页面
  navigateTo(e) {
    const { url, isTab } = e.currentTarget.dataset
    
    // 检查连接状态
    if (!app.globalData.wsConnected) {
      wx.showModal({
        title: '未连接',
        content: '请先在首页连接服务器',
        confirmText: '去连接',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }
      })
      return
    }
    
    if (isTab) {
      // 不再是 tab 页面，使用 navigateTo
      wx.navigateTo({ url })
    } else {
      wx.navigateTo({ url })
    }
  },

  // 快速扫码（直接调用扫码）
  quickScan() {
    if (!app.globalData.wsConnected) {
      wx.showModal({
        title: '未连接',
        content: '请先在首页连接服务器',
        confirmText: '去连接',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }
      })
      return
    }
    
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        console.log('扫码结果:', res.result)
        this.sendBarcode(res.result)
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 发送条码到服务器
  sendBarcode(code) {
    const socketTask = app.globalData.socketTask
    if (!socketTask || !app.globalData.wsConnected) {
      wx.showToast({
        title: '连接已断开',
        icon: 'none'
      })
      return
    }
    
    socketTask.send({
      data: JSON.stringify({
        type: 'SCAN',
        code: code,
        device_id: app.globalData.deviceId,
        ts: Date.now()
      }),
      success: () => {
        wx.showToast({
          title: '已发送',
          icon: 'success'
        })
      }
    })
  }
})
