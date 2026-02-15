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
    // 购物车
    cartItems: [],       // [{id, barcode, name, price, quantity, subtotal}]
    totalAmount: 0,
    totalItems: 0,
    // 结账
    checkingOut: false,
    // 最后添加的商品（用于提示）
    lastAddedItem: null
  },

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

  // 扫码
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
          } else if (products.length === 1 || res.data.type === 'exact') {
            // 精确匹配或只有一个结果，直接加入购物车
            this.addToCart(products[0])
            this.setData({ searchQuery: '' })
          } else {
            // 多个结果，让用户选择
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
