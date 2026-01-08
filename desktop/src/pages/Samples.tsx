import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import './Samples.css';

interface SampleStatus {
  sku_id: number;
  barcode: string;
  name: string;
  price: number;
  image_count: number;
  status: 'ready' | 'partial' | 'empty';
  images: string[];
}

interface IndexStatus {
  exists: boolean;
  num_vectors: number;
  num_skus: number;
  last_built: string | null;
}

interface BuildProgress {
  status: 'idle' | 'building' | 'completed' | 'failed';
  message: string;
  progress: number;
}

const Samples = () => {
  const [samples, setSamples] = useState<SampleStatus[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [buildProgress, setBuildProgress] = useState<BuildProgress>({ status: 'idle', message: '', progress: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingSample, setEditingSample] = useState<SampleStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  
  // 计算每页显示数量（根据屏幕宽度自适应，允许滚动所以多显示一些）
  const calculatePageSize = useCallback(() => {
    const windowWidth = window.innerWidth;
    
    // 计算每行能放几个卡片（卡片宽度约 280px，间隔 16px）
    const cardWidth = 296; // 280 + 16 gap
    const availableWidth = Math.min(windowWidth - 64, 1400); // 考虑页面 padding
    const cardsPerRow = Math.max(1, Math.floor(availableWidth / cardWidth));
    
    // 卡片布局允许滚动，所以每页多显示一些（4-6行）
    const rows = 5;
    
    // 每页数量 = 每行卡片数 * 行数，最少12个，最多30个
    const calculatedSize = cardsPerRow * rows;
    return Math.max(12, Math.min(30, calculatedSize));
  }, []);

  // 搜索和分页
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'partial' | 'empty'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => calculatePageSize());

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const newSize = calculatePageSize();
      if (newSize !== pageSize) {
        setPageSize(newSize);
        setCurrentPage(1);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePageSize, pageSize]);

  // 过滤后的样本
  const filteredSamples = samples.filter(s => {
    // 搜索过滤
    const matchSearch = searchText === '' || 
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.barcode.includes(searchText);
    
    // 状态过滤
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    
    return matchSearch && matchStatus;
  });

  // 分页
  const totalPages = Math.ceil(filteredSamples.length / pageSize);
  const paginatedSamples = filteredSamples.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 搜索或筛选变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusFilter]);

  // 加载样本状态
  const loadSamples = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/samples`);
      if (res.ok) {
        const data = await res.json();
        setSamples(data);
      }
    } catch (error) {
      console.error('加载样本失败:', error);
    }
  };

  // 加载索引状态
  const loadIndexStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/index_status`);
      if (res.ok) {
        const data = await res.json();
        setIndexStatus(data);
      }
    } catch (error) {
      console.error('加载索引状态失败:', error);
    }
  };

  // 加载构建进度
  const loadBuildProgress = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/build_status`);
      if (res.ok) {
        const data = await res.json();
        setBuildProgress(data);
        return data.status;
      }
    } catch (error) {
      console.error('加载构建进度失败:', error);
    }
    return 'idle';
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadSamples(), loadIndexStatus(), loadBuildProgress()]);
      setLoading(false);
    };
    init();
  }, []);

  // 轮询构建进度
  useEffect(() => {
    if (buildProgress.status === 'building') {
      const interval = setInterval(async () => {
        const status = await loadBuildProgress();
        if (status === 'completed' || status === 'failed') {
          clearInterval(interval);
          await loadIndexStatus();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [buildProgress.status]);

  // 创建所有目录
  const handleCreateDirectories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/create_directories`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        await loadSamples();
      }
    } catch (error) {
      console.error('创建目录失败:', error);
      alert('创建目录失败');
    }
  };

  // 开始构建索引
  const handleBuildIndex = async () => {
    if (buildProgress.status === 'building') {
      alert('索引正在构建中，请稍候...');
      return;
    }

    const readyCount = samples.filter(s => s.image_count >= 1).length;
    if (readyCount === 0) {
      alert('没有可用的样本图片，请先上传');
      return;
    }

    if (!confirm(`确定要构建索引吗？\n\n将为 ${readyCount} 个商品构建 AI 识别索引，这可能需要几分钟时间。`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/build_index`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        await loadBuildProgress();
      } else {
        const error = await res.json();
        alert(error.detail || '启动构建失败');
      }
    } catch (error) {
      console.error('构建索引失败:', error);
      alert('构建索引失败');
    }
  };

  // 选择文件上传
  const handleUploadClick = (skuId: number) => {
    setSelectedSku(skuId);
    fileInputRef.current?.click();
  };

  // 文件上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || selectedSku === null) return;

    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch(`${API_BASE_URL}/api/samples/samples/${selectedSku}/upload_multiple`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        await loadSamples();
      } else {
        const error = await res.json();
        alert(error.detail || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败');
    } finally {
      setUploading(false);
      setSelectedSku(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除图片
  const handleDeleteImage = async (skuId: number, filename: string) => {
    if (!confirm(`确定要删除图片 ${filename} 吗？`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/samples/${skuId}/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadSamples();
        // 更新编辑中的样本
        if (editingSample && editingSample.sku_id === skuId) {
          const updated = samples.find(s => s.sku_id === skuId);
          if (updated) {
            setEditingSample({
              ...updated,
              images: updated.images.filter(img => img !== filename),
              image_count: updated.image_count - 1
            });
          }
        }
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 模态框内上传
  const handleModalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingSample) return;

    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch(`${API_BASE_URL}/api/samples/samples/${editingSample.sku_id}/upload_multiple`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        await loadSamples();
        // 重新获取该商品的详情
        const detailRes = await fetch(`${API_BASE_URL}/api/samples/samples/${editingSample.sku_id}`);
        if (detailRes.ok) {
          const updated = await detailRes.json();
          setEditingSample(updated);
        }
      }
    } catch (error) {
      console.error('上传失败:', error);
    } finally {
      setUploading(false);
      if (modalFileInputRef.current) {
        modalFileInputRef.current.value = '';
      }
    }
  };

  // 打开编辑弹窗
  const openEditModal = async (sample: SampleStatus) => {
    // 获取最新详情
    try {
      const res = await fetch(`${API_BASE_URL}/api/samples/samples/${sample.sku_id}`);
      if (res.ok) {
        const data = await res.json();
        setEditingSample(data);
      } else {
        setEditingSample(sample);
      }
    } catch {
      setEditingSample(sample);
    }
  };

  // 统计
  const stats = {
    total: samples.length,
    ready: samples.filter(s => s.status === 'ready').length,
    partial: samples.filter(s => s.status === 'partial').length,
    empty: samples.filter(s => s.status === 'empty').length,
    totalImages: samples.reduce((sum, s) => sum + s.image_count, 0)
  };

  if (loading) {
    return (
      <div className="samples-page">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="samples-page">
      <header className="page-header">
        <h1>🧠 AI 样本管理</h1>
        <p>管理商品图片样本，构建 AI 识别索引</p>
      </header>

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />

      {/* 统计卡片 */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">商品总数</div>
          </div>
        </div>
        <div className="stat-card ready">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.ready}</div>
            <div className="stat-label">已就绪 (≥3张)</div>
          </div>
        </div>
        <div className="stat-card partial">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.partial}</div>
            <div className="stat-label">部分完成</div>
          </div>
        </div>
        <div className="stat-card empty">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-value">{stats.empty}</div>
            <div className="stat-label">待上传</div>
          </div>
        </div>
        <div className="stat-card images">
          <div className="stat-icon">🖼️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalImages}</div>
            <div className="stat-label">图片总数</div>
          </div>
        </div>
      </div>

      {/* 索引状态 */}
      <div className="index-section">
        <div className="section-header">
          <h2>🔍 索引状态</h2>
          <div className="section-actions">
            <button className="btn secondary" onClick={handleCreateDirectories}>
              📁 创建目录
            </button>
            <button 
              className="btn primary" 
              onClick={handleBuildIndex}
              disabled={buildProgress.status === 'building'}
            >
              {buildProgress.status === 'building' ? '⏳ 构建中...' : '🔨 重建索引'}
            </button>
          </div>
        </div>

        <div className="index-info">
          {indexStatus?.exists ? (
            <>
              <div className="index-stat">
                <span className="label">状态:</span>
                <span className="value success">✅ 已构建</span>
              </div>
              <div className="index-stat">
                <span className="label">商品数:</span>
                <span className="value">{indexStatus.num_skus}</span>
              </div>
              <div className="index-stat">
                <span className="label">向量数:</span>
                <span className="value">{indexStatus.num_vectors}</span>
              </div>
              <div className="index-stat">
                <span className="label">构建时间:</span>
                <span className="value">{indexStatus.last_built ? new Date(indexStatus.last_built).toLocaleString() : '-'}</span>
              </div>
            </>
          ) : (
            <div className="index-stat">
              <span className="value warning">⚠️ 索引未构建，请先上传图片后点击"重建索引"</span>
            </div>
          )}
        </div>

        {buildProgress.status === 'building' && (
          <div className="build-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${buildProgress.progress}%` }}></div>
            </div>
            <div className="progress-text">{buildProgress.message}</div>
          </div>
        )}

        {buildProgress.status === 'completed' && (
          <div className="build-result success">
            ✅ {buildProgress.message}
          </div>
        )}

        {buildProgress.status === 'failed' && (
          <div className="build-result error">
            ❌ {buildProgress.message}
          </div>
        )}
      </div>

      {/* 商品列表 */}
      <div className="samples-section">
        <div className="section-header">
          <h2>📦 商品样本</h2>
          <div className="search-filter">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 搜索商品名称或条码..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <select 
              className="status-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">全部状态</option>
              <option value="ready">✅ 已就绪</option>
              <option value="partial">⚠️ 部分完成</option>
              <option value="empty">❌ 待上传</option>
            </select>
          </div>
        </div>

        <div className="filter-info">
          显示 {filteredSamples.length} 个商品
          {searchText && <span>（搜索: "{searchText}"）</span>}
          {statusFilter !== 'all' && <span>（状态: {statusFilter}）</span>}
        </div>

        <div className="samples-grid">
          {paginatedSamples.map(sample => (
            <div key={sample.sku_id} className={`sample-card ${sample.status}`}>
              <div className="sample-header">
                <div className="sample-status">
                  {sample.status === 'ready' && '✅'}
                  {sample.status === 'partial' && '⚠️'}
                  {sample.status === 'empty' && '❌'}
                </div>
                <div className="sample-info">
                  <div className="sample-name">{sample.name}</div>
                  <div className="sample-barcode">{sample.barcode}</div>
                </div>
                <div className="sample-price">¥{sample.price.toFixed(2)}</div>
              </div>

              <div className="sample-images">
                {sample.images.length > 0 ? (
                  sample.images.slice(0, 4).map(img => (
                    <div key={img} className="image-thumb">
                      <img 
                        src={`${API_BASE_URL}/api/samples/samples/${sample.sku_id}/images/${img}`} 
                        alt={img}
                        loading="lazy"
                      />
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteImage(sample.sku_id, img)}
                        title="删除图片"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-images">暂无图片</div>
                )}
                {sample.images.length > 4 && (
                  <div className="more-images">+{sample.images.length - 4}</div>
                )}
              </div>

              <div className="sample-footer">
                <span className="image-count">
                  {sample.image_count} 张图片
                  {sample.image_count < 3 && <span className="hint"> (建议 ≥3 张)</span>}
                </span>
                <div className="footer-actions">
                  <button 
                    className="btn edit-btn"
                    onClick={() => openEditModal(sample)}
                  >
                    ✏️ 管理
                  </button>
                  <button 
                    className="btn upload-btn"
                    onClick={() => handleUploadClick(sample.sku_id)}
                    disabled={uploading}
                  >
                    {uploading && selectedSku === sample.sku_id ? '上传中...' : '📤 上传'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {paginatedSamples.length === 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <p>没有找到匹配的商品</p>
              {searchText && (
                <button className="btn secondary" onClick={() => setSearchText('')}>
                  清除搜索
                </button>
              )}
            </div>
          )}
        </div>

        {/* 分页工具栏 */}
        <div className="pagination-toolbar">
          <div className="pagination-info">
            <span className="total-badge">📦 共 <strong>{filteredSamples.length}</strong> 个商品</span>
            <span className="current-page-count">本页 <strong>{paginatedSamples.length}</strong> 个</span>
            {totalPages > 1 && (
              <span className="page-info">第 {currentPage} / {totalPages} 页</span>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                className="page-arrow"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="首页"
              >
                ⏮
              </button>
              <button 
                className="page-arrow"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                className="page-arrow"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="下一页"
              >
                ▶
              </button>
              <button 
                className="page-arrow"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="末页"
              >
                ⏭
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="help-section">
        <h3>💡 使用说明</h3>
        <ol>
          <li>为每个商品上传 <strong>3-10 张</strong>不同角度的照片</li>
          <li>建议拍摄：正面、侧面、背面、45度角等</li>
          <li>背景简洁、光线均匀效果更好</li>
          <li>所有商品上传完成后，点击 <strong>"重建索引"</strong></li>
          <li>索引构建完成后，AI 识别功能即可使用</li>
        </ol>
      </div>

      {/* 图片管理弹窗 */}
      {editingSample && (
        <div className="modal-overlay" onClick={() => setEditingSample(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h2>📷 {editingSample.name}</h2>
                <span className="modal-barcode">{editingSample.barcode}</span>
              </div>
              <button className="modal-close" onClick={() => setEditingSample(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="modal-stats">
                <span className={`status-badge ${editingSample.status}`}>
                  {editingSample.status === 'ready' && '✅ 已就绪'}
                  {editingSample.status === 'partial' && '⚠️ 部分完成'}
                  {editingSample.status === 'empty' && '❌ 待上传'}
                </span>
                <span className="image-count-badge">{editingSample.image_count} 张图片</span>
              </div>

              <input
                type="file"
                ref={modalFileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                multiple
                onChange={handleModalUpload}
              />

              <div className="modal-actions">
                <button 
                  className="btn primary"
                  onClick={() => modalFileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '上传中...' : '📤 添加图片'}
                </button>
              </div>

              <div className="modal-images-grid">
                {editingSample.images.length > 0 ? (
                  editingSample.images.map((img, idx) => (
                    <div key={img} className="modal-image-item">
                      <img 
                        src={`${API_BASE_URL}/api/samples/samples/${editingSample.sku_id}/images/${img}`} 
                        alt={img}
                      />
                      <div className="image-overlay">
                        <span className="image-name">{img}</span>
                        <button 
                          className="delete-image-btn"
                          onClick={() => {
                            handleDeleteImage(editingSample.sku_id, img);
                            setEditingSample({
                              ...editingSample,
                              images: editingSample.images.filter(i => i !== img),
                              image_count: editingSample.image_count - 1
                            });
                          }}
                        >
                          🗑️ 删除
                        </button>
                      </div>
                      <div className="image-index">{idx + 1}</div>
                    </div>
                  ))
                ) : (
                  <div className="no-images-modal">
                    <div className="empty-icon">📷</div>
                    <p>暂无图片，点击上方按钮添加</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <span className="modal-hint">
                💡 建议每个商品上传 3-10 张不同角度的照片
              </span>
              <button className="btn secondary" onClick={() => setEditingSample(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Samples;
