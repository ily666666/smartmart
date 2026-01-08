// pages/samples/samples.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    loading: true,
    samples: [],
    indexStatus: null,
    buildProgress: { status: 'idle', message: '', progress: 0 },
    // 筛选
    searchText: '',
    statusFilter: 'all', // all, ready, partial, empty
    // 统计
    stats: {
      total: 0,
      ready: 0,
      partial: 0,
      empty: 0,
      totalImages: 0
    },
    // 选中的商品
    selectedSample: null,
    uploading: false,
    // 展开的商品ID
    expandedId: null,
    // API 地址（用于图片显示）
    apiUrl: ''
  },

  onLoad() {
    //
  },

  onShow() {
    // 只要配置了服务器地址就加载数据
    if (app.globalData.serverUrl) {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      this.setData({ apiUrl })
      this.loadData()
    } else {
      this.setData({ loading: false })
      wx.showToast({ title: '请先配置服务器地址', icon: 'none' })
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载所有数据
  async loadData() {
    this.setData({ loading: true })
    await Promise.all([
      this.loadSamples(),
      this.loadIndexStatus(),
      this.loadBuildProgress()
    ])
    this.setData({ loading: false })
  },

  // 加载样本列表
  async loadSamples() {
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/api/samples/samples`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const samples = res.data || []
        
        // 计算统计
        const stats = {
          total: samples.length,
          ready: samples.filter(s => s.status === 'ready').length,
          partial: samples.filter(s => s.status === 'partial').length,
          empty: samples.filter(s => s.status === 'empty').length,
          totalImages: samples.reduce((sum, s) => sum + s.image_count, 0)
        }
        
        this.setData({ samples, stats })
      }
    } catch (error) {
      console.error('加载样本失败:', error)
    }
  },

  // 加载索引状态
  async loadIndexStatus() {
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/api/samples/index_status`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({ indexStatus: res.data })
      }
    } catch (error) {
      console.error('加载索引状态失败:', error)
    }
  },

  // 加载构建进度
  async loadBuildProgress() {
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/api/samples/build_status`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({ buildProgress: res.data })
        
        // 如果正在构建，轮询进度
        if (res.data.status === 'building') {
          setTimeout(() => this.loadBuildProgress(), 2000)
        } else if (res.data.status === 'completed') {
          this.loadIndexStatus()
        }
      }
    } catch (error) {
      console.error('加载构建进度失败:', error)
    }
  },

  // 搜索
  onSearchInput(e) {
    this.setData({ searchText: e.detail.value })
  },

  // 筛选状态
  setStatusFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ statusFilter: filter })
  },

  // 获取过滤后的样本列表
  getFilteredSamples() {
    const { samples, searchText, statusFilter } = this.data
    return samples.filter(s => {
      const matchSearch = !searchText || 
        s.name.toLowerCase().includes(searchText.toLowerCase()) ||
        s.barcode.includes(searchText)
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      return matchSearch && matchStatus
    })
  },

  // 选择商品上传图片
  selectSample(e) {
    const { id } = e.currentTarget.dataset
    const sample = this.data.samples.find(s => s.sku_id === id)
    this.setData({ selectedSample: sample })
  },

  // 上传图片
  uploadImages() {
    const { selectedSample } = this.data
    if (!selectedSample) return
    
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        this.setData({ uploading: true })
        
        try {
          const apiUrl = getApiUrl(app.globalData.serverUrl)
          
          for (const file of res.tempFiles) {
            await new Promise((resolve, reject) => {
              wx.uploadFile({
                url: `${apiUrl}/api/samples/samples/${selectedSample.sku_id}/upload`,
                filePath: file.tempFilePath,
                name: 'file',
                success: resolve,
                fail: reject
              })
            })
          }
          
          wx.showToast({ title: '上传成功', icon: 'success' })
          this.loadSamples()
        } catch (error) {
          console.error('上传失败:', error)
          wx.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          this.setData({ uploading: false, selectedSample: null })
        }
      }
    })
  },

  // 直接上传（快捷）
  quickUpload(e) {
    const { id } = e.currentTarget.dataset
    const sample = this.data.samples.find(s => s.sku_id === id)
    this.setData({ selectedSample: sample }, () => {
      this.uploadImages()
    })
  },

  // 重建索引
  buildIndex() {
    const { buildProgress, stats } = this.data
    
    if (buildProgress.status === 'building') {
      wx.showToast({ title: '正在构建中...', icon: 'none' })
      return
    }
    
    if (stats.ready === 0 && stats.partial === 0) {
      wx.showModal({
        title: '提示',
        content: '没有可用的样本图片，请先上传商品图片',
        showCancel: false
      })
      return
    }
    
    wx.showModal({
      title: '重建索引',
      content: `确定要重建AI识别索引吗？\n将为 ${stats.ready + stats.partial} 个有图片的商品构建索引`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const apiUrl = getApiUrl(app.globalData.serverUrl)
            const response = await new Promise((resolve, reject) => {
              wx.request({
                url: `${apiUrl}/api/samples/build_index`,
                method: 'POST',
                success: resolve,
                fail: reject
              })
            })
            
            if (response.statusCode === 200) {
              wx.showToast({ title: '开始构建', icon: 'success' })
              this.loadBuildProgress()
            } else {
              throw new Error(response.data?.detail || '启动失败')
            }
          } catch (error) {
            console.error('启动构建失败:', error)
            wx.showToast({ title: error.message || '启动失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 关闭详情弹窗
  closeModal() {
    this.setData({ selectedSample: null })
  },

  // 展开/折叠商品图片
  toggleExpand(e) {
    const { id } = e.currentTarget.dataset
    const newExpandedId = this.data.expandedId === id ? null : id
    this.setData({ expandedId: newExpandedId })
    
    // 展开时加载图片的 base64
    if (newExpandedId) {
      this.loadImagesBase64(newExpandedId)
    }
  },

  // 加载图片的 base64（ 显示图片）
  async loadImagesBase64(skuId) {
    const { samples, apiUrl } = this.data
    const sample = samples.find(s => s.sku_id === skuId)
    if (!sample || !sample.images || sample.images.length === 0) return
    
    // 检查是否已经加载过
    if (sample.imagesBase64) return
    
    const imagesBase64 = {}
    
    for (const img of sample.images) {
      try {
        const res = await new Promise((resolve, reject) => {
          wx.request({
            url: `${apiUrl}/api/samples/samples/${skuId}/images/${img}`,
            responseType: 'arraybuffer',
            success: resolve,
            fail: reject
          })
        })
        
        if (res.statusCode === 200) {
          const base64 = wx.arrayBufferToBase64(res.data)
          // 根据文件扩展名判断类型
          const ext = img.split('.').pop().toLowerCase()
          const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
          imagesBase64[img] = `data:${mimeType};base64,${base64}`
        }
      } catch (err) {
        console.error('加载图片失败:', img, err)
      }
    }
    
    // 更新对应商品的 base64 数据
    const newSamples = samples.map(s => {
      if (s.sku_id === skuId) {
        return { ...s, imagesBase64 }
      }
      return s
    })
    
    this.setData({ samples: newSamples })
  },

  // 预览图片
  previewImage(e) {
    const { sku, images, index } = e.currentTarget.dataset
    const { apiUrl } = this.data
    
    const urls = images.map(img => `${apiUrl}/api/samples/samples/${sku}/images/${img}`)
    
    wx.previewImage({
      current: urls[index],
      urls: urls
    })
  },

  // 删除图片
  deleteImage(e) {
    const { sku, filename } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除这张图片吗？`,
      confirmColor: '#dc2626',
      success: async (res) => {
        if (res.confirm) {
          try {
            const apiUrl = getApiUrl(app.globalData.serverUrl)
            const response = await new Promise((resolve, reject) => {
              wx.request({
                url: `${apiUrl}/api/samples/samples/${sku}/${filename}`,
                method: 'DELETE',
                success: resolve,
                fail: reject
              })
            })
            
            if (response.statusCode === 200) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              // 刷新样本列表
              this.loadSamples()
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
