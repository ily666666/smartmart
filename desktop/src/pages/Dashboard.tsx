import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Dashboard.css';

interface Stats {
  todaySales: number;
  todayOrders: number;
  todayRevenue: number;
  lowStockCount: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    todaySales: 0,
    todayOrders: 0,
    todayRevenue: 0,
    lowStockCount: 0,
  });
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 获取今日销售数据
      const response = await fetch(`${API_BASE_URL}/reports/sales_daily?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        setStats({
          todaySales: data.total_quantity || 0,
          todayOrders: data.total_orders || 0,
          todayRevenue: data.total_revenue || 0,
          lowStockCount: 0, // 可以添加库存预警API
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: '💰', label: '开始收银', path: '/cashier', color: '#3498db' },
    { icon: '📦', label: '商品管理', path: '/products', color: '#2ecc71' },
    { icon: '📋', label: '订单查询', path: '/orders', color: '#9b59b6' },
    { icon: '📊', label: '查看报表', path: '/reports', color: '#e67e22' },
  ];

  const statCards = [
    {
      icon: '📈',
      label: '今日销量',
      value: stats.todaySales,
      unit: '件',
      color: '#3498db',
      trend: '+12%',
    },
    {
      icon: '🛒',
      label: '今日订单',
      value: stats.todayOrders,
      unit: '单',
      color: '#2ecc71',
      trend: '+8%',
    },
    {
      icon: '💵',
      label: '今日营收',
      value: `¥${stats.todayRevenue.toFixed(2)}`,
      unit: '',
      color: '#e74c3c',
      trend: '+15%',
    },
    {
      icon: '⚠️',
      label: '低库存',
      value: stats.lowStockCount,
      unit: '个',
      color: '#f39c12',
      trend: '',
    },
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>欢迎回来！👋</h1>
        <p className="page-subtitle">这是你今天的业务概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card" style={{ borderLeftColor: card.color }}>
            <div className="stat-icon" style={{ background: card.color }}>
              {card.icon}
            </div>
            <div className="stat-content">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">
                {card.value}
                {card.unit && <span className="stat-unit">{card.unit}</span>}
              </div>
              {card.trend && (
                <div className="stat-trend positive">{card.trend}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 快捷操作 */}
      <div className="section">
        <h2 className="section-title">快捷操作</h2>
        <div className="quick-actions">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="quick-action-btn"
              onClick={() => navigate(action.path)}
              style={{ background: `linear-gradient(135deg, ${action.color}, ${action.color}dd)` }}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 系统信息 */}
      <div className="section">
        <h2 className="section-title">系统信息</h2>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">🖥️</div>
            <div className="info-content">
              <div className="info-label">系统版本</div>
              <div className="info-value">v1.0.0</div>
            </div>
          </div>
          <div className="info-card">
            <div className="info-icon">🔌</div>
            <div className="info-content">
              <div className="info-label">连接状态</div>
              <div className="info-value status-ok">● 正常</div>
            </div>
          </div>
          <div className="info-card">
            <div className="info-icon">💾</div>
            <div className="info-content">
              <div className="info-label">数据库</div>
              <div className="info-value">SQLite</div>
            </div>
          </div>
          <div className="info-card">
            <div className="info-icon">🤖</div>
            <div className="info-content">
              <div className="info-label">AI 服务</div>
              <div className="info-value status-ok">● 运行中</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

