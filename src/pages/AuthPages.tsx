import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { Modal } from '@mantine/core'
import { type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { LegalDocumentContent, legalLead } from '../components/LegalDocumentContent'
import { ApiError, type AuthSession, post, saveSession } from '../lib/api'

function AuthShell({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <div className="auth-aside-grid" />
        <Brand />
        <div className="auth-aside-copy"><span><Sparkles size={15} />GAINLAB AI TRADER</span><h1>连接您的策略<br />与交易终端</h1><p>在统一的工作台中配置 AI、控制风险并追踪每一次策略运行。</p><ul><li><Check />MT4 / MT5 统一接入</li><li><Check />官方与自定义 AI 模型</li><li><Check />余额、用量与订单全程留痕</li></ul></div>
        <small className="auth-risk">AI 交易存在市场风险，请在理解策略逻辑后谨慎使用。</small>
      </div>
      <main className="auth-main">
        <Link className="auth-back" to="/"><ArrowLeft size={16} />返回首页</Link>
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </main>
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder = '请输入密码' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false)
  return <label className="input-wrap"><LockKeyhole size={18} /><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required /><button type="button" onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></label>
}

function Message({ error, success }: { error: string; success?: string }) {
  if (!error && !success) return null
  return <div className={`auth-message ${error ? 'error' : 'success'}`}>{error || success}</div>
}

function errorText(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setTimeout(() => setSeconds((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])
  return [seconds, setSeconds] as const
}

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [seconds, setSeconds] = useCountdown()

  const sendCode = async () => {
    if (!email || seconds > 0) return
    setError(''); setSuccess('')
    try {
      await post('/api/v1/auth/login/code/send', { email })
      setSeconds(60); setSuccess('验证码已发送，请检查邮箱')
    } catch (requestError) { setError(errorText(requestError)) }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError(''); setSuccess('')
    try {
      const session = mode === 'password'
        ? await post<AuthSession>('/api/v1/auth/login/password', { email, password })
        : await post<AuthSession>('/api/v1/auth/login/code', { email, code })
      saveSession(session); navigate('/app')
    } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }

  return <AuthShell eyebrow="WELCOME BACK" title="登录您的账号" description="继续管理策略、GL AI余额和交易记录。" footer={<>还没有账号？<Link to="/register">立即注册</Link></>}>
    <div className="auth-tabs"><button className={mode === 'password' ? 'active' : ''} type="button" onClick={() => { setMode('password'); setError('') }}>密码登录</button><button className={mode === 'code' ? 'active' : ''} type="button" onClick={() => { setMode('code'); setError('') }}>验证码登录</button></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>邮箱账号</span><div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></div></label>
      {mode === 'password' ? <label><span>登录密码</span><PasswordInput value={password} onChange={setPassword} /><Link className="field-link" to="/forgot-password">忘记密码？</Link></label> : <label><span>邮箱验证码</span><div className="input-row"><div className="input-wrap"><KeyRound size={18} /><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6 位验证码" maxLength={6} required /></div><button className="code-button" type="button" disabled={seconds > 0} onClick={sendCode}>{seconds > 0 ? `${seconds}s` : '发送验证码'}</button></div></label>}
      <Message error={error} success={success} />
      <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? '正在登录…' : '登录账号'}<ArrowRight size={17} /></button>
    </form>
  </AuthShell>
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryInvite = (searchParams.get('invite') || '').trim().toUpperCase()
  const [inviteCode] = useState(() => queryInvite || localStorage.getItem('gainlab_invite_code') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [legalType, setLegalType] = useState<'terms' | 'privacy' | null>(null)
  useEffect(() => {
    if (queryInvite) localStorage.setItem('gainlab_invite_code', queryInvite)
  }, [queryInvite])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (password !== confirm) return setError('两次输入的密码不一致')
    setLoading(true)
    try {
      await post('/api/v1/auth/register', { email, password, invite_code: inviteCode })
      localStorage.removeItem('gainlab_invite_code')
      navigate(`/verify-email?purpose=register&email=${encodeURIComponent(email)}`)
    } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }
  return <AuthShell eyebrow="CREATE ACCOUNT" title="创建独立账号" description="注册并验证邮箱后即可进入工作台；使用策略需要开通 VIP。" footer={<>已有账号？<Link to="/login">返回登录</Link></>}>
    <form className="auth-form" onSubmit={submit}>
      {inviteCode && <div className="invite-register-notice">您正在通过邀请码 <strong>{inviteCode}</strong> 注册</div>}
      <label><span>邮箱账号</span><div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></div></label>
      <label><span>设置密码</span><PasswordInput value={password} onChange={setPassword} placeholder="至少 8 位，同时包含字母和数字" /></label>
      <label><span>确认密码</span><PasswordInput value={confirm} onChange={setConfirm} placeholder="再次输入密码" /></label>
      <label className="check-row"><input type="checkbox" required /><span>我已阅读并同意 <button className="legal-inline-link" type="button" onClick={() => setLegalType('terms')}>服务条款</button> 和 <button className="legal-inline-link" type="button" onClick={() => setLegalType('privacy')}>隐私政策</button></span></label>
      <Message error={error} />
      <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? '正在发送…' : '继续验证邮箱'}<ArrowRight size={17} /></button>
    </form>
    <Modal
      opened={legalType !== null}
      onClose={() => setLegalType(null)}
      title={legalType === 'privacy' ? 'GainLab AI Trader 隐私政策' : 'GainLab AI Trader 服务条款'}
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.72, blur: 4 }}
      classNames={{ content: 'register-legal-modal', header: 'register-legal-header', body: 'register-legal-body' }}
    >
      {legalType && <RegistrationLegalDocument type={legalType} />}
    </Modal>
  </AuthShell>
}

