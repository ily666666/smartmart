// pages/vision/vision.js
const app = getApp()

Page({
  data: {
    imagePath: '',           // 拍摄的图片路径
    compressing: false,      // 压缩中
    uploading: false,        // 上传中
    candidates: [],          // 候选商品列表
    sampleId: null,          // 样本ID
    wsConnected: false,      // 连接状态
    cameraReady: false,      // 相机是否就绪
    flashMode: 'off',        // 闪光灯模式
    visionHistory: []        // 识别历史
  },
  
  _historyIdCounter: 0,

  // 相机上下文
  _cameraContext: null,

  onLoad() {
    console.log('外观识别页加载')
    
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
                  content: '使用相机功能需要同意隐私协议，您可以点击"从相册选择"继续使用',
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
      this._cameraContext = wx.createCameraContext()
      this.setData({ cameraReady: true })
    }, 300)
  },

  onShow() {
    // vision 页面不再是 Tab 页面，从采集中心进入
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
  },

  onHide() {
    // 页面隐藏时关闭闪光灯
    this.setData({ flashMode: 'off' })
  },

  // 相机错误
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

  // 切换闪光灯
  toggleFlash() {
    this.setData({
      flashMode: this.data.flashMode === 'off' ? 'on' : 'off'
    })
  },

  // 拍照
  capturePhoto() {
    if (!this._cameraContext) {
      this._cameraContext = wx.createCameraContext()
    }
    
    wx.showLoading({ title: '拍照中...' })
    
    this._cameraContext.takePhoto({
      quality: 'normal',
      success: (res) => {
        wx.hideLoading()
        console.log('✅ 拍照成功:', res.tempImagePath)
        
        // 震动反馈
        wx.vibrateShort({ type: 'medium' })
        
        this.setData({ imagePath: res.tempImagePath })
        
        // 自动压缩并上传
        this.compressAndUpload(res.tempImagePath)
      },
      fail: (error) => {
        wx.hideLoading()
        console.error('❌ 拍照失败:', error)
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        })
      }
    })
  },

  // 从相册选择
  chooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const imagePath = res.tempFilePaths[0]
        console.log('选择图片:', imagePath)
        this.setData({ imagePath })
        
        // 自动压缩并上传
        this.compressAndUpload(imagePath)
      },
      fail: (error) => {
        if (!error.errMsg.includes('cancel')) {
          console.error('选择图片失败:', error)
        }
      }
    })
  },

  // 压缩并上传
  async compressAndUpload(imagePath) {
    try {
      // 1. 压缩图片
      this.setData({ compressing: true })
      
      const compressedPath = await this.compressImage(imagePath)
      
      this.setData({ 
        compressing: false,
        imagePath: compressedPath 
      })
      
      console.log('✅ 压缩完成:', compressedPath)
      
      // 2. 上传识别
      this.uploadImage(compressedPath)
      
    } catch (error) {
      this.setData({ compressing: false })
      console.error('❌ 压缩失败:', error)
      
      // 降级：使用原图上传
      console.log('⚠️ 使用原图上传')
      this.uploadImage(imagePath)
    }
  },

  // 压缩图片（限制宽边800，质量0.7）
  compressImage(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (info) => {
          console.log('原图尺寸:', info.width, 'x', info.height)
          
          let targetWidth = info.width
          let targetHeight = info.height
          const maxSize = 800
          
          if (info.width > info.height) {
            if (info.width > maxSize) {
              targetWidth = maxSize
              targetHeight = Math.round(info.height * (maxSize / info.width))
            }
          } else {
            if (info.height > maxSize) {
              targetHeight = maxSize
              targetWidth = Math.round(info.width * (maxSize / info.height))
            }
          }
          
          console.log('目标尺寸:', targetWidth, 'x', targetHeight)
          
          const canvas = wx.createOffscreenCanvas({
            type: '2d',
            width: targetWidth,
            height: targetHeight
          })
          
          const ctx = canvas.getContext('2d')
          const img = canvas.createImage()
          
          img.onload = () => {
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
            
            wx.canvasToTempFilePath({
              canvas: canvas,
              destWidth: targetWidth,
              destHeight: targetHeight,
              quality: 0.7,
              fileType: 'jpg',
              success: (res) => {
                resolve(res.tempFilePath)
              },
              fail: (error) => {
                reject(error)
              }
            })
          }
          
          img.onerror = reject
          img.src = imagePath
        },
        fail: reject
      })
    })
  },

  // 上传图片识别
  uploadImage(imagePath) {
    const serverUrl = app.globalData.serverUrl
    const deviceId = app.globalData.deviceId
    
    if (!serverUrl) {
      wx.showToast({
        title: '请先配置服务器',
        icon: 'none'
      })
      this.reset()
      return
    }
    
    this.setData({ uploading: true })
    
    wx.uploadFile({
      url: `http://${serverUrl}/vision/query`,
      filePath: imagePath,
      name: 'image',
      formData: {
        'device_id': deviceId,
        'device_type': 'miniapp',
        'top_k': '5'
      },
      success: (res) => {
        this.setData({ uploading: false })
        
        if (res.statusCode === 200) {
          const data = JSON.parse(res.data)
          console.log('✅ 识别成功:', data)
          
          const candidates = data.candidates.map(item => ({
            ...item,
            scorePercent: Math.round(item.score * 100)
          }))
          
          this.setData({
            candidates: candidates,
            sampleId: data.sample_id
          })
          
          if (candidates.length === 0) {
            wx.showToast({
              title: '未识别到商品',
              icon: 'none'
            })
          } else {
            wx.showToast({
              title: `找到 ${candidates.length} 个候选`,
              icon: 'success',
              duration: 1000
            })
          }
        } else {
          console.error('❌ 识别失败:', res)
          wx.showToast({
            title: '识别失败',
            icon: 'none'
          })
        }
      },
      fail: (error) => {
        this.setData({ uploading: false })
        console.error('❌ 上传失败:', error)
        wx.showToast({
          title: '上传失败，请检查网络',
          icon: 'none'
        })
      }
    })
  },

  // 确认选择商品（点击直接添加）
  confirmProduct(e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.candidates[index]
    
    console.log('👆 点击候选商品:', index, product)
    
    if (!product) {
      console.error('❌ 无法获取商品信息，index:', index)
      wx.showToast({ title: '操作失败', icon: 'none' })
      return
    }
    
    if (!app.globalData.wsConnected) {
      wx.showModal({
        title: '未连接服务器',
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
    
    // 震动反馈
    wx.vibrateShort({ type: 'medium' })
    
    // 直接添加到购物车，不需要二次确认
    this.addToCart(product)
  },

  // 添加到购物车
  addToCart(product) {
    const socketTask = app.globalData.socketTask
    const deviceId = app.globalData.deviceId
    
    console.log('📦 准备添加商品到购物车:', product)
    console.log('   sku_id:', product.sku_id)
    console.log('   socketTask:', socketTask ? '存在' : '不存在')
    console.log('   wsConnected:', app.globalData.wsConnected)
    
    if (!socketTask) {
      wx.showToast({ title: 'WebSocket 未连接', icon: 'none' })
      return
    }
    
    // 确保 sku_id 是数字
    const skuId = parseInt(product.sku_id)
    if (isNaN(skuId)) {
      console.error('❌ sku_id 无效:', product.sku_id)
      wx.showToast({ title: '商品ID无效', icon: 'none' })
      return
    }
    
    const message = {
      type: 'ADD_ITEM',
      sku_id: skuId,
      qty: 1,
      source: 'vision_confirm',
      device_id: deviceId,
      ts: Date.now()
    }
    
    console.log('📤 发送消息:', JSON.stringify(message))
    
    socketTask.send({
      data: JSON.stringify(message),
      success: () => {
        console.log('✅ 添加商品事件已发送')
        
        // 添加到历史记录
        this.addToHistory(product)
        
        this.confirmResult(skuId)
        
        wx.showToast({
          title: '已添加到购物车',
          icon: 'success',
          duration: 800
        })
        
        // 立即重置，让用户可以继续扫描
        this.reset()
      },
      fail: (error) => {
        console.error('❌ 发送失败:', error)
        wx.showToast({ title: '发送失败', icon: 'none' })
      }
    })
  },
  
  // 添加到历史记录
  addToHistory(product) {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    const historyItem = {
      id: ++this._historyIdCounter,
      name: product.name,
      price: product.price,
      time: timeStr
    }
    
    const history = [historyItem, ...this.data.visionHistory]
    if (history.length > 10) {
      history.pop()
    }
    this.setData({ visionHistory: history })
  },
  
  // 清空历史
  clearHistory() {
    this.setData({ visionHistory: [] })
  },

  // 确认识别结果
  confirmResult(skuId) {
    const serverUrl = app.globalData.serverUrl
    const sampleId = this.data.sampleId
    
    if (!sampleId) return
    
    wx.request({
      url: `http://${serverUrl}/vision/confirm`,
      method: 'POST',
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      data: { sample_id: sampleId, sku_id: skuId },
      success: (res) => console.log('✅ 确认结果已记录'),
      fail: (error) => console.error('⚠️ 确认结果失败:', error)
    })
  },

  // 重置
  reset() {
    this.setData({
      imagePath: '',
      candidates: [],
      sampleId: null,
      compressing: false,
      uploading: false
    })
  },

  // 切换到扫码录入
  switchToScan() {
    wx.redirectTo({
      url: '/pages/scan/scan'
    })
  }
})
