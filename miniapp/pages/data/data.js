// pages/data/data.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    wsConnected: false,
    // 今日概览数据
    todayStats: {
      revenue: 0,
      orderCount: 0,
      itemCount: 0,
      avgOrderValue: 0
    },
    // 智能提醒
    alerts: [],
    loading: true
  },

  onLoad() {
    //
  },

  onShow() {
    // 设置当前 tabBar 选中项
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    
    // 更新连接状态
    this.setData({
      wsConnected: app.globalData.wsConnected
    })
    
    // 加载数据
    if (app.globalData.wsConnected) {
      this.loadTodayStats()
      this.loadAlerts()
    }
  },

  onPullDownRefresh() {
    if (app.globalData.wsConnected) {
      Promise.all([
        this.loadTodayStats(),
        this.loadAlerts()
      ]).then(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  // 加载今日概览
  async loadTodayStats() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/reports/sales_daily?date=${today}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const data = res.data
        this.setData({
          'todayStats.revenue': data.total_revenue || 0,
          'todayStats.orderCount': data.order_count || 0,
          'todayStats.itemCount': data.item_count || 0,
          'todayStats.avgOrderValue': data.avg_order_value || 0,
          loading: false
        })
      }
    } catch (error) {
      console.error('加载今日统计失败:', error)
      this.setData({ loading: false })
    }
  },

  // 加载智能提醒
  async loadAlerts() {
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const alerts = []
      
      // 获取补货建议
      const restockRes = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/analysis/restock_suggestion?days=30&safety_stock_days=7`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (restockRes.statusCode === 200 && restockRes.data.length > 0) {
        const urgentCount = restockRes.data.filter(item => item.days_until_stockout < 3).length
        if (urgentCount > 0) {
          alerts.push({
            type: 'restock',
            icon: '🔴',
            title: `${urgentCount}个商品需要紧急补货`,
            desc: '点击查看详情'
          })
        } else if (restockRes.data.length > 0) {
          alerts.push({
            type: 'restock',
            icon: '🟠',
            title: `${restockRes.data.length}个商品需要补货`,
            desc: '点击查看详情'
          })
        }
      }
      
      // 获取异常检测
      const anomalyRes = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/analysis/anomaly_detection?days=7&threshold_std=2.0`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (anomalyRes.statusCode === 200 && anomalyRes.data.length > 0) {
        const surgeCount = anomalyRes.data.filter(a => a.anomaly_type === 'surge').length
        if (surgeCount > 0) {
          alerts.push({
            type: 'anomaly',
            icon: '📈',
            title: `${surgeCount}个商品销量异常增长`,
            desc: '点击查看详情'
          })
        }
      }
      
      this.setData({ alerts })
    } catch (error) {
      console.error('加载智能提醒失败:', error)
    }
  },

  // 导航到报表页面
  goToReports(e) {
    const tab = e.currentTarget.dataset.tab || 'daily'
    wx.navigateTo({ url: `/pages/reports/reports?tab=${tab}` })
  },

  // 导航到AI分析页面
  goToAnalysis(e) {
    const tab = e.currentTarget.dataset.tab || 'restock'
    wx.navigateTo({ url: `/pages/analysis/analysis?tab=${tab}` })
  },

  // 处理提醒点击
  handleAlertTap(e) {
    const { type } = e.currentTarget.dataset
    if (type === 'restock') {
      wx.navigateTo({ url: '/pages/analysis/analysis?tab=restock' })
    } else if (type === 'anomaly') {
      wx.navigateTo({ url: '/pages/analysis/analysis?tab=anomaly' })
    }
  },

  // 检查连接状态
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
  }
})
