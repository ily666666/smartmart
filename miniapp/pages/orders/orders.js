// pages/orders/orders.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    wsConnected: false,
    orders: [],
    loading: false,
    // 日期筛选
    startDate: '',
    endDate: '',
    activeQuickDate: 7, // 默认近7天
    // 统计
    totalCount: 0,
    totalAmount: 0,
    // 分页
    currentPage: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad() {
    // 设置默认日期（近7天）
    const today = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    
    this.setData({
      endDate: this.formatDate(today),
      startDate: this.formatDate(weekAgo)
    })
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    
    // 更新连接状态
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
    
    // 加载数据
    if (app.globalData.wsConnected) {
      this.loadOrders(true)
    }
  },

  onPullDownRefresh() {
    if (app.globalData.wsConnected) {
      this.loadOrders(true).then(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders(false)
    }
  },

  // 格式化日期
  formatDate(date) {
    return date.toISOString().split('T')[0]
  },

  // 加载订单列表
  async loadOrders(refresh = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    const page = refresh ? 1 : this.data.currentPage
    const { pageSize, startDate, endDate } = this.data
    
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      let url = `${apiUrl}/orders/list?page=${page}&page_size=${pageSize}`
      
      if (startDate) url += `&start_date=${startDate}`
      if (endDate) url += `&end_date=${endDate}`
      
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
        const newOrders = data.items || []
        
        this.setData({
          orders: refresh ? newOrders : [...this.data.orders, ...newOrders],
          totalCount: data.total || 0,
          totalAmount: data.total_amount || 0,
          currentPage: page + 1,
          hasMore: newOrders.length === pageSize,
          loading: false
        })
      }
    } catch (error) {
      console.error('加载订单失败:', error)
      this.setData({ loading: false })
    }
  },

  // 快捷日期选择
  setQuickDate(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    const today = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days + 1)
    
    this.setData({
      startDate: this.formatDate(start),
      endDate: this.formatDate(today),
      activeQuickDate: days
    })
    
    this.loadOrders(true)
  },

  // 开始日期变化
  onStartDateChange(e) {
    this.setData({ 
      startDate: e.detail.value,
      activeQuickDate: null
    })
  },

  // 结束日期变化
  onEndDateChange(e) {
    this.setData({ 
      endDate: e.detail.value,
      activeQuickDate: null
    })
  },

  // 执行查询
  doSearch() {
    this.loadOrders(true)
  },

  // 查看订单详情
  viewOrder(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${id}`
    })
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      completed: '已完成',
      pending: '待处理',
      cancelled: '已取消'
    }
    return statusMap[status] || status
  },

  // 格式化时间
  formatTime(dateStr) {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}`
  }
})
