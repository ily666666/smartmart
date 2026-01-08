import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './Reports.css';

// ===================== 类型定义 =====================

interface DailySalesReport {
  date: string;
  total_revenue: number;
  order_count: number;
  item_count: number;
  avg_order_value: number;
  top_products: Array<{
    sku_id: number;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  hourly_distribution: Array<{
    hour: number;
    order_count: number;
    revenue: number;
  }>;
}

interface TopProduct {
  sku_id: number;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  revenue: number;
  order_count: number;
  current_stock: number;
  avg_daily_sales: number;
}

interface SlowMover {
  sku_id: number;
  name: string;
  current_stock: number;
  quantity_sold: number;
  revenue: number;
  avg_daily_sales: number;
  days_of_stock: number;
  last_sale_date: string | null;
}

interface ProfitProduct {
  sku_id: number;
  name: string;
  barcode: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  profit_margin: number;
  cost_price: number;
  sell_price: number;
}

interface ProfitReport {
  days: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  products_with_cost: number;
  products_without_cost: number;
  top_profit_products: ProfitProduct[];
}

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

type TabType = 'daily' | 'top' | 'slow' | 'profit' | 'restock' | 'anomaly';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [days, setDays] = useState(30);
  const [safetyStockDays, setSafetyStockDays] = useState(7);
  
