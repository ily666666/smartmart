// pages/index/index.js - 收银台页面
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    serverConnected: false,
    serverUrl: '',
    // 搜索
    searchQuery: '',
    searching: false,
    // 持续扫码模式
    scanMode: false,       // 是否处于持续扫码模式
    cameraReady: false,    // 相机是否就绪
    flashMode: 'off',      // 闪光灯
    // 购物车
    cartItems: [],       // [{id, barcode, name, price, quantity, subtotal}]
    totalAmount: 0,
    totalItems: 0,
    // 结账
    checkingOut: false,
    // 最后添加的商品（用于提示）
    lastAddedItem: null
  },

  // 持续扫码：防重复
  _scannedCodes: {},
  _currentVisibleCode: null,
  _visibleCodeTimer: null,

  onLoad() {
    console.log('收银台页面加载')
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }

    // 更新连接状态
    this.setData({
      serverConnected: app.globalData.wsConnected,
      serverUrl: app.globalData.serverUrl
    })

    // 如果有服务器地址，检查连接
    if (app.globalData.serverUrl) {
      app.checkServerHealth().then((connected) => {
        this.setData({ serverConnected: connected })
      })
    }
  },

  onHide() {
    // 页面隐藏时关闭持续扫码
    if (this.data.scanMode) {
      this.setData({ scanMode: false, cameraReady: false, flashMode: 'off' })
    }
    this._clearScanState()
  },

  // 清除扫码状态
  _clearScanState() {
    if (this._visibleCodeTimer) {
      clearTimeout(this._visibleCodeTimer)
      this._visibleCodeTimer = null
    }
    this._scannedCodes = {}
    this._currentVisibleCode = null
  },

  // ========== 搜索/扫码 ==========

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value })
  },

  // 确认搜索（键盘回车）
  doSearch() {
    const query = this.data.searchQuery.trim()
    if (!query) return
    this.lookupProduct(query)
  },

  // 单次扫码（调用系统相机）
  scanBarcode() {
    if (!this.checkConnection()) return

    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        const code = res.result
        console.log('扫码结果:', code)
        this.setData({ searchQuery: code })
        this.lookupProduct(code)
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '扫码失败', icon: 'none' })
        }
      }
    })
  },

  // ========== 持续扫码模式 ==========

  // 开启/关闭持续扫码
  toggleScanMode() {
    if (!this.checkConnection()) return

    const newMode = !this.data.scanMode
    if (newMode) {
      // 开启持续扫码
      this._clearScanState()
      this.setData({ scanMode: true })
      // 延迟初始化相机
      setTimeout(() => {
        this.setData({ cameraReady: true })
      }, 300)
    } else {
      // 关闭持续扫码
      this.setData({ scanMode: false, cameraReady: false, flashMode: 'off' })
      this._clearScanState()
    }
  },

  // 相机持续扫码回调
  onScanCode(e) {
    const { result } = e.detail
    if (!result) return

    // 防重复逻辑（和采集扫码一样）
    this._currentVisibleCode = result

    if (this._visibleCodeTimer) {
      clearTimeout(this._visibleCodeTimer)
    }

    // 条码离开画面 800ms 后解锁，允许再次扫同一个
    this._visibleCodeTimer = setTimeout(() => {
      if (this._currentVisibleCode && this._scannedCodes[this._currentVisibleCode]) {
        delete this._scannedCodes[this._currentVisibleCode]
      }
      this._currentVisibleCode = null
    }, 800)

    // 同一条码在画面中时不重复处理
    if (this._scannedCodes[result]) {
      return
    }

    console.log('✅ 持续扫码:', result)
    this._scannedCodes[result] = true

    // 震动反馈
    wx.vibrateShort({ type: 'medium' })

    // 自动查找商品并加入购物车
    this.setData({ searchQuery: result })
    this.lookupProduct(result)
  },

  // 相机错误
  onCameraError(e) {
    console.error('相机错误:', e.detail)
    wx.showModal({
      title: '相机错误',
      content: '无法访问相机，请检查权限设置或使用单次扫码',
      confirmText: '去设置',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting()
        } else {
          this.setData({ scanMode: false, cameraReady: false })
        }
      }
    })
  },

  // 切换闪光灯
  toggleFlash() {
    this.setData({
      flashMode: this.data.flashMode === 'off' ? 'on' : 'off'
    })
  },

  // 查找商品（通过条码或名称）
  lookupProduct(query) {
    if (!this.checkConnection()) return
    if (this.data.searching) return

    this.setData({ searching: true })

    const apiUrl = getApiUrl(app.globalData.serverUrl)

    app.request({
      url: `${apiUrl}/products/search?q=${encodeURIComponent(query)}`,
      method: 'GET',
      timeout: 5000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.products) {
          const products = res.data.products
          if (products.length === 0) {
            wx.showToast({ title: '未找到商品', icon: 'none' })
          } else if (res.data.type === 'exact') {
            // 条码精确匹配，直接加入购物车
            this.addToCart(products[0])
            this.setData({ searchQuery: '' })
          } else {
            // 名称搜索，不管几个结果都让用户确认选择
            this.showProductPicker(products)
          }
        } else {
          wx.showToast({ title: '未找到商品', icon: 'none' })
        }
      },
      fail: (error) => {
        console.error('查找商品失败:', error)
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: () => {
        this.setData({ searching: false })
      }
    })
  },

  // 多个搜索结果时，弹出选择
  showProductPicker(products) {
    const names = products.map(p => `${p.name} (¥${p.price})`)
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        this.addToCart(products[res.tapIndex])
        this.setData({ searchQuery: '' })
      }
    })
  },

  // ========== 购物车管理 ==========

  // 添加商品到购物车
  addToCart(product) {
    const cartItems = [...this.data.cartItems]
    const existIndex = cartItems.findIndex(item => item.id === product.sku_id)

    if (existIndex >= 0) {
      // 已存在，增加数量
      cartItems[existIndex].quantity += 1
      cartItems[existIndex].subtotal = parseFloat((cartItems[existIndex].price * cartItems[existIndex].quantity).toFixed(2))
    } else {
      // 新商品
      cartItems.unshift({
        id: product.sku_id,
        barcode: product.barcode,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price
      })
    }

    this.updateCart(cartItems)

    // 震动反馈
    wx.vibrateShort({ type: 'medium' })

    // 简短提示
    this.setData({ lastAddedItem: product.name })
    setTimeout(() => {
      this.setData({ lastAddedItem: null })
    }, 1500)
  },

  // 增加数量
  increaseQty(e) {
    const index = e.currentTarget.dataset.index
    const cartItems = [...this.data.cartItems]
    cartItems[index].quantity += 1
    cartItems[index].subtotal = parseFloat((cartItems[index].price * cartItems[index].quantity).toFixed(2))
    this.updateCart(cartItems)
  },

  // 减少数量
  decreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const cartItems = [...this.data.cartItems]

    if (cartItems[index].quantity <= 1) {
      // 数量为1时再减就删除
      this.removeItem(e)
      return
    }

    cartItems[index].quantity -= 1
    cartItems[index].subtotal = parseFloat((cartItems[index].price * cartItems[index].quantity).toFixed(2))
    this.updateCart(cartItems)
  },

  // 删除商品
  removeItem(e) {
    const index = e.currentTarget.dataset.index
    const cartItems = [...this.data.cartItems]
    const itemName = cartItems[index].name
    cartItems.splice(index, 1)
    this.updateCart(cartItems)
    wx.showToast({ title: `已移除 ${itemName}`, icon: 'none', duration: 1000 })
  },

  // 清空购物车
  clearCart() {
    if (this.data.cartItems.length === 0) return

    wx.showModal({
      title: '清空购物车',
      content: '确定要清空所有商品吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          this.updateCart([])
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  },

  // 更新购物车状态
  updateCart(cartItems) {
    const totalAmount = parseFloat(cartItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

    this.setData({
      cartItems,
      totalAmount,
      totalItems
    })
  },

  // ========== 结账 ==========

  checkout() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    if (!this.checkConnection()) return
    if (this.data.checkingOut) return

    // 确认结账
    wx.showModal({
      title: '确认结账',
      content: `共 ${this.data.totalItems} 件商品，合计 ¥${this.data.totalAmount}`,
      confirmText: '确认',
      confirmColor: '#10b981',
      success: (res) => {
        if (res.confirm) {
          this.doCheckout()
        }
      }
    })
  },

  // 执行结账
  async doCheckout() {
    this.setData({ checkingOut: true })
    wx.showLoading({ title: '结账中...' })

    const apiUrl = getApiUrl(app.globalData.serverUrl)

    const orderData = {
      items: this.data.cartItems.map(item => ({
        product_id: item.id,
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total_amount: this.data.totalAmount,
      cashier: '小程序收银'
    }

    try {
      const res = await new Promise((resolve, reject) => {
        app.request({
          url: `${apiUrl}/orders/create`,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: orderData,
          timeout: 10000,
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()

      if (res.statusCode === 200 && res.data) {
        // 结账成功
        const orderNo = res.data.order_no || ''
        this.updateCart([])
        this.setData({ searchQuery: '' })

        wx.showModal({
          title: '结账成功',
          content: `订单号: ${orderNo}\n金额: ¥${this.data.totalAmount || res.data.total_amount}`,
          showCancel: false,
          confirmText: '好的'
        })
      } else {
        wx.showToast({
          title: res.data?.detail || '结账失败',
          icon: 'none',
          duration: 2000
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('结账失败:', error)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      this.setData({ checkingOut: false })
    }
  },

  // ========== 工具方法 ==========

  // 检查连接
  checkConnection() {
    if (!app.globalData.serverUrl) {
      wx.showModal({
        title: '未配置服务器',
        content: '请先在设置页面配置服务器地址',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/settings/settings' })
          }
        }
      })
      return false
    }
    if (!app.globalData.wsConnected) {
      // 尝试重新连接
      wx.showToast({ title: '正在连接服务器...', icon: 'loading' })
      app.checkServerHealth().then((connected) => {
        this.setData({ serverConnected: connected })
        if (!connected) {
          wx.showModal({
            title: '连接失败',
            content: '无法连接到服务器，请检查网络或服务器地址',
            confirmText: '去设置',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                wx.switchTab({ url: '/pages/settings/settings' })
              }
            }
          })
        }
      })
      return false
    }
    return true
  }
})
