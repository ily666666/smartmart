import { useState, useEffect } from 'react';
import { apiFetch, getApiBaseUrl, getApiKey, getServerPort, isLocalServer } from '../config';
import QRCode from 'qrcode';
import './Pairing.css';

interface DeviceInfo {
  id: number;
  device_id: string;
  device_type: string | null;
  device_name: string | null;
  authenticated: boolean;
  last_seen: string | null;
  created_at: string | null;
}

export default function Pairing() {
  const [token, setToken] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // 本地模式下的 IP 选择
  const [allIps, setAllIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [recommendedIp, setRecommendedIp] = useState<string>('');
  
  // 设备列表相关状态
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /** 判断是否本地后端（需要 IP 选择器） */
  const isLocal = isLocalServer();

  /** 
   * 获取 QR 码中的 server_url
   * - 远程服务器：直接用桌面端配置的地址
   * - 本地后端：用选中的局域网 IP + 端口
   */
  function getQrServerUrl(): string {
    if (isLocal && selectedIp) {
      const port = getServerPort();
      return `http://${selectedIp}:${port}`;
    }
    return getApiBaseUrl();
  }

  function copyToken() {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // 获取已配对设备列表
  async function fetchDevices() {
    setDevicesLoading(true);
    try {
      const response = await apiFetch('/pairing/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('获取设备列表失败:', err);
    } finally {
      setDevicesLoading(false);
    }
  }

  // 删除设备
  async function deleteDevice(deviceId: string) {
    try {
      const response = await apiFetch(`/pairing/devices/${deviceId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setDevices(devices.filter(d => d.device_id !== deviceId));
        setDeleteConfirm(null);
      } else {
        const data = await response.json();
        alert(data.detail || '删除失败');
      }
    } catch (err) {
      console.error('删除设备失败:', err);
      alert('删除设备失败');
    }
  }

  // 格式化时间显示
  function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 获取设备类型显示名称
  function getDeviceTypeName(type: string | null): string {
    switch (type) {
      case 'miniapp': return '📱 小程序';
      case 'desktop': return '💻 桌面端';
      case 'scanner': return '📷 扫码器';
      default: return '📟 未知设备';
    }
  }

  useEffect(() => {
    generatePairingCode();
    fetchDevices();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && token) {
      generatePairingCode();
    }
  }, [countdown]);

  // 本地模式下切换 IP 时，重新生成 QR 码
  useEffect(() => {
    if (isLocal && selectedIp && token) {
      updateQrCode();
    }
  }, [selectedIp]);

  /** 生成 QR 码图片 */
  async function updateQrCode() {
    const qrData = JSON.stringify({
      type: 'smartmart_pairing',
      server_url: getQrServerUrl(),
      api_key: getApiKey(),
      token: token,
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    setQrCodeUrl(qrDataUrl);
  }

  /**
   * 生成配对码
   * 
   * 后端返回 token + 局域网 IP 列表
   * 桌面端根据自身配置决定 QR 码中的 server_url：
   * - 本地后端 → 用后端返回的局域网 IP
   * - 远程服务器 → 用桌面端配置的远程地址
   */
  async function generatePairingCode() {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(
        '/pairing/generate_pairing_code?validity_seconds=300',
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        const newToken = data.token;
        const expiresIn = data.expires_in || 300;
        
        setToken(newToken);
        setCountdown(expiresIn);

        // 本地模式：保存 IP 列表供选择
        if (isLocal) {
          const ips: string[] = data.all_ips || [];
          const recommended: string = data.local_ip || (ips.length > 0 ? ips[0] : '127.0.0.1');
          setAllIps(ips);
          setRecommendedIp(recommended);
          // 如果还没选过 IP，默认用推荐的
          if (!selectedIp || !ips.includes(selectedIp)) {
            setSelectedIp(recommended);
          }
        }

        // 生成 QR 码
        const serverUrl = isLocal
          ? `http://${data.local_ip || '127.0.0.1'}:${getServerPort()}`
          : getApiBaseUrl();

        const qrData = JSON.stringify({
          type: 'smartmart_pairing',
          server_url: serverUrl,
          api_key: getApiKey(),
          token: newToken,
        });

        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        setQrCodeUrl(qrDataUrl);
      } else {
        throw new Error('生成配对码失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="pairing-page">
      <header className="page-header">
        <h1>📱 设备配对</h1>
        <p className="subtitle">小程序扫码快速配对（自动配置服务器地址 + 密码 + 联动授权）</p>
      </header>

      <div className="content">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>生成配对码中...</p>
          </div>
        )}

        {error && (
          <div className="error-box">
            <p>❌ {error}</p>
            <button onClick={generatePairingCode}>重试</button>
          </div>
        )}

        {!loading && !error && token && (
          <div className="pairing-container">
            <div className="qr-section">
              <div className="qr-code-wrapper">
                {qrCodeUrl && <img src={qrCodeUrl} alt="配对二维码" />}
              </div>

              <div className="countdown">
                {countdown > 0 ? (
                  <>
                    <span className="countdown-label">有效期：</span>
                    <span className="countdown-time">{formatTime(countdown)}</span>
                  </>
                ) : (
                  <span className="expired">已过期</span>
                )}
              </div>

              <button className="refresh-btn" onClick={generatePairingCode}>
                🔄 刷新二维码
              </button>
            </div>

            <div className="info-section">
              <h3>配对信息</h3>

              {/* 本地模式：显示 IP 选择器 */}
              {isLocal && allIps.length > 0 && (
                <div className="info-item">
                  <div className="info-label">选择本机 IP（点击切换）</div>
                  <div className="ip-selector">
                    {[...allIps].sort((a, b) => {
                      if (a === recommendedIp) return -1;
                      if (b === recommendedIp) return 1;
                      return 0;
                    }).map(ip => (
                      <button
                        key={ip}
                        className={`ip-option ${ip === selectedIp ? 'active' : ''}`}
                        onClick={() => setSelectedIp(ip)}
                      >
                        {ip}
                        {ip === recommendedIp && <span className="recommended">推荐</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="info-item">
                <div className="info-label">QR 码中的服务器地址</div>
                <div className="info-value code">{getQrServerUrl()}</div>
              </div>

              <div className="info-item">
                <div className="info-label">连接密码</div>
                <div className="info-value code">{getApiKey() ? '••••••••' : '（未设置）'}</div>
              </div>

              <div className="info-item">
                <div className="info-label">
                  配对 Token（点击复制）
                  {copied && <span className="copy-tip">✓ 已复制</span>}
                </div>
                <div 
                  className="info-value code token copyable"
                  onClick={copyToken}
                  title="点击复制"
                >
                  {token}
                </div>
              </div>

              <div className="instructions">
                <h4>📋 使用说明</h4>
                <ol>
                  <li>打开微信小程序</li>
                  <li>进入"设置"页面</li>
                  <li>点击"扫码配对"按钮</li>
                  <li>扫描上方二维码</li>
                  <li>自动填入服务器地址、密码，并与桌面端联动</li>
                </ol>
              </div>

              <div className="security-note">
                <h4>🔒 扫码包含的内容</h4>
                <ul>
                  <li>服务器地址（{isLocal ? '本机局域网 IP' : '远程服务器地址'}）</li>
                  <li>连接密码（小程序自动保存）</li>
                  <li>配对 Token（5分钟有效，一次性，用于 WebSocket 联动授权）</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 已配对设备列表 */}
        <div className="devices-section">
          <div className="devices-header">
            <h3>📋 已配对设备</h3>
            <button className="refresh-devices-btn" onClick={fetchDevices} disabled={devicesLoading}>
              🔄 刷新
            </button>
          </div>

          {devicesLoading ? (
            <div className="devices-loading">
              <div className="spinner small"></div>
              <span>加载中...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="no-devices">
              <p>📭 暂无已配对的设备</p>
              <p className="hint">使用上方二维码扫描配对新设备</p>
            </div>
          ) : (
            <div className="devices-list">
              {devices.map(device => (
                <div key={device.device_id} className="device-card">
                  <div className="device-icon">
                    {getDeviceTypeName(device.device_type).split(' ')[0]}
                  </div>
                  <div className="device-info">
                    <div className="device-name">
                      {device.device_name || device.device_id.substring(0, 12) + '...'}
                    </div>
                    <div className="device-meta">
                      <span className="device-type">{getDeviceTypeName(device.device_type).split(' ')[1]}</span>
                      <span className={`device-status ${device.authenticated ? 'authenticated' : ''}`}>
                        {device.authenticated ? '✓ 已认证' : '○ 未认证'}
                      </span>
                    </div>
                    <div className="device-times">
                      <span>最后活跃: {formatDateTime(device.last_seen)}</span>
                    </div>
                  </div>
                  <div className="device-actions">
                    {deleteConfirm === device.device_id ? (
                      <div className="delete-confirm">
                        <span>确认删除?</span>
                        <button className="confirm-yes" onClick={() => deleteDevice(device.device_id)}>是</button>
                        <button className="confirm-no" onClick={() => setDeleteConfirm(null)}>否</button>
                      </div>
                    ) : (
                      <button 
                        className="delete-btn" 
                        onClick={() => setDeleteConfirm(device.device_id)}
                        title="删除设备"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