function RegistrationLegalDocument({ type }: { type: 'terms' | 'privacy' }) {
  return <div className="register-legal-document">
    <span>最后更新：2026 年 8 月 20 日</span>
    <p className="register-legal-lead">{legalLead[type]}</p>
    <LegalDocumentContent type={type} />
  </div>
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('')
    try {
      await post('/api/v1/auth/password/forgot', { email })
      navigate(`/verify-email?purpose=reset&email=${encodeURIComponent(email)}`)
    } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="找回账号密码" description="我们将向您的注册邮箱发送身份验证码。" footer={<Link to="/login"><ArrowLeft size={14} />返回登录</Link>}>
    <div className="auth-symbol"><ShieldCheck /></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>注册邮箱</span><div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></div></label>
      <Message error={error} />
      <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? '正在发送…' : '发送验证码'}<ArrowRight size={17} /></button>
    </form>
  </AuthShell>
}

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = params.get('email') || ''
  const isReset = params.get('purpose') === 'reset'
  const purpose = isReset ? 'reset_password' : 'register'
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [seconds, setSeconds] = useCountdown()
  const codeInputs = useRef<Array<HTMLInputElement | null>>([])
  const focusCodeInput = (index: number) => window.requestAnimationFrame(() => {
    codeInputs.current[Math.max(0, Math.min(index, 5))]?.focus()
    codeInputs.current[Math.max(0, Math.min(index, 5))]?.select()
  })
  const fillCode = (rawValue: string, requestedStart = 0) => {
    const values = rawValue.replace(/\D/g, '').slice(0, 6).split('')
    if (!values.length) return
    const start = values.length === 6 ? 0 : requestedStart
    setDigits((current) => {
      const next = [...current]
      values.slice(0, 6 - start).forEach((value, offset) => { next[start + offset] = value })
      return next
    })
    focusCodeInput(Math.min(start + values.length, 5))
  }
  const update = (index: number, value: string) => {
    const numeric = value.replace(/\D/g, '')
    if (numeric.length > 1) return fillCode(numeric, index)
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? numeric : item))
    if (numeric && index < 5) focusCodeInput(index + 1)
  }
  const pasteCode = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault()
    fillCode(event.clipboardData.getData('text'), index)
  }
  const navigateCode = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      setDigits((current) => current.map((item, itemIndex) => itemIndex === index - 1 ? '' : item))
      focusCodeInput(index - 1)
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault(); focusCodeInput(index - 1)
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault(); focusCodeInput(index + 1)
    }
  }

  const resend = async () => {
    if (seconds > 0) return
    setError(''); setSuccess('')
    try {
      await post('/api/v1/auth/code/resend', { email, purpose })
      setSeconds(60); setSuccess('验证码已重新发送')
    } catch (requestError) { setError(errorText(requestError)) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    const code = digits.join('')
    if (code.length !== 6) return setError('请输入完整的 6 位验证码')
    if (isReset && password !== confirm) return setError('两次输入的密码不一致')
    setLoading(true)
    try {
      const session = isReset
        ? await post<AuthSession>('/api/v1/auth/password/reset', { email, code, password })
        : await post<AuthSession>('/api/v1/auth/register/verify', { email, code })
      saveSession(session); navigate('/app')
    } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }

  return <AuthShell eyebrow={isReset ? 'RESET PASSWORD' : 'EMAIL VERIFICATION'} title={isReset ? '验证并设置新密码' : '验证您的邮箱'} description={`验证码已发送至 ${email || '您的邮箱'}，请在 10 分钟内完成验证。`} footer={<>没有收到？<button type="button" disabled={seconds > 0} onClick={resend}>{seconds > 0 ? `${seconds} 秒后重发` : '重新发送验证码'}</button></>}>
    <div className="auth-symbol"><Mail /></div>
    <form className="auth-form" onSubmit={submit}>
      <label><span>6 位邮箱验证码</span><div className="code-boxes">{digits.map((digit, index) => <input key={index} ref={(element) => { codeInputs.current[index] = element }} value={digit} onChange={(event) => update(index, event.target.value)} onPaste={(event) => pasteCode(event, index)} onKeyDown={(event) => navigateCode(event, index)} onFocus={(event) => event.currentTarget.select()} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} aria-label={`验证码第 ${index + 1} 位`} />)}</div></label>
      {isReset && <><label><span>设置新密码</span><PasswordInput value={password} onChange={setPassword} placeholder="至少 8 位，同时包含字母和数字" /></label><label><span>确认新密码</span><PasswordInput value={confirm} onChange={setConfirm} /></label></>}
      <Message error={error} success={success} />
      <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? '正在验证…' : (isReset ? '重置密码并登录' : '确认并继续')}<ArrowRight size={17} /></button>
      <div className="secure-hint"><ShieldCheck size={15} />验证成功后，已有测试账号将保留原用户 ID 和策略数据。</div>
    </form>
  </AuthShell>
}
