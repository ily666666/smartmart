import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { apiFetch, getServerHost, getServerPort, getApiKey, setServerConfig, isLocalServer, getApiBaseUrl } from '../config';
import './Settings.css';

// 页面配置 - 收银台和系统设置为必显示
const ALL_PAGES = [
  { id: 'dashboard', path: '/', icon: '🏠', label: '仪表盘', required: false },
  { id: 'cashier', path: '/cashier', icon: '💰', label: '收银台', required: true },
  { id: 'products', path: '/products', icon: '📦', label: '商品管理', required: false },
  { id: 'orders', path: '/orders', icon: '📋', label: '订单查询', required: false },
  { id: 'reports', path: '/reports', icon: '📊', label: '数据中心', required: false },
  { id: 'samples', path: '/samples', icon: '🧠', label: 'AI样本', required: false },
  { id: 'database', path: '/database', icon: '🗄️', label: '数据库', required: false },
  { id: 'pairing', path: '/pairing', icon: '🔗', label: '设备配对', required: false },
  { id: 'settings', path: '/settings', icon: '⚙️', label: '系统设置', required: true },
];

// 默认密保问题
const SECURITY_QUESTIONS = [
  '您的出生城市是？',
  '您母亲的姓名是？',
  '您的第一只宠物叫什么？',
  '您小学的名称是？',
  '您最喜欢的电影是？',
];

interface SettingsData {
  password: string;
  security_question: string;
  security_answer: string;
  page_visibility: Record<string, boolean>;
}

const DEFAULT_SETTINGS: SettingsData = {
  password: 'admin',
  security_question: SECURITY_QUESTIONS[0],
  security_answer: '',
  page_visibility: ALL_PAGES.reduce((acc, page) => ({ ...acc, [page.id]: true }), {}),
};

