// pages/product-detail/product-detail.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    mode: 'view', // view, edit, add
    productId: null,
    product: {
      barcode: '',
      name: '',
      category: '其他',
      price: '',
      cost_price: '',
      stock: '',
      image_url: ''
    },
    categories: [],
    loading: false,
    saving: false,
    imageBase64: '' // 用于 显示图片
  },

  onLoad(options) {
    if (options.mode === 'add') {
      this.setData({ 
        mode: 'add',
        'product.barcode': options.barcode || ''
      })
      wx.setNavigationBarTitle({ title: '添加商品' })
    } else if (options.id) {
      this.setData({ productId: options.id })
      this.loadProduct(options.id)
    }
    
    this.loadCategories()
  },

  // 下拉刷新
  async onPullDownRefresh() {
    const { mode, productId } = this.data
    
    // 只有查看模式且有商品ID时才刷新
    if (mode === 'view' && productId) {
      await this.loadProduct(productId)
    }
    await this.loadCategories()
    
    wx.stopPullDownRefresh()
  },

  // 加载商品详情
  async loadProduct(id) {
    this.setData({ loading: true })
    
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/products/${id}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const item = res.data
        // 处理图片URL：相对路径转完整URL
        let imageUrl = item.image_url || ''
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `${apiUrl}${imageUrl}`
        }
        this.setData({
          product: {
            barcode: item.barcode,
            name: item.name,
            category: item.category || '其他',
            price: item.price.toString(),
            cost_price: item.cost_price ? item.cost_price.toString() : '',
            stock: item.stock.toString(),
            image_url: imageUrl
          },
          loading: false,
          imageBase64: '' // 重置 base64
        })
        
        // 加载图片的 base64（ 显示图片）
        if (imageUrl) {
          this.loadImageBase64(imageUrl)
        }
      }
    } catch (error) {
      console.error('加载商品失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
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

  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`product.${field}`]: e.detail.value
    })
  },

  // 分类选择
  onCategoryChange(e) {
    const index = e.detail.value
    this.setData({
      'product.category': this.data.categories[index]
    })
  },

  // 扫码获取条码
  scanBarcode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode'],
      success: (res) => {
        this.setData({
          'product.barcode': res.result
        })
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '扫码失败', icon: 'none' })
        }
      }
    })
  },

  // 进入编辑模式
  enterEditMode() {
    this.setData({ mode: 'edit' })
    wx.setNavigationBarTitle({ title: '编辑商品' })
  },

  // 取消编辑
  cancelEdit() {
    if (this.data.mode === 'add') {
      wx.navigateBack()
    } else {
      this.setData({ mode: 'view' })
      wx.setNavigationBarTitle({ title: '商品详情' })
      // 重新加载商品信息
      this.loadProduct(this.data.productId)
    }
  },

  // 保存商品
  async saveProduct() {
    const { product, mode, productId } = this.data
    
    // 验证
    if (!product.barcode.trim()) {
      wx.showToast({ title: '请输入条码', icon: 'none' })
      return
    }
    if (!product.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!product.price || parseFloat(product.price) <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' })
      return
    }
    
    this.setData({ saving: true })
    
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      
      if (mode === 'add') {
        // 创建商品 - 手动构建 URL 编码参数（小程序不支持 URLSearchParams）
        const formData = {
          barcode: product.barcode,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock || '0'
        }
        if (product.cost_price) {
          formData.cost_price = product.cost_price
        }
        
        // 将对象转为 URL 编码字符串
        const params = Object.keys(formData)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(formData[key])}`)
          .join('&')
        
        const res = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiUrl}/products/`,
            method: 'POST',
            header: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: params,
            success: resolve,
            fail: reject
          })
        })
        
        if (res.statusCode === 200) {
          wx.showToast({ title: '添加成功', icon: 'success' })
          wx.navigateBack()
          return
        } else {
          throw new Error(res.data?.detail || '添加失败')
        }
      } else {
        // 更新商品
        const formData = {
          barcode: product.barcode,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock || '0'
        }
        if (product.cost_price) {
          formData.cost_price = product.cost_price
        }
        
        const res = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiUrl}/products/${productId}`,
            method: 'PUT',
            header: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: formData,
            success: resolve,
            fail: reject
          })
        })
        
        if (res.statusCode === 200) {
          wx.showToast({ title: '保存成功', icon: 'success' })
          this.setData({ mode: 'view' })
          wx.setNavigationBarTitle({ title: '商品详情' })
        } else {
          throw new Error(res.data?.detail || '保存失败')
        }
      }
    } catch (error) {
      console.error('保存失败:', error)
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 加载图片的 base64（ 显示图片）
  async loadImageBase64(imageUrl) {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: imageUrl,
          responseType: 'arraybuffer',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const base64 = wx.arrayBufferToBase64(res.data)
        const isPng = imageUrl.toLowerCase().includes('.png')
        const mimeType = isPng ? 'image/png' : 'image/jpeg'
        this.setData({
          imageBase64: `data:${mimeType};base64,${base64}`
        })
      }
    } catch (err) {
      console.error('加载图片 base64 失败:', err)
    }
  },

  // 删除商品
  deleteProduct() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除商品"${this.data.product.name}"吗？此操作不可恢复！`,
      confirmColor: '#dc2626',
      success: async (res) => {
        if (res.confirm) {
          try {
            const apiUrl = getApiUrl(app.globalData.serverUrl)
            const response = await new Promise((resolve, reject) => {
              wx.request({
                url: `${apiUrl}/products/${this.data.productId}`,
                method: 'DELETE',
                success: resolve,
                fail: reject
              })
            })
            
            if (response.statusCode === 200) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              wx.navigateBack()
            } else {
              throw new Error('删除失败')
            }
          } catch (error) {
            console.error('删除失败:', error)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
