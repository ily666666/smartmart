import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: '🏠', label: '仪表盘' },
    { path: '/cashier', icon: '💰', label: '收银台' },
    { path: '/products', icon: '📦', label: '商品管理' },
    { path: '/orders', icon: '📋', label: '订单查询' },
    { path: '/reports', icon: '📊', label: '数据中心' },
    { path: '/samples', icon: '🧠', label: 'AI样本' },
    { path: '/database', icon: '🗄️', label: '数据库' },
    { path: '/pairing', icon: '🔗', label: '设备配对' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🛒</div>
          <h2>SmartMart</h2>
          <p className="version">v1.0</p>
        </div>

        <nav className="nav-menu">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">👤</div>
            <div className="user-details">
              <div className="user-name">收银员01</div>
              <div className="user-role">管理员</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;

