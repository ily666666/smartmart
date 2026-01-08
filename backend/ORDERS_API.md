# 订单 API 文档

## 📋 新增接口说明

### POST /orders/create

创建订单（用于桌面收银系统提交订单）

#### 请求

**URL**: `POST http://localhost:8000/orders/create`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "items": [
    {
      "product_id": 1,
      "barcode": "6901028075831",
      "quantity": 2,
      "price": 3.5
    },
    {
      "product_id": 2,
      "barcode": "6925303730086",
      "quantity": 1,
      "price": 2.0
    }
  ],
  "total_amount": 9.0,
  "cashier": "收银员01"
}
```

**字段说明**:
- `items`: 订单商品列表
  - `product_id`: 商品 ID（sku_id）
  - `barcode`: 商品条码
  - `quantity`: 数量
  - `price`: 单价
- `total_amount`: 订单总金额
- `cashier`: 收银员名称（可选，默认"收银员"）

#### 响应

**成功（200）**:
```json
{
  "order_id": 1,
  "order_no": "ORD20250101120000",
  "total_amount": 9.0,
  "status": "completed",
  "items_count": 2,
  "message": "订单创建成功"
}
```

**失败（400）**:
```json
{
  "detail": "商品 '可口可乐' 库存不足（库存: 5, 需要: 10）"
}
```

**失败（404）**:
```json
{
  "detail": "商品 ID 999 不存在"
}
```

#### 业务逻辑

1. 验证商品存在
2. 检查库存是否充足
3. 创建订单记录
4. 创建订单明细
5. **自动扣减库存**
6. 返回订单信息

---

### GET /orders/list

获取订单列表

**URL**: `GET http://localhost:8000/orders/list?skip=0&limit=50`

**参数**:
- `skip`: 跳过记录数（默认 0）
- `limit`: 返回记录数（默认 50）

**响应**:
```json
[
  {
    "order_id": 1,
    "order_no": "ORD20250101120000",
    "total_amount": 9.0,
    "status": "completed",
    "cashier": "收银员01",
    "created_at": "2025-01-01T12:00:00"
  }
]
```

---

### GET /orders/{order_id}

获取订单详情

**URL**: `GET http://localhost:8000/orders/1`

**响应**:
```json
{
  "order_id": 1,
  "order_no": "ORD20250101120000",
  "total_amount": 9.0,
  "status": "completed",
  "cashier": "收银员01",
  "created_at": "2025-01-01T12:00:00",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price": 3.5,
      "subtotal": 7.0
    },
    {
      "product_id": 2,
      "quantity": 1,
      "unit_price": 2.0,
      "subtotal": 2.0
    }
  ]
}
```

---

## 🧪 测试示例

### 使用 curl

```bash
# 创建订单
curl -X POST http://localhost:8000/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product_id": 1,
        "barcode": "6901028075831",
        "quantity": 2,
        "price": 3.5
      }
    ],
    "total_amount": 7.0,
    "cashier": "测试收银员"
  }'

# 获取订单列表
curl http://localhost:8000/orders/list

# 获取订单详情
curl http://localhost:8000/orders/1
```

### 使用 PowerShell

```powershell
# 创建订单
$body = @{
  items = @(
    @{
      product_id = 1
      barcode = "6901028075831"
      quantity = 2
      price = 3.5
    }
  )
  total_amount = 7.0
  cashier = "测试收银员"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8000/orders/create `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

# 获取订单列表
Invoke-RestMethod -Uri http://localhost:8000/orders/list
```

---

## 📊 数据库变更

### orders 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 订单 ID（主键） |
| order_no | VARCHAR(50) | 订单号（唯一） |
| total_amount | FLOAT | 总金额 |
| status | VARCHAR(20) | 状态（completed/pending/cancelled） |
| cashier | VARCHAR(100) | 收银员 |
| created_at | DATETIME | 创建时间 |

### order_items 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 明细 ID（主键） |
| order_id | INTEGER | 订单 ID（外键） |
| product_id | INTEGER | 商品 ID（外键） |
| quantity | INTEGER | 数量 |
| unit_price | FLOAT | 单价 |
| subtotal | FLOAT | 小计 |

---

## ⚠️ 注意事项

1. **库存扣减**: 提交订单会自动扣减商品库存
2. **库存不足**: 如果库存不足，会返回 400 错误
3. **事务处理**: 创建订单和扣库存在同一事务中，失败会回滚
4. **订单号生成**: 格式为 `ORD + 年月日时分秒`，例如 `ORD20250101120000`

---

## 🔄 集成说明

### Desktop 客户端调用

```typescript
const response = await fetch(`${API_BASE_URL}/orders/create`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: cart.map(item => ({
      product_id: item.sku_id,
      barcode: item.barcode,
      quantity: item.quantity,
      price: item.price
    })),
    total_amount: getTotalAmount(),
    cashier: "收银员01"
  }),
});

const result = await response.json();
console.log("订单创建成功:", result.order_no);
```

---

## 📝 完整 API 清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/orders/create` | 创建订单 |
| GET | `/orders/list` | 获取订单列表 |
| GET | `/orders/{order_id}` | 获取订单详情 |

**API 文档**: http://localhost:8000/docs

---

✅ 订单接口已完整实现，可直接使用！


