Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4f46e5",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        icon: "home"
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
        pagePath: "/pages/data/data",
        text: "数据",
        icon: "data"
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
