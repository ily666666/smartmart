import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getApiBaseUrl } from '../config';
import './Products.css';

interface Product {
  id: number;
  barcode: string;
  name: string;
  category: string;
  price: number;
  cost_price?: number;
  stock: number;
  image_url?: string;
  created_at?: string;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // 分类相关
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // 计算每页显示数量（根据屏幕高度自适应）
  const calculatePageSize = useCallback(() => {
    // 页面各部分的高度估算（像素）
    const headerHeight = 80;       // 页面标题
    const scanBarHeight = 50;      // 扫码状态栏
    const searchBarHeight = 120;   // 搜索区域
    const statsHeight = 50;        // 商品统计
    const listHeaderHeight = 50;   // 列表表头
    const paginationHeight = 80;   // 分页控件
    const padding = 100;           // 各种边距
    const rowHeight = 72;          // 每行商品高度（含缩略图）
    
    const windowHeight = window.innerHeight;
    const availableHeight = windowHeight - headerHeight - scanBarHeight - searchBarHeight 
                           - statsHeight - listHeaderHeight - paginationHeight - padding;
    
    // 计算能显示的行数，最少5行，最多15行
    const calculatedSize = Math.floor(availableHeight / rowHeight);
    const newPageSize = Math.max(5, Math.min(15, calculatedSize));
    
    return newPageSize;
  }, []);

