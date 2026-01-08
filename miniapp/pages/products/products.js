// pages/products/products.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    wsConnected: false,
    products: [],
    categories: [],
    selectedCategory: '',
    searchQuery: '',
    loading: false,
    // 分页
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    hasMore: true,
    // API 地址
    apiUrl: ''
  },

  onLoad() {
    //
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    
    // 更新连接状态和 API 地址
    const apiUrl = getApiUrl(app.globalData.serverUrl)
    this.setData({
      wsConnected: app.globalData.wsConnected,
      apiUrl
    })
    
    // 加载数据
    if (app.globalData.wsConnected) {
      this.loadCategories()
      this.loadProducts(true)
    }
  },

  onPullDownRefresh() {
    if (app.globalData.wsConnected) {
      this.loadProducts(true).then(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadProducts(false)
    }
  },

  // 加载分类列表
  async loadCategories() {
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/products/categories`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({
          categories: res.data.categories || []
        })
      }
    } catch (error) {
      console.error('加载分类失败:', error)
    }
  },

  // 加载商品列表
  async loadProducts(refresh = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    const page = refresh ? 1 : this.data.currentPage
    const { pageSize, selectedCategory, searchQuery } = this.data
    
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      
      let url
      if (searchQuery) {
        // 搜索模式
        url = `${apiUrl}/products/search?q=${encodeURIComponent(searchQuery)}`
      } else {
        // 列表模式
        const skip = (page - 1) * pageSize
        url = `${apiUrl}/products/?skip=${skip}&limit=${pageSize}`
        if (selectedCategory) {
          url += `&category=${encodeURIComponent(selectedCategory)}`
        }
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const data = res.data
        const newProducts = (data.products || []).map(item => ({
          id: item.sku_id,
          barcode: item.barcode,
          name: item.name,
          category: item.category || '其他',
          price: item.price,
          cost_price: item.cost_price,
          stock: item.stock,
          image_url: item.image_url ? (item.image_url.startsWith('http') ? item.image_url : `${apiUrl}${item.image_url}`) : '',
          imageBase64: '' // 用于存储 base64 图片
        }))
        
        const allProducts = refresh ? newProducts : [...this.data.products, ...newProducts]
        
        this.setData({
          products: allProducts,
          totalCount: data.total || newProducts.length,
          currentPage: page + 1,
          hasMore: !searchQuery && newProducts.length === pageSize,
          loading: false
        })
        
        // 加载图片的 base64（ 显示图片）
        this.loadProductImagesBase64(newProducts)
      }
    } catch (error) {
      console.error('加载商品失败:', error)
      this.setData({ loading: false })
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value })
  },

  // 执行搜索
  doSearch() {
    this.loadProducts(true)
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchQuery: '' })
    this.loadProducts(true)
  },

  // 选择分类
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ 
      selectedCategory: category === this.data.selectedCategory ? '' : category,
      searchQuery: ''
    })
    this.loadProducts(true)
  },

  // 查看商品详情
  viewProduct(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${id}`
    })
  },

  // 添加商品
  addProduct() {
    if (!this.checkConnection()) return
    wx.navigateTo({
      url: '/pages/product-detail/product-detail?mode=add'
    })
  },

  // 扫码查找/添加
  scanProduct() {
    if (!this.checkConnection()) return
    
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        const barcode = res.result
        // 设置搜索并执行
        this.setData({ searchQuery: barcode })
        this.loadProducts(true)
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '扫码失败', icon: 'none' })
        }
      }
    })
  },

  // 检查连接
  checkConnection() {
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
      return false
    }
    return true
  },

  // 加载商品图片的 base64（ 显示图片）
  async loadProductImagesBase64(productsToLoad) {
    for (const product of productsToLoad) {
      if (!product.image_url) continue
      
      try {
        const res = await new Promise((resolve, reject) => {
          wx.request({
            url: product.image_url,
            responseType: 'arraybuffer',
            success: resolve,
            fail: reject
          })
        })
        
        if (res.statusCode === 200) {
          const base64 = wx.arrayBufferToBase64(res.data)
          // 根据 URL 判断类型
          const isPng = product.image_url.toLowerCase().includes('.png')
          const mimeType = isPng ? 'image/png' : 'image/jpeg'
          const imageBase64 = `data:${mimeType};base64,${base64}`
          
          // 更新对应商品的 base64
          const products = this.data.products.map(p => {
            if (p.id === product.id) {
              return { ...p, imageBase64 }
            }
            return p
          })
          
          this.setData({ products })
        }
      } catch (err) {
        console.error('加载商品图片失败:', product.id, err)
      }
    }
  }
})
