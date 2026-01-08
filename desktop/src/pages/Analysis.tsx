import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './Analysis.css';

interface RestockSuggestion {
  sku_id: number;
  name: string;
  barcode: string;
  price: number;
  current_stock: number;
  avg_daily_sales_30d: number;
  avg_daily_sales_7d: number;
  predicted_daily_sales: number;
  safety_stock: number;
  suggested_restock: number;
  days_until_stockout: number;
  confidence: string;
  reason: string;
}

interface Anomaly {
  sku_id: number;
  name: string;
  barcode: string;
  anomaly_type: string;
  date: string;
  actual_sales: number;
  expected_sales: number;
  deviation: number | null;
  severity: string;
  possible_reasons: string[];
}

export default function Analysis() {
  const [activeTab, setActiveTab] = useState<'restock' | 'anomaly'>('restock');
  const [days, setDays] = useState(30);
  const [safetyStockDays, setSafetyStockDays] = useState(7);
  
  const [restockSuggestions, setRestockSuggestions] = useState<RestockSuggestion[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'restock') {
      fetchRestockSuggestions();
    } else if (activeTab === 'anomaly') {
      fetchAnomalies();
    }
  }, [activeTab, days, safetyStockDays]);

  async function fetchRestockSuggestions() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/restock_suggestion?days=${days}&safety_stock_days=${safetyStockDays}`
      );
      if (response.ok) {
        const data = await response.json();
        setRestockSuggestions(data);
      } else {
        throw new Error('获取补货建议失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAnomalies() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/anomaly_detection?days=${days}&threshold_std=2.0`
      );
      if (response.ok) {
        const data = await response.json();
        setAnomalies(data);
      } else {
        throw new Error('获取异常检测失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getConfidenceInfo(confidence: string) {
    const info: Record<string, { icon: string; text: string; color: string }> = {
      high: { icon: '✅', text: '可靠', color: '#4caf50' },
      medium: { icon: '⚡', text: '一般', color: '#ff9800' },
      low: { icon: '❓', text: '仅供参考', color: '#9e9e9e' }
    };
    return info[confidence] || info.low;
  }

  function getSeverityInfo(severity: string) {
    const info: Record<string, { icon: string; text: string; color: string }> = {
      high: { icon: '🚨', text: '需关注', color: '#f44336' },
      medium: { icon: '⚠️', text: '留意', color: '#ff9800' },
      low: { icon: 'ℹ️', text: '正常波动', color: '#2196f3' }
    };
    return info[severity] || info.low;
  }

  function getAnomalyTypeInfo(type: string) {
    const info: Record<string, { icon: string; text: string; color: string }> = {
      surge: { icon: '📈', text: '卖得多', color: '#4caf50' },
      drop: { icon: '📉', text: '卖得少', color: '#ff9800' },
      zero: { icon: '⚠️', text: '没卖出', color: '#f44336' }
    };
    return info[type] || { icon: '❓', text: type, color: '#999' };
  }

  function getUrgencyLevel(daysUntilStockout: number) {
    if (daysUntilStockout < 2) return { level: 'critical', text: '紧急补货！', icon: '🔴' };
    if (daysUntilStockout < 5) return { level: 'warning', text: '尽快补货', icon: '🟠' };
    if (daysUntilStockout < 10) return { level: 'normal', text: '注意库存', icon: '🟡' };
    return { level: 'safe', text: '库存充足', icon: '🟢' };
  }

  function renderRestockSuggestions() {
    // 统计数据
    const urgentCount = restockSuggestions.filter(s => s.days_until_stockout < 3).length;
    const warningCount = restockSuggestions.filter(s => s.days_until_stockout >= 3 && s.days_until_stockout < 7).length;

    return (
      <div className="restock-section">
        {/* 快速设置 */}
        <div className="quick-settings">
          <div className="setting-item">
            <span className="setting-icon">📅</span>
            <span className="setting-label">统计周期</span>
            <div className="setting-buttons">
              {[7, 15, 30].map(d => (
                <button
                  key={d}
                  className={days === d ? 'active' : ''}
                  onClick={() => setDays(d)}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
          <div className="setting-item">
            <span className="setting-icon">🛡️</span>
            <span className="setting-label">安全天数</span>
            <div className="setting-buttons">
              {[3, 5, 7, 10].map(d => (
                <button
                  key={d}
                  className={safetyStockDays === d ? 'active' : ''}
                  onClick={() => setSafetyStockDays(d)}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 概览 */}
        <div className="overview-cards">
          <div className="overview-card total">
            <span className="card-icon">📦</span>
            <div className="card-content">
              <span className="card-number">{restockSuggestions.length}</span>
              <span className="card-label">需补货商品</span>
            </div>
          </div>
          <div className="overview-card urgent">
            <span className="card-icon">🔴</span>
            <div className="card-content">
              <span className="card-number">{urgentCount}</span>
              <span className="card-label">紧急补货</span>
            </div>
          </div>
          <div className="overview-card warning">
            <span className="card-icon">🟠</span>
            <div className="card-content">
              <span className="card-number">{warningCount}</span>
              <span className="card-label">尽快补货</span>
            </div>
          </div>
        </div>

        {/* 帮助说明 */}
        <div className="help-tip">
          <span className="tip-icon">💡</span>
          <span className="tip-text">
            系统根据您的销售情况，自动计算每个商品大概多久会卖完，帮您提前准备补货
          </span>
        </div>

        {restockSuggestions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <span className="empty-text">太棒了！所有商品库存充足</span>
          </div>
        ) : (
          <div className="restock-list">
            {restockSuggestions.map((item) => {
              const urgency = getUrgencyLevel(item.days_until_stockout);
              const confidence = getConfidenceInfo(item.confidence);
              
              return (
                <div key={item.sku_id} className={`restock-item ${urgency.level}`}>
                  {/* 左侧状态指示 */}
                  <div className="item-status">
                    <span className="status-icon">{urgency.icon}</span>
                    <span className="status-text">{urgency.text}</span>
                  </div>

                  {/* 商品信息 */}
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-barcode">{item.barcode}</div>
                  </div>

                  {/* 核心数据 */}
                  <div className="item-data">
                    <div className="data-block current">
                      <span className="data-label">现有</span>
                      <span className="data-value">{item.current_stock}件</span>
                    </div>
                    <div className="data-arrow">→</div>
                    <div className="data-block suggest">
                      <span className="data-label">建议补</span>
                      <span className="data-value highlight">{item.suggested_restock.toFixed(0)}件</span>
                    </div>
                  </div>

                  {/* 预计信息 */}
                  <div className="item-forecast">
                    <span className="forecast-icon">⏳</span>
                    <span className="forecast-text">
                      约<strong>{item.days_until_stockout.toFixed(0)}</strong>天后卖完
                    </span>
                    <span className="confidence" style={{ color: confidence.color }}>
                      {confidence.icon} {confidence.text}
                    </span>
                  </div>

                  {/* 详细分析 */}
                  <div className="item-details">
                    <div className="detail-row">
                      <span>每天大约卖 <strong>{item.predicted_daily_sales.toFixed(1)}</strong> 件</span>
                      <span>安全库存 <strong>{item.safety_stock.toFixed(0)}</strong> 件</span>
                      <span>单价 <strong>¥{item.price.toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderAnomalies() {
    // 统计
    const surgeCount = anomalies.filter(a => a.anomaly_type === 'surge').length;
    const dropCount = anomalies.filter(a => a.anomaly_type === 'drop').length;
    const zeroCount = anomalies.filter(a => a.anomaly_type === 'zero').length;

    return (
      <div className="anomaly-section">
        {/* 快速设置 */}
        <div className="quick-settings">
          <div className="setting-item">
            <span className="setting-icon">📅</span>
            <span className="setting-label">检测周期</span>
            <div className="setting-buttons">
              {[7, 15, 30].map(d => (
                <button
                  key={d}
                  className={days === d ? 'active' : ''}
                  onClick={() => setDays(d)}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 概览 */}
        <div className="overview-cards">
          <div className="overview-card total">
            <span className="card-icon">🔍</span>
            <div className="card-content">
              <span className="card-number">{anomalies.length}</span>
              <span className="card-label">发现异常</span>
            </div>
          </div>
          <div className="overview-card surge">
            <span className="card-icon">📈</span>
            <div className="card-content">
              <span className="card-number">{surgeCount}</span>
              <span className="card-label">突然卖多</span>
            </div>
          </div>
          <div className="overview-card drop">
            <span className="card-icon">📉</span>
            <div className="card-content">
              <span className="card-number">{dropCount}</span>
              <span className="card-label">突然卖少</span>
            </div>
          </div>
          <div className="overview-card zero">
            <span className="card-icon">⚠️</span>
            <div className="card-content">
              <span className="card-number">{zeroCount}</span>
              <span className="card-label">没卖出</span>
            </div>
          </div>
        </div>

        {/* 帮助说明 */}
        <div className="help-tip">
          <span className="tip-icon">💡</span>
          <span className="tip-text">
            系统会发现销售异常情况，比如某商品突然卖得特别多或特别少，帮您及时关注
          </span>
        </div>

        {anomalies.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <span className="empty-text">未发现销售异常，一切正常</span>
          </div>
        ) : (
          <div className="anomaly-list">
            {anomalies.map((item, index) => {
              const typeInfo = getAnomalyTypeInfo(item.anomaly_type);
              const severityInfo = getSeverityInfo(item.severity);
              
              return (
                <div key={`${item.sku_id}-${item.date}-${index}`} className={`anomaly-item ${item.severity}`}>
                  {/* 类型标识 */}
                  <div className="item-type" style={{ backgroundColor: typeInfo.color }}>
                    <span className="type-icon">{typeInfo.icon}</span>
                    <span className="type-text">{typeInfo.text}</span>
                  </div>

                  {/* 商品信息 */}
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-date">{item.date}</div>
                  </div>

                  {/* 销售对比 */}
                  <div className="sales-compare">
                    <div className="compare-block expected">
                      <span className="compare-label">平时卖</span>
                      <span className="compare-value">{item.expected_sales}件</span>
                    </div>
                    <div className="compare-arrow">
                      {item.anomaly_type === 'surge' ? '↑' : item.anomaly_type === 'drop' ? '↓' : '→'}
                    </div>
                    <div className="compare-block actual">
                      <span className="compare-label">这天卖</span>
                      <span className="compare-value">{item.actual_sales}件</span>
                    </div>
                  </div>

                  {/* 严重程度 */}
                  <div className="severity-badge" style={{ color: severityInfo.color }}>
                    {severityInfo.icon} {severityInfo.text}
                  </div>

                  {/* 可能原因 */}
                  {item.possible_reasons.length > 0 && (
                    <div className="possible-reasons">
                      <span className="reasons-title">可能原因：</span>
                      {item.possible_reasons.map((reason, idx) => (
                        <span key={idx} className="reason-tag">{reason}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="analysis-page">
      {/* 顶部标题 */}
      <header className="page-header">
        <div className="header-content">
          <span className="header-icon">🤖</span>
          <div className="header-text">
            <h1>智能助手</h1>
            <p>自动分析，帮您做决定</p>
          </div>
        </div>
      </header>

      {/* 功能切换 */}
      <div className="function-tabs">
        <button
          className={`tab-btn ${activeTab === 'restock' ? 'active' : ''}`}
          onClick={() => setActiveTab('restock')}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-text">该补货了</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'anomaly' ? 'active' : ''}`}
          onClick={() => setActiveTab('anomaly')}
        >
          <span className="tab-icon">🔍</span>
          <span className="tab-text">销售异常</span>
        </button>
      </div>

      {/* 主内容 */}
      <div className="main-content">
        {loading && (
          <div className="loading-state">
            <span className="loading-icon">⏳</span>
            <span className="loading-text">正在分析...</span>
          </div>
        )}
        
        {error && (
          <div className="error-state">
            <span className="error-icon">❌</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            {activeTab === 'restock' && renderRestockSuggestions()}
            {activeTab === 'anomaly' && renderAnomalies()}
          </>
        )}
      </div>
    </div>
  );
}
