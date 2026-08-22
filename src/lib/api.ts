const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8800').replace(/\/$/, '')

export type AuthUser = {
  id: number
  email: string
  nickname: string
  status: string
  vip_level: number
  vip_active: boolean
  vip_expires_at: string
  max_strategy_keys: number
  agent_level: number
  invite_code: string
  referrer_user_id?: number | null
  referral_count?: number
  ai_balance: string
  credit_limit: string
  available_balance: string
  low_balance_threshold: string
  balance_warning: boolean
  credit_exhausted: boolean
  email_verified?: boolean
  password_configured?: boolean
  created_at?: string
}

export type AuthSession = {
  token: string
  expires_at: string
  user: AuthUser
}

const errorMessages: Record<string, string> = {
  invalid_email: '请输入正确的邮箱地址',
  invalid_password: '密码长度需要为 8–128 位',
  weak_password: '密码必须同时包含字母和数字',
  invalid_credentials: '邮箱或密码错误',
  email_not_verified: '邮箱尚未验证，请使用验证码登录完成激活',
  email_already_registered: '该邮箱已经注册，请直接登录',
  user_not_found: '未找到该邮箱对应的账号',
  user_disabled: '该账号已被禁用，请联系管理员',
  invalid_verification_code: '验证码错误或已失效',
  expired: '验证码已过期，请重新发送',
  too_many_attempts: '验证码错误次数过多，请重新发送',
  verification_too_frequent: '发送过于频繁，请稍后再试',
  mail_not_configured: '邮件服务尚未配置',
  mail_send_failed: '验证码邮件发送失败，请稍后重试',
  invalid_session: '登录状态已失效，请重新登录',
  invalid_current_password: '当前密码不正确',
  email_unchanged: '新邮箱与当前邮箱相同',
  session_not_found: '该登录会话不存在或已经退出',
  invalid_nickname: '昵称长度不能超过 100 个字符',
  invalid_ai_mode: '请选择正确的 AI 使用方式',
  invalid_ai_endpoint: '请选择一个可用的 GL AI 模型',
  custom_ai_config_required: '请完整填写自定义 AI 的 Base URL、模型名称和 API Key',
  invalid_strategy_settings: '请检查仓位、风险和最大持仓设置',
  vip_required: 'VIP 未开通或已到期，暂时不能创建策略',
  strategy_key_limit_reached: '策略 Key 数量已达到当前账户上限',
  official_strategy_not_found: '所选 GL 策略不存在或已下架',
  invalid_invite_code: '邀请码无效或该代理已停止邀请',
  agent_required: '当前账号不是代理',
}

export class ApiError extends Error {
  code: string

  constructor(code: string) {
    super(errorMessages[code] || code || '请求失败，请稍后重试')
    this.code = code
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('gainlab_auth_token')
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  let payload: { code?: number; data?: T; detail?: string; message?: string }
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('network_error')
  }
  if (!response.ok || payload.code !== 0) {
    throw new ApiError(payload.detail || payload.message || 'request_failed')
  }
  return payload.data as T
}

export function post<T>(path: string, data: object): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data) })
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem('gainlab_auth_token', session.token)
  localStorage.setItem('gainlab_auth_user', JSON.stringify(session.user))
}

export function getStoredUser(): Partial<AuthUser> {
  try {
    return JSON.parse(localStorage.getItem('gainlab_auth_user') || '{}') as Partial<AuthUser>
  } catch {
    return {}
  }
}

export function saveStoredUser(user: AuthUser): void {
  localStorage.setItem('gainlab_auth_user', JSON.stringify(user))
  window.dispatchEvent(new Event('gainlab-auth-user-updated'))
}

export function authUserDisplayName(user: Partial<AuthUser>): string {
  return String(user.nickname || '').trim() || String(user.email || '').trim()
}

export function authUserVipLabel(user: Partial<AuthUser>): string {
  const level = Math.max(0, Number(user.vip_level) || 0)
  return `VIP ${level}`
}

export function authUserVipDetail(user: Partial<AuthUser>): string {
  const expiresAt = String(user.vip_expires_at || '').trim()
  if ((Number(user.vip_level) || 0) <= 0) return '尚未开通 VIP'
  if (!expiresAt) return '未设置到期时间，当前已到期'

  const expires = new Date(expiresAt)
  const formatted = Number.isNaN(expires.getTime())
    ? expiresAt
    : new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(expires)
  return user.vip_active ? `有效期至 ${formatted}` : `已于 ${formatted} 到期`
}

export function hasSession(): boolean {
  return Boolean(localStorage.getItem('gainlab_auth_token') && authUserDisplayName(getStoredUser()))
}

export function clearSession(): void {
  localStorage.removeItem('gainlab_auth_token')
  localStorage.removeItem('gainlab_auth_user')
}
