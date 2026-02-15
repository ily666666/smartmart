// pages/analysis/analysis.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    activeTab: 'restock', // restock, anomaly
    loading: false,
    days: 30,
    safetyStockDays: 7,
    // 补货建议
    restockSuggestions: [],
    restockStats: { total: 0, urgent: 0, warning: 0 },
    // 异常检测
    anomalies: [],
    anomalyStats: { total: 0, surge: 0, drop: 0 }
  },

  onLoad(options) {
    // 如果传了 tab 参数，设置对应的 activeTab
    if (options.tab && ['restock', 'anomaly'].includes(options.tab)) {
      this.setData({ activeTab: options.tab })
    }
  },

  onShow() {
    if (app.globalData.wsConnected) {
      this.loadCurrentTab()
    }
  },

  onPullDownRefresh() {
    this.loadCurrentTab().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载当前 Tab 数据
  async loadCurrentTab() {
    const { activeTab } = this.data
    if (activeTab === 'restock') {
      await this.loadRestockSuggestions()
    } else if (activeTab === 'anomaly') {
      await this.loadAnomalies()
    }
  },

  // 切换 Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadCurrentTab()
  },

  // 设置统计天数
  setDays(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ days })
    this.loadCurrentTab()
  },

  // 设置安全库存天数
  setSafetyDays(e) {
    const safetyDays = parseInt(e.currentTarget.dataset.days)
    this.setData({ safetyStockDays: safetyDays })
    this.loadRestockSuggestions()
  },

  // 加载补货建议
  async loadRestockSuggestions() {
    this.setData({ loading: true })
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const { days, safetyStockDays } = this.data
      
      const res = await new Promise((resolve, reject) => {
        app.request({
          url: `${apiUrl}/analysis/restock_suggestion?days=${days}&safety_stock_days=${safetyStockDays}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const suggestions = res.data || []
        const stats = {
          total: suggestions.length,
          urgent: suggestions.filter(s => s.days_until_stockout < 3).length,
          warning: suggestions.filter(s => s.days_until_stockout >= 3 && s.days_until_stockout < 7).length
        }
        this.setData({ 
          restockSuggestions: suggestions,
          restockStats: stats
        })
      }
    } catch (error) {
      console.error('加载补货建议失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载异常检测
  async loadAnomalies() {
    this.setData({ loading: true })
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      
      const res = await new Promise((resolve, reject) => {
        app.request({
          url: `${apiUrl}/analysis/anomaly_detection?days=${this.data.days}&threshold_std=2.0`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        const anomalyList = res.data || []
        const stats = {
          total: anomalyList.length,
          surge: anomalyList.filter(a => a.anomaly_type === 'surge').length,
          drop: anomalyList.filter(a => a.anomaly_type === 'drop' || a.anomaly_type === 'zero').length
        }
        this.setData({ 
          anomalies: anomalyList,
          anomalyStats: stats
        })
      }
    } catch (error) {
      console.error('加载异常检测失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取紧急程度
  getUrgencyLevel(daysUntilStockout) {
    if (daysUntilStockout < 2) return { level: 'critical', text: '紧急补货！', icon: '🔴' }
    if (daysUntilStockout < 5) return { level: 'warning', text: '尽快补货', icon: '🟠' }
    if (daysUntilStockout < 10) return { level: 'normal', text: '注意库存', icon: '🟡' }
    return { level: 'safe', text: '库存充足', icon: '🟢' }
  },

  // 获取异常类型信息
  getAnomalyType(type) {
    const types = {
      surge: { icon: '📈', text: '卖得多', color: '#059669' },
      drop: { icon: '📉', text: '卖得少', color: '#f59e0b' },
      zero: { icon: '⚠️', text: '没卖出', color: '#dc2626' }
    }
    return types[type] || { icon: '❓', text: type, color: '#6b7280' }
  }
})
