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
    imageBase64: '', // 用于 显示图片
    tempImagePath: '', // 临时选择的图片路径
    uploadedImageUrl: '', // 上传后的图片URL
    recognizing: false, // OCR 文字识别中
    showOcrPicker: false, // 是否显示 OCR 文字选择弹窗
    ocrItems: [], // OCR 识别结果 [{text, selected, order}]
    ocrPreview: '' // 拼接预览
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
        app.request({
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
        app.request({
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
        const barcode = res.result
        this.setData({
          'product.barcode': barcode
        })
        // 扫码后自动检查条码是否已存在
        this.checkBarcodeExists(barcode)
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '扫码失败', icon: 'none' })
        }
      }
    })
  },

  // 检查条码是否已存在于数据库中
  async checkBarcodeExists(barcode) {
    if (!barcode || !barcode.trim()) return

    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        app.request({
          url: `${apiUrl}/products/by_barcode?code=${encodeURIComponent(barcode)}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200 && res.data) {
        const existProduct = res.data
        // 条码已存在，弹窗提示商品名和售价
        wx.showModal({
          title: '条码已存在',
          content: `该条码对应商品：\n商品名：${existProduct.name}\n售价：¥${existProduct.price}`,
          confirmText: '去查看',
          cancelText: '扫下一个',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 跳转到该商品的详情页
              wx.redirectTo({
                url: `/pages/product-detail/product-detail?id=${existProduct.sku_id}`
              })
            } else {
              // 清空条码，回到添加页面让用户自己操作
              this.setData({ 'product.barcode': '' })
            }
          }
        })
      }
      // 404 说明条码不存在，正常继续添加流程，无需提示
    } catch (error) {
      console.error('检查条码失败:', error)
      // 网络错误时不阻断流程，静默失败
    }
  },

  // 选择图片
  chooseImage() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: sourceType,
          sizeType: ['compressed'],
          success: (result) => {
            const tempFilePath = result.tempFiles[0].tempFilePath
            this.setData({
              tempImagePath: tempFilePath,
              uploadedImageUrl: '' // 清除之前上传的URL
            })
          },
          fail: (err) => {
            if (!err.errMsg.includes('cancel')) {
              wx.showToast({ title: '选择图片失败', icon: 'none' })
            }
          }
        })
      }
    })
  },

  // 移除图片
  removeImage() {
    wx.showModal({
      title: '确认移除',
      content: '确定要移除商品图片吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            tempImagePath: '',
            uploadedImageUrl: '',
            imageBase64: '',
            'product.image_url': ''
          })
        }
      }
    })
  },

  // 手动触发 OCR 文字识别（点击"识别文字"按钮）
  onRecognizeText() {
    if (this.data.recognizing) return
    
    const filePath = this.data.tempImagePath
    if (!filePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    this.recognizeText(filePath)
  },

  // OCR 文字识别：上传图片到后端识别文字，自动填入商品名称
  async recognizeText(filePath) {
    const apiUrl = getApiUrl(app.globalData.serverUrl)
    if (!apiUrl) {
      console.warn('OCR: 服务器地址未配置')
      return
    }
    
    this.setData({ recognizing: true })
    
    try {
      const res = await new Promise((resolve, reject) => {
        app.uploadFile({
          url: `${apiUrl}/products/ocr`,
          filePath: filePath,
          name: 'file',
          success: (res) => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(res.data))
              } catch (e) {
                reject(new Error('解析响应失败'))
              }
            } else if (res.statusCode === 501) {
              // OCR 未安装，静默跳过
              console.warn('OCR 功能未安装')
              resolve(null)
            } else {
              try {
                const errData = JSON.parse(res.data)
                reject(new Error(errData.detail || '识别失败'))
              } catch (e) {
                reject(new Error('识别失败'))
              }
            }
          },
          fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
        })
      })
      
      // OCR 未安装时静默跳过
      if (!res) return
      
      // 提取识别文字，去重
      const textItems = []
      const seen = new Set()
      if (res.texts && res.texts.length > 0) {
        for (const t of res.texts) {
          const text = t.text.trim()
          if (text && !seen.has(text)) {
            seen.add(text)
            textItems.push(text)
          }
        }
      }
      
      if (textItems.length === 0) {
        wx.showToast({ title: '未识别到有效文字', icon: 'none' })
      } else {
        // 打开多选弹窗，让用户选择并组合
        const ocrItems = textItems.map(text => ({ text, selected: false, order: 0 }))
        this.setData({
          showOcrPicker: true,
          ocrItems: ocrItems,
          ocrPreview: ''
        })
      }
    } catch (error) {
      console.error('文字识别失败:', error)
      wx.showToast({ title: error.message || '识别失败', icon: 'none' })
    } finally {
      this.setData({ recognizing: false })
    }
  },

  // 空操作，用于阻止事件冒泡
  noop() {},

  // 切换 OCR 文字选中状态（点击某一项）
  toggleOcrItem(e) {
    const index = e.currentTarget.dataset.index
    const items = this.data.ocrItems
    const item = items[index]
    
    if (item.selected) {
      // 取消选中：清除该项，并重新排序其他已选项
      const removedOrder = item.order
      item.selected = false
      item.order = 0
      for (let i = 0; i < items.length; i++) {
        if (items[i].selected && items[i].order > removedOrder) {
          items[i].order -= 1
        }
      }
    } else {
      // 选中：标记并设置顺序
      const maxOrder = items.reduce((max, it) => it.selected ? Math.max(max, it.order) : max, 0)
      item.selected = true
      item.order = maxOrder + 1
    }
    
    // 按选中顺序拼接预览
    const selectedItems = items.filter(it => it.selected).sort((a, b) => a.order - b.order)
    const preview = selectedItems.map(it => it.text).join('')
    
    this.setData({ ocrItems: items, ocrPreview: preview })
  },

  // 确认 OCR 选择，填入商品名称
  confirmOcrSelection() {
    if (!this.data.ocrPreview) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' })
      return
    }
    this.setData({
      'product.name': this.data.ocrPreview,
      showOcrPicker: false,
      ocrItems: [],
      ocrPreview: ''
    })
    wx.showToast({ title: '已填入商品名称', icon: 'success' })
  },

  // 关闭 OCR 选择弹窗
  closeOcrPicker() {
    this.setData({
      showOcrPicker: false,
      ocrItems: [],
      ocrPreview: ''
    })
  },

  // 上传图片到服务器
  async uploadImage(filePath) {
    const apiUrl = getApiUrl(app.globalData.serverUrl)
    
    return new Promise((resolve, reject) => {
      app.uploadFile({
        url: `${apiUrl}/products/upload_image`,
        filePath: filePath,
        name: 'file',
        success: (res) => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data)
              resolve(data.image_url)
            } catch (e) {
              reject(new Error('解析响应失败'))
            }
          } else {
            try {
              const errData = JSON.parse(res.data)
              reject(new Error(errData.detail || '上传失败'))
            } catch (e) {
              reject(new Error('上传失败'))
            }
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '上传失败'))
        }
      })
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
    const { product, mode, productId, tempImagePath } = this.data
    
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
      
      // 如果有新选择的图片，先上传
      let imageUrl = product.image_url
      if (tempImagePath) {
        wx.showLoading({ title: '上传图片中...' })
        try {
          imageUrl = await this.uploadImage(tempImagePath)
          this.setData({ 
            uploadedImageUrl: imageUrl,
            tempImagePath: '' 
          })
        } catch (uploadErr) {
          wx.hideLoading()
          wx.showToast({ title: uploadErr.message || '图片上传失败', icon: 'none' })
          this.setData({ saving: false })
          return
        }
        wx.hideLoading()
      }
      
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
        if (imageUrl) {
          formData.image_url = imageUrl
        }
        
        // 将对象转为 URL 编码字符串
        const params = Object.keys(formData)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(formData[key])}`)
          .join('&')
        
        const res = await new Promise((resolve, reject) => {
          app.request({
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
        if (imageUrl) {
          formData.image_url = imageUrl
        }
        
        const res = await new Promise((resolve, reject) => {
          app.request({
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
          this.setData({ 
            mode: 'view',
            tempImagePath: '',
            uploadedImageUrl: '',
            imageBase64: ''
          })
          wx.setNavigationBarTitle({ title: '商品详情' })
          // 重新加载商品数据和图片，确保页面立即显示最新内容
          this.loadProduct(productId)
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
        app.request({
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
              app.request({
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
