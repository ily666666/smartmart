# Backend MVP 启动指南

## ✅ 完整启动步骤

### 1. 安装 uv（如果未安装）

```powershell
# Windows PowerShell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 2. 创建虚拟环境并安装依赖

```powershell
cd backend

# 创建虚拟环境
uv venv

# 激活虚拟环境 (Windows PowerShell)
.venv\Scripts\Activate.ps1

# 或 Windows CMD
.venv\Scripts\activate.bat

# 或 Linux/Mac
source .venv/bin/activate

# 安装依赖
uv pip install -e .
```

### 3. 启动服务

```powershell
# 方式1: 使用 uvicorn 直接启动
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 方式2: 使用 uv run（推荐）
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 验证服务

打开浏览器访问：
- API 文档: http://localhost:8000/docs
- 根路径: http://localhost:8000/
- 健康检查: http://localhost:8000/health

## 📡 测试 API

### 1. 查询商品（通过条码）

```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/products/by_barcode?code=6901028075831"

# curl (Linux/Mac)
curl "http://localhost:8000/products/by_barcode?code=6901028075831"
```

**响应示例**:
```json
{
  "sku_id": 1,
  "barcode": "6901028075831",
  "name": "可口可乐 330ml",
  "price": 3.5,
  "stock": 100
}
```

### 2. 批量导入商品（CSV）

**创建测试 CSV 文件** (`test_products.csv`):
```csv
barcode,name,price
6901028075831,可口可乐 330ml,3.50
6925303730086,农夫山泉 550ml,2.00
6902083895488,康师傅红烧牛肉面,4.50
```

**上传 CSV**:
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/products/import_csv" `
  -Method POST `
  -ContentType "multipart/form-data" `
  -Form @{file=Get-Item -Path "test_products.csv"}

# curl (Linux/Mac)
curl -X POST "http://localhost:8000/products/import_csv" \
  -F "file=@test_products.csv"
```

或直接在 Swagger UI (http://localhost:8000/docs) 上传。

### 3. 测试 WebSocket

**使用浏览器控制台**:
```javascript
// 打开 WebSocket 连接
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  console.log('✅ WebSocket 已连接');
  
  // 发送扫码事件
  ws.send(JSON.stringify({
    type: 'SCAN_BARCODE',
    code: '6901028075831',
    device_id: 'test-device-001',
    ts: Date.now()
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📨 收到消息:', data);
};

ws.onerror = (error) => {
  console.error('❌ WebSocket 错误:', error);
};
```

**使用 Python 测试脚本**:
```python
import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8000/ws"
    
    async with websockets.connect(uri) as websocket:
        print("✅ WebSocket 已连接")
        
        # 发送扫码事件
        scan_event = {
            "type": "SCAN_BARCODE",
            "code": "6901028075831",
            "device_id": "python-client",
            "ts": 1234567890
        }
        await websocket.send(json.dumps(scan_event))
        print(f"📤 发送: {scan_event}")
        
        # 接收响应
        response = await websocket.recv()
        data = json.loads(response)
        print(f"📨 收到: {data}")

asyncio.run(test_websocket())
```

## 🔥 防火墙配置

### Windows 防火墙

```powershell
# 允许入站连接到 8000 端口
netsh advfirewall firewall add rule name="SmartMart Backend" dir=in action=allow protocol=TCP localport=8000

# 查看规则
netsh advfirewall firewall show rule name="SmartMart Backend"

# 删除规则（如需）
netsh advfirewall firewall delete rule name="SmartMart Backend"
```

### Linux 防火墙 (ufw)

```bash
sudo ufw allow 8000/tcp
sudo ufw status
```

### 临时测试（关闭防火墙）

**Windows**:
```powershell
# ⚠️ 不推荐生产环境使用
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# 恢复防火墙
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

## 📊 数据库说明

### 自动创建的表

启动时会自动创建以下表：
- `products` - 商品表
- `orders` - 订单表
- `order_items` - 订单明细表
- `inventory_moves` - 库存变动表
- `devices` - 设备表

### 示例数据

首次启动会自动插入 5 个示例商品：
1. 可口可乐 330ml (6901028075831)
2. 农夫山泉 550ml (6925303730086)
3. 康师傅红烧牛肉面 (6902083895488)
4. 奥利奥饼干 (6921168509225)
5. 测试商品 (123456789)

### 数据库文件位置

`backend/smartmart.db` (SQLite 数据库文件)

## 🌐 局域网访问

### 1. 查找本机 IP

```powershell
# Windows
ipconfig
# 查找 "IPv4 地址"

# Linux/Mac
ifconfig
# 或
ip addr show
```

### 2. 使用局域网 IP 启动

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 从其他设备访问

```
http://<你的局域网IP>:8000/docs
ws://<你的局域网IP>:8000/ws
```

例如: `http://192.168.1.100:8000/docs`

## 🐛 常见问题

### Q1: 端口被占用

```powershell
# 查找占用 8000 端口的进程
netstat -ano | findstr :8000

# 杀死进程
taskkill /PID <进程ID> /F

# 或使用其他端口
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Q2: 虚拟环境激活失败

```powershell
# PowerShell 执行策略限制
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q3: 导入 CSV 失败

确保：
- CSV 文件编码为 UTF-8
- 第一行是 `barcode,name,price`
- 价格是数字格式（不带货币符号）

### Q4: WebSocket 连接断开

- 检查防火墙设置
- 确认客户端使用 `ws://` 而不是 `wss://`
- 查看服务端日志

## 📝 API 文档

启动服务后访问 http://localhost:8000/docs 查看完整 API 文档。

## 🔄 重置数据库

```powershell
# 删除数据库文件
Remove-Item smartmart.db

# 重新启动服务（会自动创建新数据库）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```


