// 将原来的 App.tsx 内容移到这里，作为收银页面
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, getApiBaseUrl, getWsUrl, DEVICE_ID } from "../config";
import "./Cashier.css";

interface Product {
  sku_id: number;
  barcode: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem extends Product {
  quantity: number;
}

const CART_STORAGE_KEY = 'smartmart_cart_draft';
const REVOKE_CART_KEY = 'smartmart_revoke_cart';

const Cashier = () => {
  // 标记是否已处理撤销数据（防止 React 严格模式下双重处理）
  const revokeProcessedRef = useRef(false);
  
  // 从 localStorage 恢复购物车草稿（撤销订单商品在 useEffect 中处理）
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      // 恢复购物车草稿
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📦 恢复购物车草稿:', parsed.length, '件商品');
        return parsed;
      }
    } catch (e) {
      console.error('恢复购物车失败:', e);
    }
    return [];
  });
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);
  const [connected, setConnected] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  
  // 手动输入框扫码检测
  const lastManualInputTime = useRef<number>(0);
  const manualInputBuffer = useRef<string>('');
  const manualScanTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 搜索结果选择
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Toast 通知
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error' | 'warning'} | null>(null);

  // 订单确认弹窗
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 手动添加商品弹窗
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [manualName, setManualName] = useState('');

  // 处理撤销订单商品（在 useEffect 中处理，防止 React 严格模式下重复处理）
  useEffect(() => {
    // 如果已经处理过，不再处理
    if (revokeProcessedRef.current) {
      return;
    }
    
    try {
      const revokedItems = localStorage.getItem(REVOKE_CART_KEY);
      if (revokedItems) {
        const parsed = JSON.parse(revokedItems);
        console.log('↩️ 恢复撤销订单商品:', parsed.length, '件商品');
        
        // 标记已处理
        revokeProcessedRef.current = true;
        
        // 清除撤销数据
        localStorage.removeItem(REVOKE_CART_KEY);
        
        // 转换为购物车格式并设置
        const cartItems = parsed.map((item: any) => ({
          sku_id: item.product_id,
          barcode: item.barcode,
          name: item.name,
          price: item.price,
          stock: item.stock || 999,
          quantity: item.quantity
        }));
        
        setCart(cartItems);
        
        // 计算总商品数量
        const totalQty = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        
        // 延迟显示通知，确保组件已完全渲染
        setTimeout(() => {
          setToast({ 
            message: `↩️ 订单已撤销，${totalQty} 件商品已恢复到购物车`, 
            type: 'success' 
          });
          setTimeout(() => setToast(null), 4000);
        }, 100);
      }
    } catch (e) {
      console.error('恢复撤销订单商品失败:', e);
    }
  }, []);

  // 购物车变化时保存到 localStorage
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      console.log('💾 购物车草稿已保存:', cart.length, '件商品');
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cart]);

  // 自动聚焦隐藏输入框（仅在不使用手动输入时）
  useEffect(() => {
    const focusInput = (e: MouseEvent) => {
      // 如果点击的是手动输入框，不要抢占焦点
      const target = e.target as HTMLElement;
      if (target.classList.contains('manual-barcode-input')) {
        return;
      }
      inputRef.current?.focus();
    };
    
    // 初始聚焦到隐藏输入框
    inputRef.current?.focus();
    window.addEventListener("click", focusInput);
    
    return () => {
      window.removeEventListener("click", focusInput);
    };
  }, []);

  // WebSocket 连接和重连
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connectWebSocket = () => {
    // 如果已经有连接，先关闭
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const websocket = new WebSocket(getWsUrl());
    
    websocket.onopen = () => {
      console.log("✅ WebSocket 已连接");
      setConnected(true);
      reconnectAttempts.current = 0; // 重置重连次数
      
      websocket.send(JSON.stringify({
        type: "REGISTER",
        device_id: DEVICE_ID,
        device_type: "desktop",
        ts: Date.now()
      }));
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📨 收到消息:", data);
      
      if (data.type === "PRODUCT_FOUND") {
        const product: Product = {
          sku_id: data.sku_id,
          barcode: data.code,
          name: data.name,
          price: data.price,
          stock: data.stock || 0
        };
        addToCart(product);
      }
      
      if (data.type === "PRODUCT_NOT_FOUND") {
        showNotification(`商品未找到: ${data.code}`, "error");
      }
      
      if (data.type === "ADD_ITEM_SUCCESS") {
        const product: Product = {
          sku_id: data.sku_id,
          barcode: data.barcode,
          name: data.name,
          price: data.price,
          stock: 999
        };
        
        const qty = data.qty || 1;
        for (let i = 0; i < qty; i++) {
          addToCart(product);
        }
        
        // 根据来源显示不同的消息
        const source = data.source || 'unknown';
        if (source === 'order_revoke') {
          showNotification(`↩️ 撤销订单恢复: ${product.name} x${qty}`, "success");
        } else {
          showNotification(`外观识别添加: ${product.name} x${qty}`, "success");
        }
      }
    };
    
    websocket.onerror = (error) => {
      console.error("❌ WebSocket 错误:", error);
    };
    
    websocket.onclose = () => {
      console.log("❌ WebSocket 已断开");
      setConnected(false);
      wsRef.current = null;
      
      // 自动重连（不刷新页面）
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // 指数退避，最大30秒
        console.log(`🔄 ${delay/1000}秒后尝试重连... (第 ${reconnectAttempts.current + 1} 次)`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
      } else {
        console.error("❌ WebSocket 重连失败次数过多，请刷新页面");
      }
    };
    
    wsRef.current = websocket;
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      // 清理定时器
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // 关闭连接
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 扫码枪监听 + Enter 提交订单
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // 如果有弹窗打开，不处理
      if (showSearchModal || showConfirmModal) {
        return;
      }
      
      // 如果焦点在输入框中（手动输入框），不处理全局 Enter
      const activeElement = document.activeElement;
      const isInManualInput = activeElement?.classList.contains('manual-barcode-input');
      
      if (e.key === "Enter") {
        if (scanBuffer.trim()) {
          // 有扫码缓冲区，处理扫码
          console.log("🔍 扫描条码:", scanBuffer);
          setScanning(true);
          handleScan(scanBuffer.trim());
          setScanBuffer("");
          setTimeout(() => setScanning(false), 500);
        } else if (!isInManualInput && cart.length > 0) {
          // 没有扫码缓冲区，不在手动输入框中，且购物车有商品 → 弹出确认
          e.preventDefault();
          setShowConfirmModal(true);
        }
        return;
      }
      
      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        if (now - lastScanTime > 300) {
          setScanBuffer(e.key);
        } else {
          setScanBuffer(prev => prev + e.key);
        }
        setLastScanTime(now);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [scanBuffer, lastScanTime, cart.length, showSearchModal, showConfirmModal]);

  // 确认弹窗的键盘事件
  useEffect(() => {
    if (!showConfirmModal) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowConfirmModal(false);
        submitOrder();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmModal(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal]);

  const handleScan = async (query: string) => {
    try {
      const response = await apiFetch(
        `/products/search?q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.type === 'exact' && data.products.length === 1) {
          // 精确匹配（条码），直接添加
          const productData = data.products[0];
          const product: Product = {
            sku_id: productData.sku_id,
            barcode: productData.barcode,
            name: productData.name,
            price: productData.price,
            stock: productData.stock
          };
          addToCart(product);
          showNotification(`已添加: ${product.name}`, "success");
        } else if (data.type === 'fuzzy' && data.products.length > 0) {
          // 模糊匹配（名称），无论几个结果都弹选择框让用户确认
          const products: Product[] = data.products.map((p: any) => ({
            sku_id: p.sku_id,
            barcode: p.barcode,
            name: p.name,
            price: p.price,
            stock: p.stock
          }));
          setSearchResults(products);
          setSearchQuery(query);
          setShowSearchModal(true);
        }
      } else {
        showNotification(`未找到商品: ${query}`, "error");
      }
    } catch (error) {
      console.error("❌ 查询商品失败:", error);
      showNotification("查询失败，请检查网络连接", "error");
    }
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.barcode === product.barcode);
      if (existing) {
        return prevCart.map((item) =>
          item.barcode === product.barcode
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (barcode: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.barcode === barcode) {
          const newQuantity = Math.max(0, item.quantity + delta);  // 允许减到0
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(item => item.quantity > 0);  // 过滤掉数量为0的商品
    });
  };

  const deleteSelected = () => {
    if (selectedRows.size === 0) {
      showNotification("请先选择要删除的商品", "warning");
      return;
    }
    
    setCart(prevCart => prevCart.filter(item => !selectedRows.has(item.barcode)));
    setSelectedRows(new Set());
    showNotification(`已删除 ${selectedRows.size} 个商品`, "success");
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    
    if (window.confirm(`确定清空购物车？（共 ${cart.length} 件商品）`)) {
      setCart([]);
      setSelectedRows(new Set());
      showNotification("购物车已清空", "success");
    }
  };

  const undoLast = () => {
    if (cart.length === 0) return;
    
    setCart(prevCart => prevCart.slice(0, -1));
    showNotification("已撤销上一步", "success");
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      showNotification("购物车为空", "warning");
      return;
    }

    const items = cart.map((item) => ({
      product_id: item.sku_id,
      barcode: item.barcode,
      name: item.name,  // 传递商品名称（称重商品需要）
      quantity: item.quantity,
      price: item.price
    }));

    const totalAmount = getTotalAmount();

    try {
      const response = await apiFetch('/orders/create', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          total_amount: totalAmount,
          cashier: "收银员01"
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showNotification(
          `订单提交成功！\n订单号: ${result.order_no}\n总额: ¥${result.total_amount.toFixed(2)}`,
          "success"
        );
        setCart([]);
        setSelectedRows(new Set());
      } else {
        const error = await response.json();
        showNotification(`提交失败: ${error.detail || "未知错误"}`, "error");
      }
    } catch (error) {
      console.error("❌ 提交订单失败:", error);
      showNotification("提交失败，请检查网络连接", "error");
    }
  };

  const toggleRowSelection = (barcode: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(barcode)) {
        newSet.delete(barcode);
      } else {
        newSet.add(barcode);
      }
      return newSet;
    });
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const showNotification = (message: string, type: "success" | "error" | "warning") => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 显示 Toast 通知
    setToast({ message, type });
    
    // 自动隐藏（成功3秒，错误5秒）
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => setToast(null), duration);
  };

  const handleManualInput = () => {
    if (!manualBarcode.trim()) {
      showNotification("请输入条码", "warning");
      return;
    }
    
    handleScan(manualBarcode.trim());
    setManualBarcode("");
    manualInputBuffer.current = '';
  };

  // 处理手动输入框的输入变化（支持扫码检测）
  const handleManualInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeDiff = now - lastManualInputTime.current;
    
    // 扫码枪特征：输入速度非常快（每个字符间隔 < 50ms）
    const isScannerInput = timeDiff < 50 && timeDiff > 0;
    
    if (isScannerInput) {
      // 检测到扫码枪输入，累积到缓冲区
      manualInputBuffer.current += newValue.slice(-1);
    } else {
      // 普通键盘输入，重置缓冲区
      manualInputBuffer.current = newValue;
    }
    
    lastManualInputTime.current = now;
    
    // 清除之前的超时
    if (manualScanTimeout.current) {
      clearTimeout(manualScanTimeout.current);
    }
    
    // 设置超时检测扫码完成
    manualScanTimeout.current = setTimeout(() => {
      // 如果缓冲区内容和输入值不同，说明有混合输入
      if (manualInputBuffer.current !== newValue && manualInputBuffer.current.length >= 8) {
        // 可能是条码（条码通常8位以上），用缓冲区内容替换
        setManualBarcode(manualInputBuffer.current);
      }
      manualInputBuffer.current = '';
    }, 300);
    
    setManualBarcode(newValue);
  }, []);

  // 处理手动输入框的按键事件
  const handleManualKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // 清除扫码检测超时
      if (manualScanTimeout.current) {
        clearTimeout(manualScanTimeout.current);
      }
      
      // 检查是否是扫码枪输入（缓冲区有内容且长度>=8）
      if (manualInputBuffer.current.length >= 8) {
        // 是扫码输入，用缓冲区内容替换并搜索
        const scannedBarcode = manualInputBuffer.current;
        manualInputBuffer.current = '';
        setManualBarcode('');
        handleScan(scannedBarcode);
      } else {
        // 普通输入，正常处理
        handleManualInput();
      }
    }
  }, [manualBarcode]);

  // 从搜索结果中选择商品
  const handleSelectProduct = (product: Product) => {
    addToCart(product);
    showNotification(`已添加: ${product.name}`, "success");
    setShowSearchModal(false);
    setSearchResults([]);
  };

  // 手动添加：直接输入价格添加到购物车
  const handleManualAddToCart = () => {
    const price = parseFloat(manualPrice);
    if (isNaN(price) || price <= 0) {
      showNotification('请输入有效的价格', 'warning');
      return;
    }

    const name = manualName.trim() || '称重商品';
    const uniqueBarcode = `manual_${Date.now()}`;

    const newItem: CartItem = {
      sku_id: 0,
      barcode: uniqueBarcode,
      name: name,
      price: price,
      stock: 999,
      quantity: 1
    };

    setCart((prevCart) => [...prevCart, newItem]);
    showNotification(`已添加: ${name} ¥${price.toFixed(2)}`, 'success');
    
    // 重置并关闭
    setManualPrice('');
    setManualName('');
    setShowManualAddModal(false);
  };

  // 关闭手动添加弹窗
  const closeManualAddModal = () => {
    setShowManualAddModal(false);
    setManualPrice('');
    setManualName('');
  };

  const totalAmount = getTotalAmount();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="cashier-page">
      {/* Toast 通知 */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        className="hidden-input"
        value={scanBuffer}
        onChange={() => {}}
        autoFocus
      />

      <div className="page-header">
        <div className="header-left">
          <div>
            <h1>💰 收银台</h1>
            <p className="page-subtitle">扫描商品条码或输入条码/名称搜索</p>
          </div>
          
          {/* 手动输入区域 */}
          <div className="manual-input-section">
            <input
              ref={manualInputRef}
              type="text"
              className="manual-barcode-input"
              placeholder="输入条码或商品名称，支持扫码枪..."
              value={manualBarcode}
              onChange={handleManualInputChange}
              onKeyDown={handleManualKeyDown}
              onClick={(e) => {
                e.stopPropagation();
                manualInputRef.current?.focus();
              }}
            />
            <button className="btn btn-primary" onClick={handleManualInput}>
              🔍 查询
            </button>
            <button className="btn btn-secondary" onClick={() => setShowManualAddModal(true)}>
              ➕ 手动添加
            </button>
          </div>
        </div>
        
        <div className="status-bar">
          <div className={`status-indicator ${connected ? "connected" : "disconnected"}`}>
            <span className="status-dot"></span>
            <span className="status-text">{connected ? "已连接" : "未连接"}</span>
          </div>
          {scanning && <span className="scanning-indicator">🔍 扫描中...</span>}
        </div>
      </div>

      <div className="cashier-content">
        {/* 左侧：商品列表 */}
        <div className="cart-section">
          <div className="cart-header">
            <h2>🛒 购物车</h2>
            <span className="cart-count">{totalItems} 件商品</span>
          </div>
          
          {cart.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">🛒</div>
              <p>购物车为空</p>
              <p className="hint">请使用扫码枪扫描商品条码</p>
            </div>
          ) : (
            <div className="cart-grid">
              {cart.map((item, index) => (
                <div 
                  key={item.barcode} 
                  className={`cart-card ${selectedRows.has(item.barcode) ? 'selected' : ''}`}
                  onClick={() => toggleRowSelection(item.barcode)}
                >
                  <div className="card-header">
                    <span className="card-index">{index + 1}</span>
                    <input
                      type="checkbox"
                      className="card-checkbox"
                      checked={selectedRows.has(item.barcode)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="card-info">
                    <div className="card-name" title={item.name}>{item.name}</div>
                    <div className="card-price">¥{item.price.toFixed(2)}</div>
                  </div>
                  <div className="card-bottom">
                    <div className="card-quantity">
                      <button
                        className="qty-btn"
                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.barcode, -1); }}
                      >
                        −
                      </button>
                      <span className="quantity">{item.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.barcode, 1); }}
                      >
                        +
                      </button>
                    </div>
                    <div className="card-subtotal">¥{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：结算面板 */}
        <div className="checkout-panel">
          <div className="checkout-summary">
            <div className="summary-title">订单汇总</div>
            <div className="summary-details">
              <div className="summary-item">
                <span>商品种类</span>
                <span>{cart.length} 种</span>
              </div>
              <div className="summary-item">
                <span>商品数量</span>
                <span>{totalItems} 件</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-total">
                <span>合计</span>
                <span className="total-price">¥{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="checkout-actions">
            <button
              className="btn btn-checkout"
              onClick={() => setShowConfirmModal(true)}
              disabled={cart.length === 0}
            >
              💳 结算
            </button>
            
            <div className="secondary-actions">
              <button
                className="btn btn-secondary"
                onClick={undoLast}
                disabled={cart.length === 0}
                title="撤销上一步"
              >
                ↩️ 撤销
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearCart}
                disabled={cart.length === 0}
                title="清空购物车"
              >
                🗑️ 清空
              </button>
            </div>
            
            <button
              className="btn btn-danger-outline"
              onClick={deleteSelected}
              disabled={selectedRows.size === 0}
            >
              删除选中 ({selectedRows.size})
            </button>
          </div>
        </div>
      </div>

      {/* 商品选择弹窗 */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal-content search-results-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔍 请选择商品</h2>
            <p className="search-hint">搜索 "{searchQuery}" 找到 {searchResults.length} 个商品：</p>
            
            <div className="search-results-list">
              {searchResults.map((product) => (
                <div
                  key={product.barcode}
                  className="search-result-item"
                  onClick={() => handleSelectProduct(product)}
                >
                  <div className="result-info">
                    <div className="result-name">{product.name}</div>
                    <div className="result-barcode">{product.barcode}</div>
                  </div>
                  <div className="result-details">
                    <span className="result-price">¥{product.price.toFixed(2)}</span>
                    <span className="result-stock">库存: {product.stock}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSearchModal(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 订单确认弹窗 */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <span className="confirm-icon">🧾</span>
              <h2>确认提交订单？</h2>
            </div>
            
            <div className="confirm-summary">
              <div className="summary-row">
                <span className="summary-label">商品数量</span>
                <span className="summary-value">{totalItems} 件</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">商品种类</span>
                <span className="summary-value">{cart.length} 种</span>
              </div>
              <div className="summary-row total">
                <span className="summary-label">订单总额</span>
                <span className="summary-value">¥{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="confirm-hint">
              <span className="hint-icon">⌨️</span>
              <span>按 <kbd>Enter</kbd> 确认提交，按 <kbd>Esc</kbd> 取消</span>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowConfirmModal(false)}
              >
                取消 (Esc)
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowConfirmModal(false);
                  submitOrder();
                }}
              >
                确认提交 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手动添加商品弹窗 - 直接输入价格 */}
      {showManualAddModal && (
        <div className="modal-overlay" onClick={closeManualAddModal}>
          <div className="modal-content manual-add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚖️ 称重商品</h2>
              <button className="modal-close-btn" onClick={closeManualAddModal}>×</button>
            </div>

            <div className="manual-add-form">
              <div className="form-group price-input-group">
                <label>金额（必填）</label>
                <div className="price-input-wrapper">
                  <span className="currency-symbol">¥</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualAddToCart()}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label>名称（选填）</label>
                <input
                  type="text"
                  placeholder="如：鸡蛋、苹果..."
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualAddToCart()}
                />
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={closeManualAddModal}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={handleManualAddToCart}>
                  ✓ 添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cashier;