const Settings = () => {
  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // 忘记密码状态
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'no-security' | 'question' | 'reset'>('question');
  const [forgotError, setForgotError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // 设置数据
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // 修改密码状态
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  // 密码可见性
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // 设置密保状态
  const [showSetupSecurity, setShowSetupSecurity] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [setupSecurityLoading, setSetupSecurityLoading] = useState(false);

  // 自启动状态
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 服务器配置
  const [serverHost, setServerHost] = useState(getServerHost());
  const [serverPort, setServerPort] = useState(getServerPort());
  const [serverApiKey, setServerApiKey] = useState(getApiKey());
  const [serverTesting, setServerTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown');
  
  // 消息提示
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载设置
  useEffect(() => {
    loadSettings();
    checkAutostartStatus();
    testServerConnection(true); // 静默测试
  }, []);

  // 从后端 API 加载设置
  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await apiFetch('/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      // 使用默认设置
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setSettingsLoading(false);
    }
  };

  // 保存设置到后端
  const saveSettings = async (newSettings: Partial<SettingsData>) => {
    try {
      const response = await apiFetch('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        // 触发自定义事件，通知 Layout 组件更新
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: data }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('保存设置失败:', error);
      return false;
    }
  };

  const checkAutostartStatus = async () => {
    try {
      const enabled = await invoke<boolean>('autostart_is_enabled');
      setAutostartEnabled(enabled);
    } catch (error) {
      console.error('获取自启动状态失败:', error);
    } finally {
      setAutostartLoading(false);
    }
  };

  const toggleAutostart = async () => {
    setSaving(true);
    try {
      if (autostartEnabled) {
        await invoke('autostart_disable');
        setAutostartEnabled(false);
        showMessage('success', '已禁用开机自启动');
      } else {
        await invoke('autostart_enable');
        setAutostartEnabled(true);
        showMessage('success', '已启用开机自启动');
      }
    } catch (error) {
      showMessage('error', `设置失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // ========== 服务器配置 ==========

  // 测试服务器连接
  const testServerConnection = async (silent = false) => {
    setServerTesting(true);
    try {
      const protocol = serverHost.startsWith('https://') ? 'https' : 'http';
      const host = serverHost.replace(/^https?:\/\//, '');
      const url = `${protocol}://${host}:${serverPort}/health`;
      
      const res = await fetch(url, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok') {
          setServerStatus('ok');
          if (!silent) showMessage('success', '服务器连接成功');
        } else {
          setServerStatus('fail');
          if (!silent) showMessage('error', '服务器响应异常');
        }
      } else {
        setServerStatus('fail');
        if (!silent) showMessage('error', `连接失败 (${res.status})`);
      }
    } catch (e) {
      setServerStatus('fail');
      if (!silent) showMessage('error', '无法连接服务器');
    } finally {
      setServerTesting(false);
    }
  };

  // 保存服务器配置
  const saveServerConfig = () => {
    setServerConfig(serverHost.trim(), serverPort.trim(), serverApiKey);
    showMessage('success', '服务器配置已保存');
    testServerConnection(true);
  };

  // 重置服务器为本地
  const resetToLocal = () => {
    setServerHost('localhost');
    setServerPort('8000');
    setServerApiKey('');
    setServerConfig('localhost', '8000', '');
    showMessage('success', '已恢复为本地服务器');
    setServerStatus('unknown');
    testServerConnection(true);
  };

  // 登录处理 - 使用后端 API 验证
  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    
    try {
      const response = await apiFetch('/settings/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        setLoginPassword('');
      } else {
        setLoginError('密码错误');
      }
    } catch (error) {
      setLoginError('验证失败，请检查网络连接');
    } finally {
      setLoginLoading(false);
    }
  };

  // 忘记密码处理
  const handleForgotPassword = () => {
    setShowForgotPassword(true);
    setSecurityAnswerInput('');
    setNewPasswordInput('');
    setForgotError('');
    
    if (!settings.security_answer) {
      setForgotPasswordStep('no-security');
    } else {
      setForgotPasswordStep('question');
    }
  };

  // 重置为默认密码 - 使用后端 API
  const handleResetToDefault = async () => {
    setResetLoading(true);
    try {
      const response = await apiFetch('/settings/reset-to-default', {
        method: 'POST',
      });
      
      if (response.ok) {
        await loadSettings(); // 重新加载设置
        setShowForgotPassword(false);
        setLoginError('');
        showMessage('success', '密码已重置为默认密码 admin');
      } else {
        setForgotError('重置失败');
      }
    } catch (error) {
      setForgotError('重置失败，请检查网络连接');
    } finally {
      setResetLoading(false);
    }
  };

  // 验证密保答案
  const handleVerifySecurityAnswer = () => {
    if (securityAnswerInput.toLowerCase() === settings.security_answer.toLowerCase()) {
      setForgotPasswordStep('reset');
      setForgotError('');
    } else {
      setForgotError('密保答案错误');
    }
  };

  // 通过密保重置密码 - 使用后端 API
  const handleResetPassword = async () => {
    if (newPasswordInput.length < 4) {
      setForgotError('密码至少4位');
      return;
    }
    
    setResetLoading(true);
    try {
      const response = await apiFetch('/settings/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security_answer: securityAnswerInput,
          new_password: newPasswordInput,
        }),
      });
      
      if (response.ok) {
        await loadSettings();
        setShowForgotPassword(false);
        showMessage('success', '密码已重置，请使用新密码登录');
      } else {
        const data = await response.json();
        setForgotError(data.detail || '重置失败');
      }
    } catch (error) {
      setForgotError('重置失败，请检查网络连接');
    } finally {
      setResetLoading(false);
    }
  };

  // 打开修改密码弹窗 - 先检查是否设置密保
  const openChangePassword = () => {
    if (!settings.security_answer) {
      showMessage('error', '请先设置密保问题，才能修改密码');
      return;
    }
    setShowChangePassword(true);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  // 修改密码处理
  const handleChangePassword = async () => {
    setPasswordError('');
    
    if (oldPassword !== settings.password) {
      setPasswordError('原密码错误');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('新密码至少4位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次密码不一致');
      return;
    }
    
    setChangePasswordLoading(true);
    const success = await saveSettings({ password: newPassword });
    setChangePasswordLoading(false);
    
    if (success) {
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showMessage('success', '密码修改成功');
    } else {
      setPasswordError('保存失败');
    }
  };

  // 设置密保处理
  const handleSetupSecurity = async () => {
    setSecurityError('');
    
    if (!securityAnswer.trim()) {
      setSecurityError('请输入密保答案');
      return;
    }
    
    setSetupSecurityLoading(true);
    const success = await saveSettings({
      security_question: selectedQuestion,
      security_answer: securityAnswer.trim(),
    });
    setSetupSecurityLoading(false);
    
    if (success) {
      setShowSetupSecurity(false);
      setSecurityAnswer('');
      showMessage('success', '密保设置成功');
    } else {
      setSecurityError('保存失败');
    }
  };

  // 页面可见性切换
  const togglePageVisibility = async (pageId: string) => {
    const page = ALL_PAGES.find(p => p.id === pageId);
    if (page?.required) return;
    
    const newVisibility = {
      ...settings.page_visibility,
      [pageId]: !settings.page_visibility[pageId],
    };
    await saveSettings({ page_visibility: newVisibility });
  };

  // 加载中界面
  if (settingsLoading) {
    return (
      <div className="settings">
        <div className="login-container">
          <div className="login-card">
            <div className="loading-spinner">⏳</div>
            <p>正在加载设置...</p>
          </div>
        </div>
      </div>
    );
  }

  // 登录界面
  if (!isAuthenticated) {
    return (
      <div className="settings">
        <div className="login-container">
          <div className="login-card">
            <div className="login-icon">🔐</div>
            <h2>系统设置</h2>
            <p className="login-hint">请输入管理密码以访问设置</p>
            <p className="default-password-hint">💡 默认密码：<strong>admin</strong></p>
            
            {!showForgotPassword ? (
              <>
                <div className="login-form">
                  <div className="password-input-wrapper">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !loginLoading && handleLogin()}
                      autoFocus
                      disabled={loginLoading}
                    />
                    <button 
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      tabIndex={-1}
                    >
                      {showLoginPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {loginError && <div className="error-text">{loginError}</div>}
                  <button 
                    className="btn-primary" 
                    onClick={handleLogin}
                    disabled={loginLoading}
                  >
                    {loginLoading ? '验证中...' : '确认进入'}
                  </button>
                </div>
                <button className="btn-link" onClick={handleForgotPassword}>
                  忘记密码？
                </button>
              </>
            ) : (
              <div className="forgot-password-form">
                {forgotPasswordStep === 'no-security' ? (
                  <>
                    <div className="warning-box">
                      <div className="warning-icon">⚠️</div>
                      <div className="warning-text">
                        您尚未设置密保问题，无法通过密保找回密码。
                      </div>
                    </div>
                    <div className="reset-default-hint">
                      您可以将密码重置为默认密码 <strong>admin</strong>
                    </div>
                    <div className="btn-group">
                      <button className="btn-secondary" onClick={() => setShowForgotPassword(false)}>
                        返回
                      </button>
                      <button 
                        className="btn-danger" 
                        onClick={handleResetToDefault}
                        disabled={resetLoading}
                      >
                        {resetLoading ? '重置中...' : '重置为默认密码'}
                      </button>
                    </div>
                  </>
                ) : forgotPasswordStep === 'question' ? (
                  <>
                    <div className="security-question">
                      <label>密保问题</label>
                      <div className="question-text">{settings.security_question}</div>
                    </div>
                    <input
                      type="text"
                      placeholder="请输入密保答案"
                      value={securityAnswerInput}
                      onChange={(e) => setSecurityAnswerInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifySecurityAnswer()}
                    />
                    {forgotError && <div className="error-text">{forgotError}</div>}
                    <div className="btn-group">
                      <button className="btn-secondary" onClick={() => setShowForgotPassword(false)}>
                        返回
                      </button>
                      <button className="btn-primary" onClick={handleVerifySecurityAnswer}>
                        验证
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="success-text">✅ 验证成功，请设置新密码</div>
                    <input
                      type="password"
                      placeholder="请输入新密码（至少4位）"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !resetLoading && handleResetPassword()}
                      disabled={resetLoading}
                    />
                    {forgotError && <div className="error-text">{forgotError}</div>}
                    <div className="btn-group">
                      <button className="btn-secondary" onClick={() => setShowForgotPassword(false)}>
                        取消
                      </button>
                      <button 
                        className="btn-primary" 
                        onClick={handleResetPassword}
                        disabled={resetLoading}
                      >
                        {resetLoading ? '重置中...' : '重置密码'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 设置主界面
  return (
    <div className="settings">
      <div className="page-header">
        <h1>⚙️ 系统设置</h1>
        <p className="page-subtitle">配置应用程序选项和管理权限（数据存储在数据库中）</p>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`message-toast ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* 服务器配置 */}
      <div className="settings-section full-width">
        <h2 className="section-title">🌐 服务器配置</h2>
        <p className="section-desc">
          默认连接本地服务，也可以配置远程服务器地址
          {!isLocalServer() && <span className="remote-badge">远程</span>}
        </p>
        <div className="settings-card">
          <div className="server-config-grid">
            <div className="server-input-group">
              <label>服务器地址</label>
              <input
                type="text"
                value={serverHost}
                onChange={(e) => { setServerHost(e.target.value); setServerStatus('unknown'); }}
                placeholder="localhost"
              />
            </div>
            <div className="server-input-group port">
              <label>端口</label>
              <input
                type="text"
                value={serverPort}
                onChange={(e) => { setServerPort(e.target.value); setServerStatus('unknown'); }}
                placeholder="8000"
              />
            </div>
            <div className="server-input-group">
              <label>连接密码 <span className="optional-hint">（本地无需填写）</span></label>
              <input
                type="password"
                value={serverApiKey}
                onChange={(e) => setServerApiKey(e.target.value)}
                placeholder="远程服务器需要填写"
              />
            </div>
          </div>
          <div className="server-actions">
            <div className="server-status-display">
              <span className={`server-dot ${serverStatus}`}></span>
              <span className="server-status-text">
                {serverTesting ? '测试中...' : 
                 serverStatus === 'ok' ? `已连接 ${getApiBaseUrl()}` : 
                 serverStatus === 'fail' ? '连接失败' : '未测试'}
              </span>
            </div>
            <div className="server-buttons">
              <button className="btn-secondary" onClick={() => testServerConnection(false)} disabled={serverTesting}>
                {serverTesting ? '测试中...' : '测试连接'}
              </button>
              <button className="btn-primary" onClick={saveServerConfig}>
                保存配置
              </button>
              {!isLocalServer() && (
                <button className="btn-link" onClick={resetToLocal}>
                  恢复本地
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="settings-grid-3">
        {/* 启动设置 */}
        <div className="settings-section">
          <h2 className="section-title">🚀 启动设置</h2>
          <div className="settings-card">
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon blue">🔄</div>
                <div className="setting-content">
                  <div className="setting-label">开机自启动</div>
                  <div className="setting-description">系统启动时自动运行</div>
                </div>
              </div>
              <div className="setting-control">
                {autostartLoading ? (
                  <div className="loading-spinner">⏳</div>
                ) : (
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={autostartEnabled}
                      onChange={toggleAutostart}
                      disabled={saving}
                    />
                    <span className="slider"></span>
                  </label>
                )}
              </div>
            </div>
            <div className={`setting-status ${autostartEnabled ? 'enabled' : ''}`}>
              <span className="status-text">
                {autostartLoading ? '检查中...' : autostartEnabled ? '已启用' : '未启用'}
              </span>
            </div>
          </div>
        </div>

        {/* 安全设置 */}
        <div className="settings-section">
          <h2 className="section-title">🔒 安全设置</h2>
          <div className="settings-card">
            <div className="security-buttons">
              <button className="security-btn" onClick={openChangePassword}>
                <span className="security-btn-icon">🔑</span>
                <span className="security-btn-text">修改密码</span>
              </button>
              <button className="security-btn" onClick={() => setShowSetupSecurity(true)}>
                <span className="security-btn-icon">❓</span>
                <span className="security-btn-text">密保设置</span>
              </button>
            </div>
            <div className="security-status">
              <div className="security-item">
                <span>密保状态</span>
                <span className={settings.security_answer ? 'status-ok' : 'status-warn'}>
                  {settings.security_answer ? '✅ 已设置' : '⚠️ 未设置'}
                </span>
              </div>
              {!settings.security_answer && (
                <div className="security-hint">
                  ⚠️ 请先设置密保，才能修改密码
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 应用信息 */}
        <div className="settings-section">
          <h2 className="section-title">📱 应用信息</h2>
          <div className="settings-card">
            <div className="info-list">
              <div className="info-item-row">
                <span className="info-icon">🛒</span>
                <span className="info-label">SmartMart</span>
                <span className="info-value">v1.0.0</span>
              </div>
              <div className="info-item-row">
                <span className="info-icon">⚡</span>
                <span className="info-label">框架</span>
                <span className="info-value">Tauri + React</span>
              </div>
              <div className="info-item-row">
                <span className="info-icon">🤖</span>
                <span className="info-label">AI</span>
                <span className="info-value">CLIP + FAISS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 页面可见性设置 */}
      <div className="settings-section full-width">
        <h2 className="section-title">👁️ 页面可见性</h2>
        <p className="section-desc">控制左侧导航栏显示哪些页面</p>
        <div className="settings-card">
          <div className="visibility-grid">
            {ALL_PAGES.map((page) => (
              <div 
                key={page.id} 
                className={`visibility-item ${page.required ? 'required' : ''} ${settings.page_visibility[page.id] ? 'visible' : 'hidden'}`}
                onClick={() => togglePageVisibility(page.id)}
              >
                <div className="visibility-icon">{page.icon}</div>
                <div className="visibility-label">{page.label}</div>
                <div className="visibility-toggle">
                  {page.required ? (
                    <span className="required-badge">必需</span>
                  ) : (
                    <span className={`toggle-indicator ${settings.page_visibility[page.id] ? 'on' : 'off'}`}>
                      {settings.page_visibility[page.id] ? '显示' : '隐藏'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      {showChangePassword && (
        <div className="modal-overlay" onClick={() => setShowChangePassword(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>🔑 修改密码</h3>
            <div className="modal-form">
              <div className="password-input-wrapper">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  placeholder="原密码"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  disabled={changePasswordLoading}
                />
                <button 
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  tabIndex={-1}
                >
                  {showOldPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <div className="password-input-wrapper">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="新密码（至少4位）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changePasswordLoading}
                />
                <button 
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                >
                  {showNewPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="确认新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changePasswordLoading}
                />
                <button 
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {passwordError && <div className="error-text">{passwordError}</div>}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowChangePassword(false)}>取消</button>
              <button 
                className="btn-primary" 
                onClick={handleChangePassword}
                disabled={changePasswordLoading}
              >
                {changePasswordLoading ? '保存中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 密保设置弹窗 */}
      {showSetupSecurity && (
        <div className="modal-overlay" onClick={() => setShowSetupSecurity(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>❓ 设置密保问题</h3>
            <p className="modal-hint">设置密保问题后，忘记密码时可以通过密保找回</p>
            <div className="modal-form">
              <select
                value={selectedQuestion}
                onChange={(e) => setSelectedQuestion(e.target.value)}
                disabled={setupSecurityLoading}
              >
                {SECURITY_QUESTIONS.map((q, i) => (
                  <option key={i} value={q}>{q}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="请输入密保答案"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                disabled={setupSecurityLoading}
              />
              {securityError && <div className="error-text">{securityError}</div>}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSetupSecurity(false)}>取消</button>
              <button 
                className="btn-primary" 
                onClick={handleSetupSecurity}
                disabled={setupSecurityLoading}
              >
                {setupSecurityLoading ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
