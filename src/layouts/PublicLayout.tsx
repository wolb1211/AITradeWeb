import { CircleUserRound, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { SHOW_OFFICIAL_STRATEGIES } from '../config/features'
import { apiRequest, authUserDisplayName, clearSession, getStoredUser, hasSession } from '../lib/api'

const links = [
  { to: '/', label: '首页', end: true },
  ...(SHOW_OFFICIAL_STRATEGIES ? [{ to: '/official-strategies', label: '官方策略' }] : []),
  { to: '/guide', label: '接入指南' },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const loggedIn = hasSession()
  const user = getStoredUser()
  const displayName = authUserDisplayName(user)
  useEffect(() => {
    if (!userMenuOpen) return
    const closeMenu = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [userMenuOpen])
  const logout = async () => {
    try { await apiRequest('/api/v1/auth/logout', { method: 'POST' }) } catch { /* 始终清理本地会话 */ }
    clearSession(); setUserMenuOpen(false); navigate('/login', { replace: true })
  }
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <nav className={open ? 'public-nav is-open' : 'public-nav'}>
            {links.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}>{item.label}</NavLink>
            ))}
          </nav>
          <div className="header-actions">
            {loggedIn ? <div className="user-menu-wrap" ref={userMenuRef}><button className={`user-chip ${userMenuOpen ? 'is-open' : ''}`} type="button" onClick={() => setUserMenuOpen((value) => !value)} aria-haspopup="menu" aria-expanded={userMenuOpen}><span>GL</span><div><strong>{displayName}</strong><small>{user.email}</small></div><Settings size={16} /></button>{userMenuOpen && <div className="user-menu" role="menu"><div className="user-menu-head"><span>GL</span><div><strong>{displayName}</strong><small>{user.email}</small></div></div><Link to="/app" role="menuitem" onClick={() => setUserMenuOpen(false)}><LayoutDashboard size={16} /><span>用户中心</span></Link><Link to="/app/profile" role="menuitem" onClick={() => setUserMenuOpen(false)}><CircleUserRound size={16} /><span>用户资料</span></Link><Link to="/app/security" role="menuitem" onClick={() => setUserMenuOpen(false)}><ShieldCheck size={16} /><span>账户安全</span></Link><button className="user-menu-logout" type="button" role="menuitem" onClick={logout}><LogOut size={16} /><span>退出登录</span></button></div>}</div> : <><Link className="button button-ghost" to="/login">登录</Link><Link className="button button-primary" to="/register">免费开始</Link></>}
          </div>
          <button className="menu-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-label="切换菜单">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="public-footer">
        <div className="footer-grid">
          <div>
            <Brand />
            <p>为 MT4/MT5 提供可配置、可追踪的 AI 策略分析与交易决策服务。</p>
          </div>
          <div><strong>产品</strong>{SHOW_OFFICIAL_STRATEGIES && <Link to="/official-strategies">官方策略</Link>}<Link to="/guide">接入指南</Link></div>
          <div><strong>账户</strong>{loggedIn ? <Link to="/app">用户中心</Link> : <><Link to="/login">登录</Link><Link to="/register">注册</Link></>}</div>
          <div><strong>协议</strong><Link to="/terms">服务条款</Link><Link to="/privacy">隐私政策</Link></div>
        </div>
        <div className="footer-bottom">© 2026 GainLab. AI 分析不构成投资建议。</div>
      </footer>
    </div>
  )
}