  // 盈利分析专用状态
  const [profitStartDate, setProfitStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().split('T')[0];
  });
  const [profitEndDate, setProfitEndDate] = useState(getTodayDate());
  const [profitDateMode, setProfitDateMode] = useState<'quick' | 'custom'>('quick');
  const [includeNoCost, setIncludeNoCost] = useState(false);
  
  // 数据状态
  const [dailyReport, setDailyReport] = useState<DailySalesReport | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [slowMovers, setSlowMovers] = useState<SlowMover[]>([]);
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [restockSuggestions, setRestockSuggestions] = useState<RestockSuggestion[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCurrentTab();
  }, [activeTab, selectedDate, days]);
  
  useEffect(() => {
    if (activeTab === 'profit' && profitDateMode === 'quick') {
      fetchProfitReport();
    }
  }, [days, includeNoCost]);

  useEffect(() => {
    if (activeTab === 'restock') {
      fetchRestockSuggestions();
    }
  }, [safetyStockDays]);

  function loadCurrentTab() {
    if (activeTab === 'daily') {
      fetchDailyReport();
    } else if (activeTab === 'top') {
      fetchTopProducts();
    } else if (activeTab === 'slow') {
      fetchSlowMovers();
    } else if (activeTab === 'profit') {
      if (!profitReport) fetchProfitReport();
    } else if (activeTab === 'restock') {
      fetchRestockSuggestions();
    } else if (activeTab === 'anomaly') {
      fetchAnomalies();
    }
  }

  function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // ===================== 数据获取函数 =====================

  async function fetchDailyReport() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/reports/sales_daily?date=${selectedDate}`);
      if (response.ok) {
        setDailyReport(await response.json());
      } else {
        throw new Error('获取日报表失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTopProducts() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/reports/top_products?days=${days}`);
      if (response.ok) {
        setTopProducts(await response.json());
      } else {
        throw new Error('获取热销商品失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlowMovers() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/reports/slow_movers?days=${days}&min_stock=0`);
      if (response.ok) {
        setSlowMovers(await response.json());
      } else {
        throw new Error('获取滞销商品失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfitReport() {
    setLoading(true);
    setError('');
    try {
      let url = `${API_BASE_URL}/reports/profit?include_no_cost=${includeNoCost}`;
      if (profitDateMode === 'custom') {
        url += `&start_date=${profitStartDate}&end_date=${profitEndDate}`;
      } else {
        url += `&days=${days}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        setProfitReport(await response.json());
      } else {
        throw new Error('获取盈利报表失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRestockSuggestions() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/restock_suggestion?days=${days}&safety_stock_days=${safetyStockDays}`
      );
      if (response.ok) {
        setRestockSuggestions(await response.json());
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
        setAnomalies(await response.json());
      } else {
        throw new Error('获取异常检测失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ===================== 辅助函数 =====================

  const quickDates = [
    { label: '今天', offset: 0 },
    { label: '昨天', offset: 1 },
    { label: '前天', offset: 2 },
  ];

  function setQuickDate(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    setSelectedDate(date.toISOString().split('T')[0]);
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

  // ===================== 渲染函数 =====================

  function renderDailyReport() {
    if (!dailyReport) return <div className="empty-state">📭 暂无数据</div>;

    return (
      <div className="daily-report">
        <div className="date-picker">
          <div className="quick-dates">
            {quickDates.map((item) => {
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() - item.offset);
              const targetDateStr = targetDate.toISOString().split('T')[0];
              return (
                <button
                  key={item.label}
                  className={`quick-btn ${selectedDate === targetDateStr ? 'active' : ''}`}
                  onClick={() => setQuickDate(item.offset)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <input
            type="date"
            className="date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={getTodayDate()}
          />
        </div>

        <div className="big-stats">
          <div className="stat-card main">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">今日收入</div>
              <div className="stat-value money">¥{dailyReport.total_revenue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🧾</div>
            <div className="stat-content">
              <div className="stat-label">卖了多少单</div>
              <div className="stat-value">{dailyReport.order_count}<span className="unit">单</span></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-label">卖了多少件</div>
              <div className="stat-value">{dailyReport.item_count}<span className="unit">件</span></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-content">
              <div className="stat-label">平均每单</div>
              <div className="stat-value">¥{dailyReport.avg_order_value.toFixed(0)}</div>
            </div>
          </div>
        </div>

        {dailyReport.top_products.length > 0 && (
          <div className="section-card">
            <h3>🔥 今日卖得最好的商品</h3>
            <div className="product-ranks">
              {dailyReport.top_products.slice(0, 5).map((product, index) => (
                <div key={product.sku_id} className={`rank-item rank-${index + 1}`}>
                  <div className="rank-badge">{index + 1}</div>
                  <div className="rank-name">{product.name}</div>
                  <div className="rank-stats">
                    <span className="qty">{product.quantity}件</span>
                    <span className="rev">¥{product.revenue.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dailyReport.hourly_distribution.filter(h => h.order_count > 0).length > 0 && (() => {
          const activeHours = dailyReport.hourly_distribution.filter(h => h.order_count > 0);
          const maxOrders = Math.max(...activeHours.map(h => h.order_count));
          const peakHours = activeHours.filter(h => h.order_count === maxOrders);
          const totalHours = activeHours.length;
          
          return (
            <div className="section-card peak-summary">
              <h3>⏰ 营业时段</h3>
              <div className="peak-info">
                <div className="peak-item highlight">
                  <span className="peak-label">🔥 生意最好</span>
                  <span className="peak-value">{peakHours.map(h => `${h.hour}点`).join('、')}</span>
                  <span className="peak-detail">{peakHours[0].order_count}单 ¥{peakHours[0].revenue.toFixed(0)}</span>
                </div>
                <div className="peak-item">
                  <span className="peak-label">⏱️ 今日营业</span>
                  <span className="peak-value">{activeHours[0].hour}点 ~ {activeHours[activeHours.length-1].hour}点</span>
                  <span className="peak-detail">共{totalHours}小时</span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="section-card tips-card">
          <h3>📋 今日提醒</h3>
          <div className="tips-list">
            {dailyReport.order_count === 0 && (
              <div className="tip-item warning">😴 今天还没开张，加油！</div>
            )}
            {dailyReport.order_count > 0 && dailyReport.avg_order_value < 20 && (
              <div className="tip-item info">💡 客单价偏低，可以推荐搭配商品</div>
            )}
            {dailyReport.order_count >= 10 && (
              <div className="tip-item success">👍 今天生意不错，继续保持！</div>
            )}
            {dailyReport.top_products.length > 0 && dailyReport.top_products[0].quantity >= 5 && (
              <div className="tip-item info">
                🔔 {dailyReport.top_products[0].name} 卖得很好，注意补货
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderTopProducts() {
    return (
      <div className="top-products">
        <div className="time-selector">
          <span className="label">查看</span>
          {[7, 15, 30].map((d) => (
            <button
              key={d}
              className={`time-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              最近{d}天
            </button>
          ))}
        </div>

        {topProducts.length === 0 ? (
          <div className="empty-state">📭 暂无数据</div>
        ) : (
          <div className="product-list">
            {topProducts.map((product, index) => (
              <div key={product.sku_id} className={`product-item ${index < 3 ? 'top3' : ''}`}>
                <div className="item-rank">
                  {index < 3 ? ['🥇', '🥈', '🥉'][index] : <span className="num">{index + 1}</span>}
                </div>
                <div className="item-info">
                  <div className="item-name">{product.name}</div>
                  <div className="item-detail">库存 {product.current_stock} 件</div>
                </div>
                <div className="item-stats">
                  <div className="sold">卖了 <strong>{product.quantity}</strong> 件</div>
                  <div className="earned">赚了 <strong>¥{product.revenue.toFixed(0)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderSlowMovers() {
    return (
      <div className="slow-movers">
        <div className="time-selector">
          <span className="label">查看</span>
          {[7, 15, 30].map((d) => (
            <button
              key={d}
              className={`time-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              最近{d}天
            </button>
          ))}
        </div>

        {slowMovers.length === 0 ? (
          <div className="empty-state good">✅ 太棒了！没有滞销商品</div>
        ) : (
          <>
            <div className="warning-banner">
              ⚠️ 以下 {slowMovers.length} 个商品卖得很慢，要注意！
            </div>
            <div className="slow-list">
              {slowMovers.map((product) => (
                <div key={product.sku_id} className="slow-item">
                  <div className="slow-name">{product.name}</div>
                  <div className="slow-stats">
                    <div className="stat-row">
                      <span className="label">还剩</span>
                      <span className="value stock">{product.current_stock} 件</span>
                    </div>
                    <div className="stat-row">
                      <span className="label">{days}天只卖了</span>
                      <span className="value sold">{product.quantity_sold} 件</span>
                    </div>
                    <div className="stat-row">
                      <span className="label">按现在速度还要</span>
                      <span className={`value days ${product.days_of_stock > 90 ? 'danger' : ''}`}>
                        {product.days_of_stock > 999 ? '很久很久' : `${product.days_of_stock.toFixed(0)}天`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderProfitReport() {
    return (
      <div className="profit-report">
        <div className="filter-section">
          <div className="filter-item">
            <label>开始日期：</label>
            <input
              type="date"
              className="date-input"
              value={profitStartDate}
              onChange={(e) => setProfitStartDate(e.target.value)}
              max={profitEndDate}
            />
          </div>
          <div className="filter-item">
            <label>结束日期：</label>
            <input
              type="date"
              className="date-input"
              value={profitEndDate}
              onChange={(e) => setProfitEndDate(e.target.value)}
              min={profitStartDate}
              max={getTodayDate()}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setProfitDateMode('custom');
              fetchProfitReport();
            }}
          >
            🔍 查询
          </button>
          <div className="quick-dates">
            {[7, 15, 30, 60].map((d) => (
              <button
                key={d}
                className={`btn btn-small ${profitDateMode === 'quick' && days === d ? 'active' : ''}`}
                onClick={() => {
                  setProfitDateMode('quick');
                  setDays(d);
                }}
              >
                {d}天
              </button>
            ))}
            <div className="checkbox-wrapper">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeNoCost}
                  onChange={(e) => setIncludeNoCost(e.target.checked)}
                />
                <span>包含无进价商品</span>
              </label>
            </div>
          </div>
        </div>

        {!profitReport ? (
          <div className="empty-state">📭 暂无数据</div>
        ) : (
          <>
            <div className="profit-stats">
              <div className="stat-card profit-card revenue">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-label">总销售额</div>
                  <div className="stat-value money">¥{profitReport.total_revenue.toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card profit-card cost">
                <div className="stat-icon">💵</div>
                <div className="stat-content">
                  <div className="stat-label">总成本</div>
                  <div className="stat-value">¥{profitReport.total_cost.toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card profit-card profit">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <div className="stat-label">总利润</div>
                  <div className={`stat-value ${profitReport.total_profit >= 0 ? 'positive' : 'negative'}`}>
                    ¥{profitReport.total_profit.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="stat-card profit-card margin">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <div className="stat-label">利润率</div>
                  <div className={`stat-value ${profitReport.profit_margin >= 20 ? 'good' : profitReport.profit_margin >= 10 ? 'warn' : 'bad'}`}>
                    {profitReport.profit_margin}%
                  </div>
                </div>
              </div>
            </div>

            {profitReport.products_without_cost > 0 && (
              <div className="warning-banner orange">
                ⚠️ 有 <strong>{profitReport.products_without_cost}</strong> 个商品未设置进价
                {includeNoCost ? '，已按成本0计算（利润=销售额）' : '，已排除在统计之外'}。
                建议在商品管理中补充进价信息。
              </div>
            )}

            {profitReport.top_profit_products.length > 0 ? (
              <div className="section-card">
                <h3>💰 商品利润排行（已设置进价的{profitReport.products_with_cost}个商品）</h3>
                <div className="profit-list">
                  {profitReport.top_profit_products.map((item, index) => (
                    <div key={item.sku_id} className={`profit-item ${index < 3 ? 'top3' : ''}`}>
                      <div className="item-rank">
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : <span className="num">{index + 1}</span>}
                      </div>
                      <div className="item-info">
                        <div className="item-name">{item.name}</div>
                        <div className="item-prices">
                          售价 ¥{item.sell_price} / 进价 ¥{item.cost_price}
                        </div>
                      </div>
                      <div className="item-profit-stats">
                        <div className="profit-row">
                          <span className="label">卖了</span>
                          <span className="value">{item.quantity}件</span>
                        </div>
                        <div className="profit-row">
                          <span className="label">利润</span>
                          <span className={`value profit ${item.profit >= 0 ? 'positive' : 'negative'}`}>
                            ¥{item.profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="profit-row">
                          <span className="label">利润率</span>
                          <span className={`value margin ${item.profit_margin >= 30 ? 'good' : item.profit_margin >= 15 ? 'warn' : 'bad'}`}>
                            {item.profit_margin}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                📦 暂无商品利润数据，请先在商品管理中设置进价
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderRestockSuggestions() {
    const urgentCount = restockSuggestions.filter(s => s.days_until_stockout < 3).length;
    const warningCount = restockSuggestions.filter(s => s.days_until_stockout >= 3 && s.days_until_stockout < 7).length;

    return (
      <div className="restock-section">
        <div className="quick-settings">
          <div className="setting-item">
            <span className="setting-icon">📅</span>
            <span className="setting-label">统计周期</span>
            <div className="setting-buttons">
              {[7, 15, 30].map(d => (
                <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
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
                <button key={d} className={safetyStockDays === d ? 'active' : ''} onClick={() => setSafetyStockDays(d)}>
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

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
                  <div className="item-status">
                    <span className="status-icon">{urgency.icon}</span>
                    <span className="status-text">{urgency.text}</span>
                  </div>
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-barcode">{item.barcode}</div>
                  </div>
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
                  <div className="item-forecast">
                    <span className="forecast-icon">⏳</span>
                    <span className="forecast-text">
                      约<strong>{item.days_until_stockout.toFixed(0)}</strong>天后卖完
                    </span>
                    <span className="confidence" style={{ color: confidence.color }}>
                      {confidence.icon} {confidence.text}
                    </span>
                  </div>
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
    const surgeCount = anomalies.filter(a => a.anomaly_type === 'surge').length;
    const dropCount = anomalies.filter(a => a.anomaly_type === 'drop').length;
    const zeroCount = anomalies.filter(a => a.anomaly_type === 'zero').length;

    return (
      <div className="anomaly-section">
        <div className="quick-settings">
          <div className="setting-item">
            <span className="setting-icon">📅</span>
            <span className="setting-label">检测周期</span>
            <div className="setting-buttons">
              {[7, 15, 30].map(d => (
                <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

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
                  <div className="item-type" style={{ backgroundColor: typeInfo.color }}>
                    <span className="type-icon">{typeInfo.icon}</span>
                    <span className="type-text">{typeInfo.text}</span>
                  </div>
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-date">{item.date}</div>
                  </div>
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
                  <div className="severity-badge" style={{ color: severityInfo.color }}>
                    {severityInfo.icon} {severityInfo.text}
                  </div>
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

  // ===================== 主渲染 =====================

  const tabs = [
    { key: 'daily', icon: '📊', text: '今日营业', category: 'report' },
    { key: 'top', icon: '🔥', text: '畅销排行', category: 'report' },
    { key: 'slow', icon: '⚠️', text: '滞销预警', category: 'report' },
    { key: 'profit', icon: '💰', text: '盈利分析', category: 'report' },
    { key: 'restock', icon: '📦', text: '补货建议', category: 'ai' },
    { key: 'anomaly', icon: '🔍', text: '销售异常', category: 'ai' },
  ] as const;

  return (
    <div className="reports-page">
      {/* 标签切换 - 两行布局 */}
      <div className="big-tabs">
        {/* 第一行：统计报表 */}
        <div className="tab-row">
          <span className="tab-row-label">📊 统计报表</span>
          <div className="tab-row-buttons">
            {tabs.filter(t => t.category === 'report').map(tab => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-text">{tab.text}</span>
              </button>
            ))}
          </div>
        </div>
        {/* 第二行：智能分析 */}
        <div className="tab-row">
          <span className="tab-row-label">🤖 智能分析</span>
          <div className="tab-row-buttons">
            {tabs.filter(t => t.category === 'ai').map(tab => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-text">{tab.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="report-content">
        {loading && <div className="loading-state">⏳ 加载中...</div>}
        {error && <div className="error-state">❌ {error}</div>}
        
        {!loading && !error && (
          <>
            {activeTab === 'daily' && renderDailyReport()}
            {activeTab === 'top' && renderTopProducts()}
            {activeTab === 'slow' && renderSlowMovers()}
            {activeTab === 'profit' && renderProfitReport()}
            {activeTab === 'restock' && renderRestockSuggestions()}
            {activeTab === 'anomaly' && renderAnomalies()}
          </>
        )}
      </div>
    </div>
  );
}
