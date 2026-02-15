Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4f46e5",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "收银",
        icon: "scan"
      },
      {
        pagePath: "/pages/products/products",
        text: "商品",
        icon: "product"
      },
      {
        pagePath: "/pages/collect/collect",
        text: "采集",
        icon: "collect"
      },
      {
        pagePath: "/pages/orders/orders",
        text: "订单",
        icon: "order"
      },
      {
        pagePath: "/pages/settings/settings",
        text: "设置",
        icon: "settings"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      
      wx.switchTab({ url })
    }
  }
})
