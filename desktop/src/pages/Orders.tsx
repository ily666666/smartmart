import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../config';
import './Orders.css';

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: number;
  order_no: string;
  total_amount: number;
  status: string;
  cashier: string;
  created_at: string;
  items?: OrderItem[];
}

// 撤销订单时存储商品到 localStorage 的 key
const REVOKE_CART_KEY = 'smartmart_revoke_cart';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // 确认弹窗
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);
  
  // 计算每页显示数量（根据屏幕高度自适应）
  const calculatePageSize = useCallback(() => {
    // 页面各部分的高度估算（像素）
    const headerHeight = 80;       // 页面标题
    const filterHeight = 100;      // 筛选区域
    const statsHeight = 80;        // 订单统计
    const tableHeaderHeight = 50;  // 列表表头
    const paginationHeight = 80;   // 分页控件
    const padding = 120;           // 各种边距
    const rowHeight = 56;          // 每行订单高度
    
    const windowHeight = window.innerHeight;
    const availableHeight = windowHeight - headerHeight - filterHeight - statsHeight
                           - tableHeaderHeight - paginationHeight - padding;
    
    // 计算能显示的行数，最少5行，最多25行
    const calculatedSize = Math.floor(availableHeight / rowHeight);
    const newPageSize = Math.max(5, Math.min(25, calculatedSize));
    
    return newPageSize;
  }, []);

  // 分页相关 - 使用计算函数获取初始值
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pageSize, setPageSize] = useState(() => calculatePageSize());
  const [pageSizeReady, setPageSizeReady] = useState(false);

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
  
  // 快捷日期选中状态
  const [activeQuickDate, setActiveQuickDate] = useState<number | null>(7);
  
  // 日期范围筛选：默认显示最近7天
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // pageSize 或日期变化时重新加载
  useEffect(() => {
    if (pageSizeReady) {
      loadOrders(1);
    }
  }, [pageSize, pageSizeReady]);

  const loadOrders = async (page: number = currentPage) => {
    setLoading(true);
    try {
      let path = `/orders/list?page=${page}&page_size=${pageSize}`;
      
      if (startDate) {
        path += `&start_date=${startDate}`;
      }
      if (endDate) {
        path += `&end_date=${endDate}`;
      }
      
      const response = await apiFetch(path);
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.items);
        setTotalCount(data.total);
        setTotalAmount(data.total_amount);
        setCurrentPage(data.page);
      } else {
        console.error('获取订单列表失败');
        setOrders([]);
        setTotalCount(0);
        setTotalAmount(0);
      }
    } catch (error) {
      console.error('获取订单失败:', error);
      setOrders([]);
      setTotalCount(0);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  };

  // 分页计算
  const totalPages = Math.ceil(totalCount / pageSize);

  // 分页处理
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadOrders(newPage);
    }
  };

  const fetchOrderDetail = async (orderId: number) => {
    setDetailLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedOrder(data);
      } else {
        console.error('获取订单详情失败');
      }
    } catch (error) {
      console.error('获取订单详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    // 先显示基础信息
    setSelectedOrder(order);
    // 再加载详情（包含商品明细）
    fetchOrderDetail(order.id);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; className: string } } = {
      completed: { label: '已完成', className: 'status-completed' },
      pending: { label: '待处理', className: 'status-pending' },
      cancelled: { label: '已取消', className: 'status-cancelled' },
    };
    
    const statusInfo = statusMap[status] || { label: status, className: '' };
    return <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>;
  };

  // 执行删除订单
  const executeDeleteOrder = async (orderId: number) => {
    setActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setSelectedOrder(null);
        setConfirmModal(null);
        loadOrders(currentPage);
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除订单失败:', error);
      alert('删除失败，请检查网络连接');
    } finally {
      setActionLoading(false);
    }
  };

  // 执行撤销订单
  const executeRevokeOrder = async (orderId: number) => {
    setActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}/revoke`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 将商品信息存储到 localStorage，供收银台读取
        localStorage.setItem(REVOKE_CART_KEY, JSON.stringify(data.items));
        
        setSelectedOrder(null);
        setConfirmModal(null);
        
        // 跳转到收银台
        navigate('/cashier');
      } else {
        const error = await response.json();
        alert(`撤销失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('撤销订单失败:', error);
      alert('撤销失败，请检查网络连接');
    } finally {
      setActionLoading(false);
    }
  };

  // 删除订单（显示确认弹窗）
  const handleDeleteOrder = () => {
    if (!selectedOrder) return;
    
    setConfirmModal({
      show: true,
      title: '🗑️ 确认删除订单',
      message: `确定要删除订单 "${selectedOrder.order_no}" 吗？\n\n⚠️ 此操作不可恢复，且不会恢复库存！`,
      type: 'danger',
      onConfirm: () => executeDeleteOrder(selectedOrder.id)
    });
  };

  // 撤销订单（显示确认弹窗）
  const handleRevokeOrder = (orderId?: number, orderNo?: string) => {
    const id = orderId || selectedOrder?.id;
    const no = orderNo || selectedOrder?.order_no;
    
    if (!id) return;
    
    setConfirmModal({
      show: true,
      title: '↩️ 确认撤销订单',
      message: `确定要撤销订单 "${no}" 吗？\n\n✅ 商品库存将恢复\n✅ 商品将返回收银台继续编辑`,
      type: 'warning',
      onConfirm: () => executeRevokeOrder(id)
    });
  };

  // 删除单个订单（列表中直接操作）
  const handleDeleteSingle = (orderId: number, orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setConfirmModal({
      show: true,
      title: '🗑️ 确认删除订单',
      message: `确定要删除订单 "${orderNo}" 吗？\n\n⚠️ 此操作不可恢复，且不会恢复库存！`,
      type: 'danger',
      onConfirm: () => executeDeleteOrder(orderId)
    });
  };

  // 撤销单个订单（列表中直接操作）
  const handleRevokeSingle = (orderId: number, orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleRevokeOrder(orderId, orderNo);
  };

  // 切换选择
  const toggleSelect = (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  // 执行批量删除
  const executeBatchDelete = async () => {
    setActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const orderId of selectedIds) {
      try {
        const response = await apiFetch(`/orders/${orderId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    
    setActionLoading(false);
    setSelectedIds(new Set());
    setConfirmModal(null);
    
    if (failCount > 0) {
      alert(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`);
    }
    
    loadOrders(1);
  };

  // 批量删除（显示确认弹窗）
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的订单');
      return;
    }
    
    setConfirmModal({
      show: true,
      title: '🗑️ 确认批量删除',
      message: `确定要删除选中的 ${selectedIds.size} 个订单吗？\n\n⚠️ 此操作不可恢复，且不会恢复库存！`,
      type: 'danger',
      onConfirm: executeBatchDelete
    });
  };

  // 快捷日期选择（选择后自动查询）
  const setQuickDate = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setActiveQuickDate(days);
  };
  
  // 快速选择按钮变化时自动查询
  useEffect(() => {
    if (pageSizeReady && activeQuickDate !== null) {
      loadOrders(1);
    }
  }, [activeQuickDate]);

  // 手动修改日期时清除快捷选中状态
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setActiveQuickDate(null);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setActiveQuickDate(null);
  };

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1>📋 订单查询</h1>
        <p className="page-subtitle">查看和管理订单记录</p>
      </div>

      {/* 筛选栏 */}
      <div className="filter-section">
        <div className="filter-item">
          <label>开始日期：</label>
          <input
            type="date"
            className="date-input"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </div>
        <div className="filter-item">
          <label>结束日期：</label>
          <input
            type="date"
            className="date-input"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => loadOrders(1)} disabled={loading}>
          {loading ? '查询中...' : '🔍 查询'}
        </button>
        <div className="quick-dates">
          <button 
            className={`btn btn-small ${activeQuickDate === 1 ? 'active' : ''}`} 
            onClick={() => setQuickDate(1)}
          >
            今天
          </button>
          <button 
            className={`btn btn-small ${activeQuickDate === 7 ? 'active' : ''}`} 
            onClick={() => setQuickDate(7)}
          >
            近7天
          </button>
          <button 
            className={`btn btn-small ${activeQuickDate === 30 ? 'active' : ''}`} 
            onClick={() => setQuickDate(30)}
          >
            近30天
          </button>
        </div>
      </div>

      {/* 订单统计 */}
      {totalCount > 0 && (
        <div className="orders-stats">
          <div className="stat-item">
            <span className="stat-label">共</span>
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">笔订单</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">总金额</span>
            <span className="stat-value">¥{totalAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* 订单列表 */}
      <div className="orders-section">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>加载中...</p>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>当前日期范围没有订单记录</p>
            <p className="hint">调整日期范围或点击查询按钮</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            {/* 批量操作栏 */}
            {selectedIds.size > 0 && (
              <div className="batch-actions">
                <span className="batch-info">已选择 <strong>{selectedIds.size}</strong> 个订单</span>
                <button 
                  className="btn btn-danger btn-sm" 
                  onClick={handleBatchDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? '删除中...' : '🗑️ 批量删除'}
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setSelectedIds(new Set())}
                >
                  取消选择
                </button>
              </div>
            )}
            
            <div className="orders-table">
              <div className="table-header">
                <span className="col-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                  />
                </span>
                <span className="col-index">#</span>
                <span className="col-no">订单号</span>
                <span className="col-amount">金额</span>
                <span className="col-cashier">收银员</span>
                <span className="col-time">时间</span>
                <span className="col-status">状态</span>
                <span className="col-actions">操作</span>
              </div>
              {orders.map((order, index) => (
                <div
                  key={order.id}
                  className={`order-row ${selectedIds.has(order.id) ? 'selected' : ''}`}
                  onClick={() => handleOrderClick(order)}
                >
                  <span className="col-checkbox" onClick={(e) => toggleSelect(order.id, e)}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(order.id)}
                      onChange={() => {}}
                    />
                  </span>
                  <span className="col-index">{(currentPage - 1) * pageSize + index + 1}</span>
                  <span className="col-no">{order.order_no}</span>
                  <span className="col-amount">¥{order.total_amount.toFixed(2)}</span>
                  <span className="col-cashier">{order.cashier}</span>
                  <span className="col-time">
                    {new Date(order.created_at).toLocaleString('zh-CN')}
                  </span>
                  <span className="col-status">{getStatusBadge(order.status)}</span>
                  <span className="col-actions">
                    <button 
                      className="btn-action btn-revoke" 
                      onClick={(e) => handleRevokeSingle(order.id, order.order_no, e)}
                      disabled={actionLoading}
                      title="撤销订单"
                    >
                      ↩️
                    </button>
                    <button 
                      className="btn-action btn-delete" 
                      onClick={(e) => handleDeleteSingle(order.id, order.order_no, e)}
                      disabled={actionLoading}
                      title="删除订单"
                    >
                      🗑️
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {/* 分页工具栏 - 模仿商品管理页面 */}
            <div className="pagination-toolbar">
              <div className="pagination-info">
                <span className="total-badge">📋 共 <strong>{totalCount}</strong> 笔</span>
                <span className="current-page-count">本页 <strong>{orders.length}</strong> 笔</span>
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
          </>
        )}
      </div>

      {/* 订单详情弹窗 */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content order-detail" onClick={(e) => e.stopPropagation()}>
            <h2>📋 订单详情</h2>
            
            <div className="detail-section">
              <h3>基本信息</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">订单号:</span>
                  <span className="value">{selectedOrder.order_no}</span>
                </div>
                <div className="detail-item">
                  <span className="label">状态:</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="detail-item">
                  <span className="label">收银员:</span>
                  <span className="value">{selectedOrder.cashier}</span>
                </div>
                <div className="detail-item">
                  <span className="label">时间:</span>
                  <span className="value">
                    {new Date(selectedOrder.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>商品明细</h3>
              {detailLoading ? (
                <div className="loading-state small">
                  <div className="spinner"></div>
                  <p>加载明细中...</p>
                </div>
              ) : selectedOrder.items && selectedOrder.items.length > 0 ? (
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>商品名称</th>
                      <th>单价</th>
                      <th>数量</th>
                      <th>小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.product_name}</td>
                        <td>¥{item.unit_price.toFixed(2)}</td>
                        <td>{item.quantity}</td>
                        <td>¥{item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="total-label">合计</td>
                      <td className="total-value">¥{selectedOrder.total_amount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="no-items">暂无商品明细</p>
              )}
            </div>

            <div className="modal-actions order-actions">
              <button 
                className="btn btn-warning" 
                onClick={() => handleRevokeOrder()}
                disabled={actionLoading}
                title="撤销订单并将商品返回收银台"
              >
                {actionLoading ? '处理中...' : '↩️ 撤销订单'}
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteOrder}
                disabled={actionLoading}
                title="删除订单（不恢复库存）"
              >
                {actionLoading ? '处理中...' : '🗑️ 删除订单'}
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      {confirmModal?.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className={`confirm-modal ${confirmModal.type}`} onClick={(e) => e.stopPropagation()}>
            <h2>{confirmModal.title}</h2>
            <div className="confirm-message">
              {confirmModal.message.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="confirm-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
              >
                取消
              </button>
              <button 
                className={`btn ${confirmModal.type === 'danger' ? 'btn-danger' : 'btn-warning'}`}
                onClick={confirmModal.onConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
