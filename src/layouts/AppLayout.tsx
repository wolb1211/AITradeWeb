import {
  Activity, BookOpen, Bot, ChevronLeft, CircleUserRound, Coins, Download, FileClock,
  LayoutDashboard, LogOut, Menu, ReceiptText, Settings, ShieldCheck, UsersRound, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import {
  apiRequest, authUserDisplayName, authUserVipDetail, authUserVipLabel,
  clearSession, getStoredUser, saveStoredUser, type AuthUser,
} from '../lib/api'

const primaryNav = [
  { to: '/app', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/app/strategies', label: '我的策略', icon: Bot },
  { to: '/app/orders', label: '历史订单', icon: ReceiptText },
  { to: '/app/wallet', label: 'AI 余额', icon: Coins },
  { to: '/app/usage', label: '使用记录', icon: FileClock },
  { to: '/app/ea-downloads', label: 'EA 下载', icon: Download },
]

const accountNav = [
  { to: '/app/profile', label: '用户资料', icon: CircleUserRound },
  { to: '/app/security', label: '账户安全', icon: ShieldCheck },
]

const titles: Record<string, string> = {
  '/app': '账户概览',
  '/app/strategies': '我的策略',
  '/app/strategies/new': '创建策略',
  '/app/orders': '历史订单',
  '/app/wallet': 'AI 余额',
  '/app/usage': 'AI 使用记录',
  '/app/ea-downloads': 'EA 下载',
  '/app/profile': '用户资料',
  '/app/security': '账户安全',
  '/app/agent': '代理中心',
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(getStoredUser)
  const displayName = authUserDisplayName(user)
  const vipLabel = authUserVipLabel(user)
  const vipDetail = authUserVipDetail(user)
  const balance = Number(user.ai_balance || 0)
  const isAgent = Number(user.agent_level || 0) > 0
  useEffect(() => {
    const refreshLocalUser = () => setUser(getStoredUser())
    window.addEventListener('gainlab-auth-user-updated', refreshLocalUser)
    apiRequest<AuthUser>('/api/v1/auth/me')
      .then((latestUser) => { saveStoredUser(latestUser); setUser(latestUser) })
      .catch(() => { /* 网络错误时保留当前有效会话 */ })
    return () => window.removeEventListener('gainlab-auth-user-updated', refreshLocalUser)
  }, [location.pathname])
  useEffect(() => {
    if (!userMenuOpen) return
    const closeMenu = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [userMenuOpen])
  const logout = async () => {
    try { await apiRequest('/api/v1/auth/logout', { method: 'POST' }) } catch { /* 本地状态仍需清理 */ }
    clearSession(); navigate('/login', { replace: true })
  }
  const title = titles[location.pathname] || (location.pathname.includes('/strategies/') ? '策略详情' : '用户中心')

  const navGroup = (items: typeof primaryNav) => items.map((item) => {
    const Icon = item.icon
    return (
      <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined}>
        <Icon size={19} /><span>{item.label}</span>
      </NavLink>
    )
  })

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={mobileOpen ? 'app-sidebar is-open' : 'app-sidebar'}>
        <div className="sidebar-brand"><Brand compact={collapsed} /><button type="button" className="mobile-close" onClick={() => setMobileOpen(false)}><X /></button></div>
        <nav className="sidebar-nav">
          <span className="nav-caption">工作台</span>
          {navGroup(primaryNav)}
          <span className="nav-caption">账户</span>
          {navGroup(isAgent ? [...accountNav, { to: '/app/agent', label: '代理中心', icon: UsersRound }] : accountNav)}
        </nav>
        <div className="sidebar-help">
          <BookOpen size={19} />
          <div><strong>MT 接入指南</strong><small>查看 EA 配置步骤</small></div>
          <Link to="/guide" aria-label="打开接入指南" />
        </div>
        <button className="collapse-button" type="button" onClick={() => setCollapsed((value) => !value)}>
          <ChevronLeft size={17} /><span>收起菜单</span>
        </button>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="关闭菜单" />}
      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-title">
            <button className="topbar-menu" type="button" onClick={() => setMobileOpen(true)}><Menu /></button>
            <div><span>GainLab AI Trader</span><strong>{title}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="service-state"><Activity size={15} /><span>服务正常</span></div>
            <div className={`vip-chip ${user.vip_active ? 'is-active' : 'is-inactive'}`} title={vipDetail}><ShieldCheck size={15} /><span>{vipLabel}</span></div>
            <Link className="balance-chip" to="/app/wallet"><Coins size={16} /><span>¥{balance.toFixed(2)}</span></Link>
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button className={`user-chip ${userMenuOpen ? 'is-open' : ''}`} type="button" onClick={() => setUserMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={userMenuOpen}><span>GL</span><div><strong>{displayName}</strong><small>{user.email || ''}</small></div><Settings size={16} /></button>
              {userMenuOpen && <div className="user-menu" role="menu">
                <div className="user-menu-head"><span>GL</span><div><strong>{displayName}</strong><small>{user.email || ''}</small></div></div>
                <div className={`user-menu-vip ${user.vip_active ? 'is-active' : 'is-inactive'}`}><span><ShieldCheck size={15} />{vipLabel}</span><small>{vipDetail}</small></div>
                <Link to="/app" role="menuitem" onClick={() => setUserMenuOpen(false)}><LayoutDashboard size={16} /><span>用户中心</span></Link>
                <Link to="/app/profile" role="menuitem" onClick={() => setUserMenuOpen(false)}><CircleUserRound size={16} /><span>用户资料</span></Link>
                <Link to="/app/security" role="menuitem" onClick={() => setUserMenuOpen(false)}><ShieldCheck size={16} /><span>账户安全</span></Link>
                {isAgent && <Link to="/app/agent" role="menuitem" onClick={() => setUserMenuOpen(false)}><UsersRound size={16} /><span>代理中心</span></Link>}
                <button className="user-menu-logout" type="button" role="menuitem" onClick={logout}><LogOut size={16} /><span>退出登录</span></button>
              </div>}
            </div>
          </div>
        </header>
        <div className="app-content"><Outlet /></div>
      </div>
    </div>
  )
}
