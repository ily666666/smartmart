import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../config';
import './Database.css';

interface TableInfo {
  name: string;
  name_cn: string;
  count: number;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
  }[];
}

interface TableData {
  table: string;
  table_cn: string;
  total: number;
  skip: number;
  limit: number;
  data: Record<string, any>[];
}

const Database = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [stats, setStats] = useState<{ total_records: number } | null>(null);

  // 加载表列表
  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/database/tables');
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('加载表列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载统计信息
  const loadStats = useCallback(async () => {
    try {
      const response = await apiFetch('/database/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  }, []);

  // 加载表数据
  const loadTableData = useCallback(async (tableName: string, page: number = 1) => {
    if (!tableName) return;
    
    setLoadingData(true);
    try {
      const skip = (page - 1) * pageSize;
      const response = await apiFetch(
        `/database/tables/${tableName}?skip=${skip}&limit=${pageSize}`
      );
      if (response.ok) {
        const data = await response.json();
        setTableData(data);
        setCurrentPage(page);
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('加载表数据失败:', error);
    } finally {
      setLoadingData(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadTables();
    loadStats();
  }, [loadTables, loadStats]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, 1);
    } else {
      setTableData(null);
    }
  }, [selectedTable, loadTableData]);

  // 选择表
  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setSelectedIds([]);
  };

  // 切换选中记录
  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (!tableData) return;
    
    const allIds = tableData.data.map(row => row.id as number);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  // 删除选中记录
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的记录');
      return;
    }

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedIds.length} 条记录吗？\n\n此操作不可撤销！`
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(
        `/database/tables/${selectedTable}/records?ids=${selectedIds.join(',')}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const result = await response.json();
        alert(`成功删除 ${result.deleted_count} 条记录`);
        loadTableData(selectedTable, currentPage);
        loadTables();
        loadStats();
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除记录失败:', error);
      alert('删除失败，请检查网络连接');
    }
  };

  // 清空表
  const handleClearTable = async () => {
    if (clearConfirmText !== 'CONFIRM_CLEAR') {
      alert('请输入正确的确认码: CONFIRM_CLEAR');
      return;
    }

    try {
      const response = await apiFetch(
        `/database/tables/${selectedTable}/clear?confirm=CONFIRM_CLEAR`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setShowClearConfirm(false);
        setClearConfirmText('');
        loadTableData(selectedTable, 1);
        loadTables();
        loadStats();
      } else {
        const error = await response.json();
        alert(`清空失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('清空表失败:', error);
      alert('清空失败，请检查网络连接');
    }
  };

  // 导出表数据
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await apiFetch(
        `/database/tables/${selectedTable}/export?format=${format}`
      );

      if (response.ok) {
        const result = await response.json();
        
        let content: string;
        let mimeType: string;
        
        if (format === 'csv') {
          content = result.content;
          mimeType = 'text/csv';
        } else {
          content = JSON.stringify(result.data, null, 2);
          mimeType = 'application/json';
        }

        // 创建下载链接
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(`导出失败: ${error.detail || '未知错误'}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请检查网络连接');
    }
  };

  // 分页
  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadTableData(selectedTable, page);
    }
  };

  // 格式化单元格值
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // 获取列显示名称
  const getColumnDisplayName = (colName: string): string => {
    const nameMap: Record<string, string> = {
      id: 'ID',
      barcode: '条码',
      name: '名称',
      category: '分类',
      price: '售价',
      cost_price: '进价',
      stock: '库存',
      image_url: '图片',
      created_at: '创建时间',
      updated_at: '更新时间',
      order_no: '订单号',
      total_amount: '总金额',
      status: '状态',
      cashier: '收银员',
      order_id: '订单ID',
      product_id: '商品ID',
      product_name: '商品名称',
      quantity: '数量',
      unit_price: '单价',
      subtotal: '小计',
      device_id: '设备ID',
      device_type: '设备类型',
      device_name: '设备名称',
      authenticated: '已认证',
      last_seen: '最后在线',
    };
    return nameMap[colName] || colName;
  };

  return (
    <div className="database-page">
      <div className="page-header">
        <h1>🗄️ 数据库管理</h1>
        <p className="page-subtitle">查看和管理数据库中的数据表</p>
      </div>

      {/* 统计卡片 */}
      <div className="stats-section">
        <div className="stat-card total">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.total_records || 0}</div>
            <div className="stat-label">总记录数</div>
          </div>
        </div>
        <div className="stat-card tables">
          <div className="stat-icon">📁</div>
          <div className="stat-info">
            <div className="stat-value">{tables.length}</div>
            <div className="stat-label">数据表</div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="database-content">
        {/* 左侧表列表 */}
        <div className="tables-sidebar">
          <div className="sidebar-header">
            <h3>📋 数据表</h3>
            <button 
              className="btn-refresh" 
              onClick={() => { loadTables(); loadStats(); }}
              disabled={loading}
            >
              🔄
            </button>
          </div>
          
          {loading ? (
            <div className="loading-state">
              <div className="spinner-small"></div>
              <span>加载中...</span>
            </div>
          ) : (
            <div className="table-list">
              {tables.map(table => (
                <div
                  key={table.name}
                  className={`table-item ${selectedTable === table.name ? 'active' : ''}`}
                  onClick={() => handleSelectTable(table.name)}
                >
                  <div className="table-item-info">
                    <span className="table-name">{table.name_cn}</span>
                    <span className="table-tech-name">{table.name}</span>
                  </div>
                  <span className="table-count">{table.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧数据区 */}
        <div className="data-section">
          {!selectedTable ? (
            <div className="empty-state">
              <div className="empty-icon">👈</div>
              <p>请从左侧选择一个数据表</p>
            </div>
          ) : (
            <>
              {/* 工具栏 */}
              <div className="data-toolbar">
                <div className="toolbar-left">
                  <h3>
                    {tables.find(t => t.name === selectedTable)?.name_cn}
                    <span className="tech-name">({selectedTable})</span>
                  </h3>
                  {tableData && (
                    <span className="record-count">
                      共 {tableData.total} 条记录
                    </span>
                  )}
                </div>
                <div className="toolbar-right">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleExport('csv')}
                    disabled={!tableData || tableData.total === 0}
                  >
                    📄 导出 CSV
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleExport('json')}
                    disabled={!tableData || tableData.total === 0}
                  >
                    📋 导出 JSON
                  </button>
                  <button 
                    className="btn btn-danger-outline"
                    onClick={handleDeleteSelected}
                    disabled={selectedIds.length === 0}
                  >
                    🗑️ 删除选中 ({selectedIds.length})
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={!tableData || tableData.total === 0}
                  >
                    ⚠️ 清空表
                  </button>
                </div>
              </div>

              {/* 数据表格 */}
              {loadingData ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>加载数据中...</p>
                </div>
              ) : tableData && tableData.data.length > 0 ? (
                <>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="col-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === tableData.data.length && tableData.data.length > 0}
                              onChange={handleSelectAll}
                            />
                          </th>
                          {tableData.data.length > 0 && 
                            Object.keys(tableData.data[0]).map(col => (
                              <th key={col}>{getColumnDisplayName(col)}</th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.data.map((row, index) => (
                          <tr 
                            key={row.id || index}
                            className={selectedIds.includes(row.id) ? 'selected' : ''}
                          >
                            <td className="col-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                onChange={() => handleToggleSelect(row.id)}
                              />
                            </td>
                            {Object.values(row).map((value, colIndex) => (
                              <td key={colIndex} title={formatCellValue(value)}>
                                {formatCellValue(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="page-btn"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                      >
                        ⏮
                      </button>
                      <button
                        className="page-btn"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        ◀
                      </button>
                      <span className="page-info">
                        第 {currentPage} / {totalPages} 页
                      </span>
                      <button
                        className="page-btn"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        ▶
                      </button>
                      <button
                        className="page-btn"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        ⏭
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p>该表暂无数据</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content danger-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header danger">
              <h2>⚠️ 危险操作确认</h2>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                您即将清空表 <strong>{tables.find(t => t.name === selectedTable)?.name_cn}</strong>
                （{selectedTable}）中的所有数据！
              </p>
              <p className="warning-text">
                共 <strong>{tableData?.total || 0}</strong> 条记录将被永久删除。
              </p>
              <p className="warning-text danger">
                此操作不可撤销！请输入确认码以继续：
              </p>
              <div className="confirm-input-group">
                <label>请输入 <code>CONFIRM_CLEAR</code> 确认：</label>
                <input
                  type="text"
                  className="confirm-input"
                  value={clearConfirmText}
                  onChange={e => setClearConfirmText(e.target.value)}
                  placeholder="CONFIRM_CLEAR"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearConfirmText('');
                }}
              >
                取消
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleClearTable}
                disabled={clearConfirmText !== 'CONFIRM_CLEAR'}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Database;
