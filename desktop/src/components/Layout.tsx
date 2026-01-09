import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

// 所有菜单项配置
const ALL_MENU_ITEMS = [
  { id: 'dashboard', path: '/', icon: '🏠', label: '仪表盘' },
  { id: 'cashier', path: '/cashier', icon: '💰', label: '收银台' },
  { id: 'products', path: '/products', icon: '📦', label: '商品管理' },
  { id: 'orders', path: '/orders', icon: '📋', label: '订单查询' },
  { id: 'reports', path: '/reports', icon: '📊', label: '数据中心' },
  { id: 'samples', path: '/samples', icon: '🧠', label: 'AI样本' },
  { id: 'database', path: '/database', icon: '🗄️', label: '数据库' },
  { id: 'pairing', path: '/pairing', icon: '🔗', label: '设备配对' },
  { id: 'settings', path: '/settings', icon: '⚙️', label: '系统设置' },
];

// 必须显示的页面（不能被隐藏）
const REQUIRED_PAGES = ['cashier', 'settings'];

// 默认所有页面都显示
const DEFAULT_VISIBILITY: Record<string, boolean> = ALL_MENU_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.id]: true }),
  {}
);

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pageVisibility, setPageVisibility] = useState<Record<string, boolean>>(DEFAULT_VISIBILITY);

  // 从后端加载页面可见性设置
  useEffect(() => {
    const loadVisibility = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/settings`);
        if (response.ok) {
          const settings = await response.json();
          if (settings?.page_visibility) {
            setPageVisibility({ ...DEFAULT_VISIBILITY, ...settings.page_visibility });
          }
        }
      } catch (error) {
        console.error('加载页面可见性设置失败:', error);
      }
    };

    // 初始加载
    loadVisibility();

    // 监听设置变化事件（实时更新）
    const handleSettingsChange = (event: CustomEvent) => {
      const settings = event.detail;
      if (settings?.page_visibility) {
        setPageVisibility({ ...DEFAULT_VISIBILITY, ...settings.page_visibility });
      }
    };

    window.addEventListener('settings-changed', handleSettingsChange as EventListener);

    return () => {
      window.removeEventListener('settings-changed', handleSettingsChange as EventListener);
    };
  }, []);

  // 根据可见性设置过滤菜单项（必显示页面始终显示）
  const visibleMenuItems = ALL_MENU_ITEMS.filter(
    (item) => REQUIRED_PAGES.includes(item.id) || pageVisibility[item.id] !== false
  );

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
          {visibleMenuItems.map((item) => (
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
