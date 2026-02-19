// pages/order-detail/order-detail.js
import { getApiUrl } from '../../config'

const app = getApp()

Page({
  data: {
    orderId: null,
    order: null,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id })
      this.loadOrderDetail(options.id)
    }
  },

  // 加载订单详情
  async loadOrderDetail(id) {
    this.setData({ loading: true })
    
    try {
      const apiUrl = getApiUrl(app.globalData.serverUrl)
      const res = await new Promise((resolve, reject) => {
        app.request({
          url: `${apiUrl}/orders/${id}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        this.setData({
          order: res.data,
          loading: false
        })
      }
    } catch (error) {
      console.error('加载订单详情失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 撤销订单：先选择撤销到哪个收银台
  revokeOrder() {
    const { order } = this.data
    if (!order) return

    const wsConnected = app.globalData.socketTask && app.globalData.wsConnected

    if (wsConnected) {
      // 桌面端已连接，两个选项都可选
      wx.showActionSheet({
        itemList: ['撤销到小程序收银台', '撤销到桌面端收银台'],
        success: (res) => {
          const target = res.tapIndex === 0 ? 'miniapp' : 'desktop'
          this._doRevoke(target)
        }
      })
    } else {
      // 桌面端未连接，直接撤销到小程序
      this._doRevoke('miniapp')
    }
  },

  // 执行撤销
  async _doRevoke(target) {
    const { order, orderId } = this.data
    const targetName = target === 'miniapp' ? '小程序收银台' : '桌面端收银台'

    wx.showModal({
      title: '确认撤销',
      content: `确定要撤销订单"${order.order_no}"吗？\n\n商品库存将恢复，商品将返回${targetName}`,
      confirmColor: '#f59e0b',
      success: async (res) => {
        if (!res.confirm) return

        try {
          const apiUrl = getApiUrl(app.globalData.serverUrl)
          const response = await new Promise((resolve, reject) => {
            app.request({
              url: `${apiUrl}/orders/${orderId}/revoke`,
              method: 'POST',
              success: resolve,
              fail: reject
            })
          })

          if (response.statusCode === 200) {
            const data = response.data
            const items = data.items || []

            if (target === 'miniapp') {
              // 存入 globalData + storage（双保险）
              app.globalData.revokeCartItems = items
              try { wx.setStorageSync('revoke_cart_items', items) } catch (e) { /* ignore */ }

              // 跳转到收银台（onShow 会自动检测并恢复商品）
              wx.switchTab({
                url: '/pages/index/index',
                fail: () => {
                  wx.showToast({ title: '跳转失败，请手动切到收银台', icon: 'none' })
                }
              })
            } else {
              // 通过 WebSocket 发送到桌面端
              this.sendItemsToDesktop(items)
              wx.showToast({ title: '撤销成功', icon: 'success' })
              setTimeout(() => {
                wx.navigateBack()
              }, 1500)
            }
          } else {
            throw new Error(response.data?.detail || '撤销失败')
          }
        } catch (error) {
          console.error('撤销订单失败:', error)
          wx.showToast({ title: error.message || '撤销失败', icon: 'none' })
        }
      }
    })
  },

  // 通过 WebSocket 发送商品到桌面端
  sendItemsToDesktop(items) {
    const socketTask = app.globalData.socketTask
    const deviceId = app.globalData.deviceId
    
    if (!socketTask || !app.globalData.wsConnected) {
      console.warn('⚠️ WebSocket 未连接，无法发送商品到桌面端')
      return
    }
    
    // 遍历商品，发送 ADD_ITEM 消息
    items.forEach(item => {
      if (item.product_id && item.product_id > 0) {
        // 普通商品：通过 sku_id 发送
        const message = {
          type: 'ADD_ITEM',
          sku_id: item.product_id,
          qty: item.quantity,
          source: 'order_revoke',
          device_id: deviceId,
          ts: Date.now()
        }
        
        console.log('📤 发送撤销商品到桌面端:', message)
        
        socketTask.send({
          data: JSON.stringify(message),
          success: () => {
            console.log('✅ 商品已发送:', item.name)
          },
          fail: (error) => {
            console.error('❌ 发送失败:', error)
          }
        })
      } else {
        // 称重/手动商品：无法通过 WebSocket 发送，需要在桌面端手动添加
        console.warn('⚠️ 称重商品需要在桌面端手动添加:', item.name)
      }
    })
  },

  // 删除订单
  deleteOrder() {
    const { order } = this.data
    if (!order) return
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除订单"${order.order_no}"吗？\n\n⚠️ 此操作不可恢复，且不会恢复库存！`,
      confirmColor: '#dc2626',
      success: async (res) => {
        if (res.confirm) {
          try {
            const apiUrl = getApiUrl(app.globalData.serverUrl)
            const response = await new Promise((resolve, reject) => {
              app.request({
                url: `${apiUrl}/orders/${this.data.orderId}`,
                method: 'DELETE',
                success: resolve,
                fail: reject
              })
            })
            
            if (response.statusCode === 200) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              setTimeout(() => {
                wx.navigateBack()
              }, 1500)
            } else {
              throw new Error('删除失败')
            }
          } catch (error) {
            console.error('删除订单失败:', error)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 格式化时间
  formatDateTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN')
  }
})
