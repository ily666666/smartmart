// pages/settings/settings.js - 设置页面
import { getApiUrl, getWsUrl, isValidServerUrl } from '../../config'

const app = getApp()

Page({
  data: {
    // 服务器配置
    serverUrl: '',
    inputServerUrl: '',
    serverConnected: false,
    testing: false,
    // 连接密码
    apiKey: '',
    inputApiKey: '',
    authRequired: false, // 服务器是否要求密码

    // 桌面端同步（可选）
    wsConnected: false,
    wsConnecting: false,

    // 设备信息
    deviceId: '',

    // 其他
    version: '1.1.0'
  },

  onLoad() {
    const apiKey = wx.getStorageSync('apiKey') || ''
    this.setData({
      serverUrl: app.globalData.serverUrl,
      inputServerUrl: app.globalData.serverUrl,
      serverConnected: app.globalData.wsConnected,
      deviceId: app.globalData.deviceId,
      apiKey: apiKey,
      inputApiKey: apiKey
    })
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }

    // 更新状态
    this.setData({
      serverUrl: app.globalData.serverUrl,
      serverConnected: app.globalData.wsConnected,
      wsConnected: !!app.globalData.socketTask
    })
  },

  // ========== 服务器配置 ==========

  // 输入服务器地址
  onServerUrlInput(e) {
    this.setData({ inputServerUrl: e.detail.value })
  },

  // 输入连接密码
  onApiKeyInput(e) {
    this.setData({ inputApiKey: e.detail.value })
  },

  // 测试连接
  async testConnection() {
    const url = this.data.inputServerUrl.trim()

    if (!url) {
      wx.showToast({ title: '请输入服务器地址', icon: 'none' })
      return
    }

    if (!isValidServerUrl(url)) {
      wx.showToast({
        title: '地址格式不正确\n示例: example.oicp.net:12345',
        icon: 'none',
        duration: 3000
      })
      return
    }

    this.setData({ testing: true })

    const apiUrl = getApiUrl(url)

    try {
      // 第1步：检查服务器是否可达（health 不需要密码）
      const healthRes = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/health`,
          method: 'GET',
          timeout: 5000,
          success: resolve,
          fail: reject
        })
      })

      if (healthRes.statusCode !== 200 || !healthRes.data || healthRes.data.status !== 'ok') {
        this.setData({ serverConnected: false })
        wx.showToast({ title: '服务器响应异常', icon: 'none' })
        return
      }

      const authRequired = healthRes.data.auth_required || false
      this.setData({ authRequired })

      // 第2步：如果需要密码，用任意一个受保护的接口验证
      if (authRequired) {
        const apiKey = this.data.inputApiKey.trim()
        if (!apiKey) {
          this.setData({ serverConnected: false })
          wx.showToast({ title: '该服务器需要连接密码', icon: 'none', duration: 2000 })
          return
        }

        // 带密码请求一个接口，看是否返回 401
        const verifyRes = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiUrl}/products/?skip=0&limit=1`,
            method: 'GET',
            header: { 'X-API-Key': apiKey },
            timeout: 5000,
            success: resolve,
            fail: reject
          })
        })

        if (verifyRes.statusCode === 401) {
          this.setData({ serverConnected: false })
          wx.showToast({ title: '连接密码错误', icon: 'none', duration: 2000 })
          return
        }

        this.setData({ serverConnected: true })
        wx.showToast({ title: '连接成功，密码正确', icon: 'success' })
        return
      }

      // 不需要密码，直接成功
      this.setData({ serverConnected: true })
      wx.showToast({ title: '连接成功', icon: 'success' })
    } catch (error) {
      console.error('测试连接失败:', error)
      this.setData({ serverConnected: false })
      wx.showToast({ title: '连接失败，请检查地址', icon: 'none', duration: 2000 })
    } finally {
      this.setData({ testing: false })
    }
  },

  // 保存服务器配置（地址 + 密码）
  saveServerUrl() {
    const url = this.data.inputServerUrl.trim()
    const apiKey = this.data.inputApiKey.trim()

    if (!url) {
      wx.showToast({ title: '请输入服务器地址', icon: 'none' })
      return
    }

    if (!isValidServerUrl(url)) {
      wx.showToast({ title: '地址格式不正确', icon: 'none' })
      return
    }

    // 保存到本地存储和全局
    wx.setStorageSync('serverUrl', url)
    wx.setStorageSync('apiKey', apiKey)
    app.globalData.serverUrl = url
    app.globalData.apiKey = apiKey

    this.setData({ serverUrl: url, apiKey: apiKey })

    // 自动测试连接
    this.testConnection().then(() => {
      // 更新全局连接状态
      app.globalData.wsConnected = this.data.serverConnected
    })

    wx.showToast({ title: '已保存', icon: 'success' })
  },

  // 清除服务器配置
  clearServerConfig() {
    wx.showModal({
      title: '清除服务器配置',
      content: '清除后需要重新配置服务器地址和密码',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          // 断开 WebSocket
          if (app.globalData.socketTask) {
            app.globalData.socketTask.close()
            app.globalData.socketTask = null
          }

          // 清除存储
          wx.removeStorageSync('serverUrl')
          wx.removeStorageSync('apiKey')
          wx.removeStorageSync('pairingToken')

          // 重置全局状态
          app.globalData.serverUrl = ''
          app.globalData.apiKey = ''
          app.globalData.wsConnected = false
          app.globalData.pairingToken = ''

          this.setData({
            serverUrl: '',
            inputServerUrl: '',
            apiKey: '',
            inputApiKey: '',
            serverConnected: false,
            wsConnected: false,
            authRequired: false
          })

          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // ========== 桌面端同步（可选）==========

  // 扫码配对桌面端
  scanToPairDesktop() {
    if (!this.data.serverUrl) {
      wx.showToast({ title: '请先配置服务器地址', icon: 'none' })
      return
    }

    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        console.log('扫码结果:', res.result)
        this.parseAndConnectWS(res.result)
      },
      fail: (error) => {
        if (!error.errMsg.includes('cancel')) {
          wx.showToast({ title: '扫码失败', icon: 'none' })
        }
      }
    })
  },

  // 解析二维码并连接 WebSocket
  parseAndConnectWS(content) {
    let pairingToken = ''

    try {
      const data = JSON.parse(content)
      if (data.type === 'smartmart_pairing' && data.token) {
        pairingToken = data.token
      }
    } catch (e) {
      // 非 JSON 格式，忽略
    }

    if (pairingToken) {
      wx.setStorageSync('pairingToken', pairingToken)
      app.globalData.pairingToken = pairingToken
    }

    this.connectWebSocket()
  },

  // 连接 WebSocket（桌面端同步）
  connectWebSocket() {
    if (this.data.wsConnecting) return

    const serverUrl = this.data.serverUrl
    if (!serverUrl) return

    this.setData({ wsConnecting: true })

    const wsUrl = getWsUrl(serverUrl)
    console.log('WebSocket 连接:', wsUrl)

    const socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => console.log('WS 连接请求已发送'),
      fail: (error) => {
        console.error('WS 连接失败:', error)
        this.setData({ wsConnecting: false })
        wx.showToast({ title: '桌面端连接失败', icon: 'none' })
      }
    })

    // 3秒超时
    const timeout = setTimeout(() => {
      if (this.data.wsConnecting) {
        this.setData({ wsConnecting: false })
        if (socketTask) socketTask.close()
      }
    }, 3000)

    socketTask.onOpen(() => {
      clearTimeout(timeout)
      console.log('✅ WebSocket 已连接')
      this.setData({ wsConnected: true, wsConnecting: false })
      app.globalData.socketTask = socketTask

      // 发送注册消息
      const pairingToken = wx.getStorageSync('pairingToken') || ''
      socketTask.send({
        data: JSON.stringify({
          type: 'REGISTER',
          device_id: app.globalData.deviceId,
          device_type: 'miniapp',
          token: pairingToken,
          ts: Date.now()
        })
      })

      wx.showToast({ title: '桌面端已连接', icon: 'success' })
    })

    socketTask.onClose(() => {
      clearTimeout(timeout)
      this.setData({ wsConnected: false, wsConnecting: false })
      app.globalData.socketTask = null
    })

    socketTask.onError(() => {
      clearTimeout(timeout)
      this.setData({ wsConnected: false, wsConnecting: false })
      app.globalData.socketTask = null
    })
  },

  // 断开桌面端同步
  disconnectWS() {
    if (app.globalData.socketTask) {
      app.globalData.socketTask.close()
      app.globalData.socketTask = null
    }
    this.setData({ wsConnected: false })
    wx.showToast({ title: '已断开', icon: 'success' })
  },

  // ========== 其他 ==========

  // 复制设备ID
  copyDeviceId() {
    wx.setClipboardData({
      data: this.data.deviceId,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  // 前往数据中心
  goToData() {
    wx.navigateTo({ url: '/pages/data/data' })
  },

  // 前往报表
  goToReports() {
    wx.navigateTo({ url: '/pages/reports/reports' })
  },

  // 前往分析
  goToAnalysis() {
    wx.navigateTo({ url: '/pages/analysis/analysis' })
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '仅清除小程序缓存，不影响服务器数据',
      success: (res) => {
        if (res.confirm) {
          // 保留关键配置
          const serverUrl = wx.getStorageSync('serverUrl')
          const deviceId = wx.getStorageSync('deviceId')
          const apiKey = wx.getStorageSync('apiKey')

          wx.clearStorageSync()

          // 恢复关键配置
          if (serverUrl) wx.setStorageSync('serverUrl', serverUrl)
          if (deviceId) wx.setStorageSync('deviceId', deviceId)
          if (apiKey) wx.setStorageSync('apiKey', apiKey)

          wx.showToast({ title: '缓存已清除', icon: 'success' })
        }
      }
    })
  }
})
