# 🚀 Backend MVP - 立即启动

## ⚡ 一键启动（3 步）

```powershell
# 1. 进入目录
cd backend

# 2. 创建环境并安装依赖
uv venv && .venv\Scripts\Activate.ps1 && uv pip install -e .

# 3. 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ 打开浏览器: http://localhost:8000/docs

---

## 📋 已实现的 MVP 功能

### ✅ 数据库（SQLite）
自动创建 5 个表：
- `products` (商品)
- `orders` (订单)
- `order_items` (订单明细)
- `inventory_moves` (库存变动)
- `devices` (设备)

### ✅ REST API

#### 1. 查询商品（按条码）
```bash
GET /products/by_barcode?code=6901028075831
```
**返回**:
```json
{
  "sku_id": 1,
  "barcode": "6901028075831",
  "name": "可口可乐 330ml",
  "price": 3.5,
  "stock": 100
}
```

#### 2. 批量导入（CSV）
```bash
POST /products/import_csv
```
上传 CSV 文件（`barcode,name,price`）

**测试**: 使用 `test_products.csv`

### ✅ WebSocket

#### 连接
```
ws://localhost:8000/ws
```

#### 客户端发送（扫码）
```json
{
  "type": "SCAN_BARCODE",
  "code": "6901028075831",
  "device_id": "desktop-001",
  "ts": 1234567890
}
```

#### 服务端广播（找到商品）
```json
{
  "type": "PRODUCT_FOUND",
  "sku_id": 1,
  "name": "可口可乐",
  "price": 3.5,
  "code": "6901028075831",
  "source": "desktop-001"
}
```

#### 服务端广播（未找到）
```json
{
  "type": "PRODUCT_NOT_FOUND",
  "code": "999999",
  "source": "desktop-001"
}
```

---

## 🧪 快速测试

### 测试 API
```powershell
# PowerShell
Invoke-RestMethod "http://localhost:8000/products/by_barcode?code=6901028075831"
```

### 测试 WebSocket
```powershell
# 安装依赖
uv pip install websockets

# 运行测试脚本
python test_websocket.py
```

**或在浏览器控制台**:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'SCAN_BARCODE',
    code: '6901028075831',
    device_id: 'browser-test',
    ts: Date.now()
  }));
};
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## 🌐 局域网访问

### 1. 查看本机 IP
```powershell
ipconfig
# 找到 "IPv4 地址"，例如: 192.168.1.100
```

### 2. 配置防火墙
```powershell
netsh advfirewall firewall add rule name="SmartMart Backend" dir=in action=allow protocol=TCP localport=8000
```

### 3. 从其他设备访问
```
http://192.168.1.100:8000/docs
ws://192.168.1.100:8000/ws
```

---

## 📁 关键文件

| 文件 | 说明 |
|------|------|
| `app/main.py` | FastAPI 入口 |
| `app/database.py` | 数据库配置 + 示例数据 |
| `app/models/*.py` | 数据库模型（5个表） |
| `app/api/products.py` | 商品 API |
| `app/api/websocket_api.py` | WebSocket 实现 |
| `test_products.csv` | 测试数据 |
| `test_websocket.py` | WebSocket 测试脚本 |
| `smartmart.db` | SQLite 数据库（自动创建） |

---

## 🐛 故障排除

### 端口被占用
```powershell
# 换个端口
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 权限错误
```powershell
# PowerShell 执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 数据库错误
```powershell
# 删除数据库重建
Remove-Item smartmart.db
# 重新启动服务
```

---

## 📚 详细文档

- **详细启动指南**: [SETUP.md](./SETUP.md)
- **项目说明**: [README.md](./README.md)
- **API 文档**: http://localhost:8000/docs （启动后访问）

---

## ✨ 特性

- ✅ **开箱即用**: 无需手动建表，自动初始化
- ✅ **示例数据**: 启动即有 5 个测试商品
- ✅ **完整 CORS**: 局域网内任意访问
- ✅ **实时通信**: WebSocket 双向通信
- ✅ **CSV 导入**: 批量导入商品
- ✅ **防火墙说明**: 端口配置指南

---

**🎉 MVP 完整实现，可直接运行！**