  // 分页相关 - 使用计算函数获取初始值
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(() => calculatePageSize()); // 直接用计算值初始化
  const [pageSizeReady, setPageSizeReady] = useState(false); // 标记 pageSize 是否已初始化

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const newSize = calculatePageSize();
      if (newSize !== pageSize) {
        setPageSize(newSize);
        setCurrentPage(1);
      }
    };
    
    // 标记初始化完成
    setPageSizeReady(true);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePageSize, pageSize]);
  
  const [newProduct, setNewProduct] = useState({
    barcode: '',
    name: '',
    category: '其他',
    price: 0,
    cost_price: 0,
    stock: 0,
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 扫码枪相关
  const [scanBuffer, setScanBuffer] = useState('');
  const [scanStatus, setScanStatus] = useState('等待扫码...');
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 搜索框扫码检测
  const lastSearchInputTime = useRef<number>(0);
  const searchInputBuffer = useRef<string>('');
  const searchScanTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 扫码搜索并处理结果
  const handleScanSearch = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;
    
    setScanStatus(`搜索: ${barcode}`);
    setSearchQuery(barcode);
    setLoading(true);
    
    try {
      // 使用搜索接口查找商品
      const response = await apiFetch(
        `/products/search?q=${encodeURIComponent(barcode)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const productList = data.products.map((item: any) => ({
          id: item.sku_id,
          barcode: item.barcode,
          name: item.name,
          category: item.category || '其他',
          price: item.price,
          cost_price: item.cost_price,
          stock: item.stock,
          image_url: item.image_url,
        }));
        
        if (productList.length > 0) {
          // 找到商品，显示在列表中
          setProducts(productList);
          setScanStatus(`✓ 找到 ${productList.length} 个商品`);
        } else {
          // 没找到商品，自动弹出添加弹窗并填入条码
          setProducts([]);
          setScanStatus(`✗ 未找到商品，请添加`);
          setNewProduct(prev => ({
            ...prev,
            barcode: barcode,
            name: '',
            price: 0,
            stock: 0,
          }));
          setShowAddModal(true);
        }
      } else {
        // 请求失败，也弹出添加弹窗
        setProducts([]);
        setScanStatus(`✗ 未找到商品，请添加`);
        setNewProduct(prev => ({
          ...prev,
          barcode: barcode,
          name: '',
          price: 0,
          stock: 0,
        }));
        setShowAddModal(true);
      }
    } catch (error) {
      console.error('扫码查询失败:', error);
      setScanStatus('查询失败');
    } finally {
      setLoading(false);
      // 3秒后恢复等待状态
      setTimeout(() => setScanStatus('等待扫码...'), 3000);
    }
  }, []);

  // 处理扫码枪输入
  const handleScanInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScanBuffer(value);
    
    // 清除之前的超时
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // 设置超时，300ms无输入则认为扫码完成
    scanTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        handleScanSearch(value.trim());
        setScanBuffer('');
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = '';
        }
      }
    }, 300);
  }, [handleScanSearch]);

  // 处理扫码回车键
  const handleScanKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 清除超时
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      
      const value = scanBuffer.trim();
      if (value) {
        handleScanSearch(value);
        setScanBuffer('');
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = '';
        }
      }
    }
  }, [scanBuffer, handleScanSearch]);

  // 处理搜索框输入（支持扫码检测）
  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeDiff = now - lastSearchInputTime.current;
    
    // 扫码枪特征：输入速度非常快（每个字符间隔 < 50ms）
    const isScannerInput = timeDiff < 50 && timeDiff > 0;
    
    if (isScannerInput) {
      // 检测到扫码枪输入，累积到缓冲区
      searchInputBuffer.current += newValue.slice(-1); // 只取最后一个字符
    } else {
      // 普通键盘输入，重置缓冲区
      searchInputBuffer.current = newValue;
    }
    
    lastSearchInputTime.current = now;
    
    // 清除之前的超时
    if (searchScanTimeout.current) {
      clearTimeout(searchScanTimeout.current);
    }
    
    // 设置超时检测扫码完成
    searchScanTimeout.current = setTimeout(() => {
      // 如果缓冲区内容和输入值不同，说明有混合输入
      // 只保留最后扫描的条码部分
      if (searchInputBuffer.current !== newValue && searchInputBuffer.current.length >= 8) {
        // 可能是条码（条码通常8位以上），用缓冲区内容替换
        setSearchQuery(searchInputBuffer.current);
      }
      searchInputBuffer.current = '';
    }, 300);
    
    setSearchQuery(newValue);
  }, []);

  // 处理搜索框回车键 - 设置标志触发搜索
  const [triggerSearch, setTriggerSearch] = useState(0);
  
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // 清除扫码检测超时
      if (searchScanTimeout.current) {
        clearTimeout(searchScanTimeout.current);
      }
      
      // 检查是否是扫码枪输入（缓冲区有内容且长度>=8）
      if (searchInputBuffer.current.length >= 8) {
        // 是扫码输入，用缓冲区内容替换搜索框
        setSearchQuery(searchInputBuffer.current);
      }
      searchInputBuffer.current = '';
      // 触发搜索
      setTriggerSearch(prev => prev + 1);
    }
  };

  // 保持隐藏输入框焦点（仅在安全时）
  const focusHiddenInput = useCallback(() => {
    // 检查当前焦点是否在其他输入框中
    const activeElement = document.activeElement;
    const isInInput = activeElement?.tagName === 'INPUT' || 
                      activeElement?.tagName === 'TEXTAREA' ||
                      activeElement?.tagName === 'SELECT';
    
    // 只有在没有弹窗打开且不在其他输入框中时才聚焦隐藏输入框
    if (!showAddModal && !showEditModal && !showDetailModal && !isInInput && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [showAddModal, showEditModal, showDetailModal]);

  // 初始化和焦点管理
  useEffect(() => {
    // 初次加载时聚焦
    focusHiddenInput();
    
    // 点击页面空白区域时重新聚焦扫码输入框
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 如果点击的是任何输入元素，不要切换焦点
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.closest('.modal-overlay') ||
          target.closest('.search-bar')) {
        return;
      }
      
      // 点击空白区域时，延迟聚焦隐藏输入框
      setTimeout(focusHiddenInput, 200);
    };
    
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [focusHiddenInput]);

  // 弹窗关闭后重新聚焦
  useEffect(() => {
    if (!showAddModal && !showEditModal && !showDetailModal) {
      setTimeout(focusHiddenInput, 300);
    }
  }, [showAddModal, showEditModal, showDetailModal, focusHiddenInput]);

  useEffect(() => {
    // 加载分类列表
    loadCategories();
    // 商品加载由下面的 useEffect 处理（等待 pageSizeReady）
  }, []);

  // 分类或每页数量变化时重新加载商品
  useEffect(() => {
    if (pageSizeReady) {
      loadAllProducts(1); // 重置到第一页
    }
  }, [selectedCategory, pageSize, pageSizeReady]);

  const loadCategories = async () => {
    try {
      const response = await apiFetch('/products/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const loadAllProducts = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const skip = (page - 1) * pageSize;
      let path = `/products/?skip=${skip}&limit=${pageSize}`;
      if (selectedCategory) {
        path += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      
      const response = await apiFetch(path);
      
      if (response.ok) {
        const data = await response.json();
        const productList = data.products.map((item: any) => ({
          id: item.sku_id,
          barcode: item.barcode,
          name: item.name,
          category: item.category || '其他',
          price: item.price,
          cost_price: item.cost_price,
          stock: item.stock,
          image_url: item.image_url,
        }));
        setProducts(productList);
        setTotalCount(data.total);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('加载商品列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 分页计算
  const totalPages = Math.ceil(totalCount / pageSize);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadAllProducts(page);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // 如果搜索框为空，显示所有商品
      loadAllProducts();
      return;
    }

    setLoading(true);
    try {
      // 使用新的搜索接口（支持条码和名称）
      const response = await apiFetch(
        `/products/search?q=${encodeURIComponent(searchQuery)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const productList = data.products.map((item: any) => ({
          id: item.sku_id,
          barcode: item.barcode,
          name: item.name,
          category: item.category || '其他',
          price: item.price,
          cost_price: item.cost_price,
          stock: item.stock,
          image_url: item.image_url,
        }));
        setProducts(productList);
      } else {
        setProducts([]);
        alert(`未找到商品: ${searchQuery}`);
      }
    } catch (error) {
      console.error('查询失败:', error);
      alert('查询失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 响应搜索触发
  useEffect(() => {
    if (triggerSearch > 0) {
      handleSearch();
    }
  }, [triggerSearch]);

  const handleAddProduct = async () => {
    if (!newProduct.barcode || !newProduct.name || newProduct.price <= 0) {
      alert('请填写完整的商品信息');
      return;
    }

    try {
      // 如果有图片，先上传图片获取URL
      let uploadedImageUrl: string | undefined = undefined;
      if (selectedImage) {
        const imageFormData = new FormData();
        imageFormData.append('file', selectedImage);
        const uploadResponse = await apiFetch('/products/upload_image', {
          method: 'POST',
          body: imageFormData,
        });
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedImageUrl = uploadData.image_url;
        } else {
          throw new Error('图片上传失败');
        }
      }

      // 创建商品
      const params = new URLSearchParams({
        barcode: newProduct.barcode,
        name: newProduct.name,
        category: newProduct.category,
        price: newProduct.price.toString(),
        stock: newProduct.stock.toString(),
      });
      if (newProduct.cost_price && newProduct.cost_price > 0) {
        params.append('cost_price', newProduct.cost_price.toString());
      }
      if (uploadedImageUrl) {
        params.append('image_url', uploadedImageUrl);
      }

      const response = await apiFetch('/products/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (response.ok) {
        alert('商品添加成功！');
        setShowAddModal(false);
        setNewProduct({ barcode: '', name: '', category: '其他', price: 0, cost_price: 0, stock: 0 });
        setSelectedImage(null);
        setImagePreview(null);
        // 刷新列表
        loadAllProducts();
      } else {
        const error = await response.json();
        alert(`添加失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('添加商品失败:', error);
      alert('添加失败，请检查网络连接');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      
      // 生成预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowEditModal(true);
    // 显示现有图片
    if (product.image_url) {
      setImagePreview(`${getApiBaseUrl()}${product.image_url}`);
    }
  };

  const handleDeleteProduct = async (productId: number, productName: string) => {
    // 确认删除
    const confirmed = window.confirm(
      `确定要删除商品"${productName}"吗？\n\n此操作不可撤销！`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/products/${productId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('商品删除成功！');
        setShowDetailModal(false);
        setViewingProduct(null);
        // 刷新列表
        loadAllProducts();
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除商品失败:', error);
      alert('删除失败，请检查网络连接');
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    if (!editingProduct.barcode || !editingProduct.name || editingProduct.price <= 0) {
      alert('请填写完整的商品信息');
      return;
    }

    try {
      // 如果有新图片，先上传图片获取URL
      let uploadedImageUrl = editingProduct.image_url;
      if (selectedImage) {
        const imageFormData = new FormData();
        imageFormData.append('file', selectedImage);
        const uploadResponse = await apiFetch('/products/upload_image', {
          method: 'POST',
          body: imageFormData,
        });
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedImageUrl = uploadData.image_url;
        } else {
          throw new Error('图片上传失败');
        }
      }

      // 更新商品信息
      const formData = new FormData();
      formData.append('barcode', editingProduct.barcode);
      formData.append('name', editingProduct.name);
      formData.append('category', editingProduct.category || '其他');
      formData.append('price', editingProduct.price.toString());
      if (editingProduct.cost_price !== undefined && editingProduct.cost_price !== null) {
        formData.append('cost_price', editingProduct.cost_price.toString());
      }
      formData.append('stock', editingProduct.stock.toString());
      if (uploadedImageUrl) {
        formData.append('image_url', uploadedImageUrl);
      }

      const response = await apiFetch(`/products/${editingProduct.id}`, {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        alert('商品更新成功！');
        setShowEditModal(false);
        setEditingProduct(null);
        setSelectedImage(null);
        setImagePreview(null);
        // 刷新列表
        loadAllProducts();
      } else {
        const error = await response.json();
        alert(`更新失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新商品失败:', error);
      alert('更新失败，请检查网络连接');
    }
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await apiFetch('/products/import_csv', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          alert(`成功导入 ${result.imported_count} 个商品！`);
        } else {
          const error = await response.json();
          alert(`导入失败: ${error.detail || '未知错误'}`);
        }
      } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败，请检查网络连接');
      }
    };
    input.click();
  };

  return (
    <div className="products-page">
      {/* 隐藏的扫码输入框 - 用于捕获扫码枪输入 */}
      <input
        ref={hiddenInputRef}
        type="text"
        value={scanBuffer}
        onChange={handleScanInput}
        onKeyDown={handleScanKeyDown}
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      <div className="page-header">
        <h1>📦 商品管理</h1>
        <p className="page-subtitle">查询、添加和管理商品信息</p>
      </div>

      {/* 搜索栏 */}
      <div className="search-section">
        <div className="search-bar">
          <select
            className="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">全部分类</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="text"
            className="search-input"
            placeholder="输入条码或商品名称进行搜索，支持扫码枪..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? '搜索中...' : '🔍 搜索'}
          </button>
          {/* 扫码状态提示 - 集成在搜索栏 */}
          <div className="scan-status-inline">
            <span className="scan-icon">📷</span>
            <span className="scan-status">{scanStatus}</span>
            {scanBuffer && (
              <span className="scan-buffer">| {scanBuffer}</span>
            )}
          </div>
        </div>
        
        <div className="action-buttons">
          <button className="btn btn-success" onClick={() => setShowAddModal(true)}>
            ➕ 添加商品
          </button>
          <button className="btn btn-secondary" onClick={handleImportCSV}>
            📁 批量导入
          </button>
        </div>
      </div>

      {/* 商品列表 */}
      <div className="products-section">
      {products.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p>暂无商品数据</p>
          <p className="hint">请添加商品或导入 CSV 文件</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: '16px' }}>
            ➕ 立即添加
          </button>
        </div>
      )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>搜索中...</p>
          </div>
        )}

        {products.length > 0 && (
          <>
            {/* 分页工具栏 - 放在列表上方 */}
            <div className="pagination-toolbar">
              <div className="pagination-info">
                <span className="total-badge">📦 共 <strong>{totalCount}</strong> 件</span>
                <span className="current-page-count">本页 <strong>{products.length}</strong> 件</span>
                {totalPages > 1 && (
                  <span className="page-info">第 {currentPage} / {totalPages} 页</span>
                )}
              </div>
              
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button 
                    className="page-arrow"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    title="首页"
                  >
                    ⏮
                  </button>
                  <button 
                    className="page-arrow"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="上一页"
                  >
                    ◀
                  </button>
                  
                  <div className="page-numbers">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    className="page-arrow"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="下一页"
                  >
                    ▶
                  </button>
                  <button 
                    className="page-arrow"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    title="末页"
                  >
                    ⏭
                  </button>
                </div>
              )}
            </div>

            <div className="products-list">
              <div className="list-header">
                <span className="col-index">#</span>
                <span className="col-thumb">图片</span>
                <span className="col-name">商品名称</span>
                <span className="col-category">分类</span>
                <span className="col-barcode">条码</span>
                <span className="col-price">价格</span>
                <span className="col-stock">库存</span>
                <span className="col-action">操作</span>
              </div>
              {products.map((product, index) => (
                <div 
                  key={product.id} 
                  className="product-row"
                  onClick={() => {
                    setViewingProduct(product);
                    setShowDetailModal(true);
                  }}
                >
                  <span className="col-index">{(currentPage - 1) * pageSize + index + 1}</span>
                  <span className="col-thumb">
                    {product.image_url ? (
                      <img 
                        src={`${getApiBaseUrl()}${product.image_url}`} 
                        alt={product.name}
                        className="product-thumb"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={`thumb-placeholder ${product.image_url ? 'hidden' : ''}`}>📦</span>
                  </span>
                  <span className="col-name">{product.name}</span>
                  <span className="col-category">{product.category}</span>
                  <span className="col-barcode">{product.barcode}</span>
                  <span className="col-price">¥{product.price.toFixed(2)}</span>
                  <span className={`col-stock ${product.stock < 10 ? 'low' : ''}`}>
                    {product.stock}
                  </span>
                  <span className="col-action">
                    <button 
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingProduct(product);
                        setShowDetailModal(true);
                      }}
                    >
                      详情
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 编辑商品弹窗 */}
      {showEditModal && editingProduct && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>✏️ 编辑商品</h2>
            
            <div className="form-group">
              <label>商品条码 *</label>
              <input
                type="text"
                className="form-input"
                placeholder="请输入条码"
                value={editingProduct.barcode}
                onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>商品名称 *</label>
              <input
                type="text"
                className="form-input"
                placeholder="请输入商品名称"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>商品分类</label>
              <select
                className="form-input"
                value={editingProduct.category || '其他'}
                onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>售价 *</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={editingProduct.price || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>进价</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={editingProduct.cost_price || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>库存</label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                min="0"
                value={editingProduct.stock || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>商品图片（可选）</label>
              <input
                type="file"
                className="form-input"
                accept="image/*"
                onChange={handleImageSelect}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="预览" />
                  <button 
                    type="button" 
                    className="remove-image-btn"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                  >
                    ✕ 移除
                  </button>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => {
                setShowEditModal(false);
                setEditingProduct(null);
                setSelectedImage(null);
                setImagePreview(null);
              }}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleUpdateProduct}>
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加商品弹窗 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>➕ 添加新商品</h2>
            
            <div className="form-group">
              <label>商品条码 *</label>
              <input
                type="text"
                className="form-input"
                placeholder="请输入条码"
                value={newProduct.barcode}
                onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>商品名称 *</label>
              <input
                type="text"
                className="form-input"
                placeholder="请输入商品名称"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>商品分类</label>
              <select
                className="form-input"
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>售价 *</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={newProduct.price || ''}
                onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>进价</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={newProduct.cost_price || ''}
                onChange={(e) => setNewProduct({ ...newProduct, cost_price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>初始库存</label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                min="0"
                value={newProduct.stock || ''}
                onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>商品图片（可选）</label>
              <input
                type="file"
                className="form-input"
                accept="image/*"
                onChange={handleImageSelect}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="预览" />
                  <button 
                    type="button" 
                    className="remove-image-btn"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                  >
                    ✕ 移除
                  </button>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddProduct}>
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 商品详情模态框 */}
      {showDetailModal && viewingProduct && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📦 商品详情</h2>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            <div className="detail-content">
              {/* 商品图片 */}
              <div className="detail-image-section">
                {viewingProduct.image_url ? (
                  <img 
                    src={`${getApiBaseUrl()}${viewingProduct.image_url}`} 
                    alt={viewingProduct.name}
                    className="detail-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="80"%3E📦%3C/text%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="detail-no-image">
                    <div className="no-image-icon">📦</div>
                    <p>暂无图片</p>
                  </div>
                )}
              </div>

              {/* 商品信息 */}
              <div className="detail-info-section">
                <div className="detail-info-group">
                  <h3 className="detail-product-name">{viewingProduct.name}</h3>
                  <div className="detail-id">ID: {viewingProduct.id}</div>
                </div>

                <div className="detail-info-grid">
                  <div className="detail-info-item">
                    <div className="detail-label">
                      <span className="icon">🏷️</span>
                      <span>商品条码</span>
                    </div>
                    <div className="detail-value barcode">{viewingProduct.barcode}</div>
                  </div>

                  <div className="detail-info-item">
                    <div className="detail-label">
                      <span className="icon">💰</span>
                      <span>售价</span>
                    </div>
                    <div className="detail-value price">¥{viewingProduct.price.toFixed(2)}</div>
                  </div>

                  <div className="detail-info-item">
                    <div className="detail-label">
                      <span className="icon">💵</span>
                      <span>进价</span>
                    </div>
                    <div className="detail-value cost-price">
                      {viewingProduct.cost_price ? `¥${viewingProduct.cost_price.toFixed(2)}` : '未设置'}
                    </div>
                  </div>

                  <div className="detail-info-item">
                    <div className="detail-label">
                      <span className="icon">📦</span>
                      <span>当前库存</span>
                    </div>
                    <div className={`detail-value stock ${viewingProduct.stock < 10 ? 'low' : ''}`}>
                      {viewingProduct.stock} 件
                      {viewingProduct.stock < 10 && <span className="warning-badge">⚠️ 库存不足</span>}
                    </div>
                  </div>

                  {viewingProduct.created_at && (
                    <div className="detail-info-item">
                      <div className="detail-label">
                        <span className="icon">📅</span>
                        <span>创建时间</span>
                      </div>
                      <div className="detail-value">
                        {new Date(viewingProduct.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="detail-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEditProduct(viewingProduct);
                    }}
                  >
                    ✏️ 编辑商品
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteProduct(viewingProduct.id, viewingProduct.name)}
                  >
                    🗑️ 删除商品
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setShowDetailModal(false)}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

