// pages/reports/reports.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    activeTab: 'daily', // daily, top, slow, profit
    loading: false,
    // 今日营业
    selectedDate: '',
    dailyReport: null,
    // 畅销/滞销
    days: 30,
    topProducts: [],
    slowMovers: [],
    // 盈利分析
    profitReport: null
  },

  onLoad(options) {
    // 设置默认日期为今天
    const data = {
      selectedDate: new Date().toISOString().split('T')[0]
    }
    // 如果传了 tab 参数，设置对应的 activeTab
    if (options.tab && ['daily', 'top', 'slow', 'profit'].includes(options.tab)) {
      data.activeTab = options.tab
    }
    this.setData(data)
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
    if (activeTab === 'daily') {
      await this.loadDailyReport()
    } else if (activeTab === 'top') {
      await this.loadTopProducts()
    } else if (activeTab === 'slow') {
      await this.loadSlowMovers()
    } else if (activeTab === 'profit') {
      await this.loadProfitReport()
    }
  },

  // 切换 Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadCurrentTab()
  },

  // 日期快捷选择
  setQuickDate(e) {
    const offset = parseInt(e.currentTarget.dataset.offset)
    const date = new Date()
    date.setDate(date.getDate() - offset)
    this.setData({ selectedDate: date.toISOString().split('T')[0] })
    this.loadDailyReport()
  },

  // 日期选择
  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value })
    this.loadDailyReport()
  },

  // 天数选择
  setDays(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ days })
    if (this.data.activeTab === 'top') {
      this.loadTopProducts()
    } else if (this.data.activeTab === 'slow') {
      this.loadSlowMovers()
    } else if (this.data.activeTab === 'profit') {
      this.loadProfitReport()
    }
  },

  // 加载日报表
  async loadDailyReport() {
    this.setData({ loading: true })
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/reports/sales_daily?date=${this.data.selectedDate}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({ dailyReport: res.data })
      }
    } catch (error) {
      console.error('加载日报表失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载畅销商品
  async loadTopProducts() {
    this.setData({ loading: true })
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/reports/top_products?days=${this.data.days}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({ topProducts: res.data || [] })
      }
    } catch (error) {
      console.error('加载畅销商品失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载滞销商品
  async loadSlowMovers() {
    this.setData({ loading: true })
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/reports/slow_movers?days=${this.data.days}&min_stock=0`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({ slowMovers: res.data || [] })
      }
    } catch (error) {
      console.error('加载滞销商品失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载盈利报表
  async loadProfitReport() {
    this.setData({ loading: true })
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiUrl}/reports/profit?days=${this.data.days}&include_no_cost=false`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({ profitReport: res.data })
      }
    } catch (error) {
      console.error('加载盈利报表失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  }
})
