import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bot, BrainCircuit,
  Check, ChevronDown, ChevronRight, CircleDollarSign, Clock3, Coins, Copy, CreditCard, Database,
  Download, Ellipsis, FileClock, Filter, Fingerprint, ImageIcon, KeyRound, LineChart, LockKeyhole, Mail,
  PauseCircle, PlayCircle, Plus, ReceiptText, RefreshCcw, Search, Settings2, ShieldCheck, Sparkles, Trash2, UserRound, UsersRound, X,
  WalletCards, Zap,
} from 'lucide-react'
import { Loader, Menu, Modal, Select } from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { lazy, Suspense, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeading, StatCard, StatusPill, TextLink } from '../components/Ui'
import type { PnlCurvePoint } from '../components/PnlChart'
import { ApiError, apiRequest, authUserDisplayName, authUserVipDetail, authUserVipLabel, clearSession, getStoredUser, post, saveStoredUser, type AuthUser } from '../lib/api'
import { createDefaultWorkflow } from '../features/strategy-workflow/defaults'
import {
  clearStrategySettingsDraft, clearWorkflowDraft, loadStrategySettingsDraft, loadWorkflowDraft,
  saveStrategySettingsDraft, saveWorkflowDraft, strategySettingsDraftKey, workflowDraftKey,
  type StrategySettingsDraftValue,
} from '../features/strategy-workflow/draftStorage'
import type { CustomStrategyWorkflow, WorkflowStage, WorkflowStageName } from '../features/strategy-workflow/types'

const PnlChart = lazy(() => import('../components/PnlChart').then((module) => ({ default: module.PnlChart })))
const WorkflowEditor = lazy(() => import('../features/strategy-workflow/WorkflowEditor').then((module) => ({ default: module.WorkflowEditor })))

type PortalStrategy = {
  id: string; deployment_key: string; name: string; status: string; strategy_code: string; mt_login: string; summary: string
  ea_description?: string
  strategy_type?: string; open_logic?: string; position_logic?: string; compile_status?: string
  open_indicators?: Array<{ name: string; alias: string; source: string; params: Record<string, number> }>
  position_indicators?: Array<{ name: string; alias: string; source: string; params: Record<string, number> }>
  unsupported_indicators?: string[]
  open_ai_mode: string; open_ai_model: string; position_ai_mode: string; position_ai_model: string
  open_ai_endpoint_id: string; open_ai_endpoint_name: string; open_ai_base_url: string; open_ai_key_configured: boolean
  open_ai_vision_verified?: boolean
  position_ai_endpoint_id: string; position_ai_endpoint_name: string; position_ai_base_url: string; position_ai_key_configured: boolean
  position_ai_vision_verified?: boolean
  ai_user_configured: boolean
  open_data_type: string; open_kline_count: number; position_data_type: string; position_kline_count: number
  open_rule_plan?: CustomRulePlan; position_rule_plan?: CustomRulePlan; rule_engine_version?: number
  workflow?: CustomStrategyWorkflow
  compiled_workflow?: Record<string, unknown>
  open_requested_kline_count?: number; position_requested_kline_count?: number
  call_mode: string; call_val: number; position_size_mode: string; fixed_volume: number; risk_base_mode: string
  risk_amount: number; risk_percent: number; allow_add: boolean; max_positions: number; updated_at: string
  analysis_count: number; signal_count: number; order_count: number; official_tokens_used: number; custom_tokens_used: number; pnl: number
}

type CustomRulePlan = {
  version: number
  mode: 'deterministic' | 'ai'
  rules: Array<{ when: string; description: string; action: Record<string, unknown> }>
}

type CustomStrategyPreview = {
  summary: string
  open_prompt_template: string
  position_prompt_template: string
  open_indicators: Array<{ name: string; alias: string; source: string; params: Record<string, number> }>
  position_indicators: Array<{ name: string; alias: string; source: string; params: Record<string, number> }>
  open_rule_plan: CustomRulePlan
  position_rule_plan: CustomRulePlan
  rule_engine_version: number
  open_kline_count: number
  position_kline_count: number
  open_requested_kline_count: number
  position_requested_kline_count: number
  open_indicator_kline_count: number
  position_indicator_kline_count: number
  open_data_type: string
  position_data_type: string
  unsupported_indicators: string[]
  warnings: string[]
  prompt_version: number
  compile_status: 'generated'
}

type AiModelOption = {
  id: string; provider_name: string; provider_type: string; model: string; display_name: string
  input_price_per_million: string; output_price_per_million: string
  is_default: boolean; official_available: boolean
  supports_vision?: boolean; vision_test_status?: string
}

type AiFormConfig = {
  mode: 'official' | 'custom'; endpointId: string; model: string; customModel: string; baseUrl: string; apiKey: string; keyConfigured: boolean; visionVerified: boolean
}

type AiConnectionTestResult = {
  success: boolean; model?: string; elapsed_ms?: number; response_preview?: string
  prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; error?: string
  supports_vision?: boolean; vision_test_status?: string
}

type IndicatorCatalogItem = {
  name: string
  title: string
  description: string
  aliases?: string[]
  input: string
  default_params: Record<string, number>
  parameters: Array<{ name: string; label: string; default: number; description: string }>
  sources?: Array<{ value: string; label: string; formula: string }>
}

const fallbackPriceSources = [
  { value: 'close', label: '收盘价', formula: 'close' },
  { value: 'open', label: '开盘价', formula: 'open' },
  { value: 'high', label: '最高价', formula: 'high' },
  { value: 'low', label: '最低价', formula: 'low' },
  { value: 'hl2', label: '高低均价 HL2', formula: '(high + low) / 2' },
  { value: 'hlc3', label: '典型价格 HLC3', formula: '(high + low + close) / 3' },
  { value: 'ohlc4', label: '四价均值 OHLC4', formula: '(open + high + low + close) / 4' },
  { value: 'oc2', label: '开收均价 OC2', formula: '(open + close) / 2' },
  { value: 'wclprice', label: '加权收盘价', formula: '(high + low + close × 2) / 4' },
]

function indicatorSourceOptions(indicator: IndicatorCatalogItem) {
  if (indicator.sources?.length) return indicator.sources
  return ['ema', 'sma', 'wma', 'rsi', 'macd', 'bbands', 'roc', 'mom'].includes(indicator.name)
    ? fallbackPriceSources
    : []
}

function aiModelCategory(name: string): string {
  const category = String(name || '').split('/')[0]?.trim()
  return category || '其他'
}

function aiModelCategories(options: AiModelOption[]): string[] {
  return Array.from(new Set(options.map((item) => aiModelCategory(item.provider_name))))
}

function groupedAiModelOptions(options: AiModelOption[], defaultEndpointId: string) {
  return aiModelCategories(options).map((category) => ({
    group: category,
    items: options
      .filter((item) => aiModelCategory(item.provider_name) === category)
      .map((item) => ({
        value: item.id,
        label: `${item.provider_name}${item.id === defaultEndpointId ? '（默认）' : ''}`,
      })),
  }))
}

type StrategyDefaultConfig = {
  position_sizing_mode?: string; position_size_mode?: string
  fixed_lot?: number; fixed_volume?: number
  risk_mode?: string; risk_base_mode?: string
  max_stop_amount?: number; risk_amount?: number; risk_percent?: number
  max_positions?: number; allow_add_position?: boolean; allow_add?: boolean
}

type PortalOrder = {
  order_id: string; deployment_id: string; strategy_name: string; symbol: string; mt_type: string; volume: number
  deployment_key: string; account_login: string; open_price: number; close_price: number
  net_profit: number; open_time: number; close_time: number; comment: string
}

type PortalUsage = {
  id: string; created_at: string; provider_name?: string; model_name?: string; model_id?: string; strategy_code: string
  endpoint: string; input_tokens: number; output_tokens: number; charged_amount: string; success: boolean; billing_source?: string
  input_price_snapshot?: string; output_price_snapshot?: string; balance_after?: string | null; response_preview?: string; error_message?: string
  deployment_id?: string; deployment_key?: string; strategy_name?: string
  screenshot_preview_id?: string
}

type UsageScreenshotPreview = { data_url: string; mime_type: string; size_bytes: number; created_at: string }

type UsageFilters = { modelId: string; deploymentId: string; startAt: string; endAt: string }
type UsageSummaryData = { calls: number; success_calls: number; input_tokens: number; output_tokens: number; official_tokens: number; custom_tokens: number; charged_amount: string }
type MonthlyUsageBill = UsageSummaryData & { month: string }
type PagedUsageData = {
  total: number; page: number; size: number; pages: number; list: PortalUsage[]
  retention_days: number; detail_start_at: string; current_balance: string
  summary: UsageSummaryData; lifetime_summary: UsageSummaryData; monthly_bills: MonthlyUsageBill[]
  filters: { models: Array<{ id: string; name: string }>; deployments: Array<{ id: string; key: string; name: string }> }
}
type OrderFilters = { deploymentId: string; symbol: string; startAt: string; endAt: string }
type PagedOrdersData = {
  total: number; page: number; size: number; pages: number; list: PortalOrder[]
  summary: { total: number; wins: number; losses: number; win_rate: number; pnl: number; symbol_count: number }
  curve: PnlCurvePoint[]
  curve_granularity: 'order' | 'hour' | 'day'
  detail_retention_days: number
  filters: { deployments: Array<{ id: string; key: string; name: string }>; symbols: string[] }
}
type EaDownloadItem = { id: string; name: string; description: string; oss_url: string; file_name: string; file_size: number; updated_at: string }

function secureDownloadUrl(value: string) {
  return /^http:\/\//i.test(value) ? value.replace(/^http:\/\//i, 'https://') : value
}
type AgentDashboardData = {
  agent_level: number; invite_code: string; page: number; size: number; pages: number; total: number
  summary: { total_users: number; active_users: number; active_vip_users: number }
  list: Array<{
    id: number; email: string; nickname: string; status: string; vip_level: number
    vip_active: boolean; vip_expires_at: string; referred_at: string; created_at: string
  }>
}

type PortalData = {
  user: AuthUser
  summary: { strategy_count: number; active_strategy_count: number; analysis_count: number; signal_count: number; order_count: number; official_tokens_used: number; custom_tokens_used: number; pnl: number }
  strategies: PortalStrategy[]
  orders: { total: number; wins: number; losses: number; win_rate: number; pnl: number; symbol_count: number; list: PortalOrder[] }
  usage: { calls: number; success_calls: number; input_tokens: number; output_tokens: number; official_tokens: number; custom_tokens: number; charged_amount: string; list: PortalUsage[] }
  wallet: { balance: string; credit_limit: string; available_balance: string; low_balance_threshold: string; balance_warning: boolean; credit_exhausted: boolean; total_credit: string; total_debit: string; ledger: Array<{ id: string; entry_type: string; amount: string; balance_after: string; remark: string; created_at: string }> }
}

function usePortalData() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    apiRequest<PortalData>('/api/v1/auth/portal')
      .then((result) => { if (active) { setData(result); saveStoredUser(result.user) } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '数据加载失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  return { data, loading, error, refresh: () => setRevision((value) => value + 1) }
}

function useUserUsage(page: number, size: number, filters: UsageFilters) {
  const [data, setData] = useState<PagedUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (filters.modelId) params.set('model_id', filters.modelId)
    if (filters.deploymentId) params.set('deployment_id', filters.deploymentId)
    if (filters.startAt) params.set('start_at', filterTimeIso(filters.startAt))
    if (filters.endAt) params.set('end_at', filterTimeIso(filters.endAt))
    apiRequest<PagedUsageData>(`/api/v1/auth/usage?${params.toString()}`)
      .then((result) => { if (active) setData(result) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '调用记录加载失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, size, filters.modelId, filters.deploymentId, filters.startAt, filters.endAt])
  return { data, loading, error }
}

function useUserOrders(page: number, size: number, filters: OrderFilters) {
  const [data, setData] = useState<PagedOrdersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (filters.deploymentId) params.set('deployment_id', filters.deploymentId)
    if (filters.symbol) params.set('symbol', filters.symbol)
    if (filters.startAt) params.set('start_at', filterTimeIso(filters.startAt))
    if (filters.endAt) params.set('end_at', filterTimeIso(filters.endAt))
    apiRequest<PagedOrdersData>(`/api/v1/auth/orders?${params.toString()}`)
      .then((result) => { if (active) setData(result) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '历史订单加载失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, size, filters.deploymentId, filters.symbol, filters.startAt, filters.endAt])
  return { data, loading, error }
}

function money(value: string | number | undefined) { return Number(value || 0).toFixed(2) }
function filterTimeIso(value: string) { return new Date(value.includes('T') ? value : value.replace(' ', 'T')).toISOString() }
function feeMoney(value: string | number | undefined) { return Number(value || 0).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') || '0' }
function signedMoney(value: number) { return `${value > 0 ? '+' : ''}${value.toFixed(2)}` }
function numberText(value: number) { return Number(value || 0).toLocaleString('zh-CN') }
function tokenText(value: number) { return Number(value || 0).toLocaleString('zh-CN') }
function unixTime(value: number) { return value ? new Date(value < 1e12 ? value * 1000 : value).toLocaleString('zh-CN', { hour12: false }) : '-' }
function isoTime(value: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-' }
function tradeSide(value: string) { const side = String(value || '').toUpperCase(); return side === '0' || side.includes('BUY') ? 'BUY' : side === '1' || side.includes('SELL') ? 'SELL' : side || '-' }
function ledgerName(value: string) { return ({ admin_recharge: '人工充值', admin_deduction: '人工扣减', ai_charge: 'AI 调用', refund: '退款' } as Record<string, string>)[value] || value }
function statusText(value: string) { return value === 'active' ? '运行中' : value === 'paused' ? '已暂停' : value === 'disabled' ? '已停用' : value || '未知' }
function statusTone(value: string): 'active' | 'paused' | 'neutral' { return value === 'active' ? 'active' : value === 'paused' ? 'paused' : 'neutral' }
function aiModeText(value: string) { return value === 'official' ? 'GL提供AI' : '自定义AI' }
function sceneText(value: string) { const endpoint = String(value || '').toLowerCase(); return endpoint.includes('compile') ? '生成自定义策略' : endpoint.includes('position') || endpoint.includes('risk') ? '持仓风控' : endpoint.includes('open') ? '开单分析' : value || '-' }
function dataTypeText(value: string) { return value === 'kline' ? 'K 线' : value || '-' }
function publicAiErrorText(value: string | undefined) {
  const cleaned = String(value || '')
    .replace(/\s*[;,]\s*model\s*=\s*[^,;\r\n]+/gi, '')
    .replace(/\s*[;,]\s*url\s*=\s*https?:\/\/[^\s,;\r\n]+/gi, '')
    .replace(/https?:\/\/[^\s,;\r\n]+/gi, '')
    .replace(/[ \t]+([,;])/g, '$1')
    .replace(/[,;]\s*$/gm, '')
    .trim()
  return cleaned || 'AI 调用失败，请稍后重试'
}

function RecentOrders({ orders: rows }: { orders: PortalOrder[] }) {
  if (!rows.length) return <EmptyState icon={<ReceiptText />} title="暂无历史订单" description="EA 同步成交记录后会显示在这里。" />
  return <div className="table-wrap"><table><thead><tr><th>订单</th><th>商品</th><th>方向</th><th>手数</th><th>盈亏</th><th>时间</th></tr></thead><tbody>{rows.map((order) => { const side = tradeSide(order.mt_type); return <tr key={`${order.deployment_id}-${order.order_id}`}><td className="mono">#{order.order_id}</td><td><strong>{order.symbol}</strong></td><td><span className={side === 'BUY' ? 'trade-buy' : 'trade-sell'}>{side}</span></td><td>{order.volume.toFixed(2)}</td><td className={order.net_profit >= 0 ? 'profit' : 'loss'}>{signedMoney(order.net_profit)}</td><td className="muted-cell">{unixTime(order.close_time)}</td></tr> })}</tbody></table></div>
}

function CreateStrategyAction() {
  const user = getStoredUser()
  if (!user.vip_active) return <div className="button-group"><button className="button button-secondary" type="button" disabled title="VIP 未开通或已到期，暂时不能创建策略"><BrainCircuit size={17} />从策略库创建</button><button className="button button-primary" type="button" disabled title="VIP 未开通或已到期，暂时不能创建策略"><Sparkles size={17} />自定义AI策略</button></div>
  return <div className="button-group"><Link className="button button-secondary" to="/app/strategies/new/library"><BrainCircuit size={17} />从策略库创建</Link><Link className="button button-primary" to="/app/strategies/new/custom"><Sparkles size={17} />自定义AI策略</Link></div>
}

export function DashboardPage() {
  const { data, loading, error } = usePortalData()
  const displayName = authUserDisplayName(data?.user || getStoredUser())
  if (loading) return <div className="permission-loading">正在加载账户数据...</div>
  if (!data) return <div className="permission-notice"><ShieldCheck size={18} /><div><strong>账户数据加载失败</strong><span>{error}</span></div></div>
  const active = data.strategies.find((item) => item.status === 'active') || data.strategies[0]
  const wallet = data.wallet
  const usesOfficialAi = data.strategies.some((item) => item.open_ai_mode !== 'custom' || item.position_ai_mode !== 'custom')
  const warningThreshold = Number(wallet.low_balance_threshold || 10).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return <>
    <PageHeading eyebrow="OVERVIEW" title={`晚上好，${displayName}`} description="这里是您的策略运行和 GL AI余额概览。" action={<CreateStrategyAction />} />
    {usesOfficialAi && wallet.balance_warning && <div className="permission-notice balance-warning-danger"><Coins size={21} /><div><strong>当前余额不足 {warningThreshold} 元，为保证 EA 正常运行，建议及时充值</strong><span>账户余额 ¥{money(wallet.balance)}，含信用额度当前可用 ¥{money(wallet.available_balance)}。{wallet.credit_exhausted ? '信用额度已用完，官方 AI 已停止调用。' : ''}</span></div></div>}
    <section className="stats-grid"><StatCard label="运行中策略" value={numberText(data.summary.active_strategy_count)} note={`共 ${numberText(data.summary.strategy_count)} 个策略部署`} icon={<Bot />} /><StatCard label="本月 AI 费用" value={`¥${money(data.usage.charged_amount)}`} note={`${numberText(data.usage.calls)} 次 AI 调用`} icon={<BrainCircuit />} tone="blue" /><StatCard label="累计策略盈亏" value={signedMoney(data.orders.pnl)} note={`${numberText(data.orders.total)} 笔历史订单`} icon={<LineChart />} /><StatCard label="GL AI余额" value={`¥${money(wallet.balance)}`} note={`含信用额度可用 ¥${money(wallet.available_balance)}`} icon={<Coins />} tone="amber" /></section>
    <section className="dashboard-grid">
      {active ? <article className="panel runtime-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVE STRATEGY</span><h2>{active.name}</h2></div><StatusPill>{active.status === 'active' ? '运行中' : '已暂停'}</StatusPill></div><div className="runtime-key"><span>部署 Key</span><code>{active.deployment_key}</code><button type="button" title="复制" onClick={() => navigator.clipboard.writeText(active.deployment_key)}><Copy size={15} /></button></div><div className="runtime-metrics"><div><small>分析次数</small><strong>{numberText(active.analysis_count)}</strong></div><div><small>有效信号</small><strong>{numberText(active.signal_count)}</strong></div><div><small>订单数量</small><strong>{numberText(active.order_count)}</strong></div><div><small>累计盈亏</small><strong className={active.pnl >= 0 ? 'profit' : 'loss'}>{signedMoney(active.pnl)}</strong></div></div><div className="runtime-footer"><span><Activity size={15} />更新于 {isoTime(active.updated_at)}</span><Link to={`/app/strategies/${active.id}`}><TextLink>策略详情</TextLink></Link></div></article> : <article className="panel runtime-panel"><EmptyState icon={<Bot />} title="暂无策略" description="创建策略后即可连接 MT4/MT5。" /></article>}
      <article className="panel balance-panel"><div className="panel-heading"><div><span className="eyebrow">AI BALANCE</span><h2>余额与本月用量</h2></div><Coins /></div><div className="balance-total"><small>当前账户余额</small><strong>¥{money(wallet.balance)}</strong><span>CNY</span></div><div className="usage-progress"><div><span>本月 AI 费用</span><strong>¥{money(data.usage.charged_amount)}</strong></div><i><b style={{ width: data.usage.calls ? '100%' : '0%' }} /></i></div><div className="balance-split"><div><span>信用额度</span><strong>¥{money(wallet.credit_limit)}</strong></div><div><span>当前可用</span><strong>¥{money(wallet.available_balance)}</strong></div></div><Link className="button button-secondary full-button" to="/app/wallet">查看资金流水<ArrowRight size={16} /></Link></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ORDERS</span><h2>最近订单</h2></div><Link to="/app/orders"><TextLink>查看全部</TextLink></Link></div><RecentOrders orders={data.orders.list.slice(0, 5)} /></section>
  </>
}

export function StrategiesPage() {
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PortalStrategy | null>(null)
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')
  const { data, loading, error, refresh } = usePortalData()
  const user = data?.user || getStoredUser()
  const vipRequired = !user.vip_active
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return data?.strategies || []
    return (data?.strategies || []).filter((item) => `${item.name} ${item.deployment_key} ${item.strategy_code}`.toLowerCase().includes(keyword))
  }, [data, query])
  const copyDeploymentKey = async (deploymentKey: string) => {
    try {
      await navigator.clipboard.writeText(deploymentKey)
      notifications.show({ title: '复制成功', message: '部署 Key 已复制到剪贴板', color: 'gainlab', autoClose: 1800 })
    } catch {
      notifications.show({ title: '复制失败', message: '请手动选择并复制部署 Key', color: 'red' })
    }
  }
  const changeStatus = async (item: PortalStrategy) => {
    setBusyId(item.id); setActionError('')
    try {
      await apiRequest(`/api/v1/auth/strategies/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: item.status === 'active' ? 'paused' : 'active' }),
      })
      refresh()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : '策略状态修改失败')
    } finally {
      setBusyId('')
    }
  }
  const deleteStrategy = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id); setActionError('')
    try {
      await apiRequest(`/api/v1/auth/strategies/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      refresh()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : '策略删除失败')
    } finally {
      setBusyId('')
    }
  }
  return <>
    <PageHeading eyebrow="STRATEGIES" title="我的策略" description="管理已连接 MT4/MT5 的策略部署与运行配置。" action={<CreateStrategyAction />} />
    {vipRequired && <div className="permission-notice"><ShieldCheck size={18} /><div><strong>{authUserVipLabel(user)} · 当前账户暂时不能创建策略</strong><span>{authUserVipDetail(user)}。您仍然可以查看已有策略和其他账户信息。</span></div></div>}
    {actionError && <div className="permission-notice"><ShieldCheck size={18} /><div><strong>策略操作失败</strong><span>{actionError}</span></div></div>}
    <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索策略名称或 Key" /></label><button className="button button-secondary" type="button"><Filter size={16} />全部状态</button></div>
    {loading && !data ? <div className="permission-loading">正在加载策略...</div> : error && !data ? <div className="permission-notice"><ShieldCheck size={18} /><div><strong>策略加载失败</strong><span>{error}</span></div></div> : <div className="strategy-list">{filtered.length ? filtered.map((item) => <article className="strategy-row" key={item.id}>
      <div className="strategy-row-head">
        <div className="strategy-row-icon"><BrainCircuit /></div>
        <div className="strategy-row-title"><h3>{item.name}</h3><span>{item.strategy_code === 'CUSTOM_AI_V1' ? '自定义策略' : `GainLab 官方 · ${item.strategy_code}`}</span></div>
        <div className="strategy-row-actions">
          <StatusPill tone={statusTone(item.status)}>{statusText(item.status)}</StatusPill>
          <Menu position="bottom-end" withinPortal shadow="md">
            <Menu.Target>
              <button className="strategy-more-button" type="button" disabled={busyId === item.id} aria-label={`${item.name} 操作`}><Ellipsis size={18} /></button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={item.status === 'active' ? <PauseCircle size={16} /> : <PlayCircle size={16} />} onClick={() => changeStatus(item)}>
                {item.status === 'active' ? '停用策略' : '启用策略'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<Trash2 size={16} />} onClick={() => setDeleteTarget(item)}>删除策略</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
      <div className="strategy-row-key"><code>{item.deployment_key}</code><button type="button" onClick={() => copyDeploymentKey(item.deployment_key)}><Copy size={14} />复制</button></div>
      <div className="strategy-row-stats"><div><span>分析次数</span><strong>{numberText(item.analysis_count)}</strong></div><div><span>有效信号</span><strong>{numberText(item.signal_count)}</strong></div><div><span>订单数量</span><strong>{numberText(item.order_count)}</strong></div><div><span>AI Token</span><strong>{tokenText(item.official_tokens_used + item.custom_tokens_used)}</strong></div><div><span>累计盈亏</span><strong className={item.pnl >= 0 ? 'profit' : 'loss'}>{signedMoney(item.pnl)}</strong></div></div>
      <div className="strategy-row-footer"><span><Clock3 size={14} />更新于 {isoTime(item.updated_at)}</span><div className="button-group"><Link className="button button-secondary" to={`/app/strategies/${item.id}?edit=1`}><Settings2 size={16} />编辑</Link><Link className="button button-secondary" to={`/app/strategies/${item.id}`}>查看策略<ChevronRight size={16} /></Link></div></div>
    </article>) : <EmptyState icon={<Bot />} title={query ? '没有匹配的策略' : '暂无策略'} description={query ? '请尝试其他策略名称或 Key。' : '创建策略后，会在这里显示真实运行数据。'} />}</div>}
    <Modal
      opened={Boolean(deleteTarget)}
      onClose={() => !busyId && setDeleteTarget(null)}
      title="删除策略"
      centered
      classNames={{ content: 'strategy-delete-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}
    >
      <div className="strategy-delete-confirm">
        <div className="strategy-delete-icon"><Trash2 size={22} /></div>
        <p>确定删除策略“<strong>{deleteTarget?.name}</strong>”吗？</p>
        <span>删除后该 Key 将立即停止使用，历史订单和计费记录仍会保留。</span>
        <div className="security-modal-actions">
          <button className="button button-secondary" type="button" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(null)}>取消</button>
          <button className="button strategy-delete-button" type="button" disabled={Boolean(busyId)} onClick={deleteStrategy}>{busyId ? '正在删除...' : '确认删除'}</button>
        </div>
      </div>
    </Modal>
  </>
}

function StrategyForm({ source, editing = false, deployment, onSaved, onCancel }: { source?: 'official' | 'custom'; editing?: boolean; deployment?: PortalStrategy; onSaved?: () => void; onCancel?: () => void }) {
  const navigate = useNavigate()
  const strategySource: 'official' | 'custom' = source || (deployment?.strategy_code === 'CUSTOM_AI_V1' ? 'custom' : 'official')
  const draftOwnerId = String(getStoredUser()?.id || 'anonymous')
  const settingsDraftStorageKey = useMemo(
    () => strategySettingsDraftKey(draftOwnerId, `${strategySource}-${deployment?.id || 'new'}`),
    [deployment?.id, draftOwnerId, strategySource],
  )
  const initialSettingsDraft = useMemo(() => loadStrategySettingsDraft(settingsDraftStorageKey), [settingsDraftStorageKey])
  const [sizeMode, setSizeMode] = useState<'fixed' | 'risk'>(deployment?.position_size_mode === 'risk' ? 'risk' : 'fixed')
  const [strategyName, setStrategyName] = useState(deployment?.name || (strategySource === 'custom' ? '我的自定义AI策略' : 'GL 趋势自动分析策略'))
  const [strategyStatus, setStrategyStatus] = useState(deployment?.status || 'active')
  const [mtLogin, setMtLogin] = useState(deployment?.mt_login || '')
  const [eaDescription, setEaDescription] = useState(deployment?.ea_description || '')
  const [fixedVolume, setFixedVolume] = useState(String(deployment?.fixed_volume ?? 0.1))
  const [riskBaseMode, setRiskBaseMode] = useState<'fixed_loss' | 'balance_percent'>(deployment?.risk_base_mode === 'balance_percent' ? 'balance_percent' : 'fixed_loss')
  const [riskAmount, setRiskAmount] = useState(String(deployment?.risk_amount ?? 100))
  const [riskPercent, setRiskPercent] = useState(String(deployment?.risk_percent ?? 1))
  const [maxPositions, setMaxPositions] = useState(String(deployment?.max_positions ?? 1))
  const [allowAdd, setAllowAdd] = useState(Boolean(deployment?.allow_add))
  const [openLogic, setOpenLogic] = useState(deployment?.open_logic || '')
  const [positionLogic, setPositionLogic] = useState(deployment?.position_logic || '')
  const [openDataType, setOpenDataType] = useState(deployment?.open_data_type || 'kline')
  const [openKlineCount, setOpenKlineCount] = useState(String(deployment?.open_requested_kline_count || (Number(deployment?.open_kline_count) >= 10 ? deployment?.open_kline_count : 100) || 100))
  const [positionDataType, setPositionDataType] = useState(deployment?.position_data_type || 'kline')
  const [positionKlineCount, setPositionKlineCount] = useState(String(deployment?.position_requested_kline_count || (Number(deployment?.position_kline_count) >= 10 ? deployment?.position_kline_count : 100) || 100))
  const [indicatorCatalog, setIndicatorCatalog] = useState<IndicatorCatalogItem[]>([])
  const [indicatorsExpanded, setIndicatorsExpanded] = useState(false)
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorCatalogItem | null>(null)
  const [dataHelpOpened, setDataHelpOpened] = useState(false)
  const [strategyDetailOpened, setStrategyDetailOpened] = useState(false)
  const [pricingOpened, setPricingOpened] = useState(false)
  const [pricingCategory, setPricingCategory] = useState('全部')
  const [customAiHelpOpened, setCustomAiHelpOpened] = useState(false)
  const [libraryStrategy, setLibraryStrategy] = useState<{ code: string; name: string; summary: string; open_ai_endpoint_id: string; position_ai_endpoint_id: string; default_config: StrategyDefaultConfig } | null>(null)
  const [aiModelOptions, setAiModelOptions] = useState<AiModelOption[]>([])
  const [aiModelsLoading, setAiModelsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customPreview, setCustomPreview] = useState<CustomStrategyPreview | null>(null)
  const [pendingStrategyPayload, setPendingStrategyPayload] = useState<Record<string, unknown> | null>(null)
  const workflowDraftStorageKey = useMemo(() => workflowDraftKey(draftOwnerId, deployment?.id || 'new'), [deployment?.id, draftOwnerId])
  const initialWorkflowDraft = useMemo(() => loadWorkflowDraft(workflowDraftStorageKey), [workflowDraftStorageKey])
  // Prefer an unsaved local draft, then the persisted workflow from the API;
  // only brand-new strategies should start with the blank default graph.
  const [workflow, setWorkflow] = useState(() => {
    const defaultWorkflow = createDefaultWorkflow()
    let baseWorkflow: CustomStrategyWorkflow
    if (!deployment?.workflow) baseWorkflow = initialWorkflowDraft?.workflow || defaultWorkflow
    else {
      const persisted = deployment.workflow
      const draftTime = initialWorkflowDraft?.saved_at ? Date.parse(initialWorkflowDraft.saved_at) : 0
      const savedTime = deployment.updated_at ? Date.parse(deployment.updated_at) : 0
      baseWorkflow = draftTime > savedTime ? initialWorkflowDraft!.workflow : persisted
    }
    // Older text-based strategies may have a partial workflow object (or
    // missing data_requirements). Merge each stage with the current defaults
    // so the editor remains usable and can be migrated on the next save.
    return {
      ...defaultWorkflow,
      ...baseWorkflow,
      open: { ...defaultWorkflow.open, ...baseWorkflow.open, data_requirements: { ...defaultWorkflow.open.data_requirements, ...(baseWorkflow.open?.data_requirements || {}) } },
      position: { ...defaultWorkflow.position, ...baseWorkflow.position, data_requirements: { ...defaultWorkflow.position.data_requirements, ...(baseWorkflow.position?.data_requirements || {}) } },
    }
  })
  const [workflowDraftDirty, setWorkflowDraftDirty] = useState(false)
  const [workflowTouched, setWorkflowTouched] = useState(false)
  const [workflowDraftSavedAt, setWorkflowDraftSavedAt] = useState(initialWorkflowDraft?.saved_at || '')
  const workflowRef = useRef(workflow)
  const workflowDraftDirtyRef = useRef(false)
  const [workflowAiStage, setWorkflowAiStage] = useState<'open' | 'position' | null>(null)
  const [workflowGeneratingStage, setWorkflowGeneratingStage] = useState<WorkflowStageName | null>(null)
  const [workflowOverwriteStage, setWorkflowOverwriteStage] = useState<WorkflowStageName | null>(null)
  const [expandedWorkflowStages, setExpandedWorkflowStages] = useState({ open: true, position: true })
  const [expandedAiSettings, setExpandedAiSettings] = useState({ open: false, position: false })
  const [openAi, setOpenAi] = useState<AiFormConfig>({
    mode: deployment?.open_ai_mode === 'custom' ? 'custom' : 'official',
    endpointId: deployment?.open_ai_endpoint_id || '',
    model: deployment?.open_ai_model || '',
    customModel: deployment?.open_ai_mode === 'custom' ? deployment.open_ai_model : '',
    baseUrl: deployment?.open_ai_base_url || '',
    apiKey: '',
    keyConfigured: Boolean(deployment?.open_ai_key_configured),
    visionVerified: Boolean(deployment?.open_ai_vision_verified),
  })
  const [positionAi, setPositionAi] = useState<AiFormConfig>({
    mode: deployment?.position_ai_mode === 'custom' ? 'custom' : 'official',
    endpointId: deployment?.position_ai_endpoint_id || '',
    model: deployment?.position_ai_model || '',
    customModel: deployment?.position_ai_mode === 'custom' ? deployment.position_ai_model : '',
    baseUrl: deployment?.position_ai_base_url || '',
    apiKey: '',
    keyConfigured: Boolean(deployment?.position_ai_key_configured),
    visionVerified: Boolean(deployment?.position_ai_vision_verified),
  })
  const settingsDraftRef = useRef<StrategySettingsDraftValue | null>(null)
  const settingsDraftEnabledRef = useRef(true)
  useEffect(() => {
    const settings = initialSettingsDraft?.settings
    if (!settings) return
    setStrategyName(settings.strategyName)
    setStrategyStatus(settings.strategyStatus)
    setMtLogin(settings.mtLogin)
    setEaDescription(settings.eaDescription)
    setSizeMode(settings.sizeMode)
    setFixedVolume(settings.fixedVolume)
    setRiskBaseMode(settings.riskBaseMode)
    setRiskAmount(settings.riskAmount)
    setRiskPercent(settings.riskPercent)
    setMaxPositions(settings.maxPositions)
    setAllowAdd(settings.allowAdd)
  }, [initialSettingsDraft])
  useEffect(() => {
    const settings: StrategySettingsDraftValue = {
      strategyName,
      strategyStatus,
      mtLogin,
      eaDescription,
      sizeMode,
      fixedVolume,
      riskBaseMode,
      riskAmount,
      riskPercent,
      maxPositions,
      allowAdd,
    }
    settingsDraftRef.current = settings
    const timer = window.setTimeout(() => {
      if (settingsDraftEnabledRef.current) saveStrategySettingsDraft(settingsDraftStorageKey, settings)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [allowAdd, eaDescription, fixedVolume, maxPositions, mtLogin, riskAmount, riskBaseMode, riskPercent, settingsDraftStorageKey, sizeMode, strategyName, strategyStatus])
  useEffect(() => {
    const flushSettingsDraft = () => {
      if (settingsDraftEnabledRef.current && settingsDraftRef.current) {
        saveStrategySettingsDraft(settingsDraftStorageKey, settingsDraftRef.current)
      }
    }
    window.addEventListener('beforeunload', flushSettingsDraft)
    return () => { window.removeEventListener('beforeunload', flushSettingsDraft); flushSettingsDraft() }
  }, [settingsDraftStorageKey])
  useEffect(() => {
    const sourceText = initialWorkflowDraft?.workflow.source_text
    if (!sourceText) return
    setOpenLogic((current) => current || sourceText.open || '')
    setPositionLogic((current) => current || sourceText.position || '')
  }, [initialWorkflowDraft])
  useEffect(() => {
    if (!workflowDraftDirty) return
    const timer = window.setTimeout(() => {
      const draft = saveWorkflowDraft(workflowDraftStorageKey, workflow)
      setWorkflowDraftSavedAt(draft.saved_at)
      setWorkflowDraftDirty(false)
      workflowDraftDirtyRef.current = false
    }, 500)
    return () => window.clearTimeout(timer)
  }, [workflow, workflowDraftDirty, workflowDraftStorageKey])
  useEffect(() => {
    const flushDraft = () => {
      if (workflowDraftDirtyRef.current) saveWorkflowDraft(workflowDraftStorageKey, workflowRef.current)
    }
    window.addEventListener('beforeunload', flushDraft)
    return () => { window.removeEventListener('beforeunload', flushDraft); flushDraft() }
  }, [workflowDraftStorageKey])
  const updateWorkflow = (next: typeof workflow) => {
    workflowRef.current = next
    workflowDraftDirtyRef.current = true
    setWorkflowTouched(true)
    setWorkflow(next)
    setWorkflowDraftDirty(true)
  }
  const workflowDraftStatus = workflowDraftDirty
    ? '草稿保存中...'
    : workflowDraftSavedAt
      ? `草稿已保存 ${new Date(workflowDraftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      : '修改后自动保存草稿'
  useEffect(() => {
    let active = true
    apiRequest<{ list: Array<{ code: string; name: string; summary: string; open_ai_endpoint_id: string; position_ai_endpoint_id: string; default_config: StrategyDefaultConfig }> }>('/api/v1/auth/official-strategies')
      .then((result) => {
        if (!active) return
        const code = deployment?.strategy_code || 'PA_AGENT_V1'
        setLibraryStrategy(result.list.find((item) => item.code === code) || result.list[0] || null)
      })
      .catch(() => { if (active) setLibraryStrategy(null) })
    return () => { active = false }
  }, [deployment?.strategy_code])
  useEffect(() => {
    let active = true
    apiRequest<{ list: IndicatorCatalogItem[] }>('/api/v1/auth/custom-strategy/indicators')
      .then((result) => { if (active) setIndicatorCatalog(result.list || []) })
      .catch(() => { if (active) setIndicatorCatalog([]) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    setAiModelsLoading(true)
    apiRequest<{ list: AiModelOption[] }>('/api/v1/auth/ai-model-options')
      .then((result) => {
        if (!active) return
        const options = result.list.filter((item) => item.official_available)
        setAiModelOptions(options)
        const defaultOption = options.find((item) => item.is_default) || options[0]
        if (defaultOption) {
          setOpenAi((current) => current.mode === 'official' && !options.some((item) => item.id === current.endpointId)
            ? { ...current, endpointId: defaultOption.id, model: defaultOption.model, visionVerified: Boolean(defaultOption.supports_vision) }
            : current)
          setPositionAi((current) => current.mode === 'official' && !options.some((item) => item.id === current.endpointId)
            ? { ...current, endpointId: defaultOption.id, model: defaultOption.model, visionVerified: Boolean(defaultOption.supports_vision) }
            : current)
        }
      })
      .catch(() => { if (active) setAiModelOptions([]) })
      .finally(() => { if (active) setAiModelsLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!libraryStrategy || !aiModelOptions.length || deployment?.ai_user_configured) return
    const openDefault = aiModelOptions.find((item) => item.id === libraryStrategy.open_ai_endpoint_id)
    const positionDefault = aiModelOptions.find((item) => item.id === libraryStrategy.position_ai_endpoint_id)
    if (openDefault) setOpenAi((current) => ({ ...current, mode: 'official', endpointId: openDefault.id, model: openDefault.model, visionVerified: Boolean(openDefault.supports_vision) }))
    if (positionDefault) setPositionAi((current) => ({ ...current, mode: 'official', endpointId: positionDefault.id, model: positionDefault.model, visionVerified: Boolean(positionDefault.supports_vision) }))
  }, [aiModelOptions, deployment?.ai_user_configured, libraryStrategy])
  useEffect(() => {
    if (deployment || !libraryStrategy || strategySource === 'custom') return
    const config = libraryStrategy.default_config || {}
    const defaultSizeMode = config.position_sizing_mode || config.position_size_mode
    const defaultRiskMode = config.risk_mode || config.risk_base_mode
    setStrategyName(libraryStrategy.name || 'GL 趋势自动分析策略')
    setSizeMode(defaultSizeMode === 'risk' ? 'risk' : 'fixed')
    setFixedVolume(String(config.fixed_lot ?? config.fixed_volume ?? 0.01))
    setRiskBaseMode(defaultRiskMode === 'balance_percent' ? 'balance_percent' : 'fixed_loss')
    setRiskAmount(String(config.max_stop_amount ?? config.risk_amount ?? 100))
    setRiskPercent(String(config.risk_percent ?? 1))
    setMaxPositions(String(config.max_positions ?? 1))
    setAllowAdd(Boolean(config.allow_add_position ?? config.allow_add ?? false))
  }, [deployment, libraryStrategy, strategySource])
  const strategyTitle = libraryStrategy?.name || deployment?.name || 'GL 趋势自动分析策略'
  const strategyDescription = libraryStrategy?.summary || deployment?.summary || '暂无策略介绍。'
  const customLogicChanged = !editing || !deployment
    || openLogic.trim() !== String(deployment.open_logic || '').trim()
    || positionLogic.trim() !== String(deployment.position_logic || '').trim()
  const customNeedsCompilation = strategySource === 'custom' && (
    customLogicChanged || Number(deployment?.rule_engine_version || 0) < 1
  )
  // Legacy text-based strategies have no visual workflow. Do not persist the
  // editor's placeholder graph unless the user explicitly changes it (or this
  // is a new strategy), otherwise simply editing an old strategy would replace
  // its rules with the default graph.
  const shouldPersistWorkflow = strategySource === 'custom' && (!deployment || Boolean(deployment.workflow) || workflowTouched)
  const saveStrategy = async (payload: Record<string, unknown>, compiledConfig?: CustomStrategyPreview) => {
    setSaving(true)
    try {
      await apiRequest<{ id: string; deployment_key?: string }>(editing && deployment ? `/api/v1/auth/strategies/${deployment.id}` : '/api/v1/auth/strategies', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(compiledConfig ? { ...payload, compiled_config: compiledConfig } : payload),
      })
      settingsDraftEnabledRef.current = false
      workflowDraftDirtyRef.current = false
      clearStrategySettingsDraft(settingsDraftStorageKey)
      clearWorkflowDraft(workflowDraftStorageKey)
      setCustomPreview(null)
      setPendingStrategyPayload(null)
      notifications.show({ title: editing ? '保存成功' : '创建成功', message: editing ? '策略配置已更新' : '策略 Key 已生成', color: 'gainlab', autoClose: 1800 })
      if (editing && deployment && onSaved) onSaved()
      else navigate(editing && deployment ? `/app/strategies/${deployment.id}` : '/app/strategies')
    } catch (reason) {
      notifications.show({ title: editing ? '保存失败' : '创建失败', message: reason instanceof Error ? reason.message : '策略保存失败', color: 'red' })
    } finally {
      setSaving(false)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (strategySource === 'custom') {
      const missingVision = [
        { label: '开单分析 AI', dataType: workflow.open.data_requirements.data_type, ai: openAi },
        { label: '持仓风控 AI', dataType: workflow.position.data_requirements.data_type, ai: positionAi },
      ].find((item) => (item.dataType === 'screenshot' || item.dataType === 'both') && !item.ai.visionVerified)
      if (missingVision) {
        notifications.show({ title: '请先测试图片识别', message: `${missingVision.label} 需要处理截图，请先通过图片识别测试。`, color: 'red', autoClose: 6000 })
        return
      }
    }
    const payload = {
      deployment_id: deployment?.id || '',
      strategy_code: strategySource === 'custom' ? 'CUSTOM_AI_V1' : (libraryStrategy?.code || deployment?.strategy_code || 'PA_AGENT_V1'),
      name: strategyName,
      status: strategyStatus,
      mt_login: mtLogin,
      ea_description: strategySource === 'custom' ? eaDescription.trim() : '',
      open_ai_mode: openAi.mode,
      open_ai_endpoint_id: openAi.mode === 'official' ? openAi.endpointId : '',
      open_ai_model: openAi.mode === 'custom' ? openAi.customModel : openAi.model,
      open_ai_base_url: openAi.baseUrl,
      open_ai_key: openAi.apiKey,
      open_ai_vision_verified: openAi.visionVerified,
      position_ai_mode: positionAi.mode,
      position_ai_endpoint_id: positionAi.mode === 'official' ? positionAi.endpointId : '',
      position_ai_model: positionAi.mode === 'custom' ? positionAi.customModel : positionAi.model,
      position_ai_base_url: positionAi.baseUrl,
      position_ai_key: positionAi.apiKey,
      position_ai_vision_verified: positionAi.visionVerified,
      position_size_mode: sizeMode,
      fixed_volume: Number(fixedVolume),
      risk_base_mode: riskBaseMode,
      risk_amount: Number(riskAmount),
      risk_percent: Number(riskPercent),
      max_positions: Number(maxPositions),
      allow_add: allowAdd,
      open_logic: strategySource === 'custom' ? openLogic.trim() : '',
      position_logic: strategySource === 'custom' ? positionLogic.trim() : '',
      workflow: shouldPersistWorkflow ? workflow : undefined,
      open_data_type: strategySource === 'custom' ? workflow.open.data_requirements.data_type : openDataType,
      open_kline_count: strategySource === 'custom' ? workflow.open.data_requirements.kline_count : Number(openKlineCount),
      position_data_type: strategySource === 'custom' ? workflow.position.data_requirements.data_type : positionDataType,
      position_kline_count: strategySource === 'custom' ? workflow.position.data_requirements.kline_count : Number(positionKlineCount),
    }
    if (strategySource === 'custom') {
      if (!customNeedsCompilation) {
        await saveStrategy(payload)
        return
      }
      setSaving(true)
      try {
        const preview = await apiRequest<CustomStrategyPreview>('/api/v1/auth/custom-strategy/preview', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setPendingStrategyPayload(payload)
        setCustomPreview(preview)
      } catch (reason) {
        notifications.show({ title: '策略分析失败', message: reason instanceof Error ? reason.message : 'AI 无法生成策略配置，请稍后重试', color: 'red' })
      } finally {
        setSaving(false)
      }
      return
    }
    await saveStrategy(payload)
  }
  const savingMessage = customPreview
    ? '正在保存策略配置...'
    : customNeedsCompilation
      ? 'AI 正在分析策略，请稍候...'
      : editing
        ? '正在保存策略修改...'
        : '正在创建策略并生成 Key...'
  const workflowDataLabel = (stage: 'open' | 'position') => {
    const requirements = workflow[stage].data_requirements
    if (requirements.data_type === 'screenshot') return 'EA图表截图'
    if (requirements.data_type === 'both') return `K线 × ${requirements.kline_count} + EA图表截图`
    return `K线 × ${requirements.kline_count}`
  }
  const workflowAiLabel = (config: AiFormConfig) => config.mode === 'custom'
    ? (config.customModel || '自定义 AI')
    : (aiModelOptions.find((item) => item.id === config.endpointId)?.display_name || config.model || '请选择 AI')
  const generateWorkflowStage = async (stage: WorkflowStageName) => {
    const logic = (stage === 'open' ? openLogic : positionLogic).trim()
    if (logic.length < 5) {
      notifications.show({ title: '请完善策略规则', message: `请先填写完整的${stage === 'open' ? '开仓' : '持仓风控'}逻辑`, color: 'red' })
      return
    }
    setWorkflowGeneratingStage(stage)
    try {
      const result = await apiRequest<{ stage: WorkflowStage; source_text: string; repaired?: boolean; generation_model?: string; customer_billed?: boolean }>('/api/v1/auth/custom-strategy/workflow/generate', {
        method: 'POST',
        body: JSON.stringify({
          stage,
          user_logic: logic,
          data_requirements: workflow[stage].data_requirements,
        }),
      })
      updateWorkflow({
        ...workflow,
        source_mode: 'ai_generated',
        source_text: { ...workflow.source_text, [stage]: logic },
        [stage]: result.stage,
      })
      setExpandedWorkflowStages((current) => ({ ...current, [stage]: true }))
      setWorkflowAiStage(null)
      notifications.show({
        title: `${stage === 'open' ? '开仓' : '风控'}流程已生成`,
        message: result.repaired ? 'AI生成结果已自动修复并通过结构检查，请确认流程逻辑。' : '流程已通过结构检查，请确认是否符合您的策略逻辑。',
        color: 'gainlab',
        autoClose: 3500,
      })
    } catch (reason) {
      const rawMessage = reason instanceof Error ? reason.message : ''
      const message = rawMessage === 'workflow_generation_validation_failed'
        ? 'AI生成的流程结构仍不完整，请稍后重试或调整规则描述。'
        : rawMessage === 'workflow_generation_model_unavailable'
          ? '平台流程生成模型暂不可用，请联系管理员检查 qwen-plus 配置。'
        : rawMessage || 'AI无法生成有效流程，请调整描述后重试'
      notifications.show({ title: '流程生成失败', message, color: 'red', autoClose: 6000 })
    } finally {
      setWorkflowGeneratingStage(null)
    }
  }
  const requestWorkflowGeneration = (stage: WorkflowStageName) => {
    const logic = (stage === 'open' ? openLogic : positionLogic).trim()
    if (logic.length < 5) {
      notifications.show({ title: '请完善策略规则', message: `请先填写完整的${stage === 'open' ? '开仓' : '持仓风控'}逻辑`, color: 'red' })
      return
    }
    if (workflow[stage].nodes.length > 1) {
      setWorkflowOverwriteStage(stage)
      return
    }
    void generateWorkflowStage(stage)
  }
  return <form className={`strategy-form ${strategySource === 'custom' ? 'custom-strategy-form' : 'library-strategy-form'}`} onSubmit={submit} aria-busy={saving}>
    {saving && <div className="strategy-saving-overlay" role="status" aria-live="polite"><div><Loader color="teal" size="md" /><strong>{savingMessage}</strong><span>处理完成前请不要关闭页面</span></div></div>}
    {strategySource === 'official' ? <section className="panel form-section strategy-library-section"><div className="form-section-title"><span>01</span><div><h2>选择GL策略</h2><p>当前可选择已经配置完成的 GL 策略。</p></div></div><label className="library-option selected"><input type="radio" defaultChecked /><strong>{strategyTitle}</strong><button className="library-detail-button" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setStrategyDetailOpened(true) }}>查看详情<ChevronRight size={15} /></button><Check /></label></section> : <>
      <section className={`panel form-section strategy-workflow-module ${expandedWorkflowStages.open ? 'expanded' : ''}`}>
        <button className="workflow-module-heading" type="button" onClick={() => setExpandedWorkflowStages((current) => ({ ...current, open: !current.open }))} aria-expanded={expandedWorkflowStages.open}>
          <span className="workflow-module-number">01</span><div><h2>开仓模块</h2><p>设置首单开仓规则、判断开单时机以及开仓方向。</p></div>
          <div className="workflow-module-summary"><span>{workflowAiLabel(openAi)}</span><span>{workflowDataLabel('open')}</span><span>{workflow.open.nodes.length} 个节点</span></div><ChevronDown size={19} />
        </button>
        {expandedWorkflowStages.open && <div className="workflow-module-content">
          <button className={`workflow-ai-settings-toggle ${expandedAiSettings.open ? 'expanded' : ''}`} type="button" onClick={() => setExpandedAiSettings((current) => ({ ...current, open: !current.open }))} aria-expanded={expandedAiSettings.open}><Bot size={17} /><span><small>开单分析 AI</small><strong>{workflowAiLabel(openAi)}</strong></span><em>{openAi.mode === 'official' ? 'GL提供AI' : '自定义AI'}</em><ChevronDown size={17} /></button>
          {expandedAiSettings.open && <AiSelect title="开单分析 AI" value={openAi} options={aiModelOptions} defaultEndpointId={libraryStrategy?.open_ai_endpoint_id || ''} loading={aiModelsLoading} onShowPricing={() => setPricingOpened(true)} onShowCustomHelp={() => setCustomAiHelpOpened(true)} onChange={setOpenAi} />}
          <Suspense fallback={<div className="loading-block"><Loader color="teal" size="md" />正在加载开仓流程...</div>}><WorkflowEditor fixedStage="open" value={workflow} onChange={updateWorkflow} onGenerateWithAi={setWorkflowAiStage} draftStatus={workflowDraftStatus} /></Suspense>
        </div>}
      </section>
      <section className={`panel form-section strategy-workflow-module ${expandedWorkflowStages.position ? 'expanded' : ''}`}>
        <button className="workflow-module-heading" type="button" onClick={() => setExpandedWorkflowStages((current) => ({ ...current, position: !current.position }))} aria-expanded={expandedWorkflowStages.position}>
          <span className="workflow-module-number">02</span><div><h2>风控模块</h2><p>设置加仓、平仓、部分平仓以及止损止盈修改规则。</p></div>
          <div className="workflow-module-summary"><span>{workflowAiLabel(positionAi)}</span><span>{workflowDataLabel('position')}</span><span>{workflow.position.nodes.length} 个节点</span></div><ChevronDown size={19} />
        </button>
        {expandedWorkflowStages.position && <div className="workflow-module-content">
          <button className={`workflow-ai-settings-toggle ${expandedAiSettings.position ? 'expanded' : ''}`} type="button" onClick={() => setExpandedAiSettings((current) => ({ ...current, position: !current.position }))} aria-expanded={expandedAiSettings.position}><Bot size={17} /><span><small>持仓风控 AI</small><strong>{workflowAiLabel(positionAi)}</strong></span><em>{positionAi.mode === 'official' ? 'GL提供AI' : '自定义AI'}</em><ChevronDown size={17} /></button>
          {expandedAiSettings.position && <AiSelect title="持仓风控 AI" value={positionAi} options={aiModelOptions} defaultEndpointId={libraryStrategy?.position_ai_endpoint_id || ''} loading={aiModelsLoading} onShowPricing={() => setPricingOpened(true)} onShowCustomHelp={() => setCustomAiHelpOpened(true)} onChange={setPositionAi} />}
          <Suspense fallback={<div className="loading-block"><Loader color="teal" size="md" />正在加载风控流程...</div>}><WorkflowEditor fixedStage="position" value={workflow} onChange={updateWorkflow} onGenerateWithAi={setWorkflowAiStage} draftStatus={workflowDraftStatus} /></Suspense>
        </div>}
      </section>
    </>}
    <section className="panel form-section strategy-basic-section">
      <div className="form-section-title"><span>{strategySource === 'custom' ? '03' : '02'}</span><div><h2>{strategySource === 'custom' ? '策略信息设置' : '基础设置'}</h2><p>设置策略名称、运行状态、说明以及绑定的交易账号。</p></div></div>
      <div className="form-grid">
        <label><span>策略名称</span><input value={strategyName} onChange={(event) => setStrategyName(event.target.value)} /></label>
        <label><span>运行状态</span><Select className="app-mantine-select" value={strategyStatus} onChange={(value) => setStrategyStatus(value || 'active')} data={[{ value: 'active', label: '运行中' }, { value: 'paused', label: '暂停' }]} allowDeselect={false} /></label>
        {strategySource === 'custom' && <label className="strategy-description-field"><span>策略说明</span><textarea value={eaDescription} onChange={(event) => setEaDescription(event.target.value)} maxLength={1000} rows={3} placeholder="例如：黄金15分钟趋势策略，EA连接后会显示此说明" /></label>}
        <label className="mt-login-field"><span>绑定 MT4/MT5 账号</span><input value={mtLogin} onChange={(event) => setMtLogin(event.target.value)} inputMode="numeric" placeholder="留空则在首次连接时自动绑定" /><small>{mtLogin ? (editing ? '此 Key 只允许该 MT 账号使用；可以修改或清空后重新绑定。' : '创建后，此 Key 只允许该 MT 账号使用。') : '留空时，MT 首次连接会自动绑定上传的账号。'}</small></label>
      </div>
    </section>
    {strategySource === 'official' && <section className="panel form-section strategy-ai-section"><div className="form-section-title"><span>03</span><div><h2>AI 模型</h2><p>开单和持仓风控可以分别选择 GL 提供的模型或配置自己的 AI 接口。带有图片图标的模型支持截图识别。</p></div></div><div className="form-grid two-cards"><AiSelect title="开单分析 AI" value={openAi} options={aiModelOptions} defaultEndpointId={libraryStrategy?.open_ai_endpoint_id || ''} loading={aiModelsLoading} onShowPricing={() => setPricingOpened(true)} onShowCustomHelp={() => setCustomAiHelpOpened(true)} onChange={setOpenAi} /><AiSelect title="持仓风控 AI" value={positionAi} options={aiModelOptions} defaultEndpointId={libraryStrategy?.position_ai_endpoint_id || ''} loading={aiModelsLoading} onShowPricing={() => setPricingOpened(true)} onShowCustomHelp={() => setCustomAiHelpOpened(true)} onChange={setPositionAi} /></div></section>}
    <section className="panel form-section strategy-risk-section"><div className="form-section-title"><span>04</span><div><h2>{strategySource === 'custom' ? '仓位与风险设置' : '仓位和风险'}</h2><p>服务端会在返回订单前按照此处规则计算最终手数。</p></div></div><div className="segmented"><button type="button" className={sizeMode === 'fixed' ? 'active' : ''} onClick={() => setSizeMode('fixed')}>固定手数</button><button type="button" className={sizeMode === 'risk' ? 'active' : ''} onClick={() => setSizeMode('risk')}>以损定仓</button></div>{sizeMode === 'fixed' ? <div className="form-grid"><label><span>每次开单手数</span><input type="number" min="0.01" value={fixedVolume} onChange={(event) => setFixedVolume(event.target.value)} step="0.01" /></label><label><span>最大持仓数量</span><input type="number" min="1" value={maxPositions} onChange={(event) => setMaxPositions(event.target.value)} /></label></div> : <><div className="form-grid risk-mode-grid"><label><span>风险计算方式</span><Select className="app-mantine-select" value={riskBaseMode} onChange={(value) => setRiskBaseMode(value === 'balance_percent' ? 'balance_percent' : 'fixed_loss')} data={[{ value: 'fixed_loss', label: '固定止损金额' }, { value: 'balance_percent', label: '余额比例止损' }]} allowDeselect={false} /></label>{riskBaseMode === 'fixed_loss' ? <label><span>每单最大风险金额</span><div className="suffix-input"><input type="number" min="0" value={riskAmount} onChange={(event) => setRiskAmount(event.target.value)} /><span>USD</span></div></label> : <label><span>单笔风险占余额比例</span><div className="suffix-input"><input type="number" min="0.01" step="0.1" value={riskPercent} onChange={(event) => setRiskPercent(event.target.value)} /><span>%</span></div></label>}<label><span>最大持仓数量</span><input type="number" min="1" value={maxPositions} onChange={(event) => setMaxPositions(event.target.value)} /></label></div><p className="risk-mode-note">以损定仓需要策略返回有效止损价；没有止损价时，服务端会回退到固定手数或拒绝下单。</p></>}<label className="toggle-row"><div><strong>允许策略加仓</strong><small>仅在策略返回明确加仓动作且未超过持仓上限时执行</small></div><input type="checkbox" checked={allowAdd} onChange={(event) => setAllowAdd(event.target.checked)} /></label></section>
    <div className="form-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={() => editing && onCancel ? onCancel() : navigate(editing && deployment ? `/app/strategies/${deployment.id}` : '/app/strategies')}>取消</button><button className="button button-primary" type="submit" disabled={saving || aiModelsLoading || (strategySource === 'official' && !libraryStrategy) || (strategySource === 'custom' && (openLogic.trim().length < 5 || positionLogic.trim().length < 5))}>{saving ? customNeedsCompilation ? 'AI 正在分析策略...' : editing ? '正在保存...' : '正在创建...' : customNeedsCompilation ? '生成策略配置' : editing ? '保存修改' : '创建并生成 Key'}{!saving && <ArrowRight size={17} />}</button></div>
    <Modal opened={Boolean(workflowAiStage)} onClose={() => { if (!workflowGeneratingStage) setWorkflowAiStage(null) }} closeOnClickOutside={!workflowGeneratingStage} closeOnEscape={!workflowGeneratingStage} title={`AI帮我生成${workflowAiStage === 'position' ? '风控' : '开仓'}流程`} centered size="lg">
      <div className="workflow-generation-note"><Sparkles size={15} /><span>流程图由平台使用 qwen-plus 生成，不会扣除您的 GL AI 余额；当前模块选择的 AI 仅用于策略运行。</span></div>
      <div className="custom-rule-grid single">
        {workflowAiStage === 'position'
          ? <label><span>持仓风控逻辑</span><textarea rows={10} disabled={Boolean(workflowGeneratingStage)} value={positionLogic} onChange={(event) => setPositionLogic(event.target.value)} placeholder="请描述加仓、平仓、部分平仓、取消挂单和修改止损止盈规则" /></label>
          : <label><span>开仓逻辑</span><textarea rows={10} disabled={Boolean(workflowGeneratingStage)} value={openLogic} onChange={(event) => setOpenLogic(event.target.value)} placeholder="请用自然语言描述开仓方向、开单条件和止损止盈规则" /></label>}
      </div>
      <div className="custom-preview-actions"><button className="button button-secondary" type="button" disabled={Boolean(workflowGeneratingStage)} onClick={() => setWorkflowAiStage(null)}>取消</button><button className="button button-primary" type="button" disabled={Boolean(workflowGeneratingStage)} onClick={() => workflowAiStage && requestWorkflowGeneration(workflowAiStage)}>{workflowGeneratingStage ? <Loader color="dark" size="xs" /> : <Sparkles size={16} />}{workflowGeneratingStage ? 'AI正在生成并检查...' : '生成流程图'}</button></div>
    </Modal>
    <Modal opened={Boolean(workflowOverwriteStage)} onClose={() => setWorkflowOverwriteStage(null)} title="确认覆盖现有流程" centered size="sm" closeOnClickOutside={!workflowGeneratingStage} closeOnEscape={!workflowGeneratingStage}>
      <div className="workflow-overwrite-confirm"><p>当前{workflowOverwriteStage === 'position' ? '风控' : '开仓'}模块已经有流程图。继续生成会覆盖当前模块的全部节点和连线，但不会影响{workflowOverwriteStage === 'position' ? '开仓' : '风控'}模块。</p><small>覆盖后本地草稿也会同步更新，原流程无法自动恢复，请确认自然语言规则已经填写完整。</small><div><button className="button button-secondary" type="button" disabled={Boolean(workflowGeneratingStage)} onClick={() => setWorkflowOverwriteStage(null)}>暂不覆盖</button><button className="button button-primary" type="button" disabled={Boolean(workflowGeneratingStage)} onClick={() => { const stage = workflowOverwriteStage; setWorkflowOverwriteStage(null); if (stage) void generateWorkflowStage(stage) }}><Sparkles size={16} />确认覆盖并生成</button></div></div>
    </Modal>
    <Modal opened={strategyDetailOpened} onClose={() => setStrategyDetailOpened(false)} title="策略说明" centered size="lg" classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      <div className="strategy-library-detail"><h3>{strategyTitle}</h3><p>{strategyDescription.replace(/\\n/g, '\n')}</p><button className="button button-primary" type="button" onClick={() => setStrategyDetailOpened(false)}>关闭</button></div>
    </Modal>
    <Modal opened={Boolean(customPreview)} onClose={() => { if (saving) return; setCustomPreview(null); setPendingStrategyPayload(null) }} closeOnClickOutside={!saving} closeOnEscape={!saving} title="确认策略配置结果" centered size="xl" classNames={{ content: 'custom-preview-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      {customPreview && <div className="custom-preview-content">
        <p className="custom-preview-lead">系统已根据您确认的开仓与风控流程图生成运行配置。请核对指标和数据需求，确认后才会正式保存并生成 Key。</p>
        <section><h3>策略理解</h3><p>{customPreview.summary || 'AI 未提供策略摘要，请重点检查下方提示词模板。'}</p></section>
        <div className="custom-preview-columns">
          {(['open', 'position'] as const).map((prefix) => {
            const isOpen = prefix === 'open'
            const indicators = isOpen ? customPreview.open_indicators : customPreview.position_indicators
            const requested = isOpen ? customPreview.open_requested_kline_count : customPreview.position_requested_kline_count
            const required = isOpen ? customPreview.open_indicator_kline_count : customPreview.position_indicator_kline_count
            const effective = isOpen ? customPreview.open_kline_count : customPreview.position_kline_count
            const rulePlan = isOpen ? customPreview.open_rule_plan : customPreview.position_rule_plan
            return <section key={prefix}><h3>{isOpen ? '开仓分析' : '持仓风控'}</h3><div className={`rule-execution-mode ${rulePlan?.mode === 'deterministic' ? 'deterministic' : 'ai'}`}><strong>{rulePlan?.mode === 'deterministic' ? '精确规则执行' : 'AI 判断'}</strong><span>{rulePlan?.mode === 'deterministic' ? '条件和价格由服务端计算，AI生成分析说明' : '当前规则需要由AI结合运行数据判断'}</span></div>{rulePlan?.mode === 'deterministic' && rulePlan.rules.length > 0 && <ol className="compiled-rule-list">{rulePlan.rules.map((rule, index) => <li key={`${prefix}-${index}`}>{rule.description || `规则 ${index + 1}`}</li>)}</ol>}<dl><div><dt>内置指标</dt><dd>{indicators.length ? indicators.map((item) => item.alias || item.name).join('、') : '无需额外指标'}</dd></div><div><dt>K线数量</dt><dd>{effective} 根 <small>（用户设置 {requested}，指标至少需要 {required}）</small></dd></div></dl></section>
          })}
        </div>
        {(customPreview.unsupported_indicators.length > 0 || customPreview.warnings.length > 0) && <section className="custom-preview-warnings"><h3>需要注意</h3>{customPreview.unsupported_indicators.length > 0 && <p>暂不支持自动计算：{customPreview.unsupported_indicators.join('、')}</p>}{customPreview.warnings.length > 0 && <ul>{customPreview.warnings.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}</section>}
        <details><summary>查看开仓提示词模板</summary><pre>{customPreview.open_prompt_template}</pre></details>
        <details><summary>查看持仓风控提示词模板</summary><pre>{customPreview.position_prompt_template}</pre></details>
        <div className="custom-preview-actions"><button className="button button-secondary" type="button" disabled={saving} onClick={() => { setCustomPreview(null); setPendingStrategyPayload(null) }}>返回修改</button><button className="button button-primary" type="button" disabled={saving || !pendingStrategyPayload} onClick={() => pendingStrategyPayload && void saveStrategy(pendingStrategyPayload, customPreview)}>{saving ? '正在保存...' : editing ? '确认并保存修改' : '确认创建并生成 Key'}<ArrowRight size={17} /></button></div>
      </div>}
    </Modal>
    <Modal opened={Boolean(selectedIndicator)} onClose={() => setSelectedIndicator(null)} title="指标说明" centered size="md" classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      {selectedIndicator && <div className="indicator-detail-modal"><div className="indicator-detail-title"><span>{selectedIndicator.name.toUpperCase()}</span><h3>{selectedIndicator.title}</h3>{selectedIndicator.name === 'sma' && <p>策略中写 MA 时按 SMA 计算。</p>}</div><section><span>可选参数</span><div className="indicator-parameter-list">{selectedIndicator.parameters.map((parameter) => <article key={parameter.name}><div><strong>{parameter.label}</strong><code>{parameter.name}</code></div><b>默认值：{parameter.default}</b></article>)}</div></section>{indicatorSourceOptions(selectedIndicator).length > 0 && <section><span>可选数据源</span><div className="indicator-source-list">{indicatorSourceOptions(selectedIndicator).map((source) => <article key={source.value}><strong>{source.label}</strong><code>{source.formula}</code></article>)}</div></section>}<button className="button button-primary" type="button" onClick={() => setSelectedIndicator(null)}>关闭</button></div>}
    </Modal>
    <Modal opened={dataHelpOpened} onClose={() => setDataHelpOpened(false)} title="EA提供数据说明" centered size="lg" classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      <div className="ea-data-help"><p>开仓分析和持仓风控可以分别设置，按策略实际需要选择即可。</p><div><article><strong>K线</strong><span>适合均线、指标、价格高低点、连续涨跌和常见K线形态等规则。数据便于精确计算，输入 Token 相对较少，通常优先选择。</span></article><article><strong>截图</strong><span>适合图表中的自定义指标、画线、特殊图形或无法由系统计算的内容。所选 AI 必须支持图片识别，图片会产生额外输入 Token。</span></article><article><strong>K线 + 截图</strong><span>适合同时需要精确数值计算和图表视觉判断的策略，信息最完整，但输入 Token 和调用成本通常也最高。</span></article></div><section><strong>Token 提示</strong><ul><li>K线数量越多，输入 Token 越多；满足策略判断需要即可。</li><li>截图尺寸、清晰度和模型的图片计费方式都会影响 Token。</li><li>开仓与持仓风控可使用不同设置，不需要统一选择。</li></ul></section><button className="button button-primary" type="button" onClick={() => setDataHelpOpened(false)}>关闭</button></div>
    </Modal>
    <Modal opened={pricingOpened} onClose={() => setPricingOpened(false)} title="GL AI 收费标准" centered size="lg" classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      <div className="ai-pricing-modal"><p>以下价格为平台实际计费标准，单位：元 / 百万 Token。</p><div className="ai-model-category-tabs"><button className={pricingCategory === '全部' ? 'active' : ''} type="button" onClick={() => setPricingCategory('全部')}>全部</button>{aiModelCategories(aiModelOptions).map((category) => <button key={category} className={pricingCategory === category ? 'active' : ''} type="button" onClick={() => setPricingCategory(category)}>{category}</button>)}</div><div className="table-wrap"><table><thead><tr><th>模型</th><th>输入价格</th><th>输出价格</th></tr></thead><tbody>{aiModelOptions.filter((item) => pricingCategory === '全部' || aiModelCategory(item.provider_name) === pricingCategory).map((item) => <tr key={item.id}><td><strong>{item.provider_name}</strong></td><td>¥{money(item.input_price_per_million)}</td><td>¥{money(item.output_price_per_million)}</td></tr>)}</tbody></table></div><small>每次调用按照实际输入和输出 Token 分别计算费用，最终从账户余额中实时扣除。</small><button className="button button-primary" type="button" onClick={() => setPricingOpened(false)}>关闭</button></div>
    </Modal>
    <Modal opened={customAiHelpOpened} onClose={() => setCustomAiHelpOpened(false)} title="自定义 AI 接口说明" centered size="lg" classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      <div className="custom-ai-help"><p>当前支持 OpenAI Chat Completions 兼容结构。OpenAI、DeepSeek、通义千问兼容模式以及多数中转服务商通常都可以使用。</p><h3>请求结构示例</h3><pre>{'{\n  "model": "gpt-4o",\n  "messages": [\n    { "role": "system", "content": "..." },\n    { "role": "user", "content": "..." }\n  ],\n  "temperature": 0.2\n}'}</pre><p>请确认服务商接口支持以上 JSON 请求结构，并支持 Bearer API Key 鉴权；不兼容此结构的接口暂时无法接入。</p><button className="button button-primary" type="button" onClick={() => setCustomAiHelpOpened(false)}>关闭</button></div>
    </Modal>
  </form>
}

function DataRequirementCard({ title, dataType, klineCount, onDataTypeChange, onKlineCountChange }: {
  title: string
  dataType: string
  klineCount: string
  onDataTypeChange: (value: string) => void
  onKlineCountChange: (value: string) => void
}) {
  const usesKline = dataType === 'kline' || dataType === 'both'
  return <div className="data-requirement-card"><strong>{title}</strong><label><span>数据类型</span><Select className="app-mantine-select" value={dataType} onChange={(value) => onDataTypeChange(value || 'kline')} data={[{ value: 'kline', label: 'K线' }, { value: 'screenshot', label: '截图' }, { value: 'both', label: 'K线 + 截图' }]} allowDeselect={false} /></label>{usesKline && <label><span>K线数量</span><input type="number" min="10" max="1000" step="10" value={klineCount} onChange={(event) => onKlineCountChange(event.target.value)} /><small>允许设置 10～1000 根；指标计算需要更多历史数据时，系统会自动增加 EA 请求数量。</small></label>}</div>
}

function AiSelect({ title, value, options, defaultEndpointId, loading, onShowPricing, onShowCustomHelp, onChange }: {
  title: string
  value: AiFormConfig
  options: AiModelOption[]
  defaultEndpointId: string
  loading: boolean
  onShowPricing: () => void
  onShowCustomHelp: () => void
  onChange: (next: AiFormConfig) => void
}) {
  const [testing, setTesting] = useState(false)
  const [testingVision, setTestingVision] = useState(false)
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null)
  const [testResultType, setTestResultType] = useState<'connection' | 'vision'>('connection')
  const selectOfficial = (endpointId: string | null) => {
    const option = options.find((item) => item.id === endpointId)
    if (option) onChange({ ...value, endpointId: option.id, model: option.model, visionVerified: Boolean(option.supports_vision && option.vision_test_status === 'passed') })
  }
  const testCustomAi = async () => {
    if (!value.baseUrl.trim() || !value.customModel.trim() || !value.apiKey.trim()) {
      notifications.show({
        title: '请完整填写测试配置',
        message: value.keyConfigured && !value.apiKey.trim() ? '为保护密钥安全，测试已有配置时请重新输入 API Key。' : '请输入 Base URL、模型名称和 API Key。',
        color: 'red',
      })
      return
    }
    setTesting(true)
    try {
      const result = await apiRequest<AiConnectionTestResult>('/api/v1/auth/custom-ai/test', {
        method: 'POST',
        body: JSON.stringify({
          base_url: value.baseUrl.trim(),
          model: value.customModel.trim(),
          api_key: value.apiKey.trim(),
        }),
      })
      if (!result.success) {
        notifications.show({ title: '连接测试失败', message: result.error || '模型接口未能正常响应', color: 'red', autoClose: 8000 })
        return
      }
      setTestResultType('connection')
      setTestResult(result)
    } catch (reason) {
      notifications.show({ title: '连接测试失败', message: reason instanceof Error ? reason.message : '模型接口未能正常响应', color: 'red', autoClose: 8000 })
    } finally {
      setTesting(false)
    }
  }
  const testCustomAiVision = async () => {
    if (!value.baseUrl.trim() || !value.customModel.trim() || !value.apiKey.trim()) {
      notifications.show({
        title: '请完整填写测试配置',
        message: value.keyConfigured && !value.apiKey.trim() ? '为保护密钥安全，测试已有配置时请重新输入 API Key。' : '请输入 Base URL、模型名称和 API Key。',
        color: 'red',
      })
      return
    }
    setTestingVision(true)
    try {
      const result = await apiRequest<AiConnectionTestResult>('/api/v1/auth/custom-ai/test-vision', {
        method: 'POST',
        body: JSON.stringify({ base_url: value.baseUrl.trim(), model: value.customModel.trim(), api_key: value.apiKey.trim() }),
      })
      if (!result.success) {
        onChange({ ...value, visionVerified: false })
        notifications.show({ title: '图片识别测试失败', message: result.error || '模型未能正确识别测试图片', color: 'red', autoClose: 8000 })
        return
      }
      onChange({ ...value, visionVerified: true })
      setTestResultType('vision')
      setTestResult(result)
    } catch (reason) {
      onChange({ ...value, visionVerified: false })
      notifications.show({ title: '图片识别测试失败', message: reason instanceof Error ? reason.message : '模型未能正确识别测试图片', color: 'red', autoClose: 8000 })
    } finally {
      setTestingVision(false)
    }
  }
  return <div className="ai-select">
    <div className="ai-select-title"><BrainCircuit /><strong>{title}</strong></div>
    <div className="segmented compact">
      <button className={value.mode === 'official' ? 'active' : ''} type="button" onClick={() => { const option = options.find((item) => item.id === value.endpointId); onChange({ ...value, mode: 'official', visionVerified: Boolean(option?.supports_vision && option?.vision_test_status === 'passed') }) }}>GL提供AI</button>
      <button className={value.mode === 'custom' ? 'active' : ''} type="button" onClick={() => onChange({ ...value, mode: 'custom', visionVerified: value.mode === 'custom' && value.visionVerified })}>自定义AI</button>
    </div>
    {value.mode === 'official' ? <>
      <label><span>选择模型</span><Select className={`app-mantine-select ai-model-vision-select${value.visionVerified ? ' has-vision-icon' : ''}`} value={value.endpointId || null} onChange={selectOfficial} data={groupedAiModelOptions(options, defaultEndpointId)} placeholder={loading ? '正在加载模型...' : '请选择模型'} disabled={loading || options.length === 0} allowDeselect={false} searchable leftSection={value.visionVerified ? <ImageIcon className="ai-model-vision-icon supported" size={15} /> : null} renderOption={({ option }) => { const modelOption = options.find((item) => item.id === option.value); const supportsVision = Boolean(modelOption?.supports_vision && modelOption?.vision_test_status === 'passed'); return <div className="ai-model-select-option"><span>{option.label}</span>{supportsVision && <ImageIcon className="ai-model-vision-icon supported" size={15} aria-label="支持图片" />}</div> }} /></label>
      <div className="ai-price"><Coins size={15} /><span>{options.length ? <><span>按实际 Token 用量和模型价格计费</span><small>价格可能随模型服务商调整</small></> : loading ? '正在读取模型配置...' : '暂无可用的 GL AI 模型'}</span>{options.length > 0 && <button type="button" onClick={onShowPricing}>查看收费标准</button>}</div>
    </> : <div className="custom-ai-fields">
      <label><span>接口类型</span><div className="custom-ai-type">OpenAI 兼容接口</div></label>
      <label><span>Base URL</span><input value={value.baseUrl} onChange={(event) => onChange({ ...value, baseUrl: event.target.value, visionVerified: false })} placeholder="例如 https://api.openai.com/v1，也支持完整接口地址" /></label>
      <label><span>模型名称</span><input value={value.customModel} onChange={(event) => onChange({ ...value, customModel: event.target.value, visionVerified: false })} placeholder="例如 gpt-4o / deepseek-chat / qwen-plus" /></label>
      <label><span>API Key</span><input type="password" value={value.apiKey} onChange={(event) => onChange({ ...value, apiKey: event.target.value, visionVerified: false })} placeholder={value.keyConfigured ? '已配置，留空表示不修改' : '请输入 API Key'} autoComplete="new-password" /></label>
      <div className="custom-ai-note"><ShieldCheck size={15} /><span>{value.visionVerified ? '图片识别测试已通过；修改接口配置后需要重新测试。' : 'API Key 通过请求头发送；选择截图数据时需要先通过图片识别测试。'}</span><div className="custom-ai-note-actions"><button type="button" onClick={onShowCustomHelp}>查看接口说明</button><button className="custom-ai-test-button" type="button" disabled={testing || testingVision} onClick={testCustomAi}><Zap size={13} />{testing ? '测试中...' : '测试连接'}</button><button className="custom-ai-test-button" type="button" disabled={testing || testingVision} onClick={testCustomAiVision}><Zap size={13} />{testingVision ? '识别中...' : '测试图片识别'}</button></div></div>
    </div>}
    <Modal opened={Boolean(testResult)} onClose={() => setTestResult(null)} title={testResultType === 'vision' ? '图片识别测试成功' : '模型连接测试成功'} centered classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}>
      {testResult && <div className="custom-ai-test-result"><div className="custom-ai-test-success"><Check size={22} /></div><p><span>模型</span><strong>{testResult.model || value.customModel}</strong></p>{testResultType === 'vision' && <p><span>识别结果</span><strong>红色圆形、蓝色方形（正确）</strong></p>}<p><span>响应耗时</span><strong>{Number(testResult.elapsed_ms || 0)} ms</strong></p><p><span>Token 用量</span><strong>输入 {Number(testResult.prompt_tokens || 0)} / 输出 {Number(testResult.completion_tokens || 0)} / 合计 {Number(testResult.total_tokens || 0)}</strong></p><div><span>返回内容</span><pre>{testResult.response_preview || '-'}</pre></div><small>本次仅用于能力测试，不扣除平台余额，也不会写入 AI 使用流水；AI 服务商可能收取少量请求费用。</small><button className="button button-primary" type="button" onClick={() => setTestResult(null)}>关闭</button></div>}
    </Modal>
  </div>
}

export function StrategyLibraryCreatePage() { return <><PageHeading eyebrow="STRATEGY LIBRARY" title="从策略库创建" description="选择经过配置的 GL 策略，完成部署后生成用于 MT4/MT5 的唯一 Key。" /><StrategyForm source="official" /></> }

export function CustomAiStrategyCreatePage() { return <><PageHeading eyebrow="CUSTOM AI STRATEGY" title="自定义AI策略" description="选择AI模型并描述您的交易逻辑，确认配置后生成用于 MT4/MT5 的唯一 Key。" /><StrategyForm source="custom" /></> }

export function WorkflowPrototypePage() {
  const draftKey = useMemo(() => workflowDraftKey(String(getStoredUser()?.id || 'anonymous')), [])
  const initialDraft = useMemo(() => loadWorkflowDraft(draftKey), [draftKey])
  const [workflow, setWorkflow] = useState(() => initialDraft?.workflow || createDefaultWorkflow())
  const [draftDirty, setDraftDirty] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft?.saved_at || '')
  const workflowRef = useRef(workflow)
  const draftDirtyRef = useRef(false)
  const [aiOpened, setAiOpened] = useState(false)
  useEffect(() => {
    if (!draftDirty) return
    const timer = window.setTimeout(() => {
      const draft = saveWorkflowDraft(draftKey, workflow)
      setDraftSavedAt(draft.saved_at)
      setDraftDirty(false)
      draftDirtyRef.current = false
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draftDirty, draftKey, workflow])
  useEffect(() => {
    const flushDraft = () => {
      if (draftDirtyRef.current) saveWorkflowDraft(draftKey, workflowRef.current)
    }
    window.addEventListener('beforeunload', flushDraft)
    return () => { window.removeEventListener('beforeunload', flushDraft); flushDraft() }
  }, [draftKey])
  const updateWorkflow = (next: typeof workflow) => {
    workflowRef.current = next
    draftDirtyRef.current = true
    setWorkflow(next)
    setDraftDirty(true)
  }
  const draftStatus = draftDirty
    ? '草稿保存中...'
    : draftSavedAt
      ? `草稿已保存 ${new Date(draftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      : '修改后自动保存草稿'
  return <>
    <PageHeading eyebrow="VISUAL STRATEGY" title="可视化策略编辑器" description="通过条件分支搭建开仓与持仓风控逻辑；当前页面用于确认第一版编辑体验。" />
    <Suspense fallback={<div className="panel loading-block"><Loader color="teal" size="md" />正在加载流程编辑器...</div>}><WorkflowEditor value={workflow} onChange={updateWorkflow} onGenerateWithAi={() => setAiOpened(true)} draftStatus={draftStatus} /></Suspense>
    <Modal opened={aiOpened} onClose={() => setAiOpened(false)} title="AI帮我生成流程" centered size="xl">
      <div className="custom-rule-grid">
        <label><span>开仓逻辑</span><textarea rows={8} placeholder="请用自然语言描述开仓方向、条件和止损止盈规则" /></label>
        <label><span>持仓风控逻辑</span><textarea rows={8} placeholder="请描述平仓、加仓、部分平仓和修改止损止盈规则" /></label>
      </div>
      <div className="custom-preview-actions"><button className="button button-secondary" type="button" onClick={() => setAiOpened(false)}>取消</button><button className="button button-primary" type="button" disabled><Sparkles size={16} />生成流程草稿（下一阶段接入）</button></div>
    </Modal>
  </>
}

export function StrategyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const { data, loading, error, refresh } = usePortalData()
  if (loading) return <div className="permission-loading">正在加载策略详情...</div>
  if (!data) return <div className="permission-notice"><ShieldCheck size={18} /><div><strong>策略加载失败</strong><span>{error}</span></div></div>
  const deployment = data.strategies.find((item) => item.id === id)
  if (!deployment) return <EmptyState icon={<Bot />} title="没有找到该策略" description="策略可能已被删除，或不属于当前账户。" action={<Link className="button button-secondary" to="/app/strategies">返回策略列表</Link>} />
  const exitEditing = (reload: boolean) => {
    setEditing(false)
    navigate(`/app/strategies/${deployment.id}`, { replace: true })
    if (reload) refresh()
  }
  if (editing) return <><PageHeading eyebrow="EDIT STRATEGY" title="编辑策略" description="修改模型、仓位和运行状态，不会改变现有部署 Key。" /><StrategyForm editing deployment={deployment} onSaved={() => exitEditing(true)} onCancel={() => exitEditing(false)} /></>
  const strategyOrders = data.orders.list.filter((order) => order.deployment_id === deployment.id)
  const signalRate = deployment.analysis_count ? (deployment.signal_count / deployment.analysis_count) * 100 : 0
  const positionText = deployment.position_size_mode === 'fixed'
    ? `固定手数 / ${deployment.fixed_volume.toFixed(2)}`
    : deployment.risk_base_mode === 'balance_percent'
      ? `风险比例 / ${deployment.risk_percent}%`
      : `固定风险金额 / ${money(deployment.risk_amount)} USD`
  const copyDeploymentKey = async () => {
    try {
      await navigator.clipboard.writeText(deployment.deployment_key)
      notifications.show({ title: '复制成功', message: '部署 Key 已复制到剪贴板', color: 'gainlab', autoClose: 1800 })
    } catch {
      notifications.show({ title: '复制失败', message: '请手动选择并复制部署 Key', color: 'red' })
    }
  }
  return <>
    <PageHeading eyebrow="STRATEGY DETAIL" title={deployment.name} description={`部署 ID：${deployment.id}`} action={<div className="button-group"><button className="button button-secondary" type="button" onClick={() => setEditing(true)}><Settings2 size={16} />编辑</button><button className="button button-primary" type="button" onClick={() => window.location.reload()}><RefreshCcw size={16} />刷新数据</button></div>} />
    <section className="detail-hero panel"><div><div className="detail-title"><div className="strategy-row-icon"><BrainCircuit /></div><div><span>{deployment.strategy_code === 'CUSTOM_AI_V1' ? 'CUSTOM STRATEGY' : `GAINLAB OFFICIAL · ${deployment.strategy_code}`}</span><h2>{deployment.name}</h2></div><StatusPill tone={statusTone(deployment.status)}>{statusText(deployment.status)}</StatusPill></div><p className="strategy-detail-summary">{(deployment.summary || (deployment.strategy_code === 'CUSTOM_AI_V1' ? '由自然语言规则生成的自定义 AI 策略。' : '本策略由价格行为分析引擎与 AI 共同完成候选信号识别、开仓判断和持仓风控。')).replace(/\\n/g, '\n')}</p></div><div className="detail-key"><span>MT4 / MT5 部署 Key</span><div><code>{deployment.deployment_key}</code><button type="button" onClick={copyDeploymentKey}><Copy size={15} />复制 Key</button></div><small><ShieldCheck size={14} />请勿公开分享，该 Key 可以调用您的策略。</small><Link className="detail-key-guide" to="/guide">如何设置？<ArrowRight size={14} /></Link></div></section>
    <section className="stats-grid compact-stats"><StatCard label="分析次数" value={numberText(deployment.analysis_count)} note={`累计调用 ${numberText(deployment.analysis_count)} 次`} icon={<Activity />} /><StatCard label="有效信号" value={numberText(deployment.signal_count)} note={`信号率 ${signalRate.toFixed(2)}%`} icon={<Zap />} tone="blue" /><StatCard label="历史订单" value={numberText(deployment.order_count)} note={`${strategyOrders.length} 条已同步记录`} icon={<ReceiptText />} /><StatCard label="累计盈亏" value={signedMoney(deployment.pnl)} note="净盈亏" icon={<LineChart />} tone="amber" /></section>
    <section className="detail-grid"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">RUNTIME CONFIG</span><h2>运行配置</h2></div></div><div className="info-list"><Info label="绑定 MT 账号" value={deployment.mt_login || '首次连接时自动绑定'} icon={<Fingerprint />} /><Info label="开单算法" value={positionText} icon={<ShieldCheck />} /><Info label="最大持仓" value={`${deployment.max_positions}${deployment.allow_add ? '（允许加仓）' : ''}`} icon={<BarChart3 />} /></div></article><article className="panel"><div className="panel-heading"><div><span className="eyebrow">AI MODELS</span><h2>模型配置</h2></div></div><div className="model-summary"><div><BrainCircuit /><span><small>开单分析</small><strong>{deployment.open_ai_endpoint_name || deployment.open_ai_model || '未指定模型'}</strong><em>{aiModeText(deployment.open_ai_mode)}</em></span></div><div><BrainCircuit /><span><small>持仓风控</small><strong>{deployment.position_ai_endpoint_name || deployment.position_ai_model || '未指定模型'}</strong><em>{aiModeText(deployment.position_ai_mode)}</em></span></div></div><div className="usage-progress"><div><span>累计 AI Token</span><strong>{tokenText(deployment.official_tokens_used + deployment.custom_tokens_used)}</strong></div><i><b style={{ width: deployment.analysis_count ? '100%' : '0%' }} /></i></div></article></section>
    {deployment.strategy_code === 'CUSTOM_AI_V1' && <section className="panel custom-strategy-detail"><div className="panel-heading"><div><span className="eyebrow">CUSTOM RULES</span><h2>自定义策略逻辑</h2></div></div>{deployment.workflow?.open && deployment.workflow?.position && Array.isArray(deployment.workflow.open.nodes) && Array.isArray(deployment.workflow.position.nodes) ? <div className="strategy-workflow-readonly"><div className="strategy-workflow-stage"><h3>开仓流程</h3><Suspense fallback={<div className="loading-block">正在加载开仓流程...</div>}><WorkflowEditor value={deployment.workflow} fixedStage="open" readOnly /></Suspense></div><div className="strategy-workflow-stage"><h3>风控流程</h3><Suspense fallback={<div className="loading-block">正在加载风控流程...</div>}><WorkflowEditor value={deployment.workflow} fixedStage="position" readOnly /></Suspense></div></div> : <div><article><span>开仓逻辑</span><p>{deployment.open_logic || '-'}</p><small>指标：{deployment.open_indicators?.length ? deployment.open_indicators.map((item) => item.alias || item.name).join('、') : '仅使用 K 线数据'}</small></article><article><span>持仓风控逻辑</span><p>{deployment.position_logic || '-'}</p><small>指标：{deployment.position_indicators?.length ? deployment.position_indicators.map((item) => item.alias || item.name).join('、') : '仅使用 K 线与持仓数据'}</small></article></div>}</section>}
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST ORDERS</span><h2>最近订单</h2></div><Link to="/app/orders"><TextLink>查看全部</TextLink></Link></div><RecentOrders orders={strategyOrders.slice(0, 5)} /></section>
  </>
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div>{icon}<span>{label}</span><strong>{value}</strong></div> }

export function WalletPage() {
  const { data, loading, error } = usePortalData()
  const [aiModelOptions, setAiModelOptions] = useState<AiModelOption[]>([])
  const [aiModelsLoading, setAiModelsLoading] = useState(true)
  const [pricingOpened, setPricingOpened] = useState(false)
  const [pricingCategory, setPricingCategory] = useState('全部')
  useEffect(() => {
    let active = true
    apiRequest<{ list: AiModelOption[] }>('/api/v1/auth/ai-model-options')
      .then((result) => { if (active) setAiModelOptions(result.list.filter((item) => item.official_available)) })
      .catch(() => { if (active) setAiModelOptions([]) })
      .finally(() => { if (active) setAiModelsLoading(false) })
    return () => { active = false }
  }, [])
  if (loading) return <div className="permission-loading">正在加载余额...</div>
  if (!data) return <div className="permission-notice"><ShieldCheck size={18} /><div><strong>余额加载失败</strong><span>{error}</span></div></div>
  const wallet = data.wallet
  const usesOfficialAi = data.strategies.some((item) => item.open_ai_mode !== 'custom' || item.position_ai_mode !== 'custom')
  const warningThreshold = Number(wallet.low_balance_threshold || 10).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return <>
    <PageHeading eyebrow="GL AI WALLET" title="GL AI余额" description="使用 GL 提供的 AI 时按各模型实际输入、输出 Token 价格实时计费；自定义 AI 不扣除平台余额。" />
    {usesOfficialAi && wallet.balance_warning && <div className="permission-notice balance-warning-danger"><Coins size={21} /><div><strong>当前余额不足 {warningThreshold} 元，为保证 EA 正常运行，建议及时充值</strong><span>账户余额 ¥{money(wallet.balance)}，含信用额度当前可用 ¥{money(wallet.available_balance)}。{wallet.credit_exhausted ? '信用额度已用完，官方 AI 已停止调用。' : ''}</span></div></div>}
    <section className="wallet-grid"><article className="wallet-card"><div className="wallet-card-top"><div><span>当前账户余额</span><strong>¥{money(wallet.balance)}</strong><small>人民币 CNY</small></div><WalletCards /></div><div className="wallet-card-bottom"><div><span>含信用额度可用</span><strong>¥{money(wallet.available_balance)}</strong></div><div><span>信用额度</span><strong>¥{money(wallet.credit_limit)}</strong></div></div></article><article className="panel recharge-card"><div className="panel-heading"><div><span className="eyebrow">MANUAL TOP-UP</span><h2>人工充值</h2></div><CreditCard /></div><p>当前使用人工转账充值。完成转账后联系管理员，管理员确认后将金额加入您的 GL AI余额。</p><div className="recharge-notice"><ShieldCheck /><span><strong>每次余额变动都会生成流水</strong><small>累计入账 ¥{money(wallet.total_credit)}，累计扣减 ¥{money(wallet.total_debit)}。</small></span></div><button className="button button-secondary" type="button">查看充值说明</button></article></section>
    <section className="panel wallet-pricing-summary"><div><span className="eyebrow">GL PROVIDED AI</span><h2>GL 提供AI</h2><p>为简化 AI 配置，GainLab 提供多款常用模型的一键接入服务，无需单独申请或填写 API Key。用户可预充值 GL AI余额，系统将按实际用量自动计费并实时扣除。模型服务商可能调整价格，平台收费标准将同步更新，实际费用以调用时公示的价格为准。</p></div><button className="button button-secondary" type="button" onClick={() => setPricingOpened(true)}><Coins size={16} />查看收费详情</button></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">FUND LEDGER</span><h2>资金流水</h2></div><Link className="button button-secondary" to="/app/usage"><BrainCircuit size={15} />查看 AI 用量和扣费</Link></div>{wallet.ledger.length ? <div className="table-wrap"><table><thead><tr><th>时间</th><th>类型</th><th>说明</th><th>变动</th><th>余额</th></tr></thead><tbody>{wallet.ledger.map((item) => { const credit = Number(item.amount) >= 0; return <tr key={item.id}><td className="muted-cell">{isoTime(item.created_at)}</td><td><span className={credit ? 'ledger-credit' : 'ledger-debit'}>{ledgerName(item.entry_type)}</span></td><td>{item.remark || '-'}</td><td className={credit ? 'profit' : 'loss'}>{credit ? '+' : ''}¥{money(item.amount)}</td><td><strong>¥{money(item.balance_after)}</strong></td></tr> })}</tbody></table></div> : <EmptyState icon={<FileClock />} title="暂无资金流水" description="人工充值、后台余额调整、退款或补偿会显示在这里。AI 调用扣费请前往 AI 使用记录查看。" />}</section>
    <Modal opened={pricingOpened} onClose={() => setPricingOpened(false)} title="GL AI 收费详情" centered size="lg" classNames={{ content: 'strategy-unavailable-modal', header: 'strategy-delete-modal-header', title: 'strategy-delete-modal-title' }}><div className="ai-pricing-modal"><p>以下价格为平台实际计费标准，单位：元 / 百万 Token。</p>{aiModelsLoading ? <div className="permission-loading wallet-pricing-loading">正在读取模型价格...</div> : aiModelOptions.length ? <><div className="ai-model-category-tabs"><button className={pricingCategory === '全部' ? 'active' : ''} type="button" onClick={() => setPricingCategory('全部')}>全部</button>{aiModelCategories(aiModelOptions).map((category) => <button key={category} className={pricingCategory === category ? 'active' : ''} type="button" onClick={() => setPricingCategory(category)}>{category}</button>)}</div><div className="table-wrap"><table><thead><tr><th>模型</th><th>输入价格</th><th>输出价格</th></tr></thead><tbody>{aiModelOptions.filter((item) => pricingCategory === '全部' || aiModelCategory(item.provider_name) === pricingCategory).map((item) => <tr key={item.id}><td><strong>{item.provider_name}</strong></td><td>¥{money(item.input_price_per_million)}</td><td>¥{money(item.output_price_per_million)}</td></tr>)}</tbody></table></div></> : <EmptyState icon={<Coins />} title="暂无收费标准" description="管理员配置可用的 GL AI 模型后会显示在这里。" />}<small>每次调用按照实际输入和输出 Token 分别计算费用，最终从 GL AI余额中实时扣除。模型价格可能随服务商调整，请以调用时平台公示的价格为准。</small><button className="button button-primary" type="button" onClick={() => setPricingOpened(false)}>关闭</button></div></Modal>
  </>
}

export function UsagePage() {
  const [page, setPage] = useState(1)
  const [selectedUsage, setSelectedUsage] = useState<PortalUsage | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<UsageScreenshotPreview | null>(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [screenshotError, setScreenshotError] = useState('')
  const [filters, setFilters] = useState<UsageFilters>({ modelId: '', deploymentId: '', startAt: '', endAt: '' })
  const pageSize = 10
  const { data: usageData, loading: usageLoading, error: usageError } = useUserUsage(page, pageSize, filters)
  const changeFilter = (field: keyof UsageFilters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [field]: value })) }
  const resetFilters = () => { setPage(1); setFilters({ modelId: '', deploymentId: '', startAt: '', endAt: '' }) }
  const openUsageDetail = (item: PortalUsage) => { setSelectedUsage(item); setScreenshotPreview(null); setScreenshotError('') }
  const closeUsageDetail = () => { setSelectedUsage(null); setScreenshotPreview(null); setScreenshotError(''); setScreenshotLoading(false) }
  const loadUsageScreenshot = async () => {
    if (!selectedUsage?.screenshot_preview_id || screenshotLoading) return
    setScreenshotLoading(true)
    setScreenshotError('')
    try {
      const result = await apiRequest<UsageScreenshotPreview>('/api/v1/auth/usage/screenshot-preview', {
        method: 'POST',
        body: JSON.stringify({ usage_id: selectedUsage.id }),
      })
      setScreenshotPreview(result)
    } catch {
      setScreenshotError('请求截图已过期或不存在')
    } finally {
      setScreenshotLoading(false)
    }
  }
  const rows = usageData?.list || []
  const totalPages = usageData?.pages || 1
  const summary = usageData?.summary || { calls: 0, success_calls: 0, input_tokens: 0, output_tokens: 0, official_tokens: 0, custom_tokens: 0, charged_amount: '0' }
  const lifetime = usageData?.lifetime_summary || { calls: 0, success_calls: 0, input_tokens: 0, output_tokens: 0, official_tokens: 0, custom_tokens: 0, charged_amount: '0' }
  const retentionDays = usageData?.retention_days || 60
  const monthlyBills = usageData?.monthly_bills || []
  return <>
    <PageHeading eyebrow="AI USAGE" title="AI 使用记录" description="累计总账永久保留，调用明细用于核对近期 Token、费用及执行状态。" />
    <div className="usage-section-heading"><div><span className="eyebrow">LIFETIME SUMMARY</span><h2>累计总览</h2></div><small>累计数据不受下方筛选影响</small></div>
    <section className="stats-grid compact-stats usage-lifetime-stats"><StatCard label="累计调用" value={numberText(lifetime.calls)} note={`成功 ${numberText(lifetime.success_calls)} 次`} icon={<BrainCircuit />} /><StatCard label="累计 Token" value={tokenText(lifetime.input_tokens + lifetime.output_tokens)} note={`官方 ${tokenText(lifetime.official_tokens)} · 自定义 ${tokenText(lifetime.custom_tokens)}`} icon={<Database />} tone="blue" /><StatCard label="累计 AI 费用" value={`¥${money(lifetime.charged_amount)}`} note="永久总账" icon={<Coins />} tone="amber" /><StatCard label="当前余额" value={`¥${money(usageData?.current_balance)}`} note="GL AI余额" icon={<WalletCards />} /></section>
    <section className="panel usage-monthly-panel"><div className="panel-heading"><div><span className="eyebrow">MONTHLY BILL</span><h2>月度账单</h2></div><span className="usage-permanent-badge">永久保留</span></div>{monthlyBills.length ? <div className="table-wrap"><table><thead><tr><th>月份</th><th>调用次数</th><th>成功次数</th><th>输入 Token</th><th>输出 Token</th><th>官方 Token</th><th>自定义 Token</th><th>AI 费用</th></tr></thead><tbody>{monthlyBills.map((bill) => <tr key={bill.month}><td><strong>{bill.month}</strong></td><td>{numberText(bill.calls)}</td><td>{numberText(bill.success_calls)}</td><td>{tokenText(bill.input_tokens)}</td><td>{tokenText(bill.output_tokens)}</td><td>{tokenText(bill.official_tokens)}</td><td>{tokenText(bill.custom_tokens)}</td><td><strong className="usage-monthly-fee">¥{money(bill.charged_amount)}</strong></td></tr>)}</tbody></table></div> : <EmptyState icon={<ReceiptText />} title="暂无月度账单" description="产生 AI 调用后，系统会实时生成并永久保存月度汇总。" />}</section>
    <div className="usage-section-heading usage-detail-heading"><div><span className="eyebrow">RECENT DETAILS</span><h2>近期 AI 调用明细</h2></div><small>只能查询最近 {retentionDays} 天明细内容</small></div>
    <section className="usage-filter-panel">
      <Select className="usage-mantine-field" label="模型" placeholder="全部模型" value={filters.modelId || null} onChange={(value) => changeFilter('modelId', value || '')} data={(usageData?.filters.models || []).map((item) => ({ value: item.id, label: item.name }))} clearable allowDeselect searchable nothingFoundMessage="没有匹配的模型" />
      <Select className="usage-mantine-field" label="策略 Key" placeholder="全部 Key" value={filters.deploymentId || null} onChange={(value) => changeFilter('deploymentId', value || '')} data={(usageData?.filters.deployments || []).map((item) => ({ value: item.id, label: item.key }))} clearable allowDeselect searchable nothingFoundMessage="没有匹配的 Key" />
      <DateTimePicker className="usage-mantine-field" label="开始时间" placeholder={`最近 ${retentionDays} 天`} value={filters.startAt || null} onChange={(value) => changeFilter('startAt', value || '')} valueFormat="YYYY-MM-DD HH:mm" minDate={usageData?.detail_start_at || undefined} clearable timePickerProps={{ format: '24h', minutesStep: 15, withDropdown: true }} />
      <DateTimePicker className="usage-mantine-field" label="结束时间" placeholder="截至现在" value={filters.endAt || null} onChange={(value) => changeFilter('endAt', value || '')} valueFormat="YYYY-MM-DD HH:mm" minDate={filters.startAt || usageData?.detail_start_at || undefined} clearable timePickerProps={{ format: '24h', minutesStep: 15, withDropdown: true }} />
      <button className="button button-secondary" type="button" onClick={resetFilters}><RefreshCcw size={15} />重置</button>
    </section>
    <section className="stats-grid compact-stats"><StatCard label="筛选调用次数" value={numberText(summary.calls)} note={`成功 ${numberText(summary.success_calls)} 次`} icon={<BrainCircuit />} /><StatCard label="筛选输入 Token" value={tokenText(summary.input_tokens)} note="当前筛选范围" icon={<ArrowUpRight />} tone="blue" /><StatCard label="筛选输出 Token" value={tokenText(summary.output_tokens)} note="当前筛选范围" icon={<ArrowDownRight />} /><StatCard label="筛选费用" value={`¥${money(summary.charged_amount)}`} note="当前筛选范围" icon={<Coins />} tone="amber" /></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CALL HISTORY</span><h2>调用明细</h2></div><div className="usage-retention-notes"><span className="usage-retention-badge">调用明细保留 {retentionDays} 天</span><small>请求截图保留 6 小时</small></div></div>
      {usageLoading ? <div className="permission-loading">正在加载调用明细...</div> : usageError ? <div className="permission-notice"><ShieldCheck size={18} /><div><strong>调用明细加载失败</strong><span>{usageError}</span></div></div> : rows.length ? <><div className="table-wrap"><table><thead><tr><th>时间</th><th>模型</th><th>策略</th><th>策略 Key</th><th>场景</th><th>输入</th><th>输出</th><th>费用</th><th>状态</th><th>详情</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td className="muted-cell">{isoTime(item.created_at)}</td><td><strong>{item.model_name || item.provider_name || item.model_id || '-'}</strong></td><td>{item.strategy_name || item.strategy_code || '-'}</td><td><code className="usage-key" title={item.deployment_key || ''}>{item.deployment_key || '-'}</code></td><td>{sceneText(item.endpoint)}</td><td>{tokenText(item.input_tokens)}</td><td>{tokenText(item.output_tokens)}</td><td>{item.billing_source === 'custom' ? '自定义 AI' : `¥${feeMoney(item.charged_amount)}`}</td><td><span className={item.success ? 'result-success' : 'result-neutral'}>{item.success ? '成功' : '失败'}</span></td><td><button className="usage-detail-button" type="button" onClick={() => openUsageDetail(item)}>查看</button></td></tr>)}</tbody></table></div><div className="usage-pagination"><span>共 {numberText(usageData?.total || 0)} 条</span><div><button type="button" disabled={page <= 1 || usageLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><em>{page} / {totalPages}</em><button type="button" disabled={page >= totalPages || usageLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button></div></div></> : <EmptyState icon={<BrainCircuit />} title="暂无匹配记录" description="请调整模型、策略 Key 或时间范围。" />}
    </section>
    {selectedUsage && <div className="security-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUsageDetail() }}><section className="security-modal usage-detail-modal" role="dialog" aria-modal="true"><button className="security-modal-close" type="button" onClick={closeUsageDetail} aria-label="关闭"><X size={18} /></button><div className="security-modal-title"><BrainCircuit /><div><h2>AI 调用详情</h2><p>{isoTime(selectedUsage.created_at)} · {selectedUsage.model_name || selectedUsage.provider_name || selectedUsage.model_id || '-'}</p></div></div><div className="usage-detail-summary"><div><span>策略 Key</span><strong className="mono">{selectedUsage.deployment_key || '-'}</strong></div><div><span>场景</span><strong>{sceneText(selectedUsage.endpoint)}</strong></div><div><span>输入 / 输出</span><strong>{tokenText(selectedUsage.input_tokens)} / {tokenText(selectedUsage.output_tokens)}</strong></div><div><span>计费单价</span><strong>¥{feeMoney(selectedUsage.input_price_snapshot)} / ¥{feeMoney(selectedUsage.output_price_snapshot)}</strong></div><div><span>本次费用</span><strong>¥{feeMoney(selectedUsage.charged_amount)}</strong></div><div><span>扣费后余额</span><strong>{selectedUsage.balance_after == null ? '-' : `¥${feeMoney(selectedUsage.balance_after)}`}</strong></div><div><span>执行状态</span><strong className={selectedUsage.success ? 'profit' : 'loss'}>{selectedUsage.success ? '成功' : '失败'}</strong></div></div><div className="usage-detail-content"><section><h3>AI 返回内容</h3><pre>{selectedUsage.response_preview || '暂无返回内容'}</pre></section>{selectedUsage.error_message && <section className="usage-error-content"><h3>错误信息</h3><pre>{publicAiErrorText(selectedUsage.error_message)}</pre></section>}{selectedUsage.screenshot_preview_id && <section className="usage-screenshot-content"><div className="usage-screenshot-heading"><h3>EA 请求截图</h3>{!screenshotPreview && <button className="usage-detail-button" type="button" disabled={screenshotLoading} onClick={() => void loadUsageScreenshot()}>{screenshotLoading ? '正在读取...' : '查看请求截图'}</button>}</div>{screenshotError && <p>{screenshotError}</p>}{screenshotPreview && <><img src={screenshotPreview.data_url} alt="EA请求截图" /><small>{screenshotPreview.mime_type} · {numberText(screenshotPreview.size_bytes)} 字节 · 截图保留6小时</small></>}</section>}</div></section></div>}
  </>
}

export function EaDownloadsPage() {
  const [items, setItems] = useState<EaDownloadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    apiRequest<{ list: EaDownloadItem[] }>('/api/v1/auth/ea-downloads')
      .then((result) => setItems(result.list || []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'EA 下载列表加载失败'))
      .finally(() => setLoading(false))
  }, [])
  const fileSize = (value: number) => {
    if (!value) return ''
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }
  return <>
    <PageHeading eyebrow="EA DOWNLOADS" title="EA 下载" description="下载 GainLab 提供的 MT4/MT5 EA，并按照使用指南完成安装和策略 Key 配置。" />
    {loading ? <div className="permission-loading">正在加载 EA 下载列表...</div> : error ? <div className="permission-notice"><ShieldCheck size={18} /><div><strong>加载失败</strong><span>{error}</span></div></div> : items.length ? <div className="ea-download-list">{items.map((item) => <article className="panel ea-download-card" key={item.id}><div className="ea-download-icon"><Download /></div><div><h2>{item.name}</h2><p>{item.description || 'GainLab MT4/MT5 EA 安装文件。'}</p><small>{item.file_name || 'EA 安装包'}{fileSize(item.file_size) ? ` · ${fileSize(item.file_size)}` : ''}</small></div><a className="button button-primary" href={secureDownloadUrl(item.oss_url)} download={item.file_name || true}><Download size={17} />立即下载</a></article>)}</div> : <EmptyState icon={<Download />} title="暂无 EA 下载" description="管理员发布 EA 文件后会显示在这里。" />}
  </>
}

export function OrdersPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<OrderFilters>({ deploymentId: '', symbol: '', startAt: '', endAt: '' })
  const pageSize = 10
  const { data, loading, error } = useUserOrders(page, pageSize, filters)
  const changeFilter = (field: keyof OrderFilters, value: string) => {
    setPage(1)
    setFilters((current) => ({ ...current, [field]: value }))
  }
  const resetFilters = () => {
    setPage(1)
    setFilters({ deploymentId: '', symbol: '', startAt: '', endAt: '' })
  }
  if (loading && !data) return <div className="permission-loading">正在加载历史订单...</div>
  if (!data) return <div className="permission-notice"><ShieldCheck size={18} /><div><strong>订单加载失败</strong><span>{error}</span></div></div>
  const summary = data.summary
  const curveGranularity = ({ order: '逐笔订单', hour: '按小时', day: '按日' } as const)[data.curve_granularity] || '自动'
  return <>
    <PageHeading className="orders-page-heading" eyebrow="ORDER HISTORY" title="历史订单" description="数据由 MT4/MT5 同步，用于汇总策略订单与净盈亏；受网络或同步状态影响可能存在遗漏，仅供参考，实际数据请以交易平台为准。" />
    <section className="usage-filter-panel order-filter-panel">
      <Select className="usage-mantine-field" label="策略 Key" placeholder="全部 Key" value={filters.deploymentId || null} onChange={(value) => changeFilter('deploymentId', value || '')} data={data.filters.deployments.map((item) => ({ value: item.id, label: item.key }))} clearable allowDeselect searchable nothingFoundMessage="没有匹配的 Key" />
      <Select className="usage-mantine-field" label="交易商品" placeholder="全部商品" value={filters.symbol || null} onChange={(value) => changeFilter('symbol', value || '')} data={data.filters.symbols} clearable allowDeselect searchable nothingFoundMessage="没有匹配的商品" />
      <DateTimePicker className="usage-mantine-field" label="开始时间" placeholder="全部时间" value={filters.startAt || null} onChange={(value) => changeFilter('startAt', value || '')} valueFormat="YYYY-MM-DD HH:mm" maxDate={new Date()} clearable timePickerProps={{ format: '24h', minutesStep: 15, withDropdown: true }} />
      <DateTimePicker className="usage-mantine-field" label="结束时间" placeholder="截至现在" value={filters.endAt || null} onChange={(value) => changeFilter('endAt', value || '')} valueFormat="YYYY-MM-DD HH:mm" minDate={filters.startAt || undefined} maxDate={new Date()} clearable timePickerProps={{ format: '24h', minutesStep: 15, withDropdown: true }} />
      <button className="button button-secondary" type="button" onClick={resetFilters}><RefreshCcw size={15} />重置</button>
    </section>
    {error && <div className="permission-notice"><ShieldCheck size={18} /><div><strong>订单数据刷新失败</strong><span>{error}</span></div></div>}
    <section className="stats-grid compact-stats"><StatCard label="历史订单" value={numberText(summary.total)} note={`${numberText(summary.symbol_count)} 个交易商品`} icon={<ReceiptText />} /><StatCard label="盈利订单" value={numberText(summary.wins)} note={`胜率 ${summary.win_rate.toFixed(1)}%`} icon={<ArrowUpRight />} tone="blue" /><StatCard label="亏损订单" value={numberText(summary.losses)} note="当前筛选范围" icon={<ArrowDownRight />} /><StatCard label="累计净盈亏" value={signedMoney(summary.pnl)} note="当前筛选范围，含手续费和库存费" icon={<CircleDollarSign />} tone="amber" /></section>
    <section className="panel order-chart-panel"><div className="panel-heading"><div><span className="eyebrow">PNL CURVE</span><h2>累计净盈亏曲线</h2></div><span className="order-chart-note">{curveGranularity} · 以平仓时间统计</span></div><Suspense fallback={<div className="pnl-chart-empty">正在加载图表...</div>}><PnlChart data={data.curve} /></Suspense></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SYNCED FROM MT</span><h2>订单明细</h2></div><span className="order-loading-note">{loading ? '正在更新...' : `仅显示近 ${data.detail_retention_days || 365} 天明细`}</span></div>
      {data.list.length ? <><div className="table-wrap expanded"><table><thead><tr><th>订单</th><th>交易账号</th><th>商品</th><th>方向</th><th>手数</th><th>开仓价</th><th>平仓价</th><th>净盈亏</th><th>平仓时间</th></tr></thead><tbody>{data.list.map((order) => { const side = tradeSide(order.mt_type); return <tr key={`${order.deployment_id}-${order.account_login}-${order.order_id}`}><td className="mono">#{order.order_id}</td><td><strong className="order-account">{order.account_login || '-'}</strong></td><td><strong>{order.symbol}</strong></td><td><span className={side === 'BUY' ? 'trade-buy' : 'trade-sell'}>{side}</span></td><td>{order.volume.toFixed(2)}</td><td>{order.open_price || '-'}</td><td>{order.close_price || '-'}</td><td className={order.net_profit >= 0 ? 'profit' : 'loss'}>{signedMoney(order.net_profit)}</td><td className="muted-cell">{unixTime(order.close_time)}</td></tr> })}</tbody></table></div><div className="usage-pagination"><span>共 {numberText(data.total)} 条</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><em>{page} / {data.pages}</em><button type="button" disabled={page >= data.pages || loading} onClick={() => setPage((value) => Math.min(data.pages, value + 1))}>下一页</button></div></div></> : <EmptyState icon={<ReceiptText />} title="暂无匹配订单" description="请调整策略 Key、交易商品或时间范围。" />}
    </section>
  </>
}

export function AgentCenterPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AgentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pageSize = 20
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    apiRequest<AgentDashboardData>(`/api/v1/auth/agent?page=${page}&size=${pageSize}`)
      .then((result) => { if (active) setData(result) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '代理数据加载失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page])
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notifications.show({ color: 'teal', title: '复制成功', message: `${label}已复制到剪贴板` })
    } catch {
      notifications.show({ color: 'red', title: '复制失败', message: '请手动选择并复制' })
    }
  }
  if (loading && !data) return <div className="permission-loading">正在加载代理数据...</div>
  if (!data) return <div className="permission-notice"><ShieldCheck size={18} /><div><strong>代理中心暂不可用</strong><span>{error}</span></div></div>
  const inviteLink = `${window.location.origin}/register?invite=${data.invite_code}`
  return <>
    <PageHeading eyebrow="AGENT CENTER" title="代理中心" description="分享专属邀请链接，查看通过您邀请注册的用户。佣金和结算功能将在后续开放。" />
    <section className="agent-invite-panel panel">
      <div className="agent-level-badge"><UsersRound size={20} /><span><small>当前身份</small><strong>{data.agent_level} 级代理</strong></span></div>
      <div className="agent-code-block"><span>专属邀请码</span><div><code>{data.invite_code}</code><button className="button button-secondary" type="button" onClick={() => copy(data.invite_code, '邀请码')}><Copy size={15} />复制</button></div></div>
      <div className="agent-link-block"><span>专属邀请链接</span><div><code title={inviteLink}>{inviteLink}</code><button className="button button-primary" type="button" onClick={() => copy(inviteLink, '邀请链接')}><Copy size={15} />复制链接</button></div></div>
    </section>
    <section className="stats-grid compact-stats agent-stats"><StatCard label="累计邀请" value={numberText(data.summary.total_users)} note="通过邀请码注册" icon={<UsersRound />} /><StatCard label="正常账号" value={numberText(data.summary.active_users)} note="账号状态正常" icon={<UserRound />} tone="blue" /><StatCard label="有效 VIP" value={numberText(data.summary.active_vip_users)} note="VIP 当前有效" icon={<ShieldCheck />} tone="amber" /></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">REFERRED USERS</span><h2>邀请用户</h2></div><span className="agent-list-note">邮箱已脱敏，仅用于邀请统计</span></div>
      {loading ? <div className="permission-loading">正在更新列表...</div> : data.list.length ? <><div className="table-wrap"><table><thead><tr><th>用户</th><th>邮箱</th><th>账号状态</th><th>VIP</th><th>邀请时间</th></tr></thead><tbody>{data.list.map((item) => <tr key={item.id}><td><strong>{item.nickname || `用户 ${item.id}`}</strong></td><td className="mono">{item.email || '-'}</td><td><span className={item.status === 'active' ? 'result-success' : 'result-neutral'}>{item.status === 'active' ? '正常' : '未激活'}</span></td><td><span className={item.vip_active ? 'result-success' : 'result-neutral'}>{item.vip_active ? `VIP ${item.vip_level}` : '未开通/已到期'}</span></td><td className="muted-cell">{isoTime(item.referred_at || item.created_at)}</td></tr>)}</tbody></table></div><div className="usage-pagination"><span>共 {numberText(data.total)} 人</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><em>{page} / {data.pages || 1}</em><button type="button" disabled={page >= (data.pages || 1) || loading} onClick={() => setPage((value) => Math.min(data.pages || 1, value + 1))}>下一页</button></div></div></> : <EmptyState icon={<UsersRound />} title="暂无邀请用户" description="复制上方邀请链接分享给新用户，注册成功后会显示在这里。" />}
    </section>
  </>
}

export function ProfilePage() {
  const [user, setUser] = useState(getStoredUser())
  const [nickname, setNickname] = useState(user.nickname || '')
  const [message, setMessage] = useState('')
  useEffect(() => {
    const refreshUser = () => {
      const latest = getStoredUser()
      setUser(latest)
      setNickname(latest.nickname || '')
    }
    window.addEventListener('gainlab-auth-user-updated', refreshUser)
    return () => window.removeEventListener('gainlab-auth-user-updated', refreshUser)
  }, [])
  const displayName = authUserDisplayName(user)
  const registeredAt = user.created_at ? user.created_at.slice(0, 10) : '-'
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    const updated = await post<AuthUser>('/api/v1/auth/profile', { nickname })
    saveStoredUser(updated); setUser(updated); setNickname(updated.nickname || ''); setMessage('资料已保存')
  }
  return <><PageHeading eyebrow="PROFILE" title="用户资料" description="管理独立系统中的基础账户信息。" /><section className="settings-grid"><article className="panel profile-card"><div className="profile-avatar">GL</div><h2>{displayName}</h2><p>{user.email}</p><StatusPill tone="active">{user.email_verified === false ? '邮箱未验证' : '邮箱已验证'}</StatusPill><div className="profile-meta"><span>用户 ID</span><code>{user.id}</code></div><div className="profile-meta"><span>注册时间</span><strong>{registeredAt}</strong></div></article><article className="panel settings-form"><div className="panel-heading"><div><span className="eyebrow">BASIC INFO</span><h2>基本信息</h2></div></div><form onSubmit={saveProfile}><label><span>显示名称</span><div className="input-wrap"><UserRound size={17} /><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={100} placeholder="请输入昵称" /></div></label><label><span>邮箱地址</span><div className="input-wrap disabled"><Mail size={17} /><input value={user.email || ''} disabled readOnly /></div><small>修改邮箱需要重新完成验证。</small></label><label><span>时区</span><Select className="app-mantine-select" defaultValue="Asia/Shanghai" data={[{ value: 'Asia/Shanghai', label: 'Asia/Shanghai' }, { value: 'UTC', label: 'UTC' }]} allowDeselect={false} /></label>{message && <small className="verified">{message}</small>}<button className="button button-primary" type="submit">保存资料</button></form></article></section></>
}

export function SecurityPage() {
  type Dialog = 'password' | 'email' | 'sessions' | 'logout-all' | null
  type LoginSession = { id: string; created_at: string; expires_at: string; is_current: boolean }
  const navigate = useNavigate()
  const [user, setUser] = useState(getStoredUser())
  const [dialog, setDialog] = useState<Dialog>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [currentEmailCode, setCurrentEmailCode] = useState('')
  const [newEmailCode, setNewEmailCode] = useState('')
  const [currentEmailCodeSent, setCurrentEmailCodeSent] = useState(false)
  const [newEmailCodeSent, setNewEmailCodeSent] = useState(false)
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const errorMessage = (value: unknown) => value instanceof ApiError || value instanceof Error ? value.message : '操作失败，请稍后重试'
  const closeDialog = () => { setDialog(null); setError(''); setMessage('') }
  const showSuccess = (text: string) => {
    setDialog(null); setError(''); setMessage(''); setToast(text)
    window.setTimeout(() => setToast(''), 3000)
  }
  const loadSessions = async () => {
    try { setSessions(await apiRequest<LoginSession[]>('/api/v1/auth/sessions')) } catch { /* 顶部数量保持最近一次结果 */ }
  }
  useEffect(() => { loadSessions() }, [])
  const openDialog = (value: Dialog) => {
    setDialog(value); setError(''); setMessage('')
    if (value === 'sessions') loadSessions()
  }
  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    if (newPassword !== confirmPassword) return setError('两次输入的新密码不一致')
    setLoading(true)
    try {
      const updated = await post<AuthUser>('/api/v1/auth/password/change', { current_password: currentPassword, new_password: newPassword })
      saveStoredUser(updated); setUser(updated); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); await loadSessions(); showSuccess('密码修改成功，其他设备已退出登录')
    } catch (value) { setError(errorMessage(value)) } finally { setLoading(false) }
  }
  const sendCurrentEmailCode = async () => {
    setError(''); setMessage(''); setLoading(true)
    try {
      await post('/api/v1/auth/email/change/current/send', {})
      setCurrentEmailCodeSent(true); setMessage('验证码已发送到当前邮箱')
    } catch (value) { setError(errorMessage(value)) } finally { setLoading(false) }
  }
  const sendNewEmailCode = async () => {
    setError(''); setMessage(''); setLoading(true)
    try {
      await post('/api/v1/auth/email/change/send', { email: newEmail })
      setNewEmailCodeSent(true); setMessage('验证码已发送到新邮箱')
    } catch (value) { setError(errorMessage(value)) } finally { setLoading(false) }
  }
  const verifyEmail = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const updated = await post<AuthUser>('/api/v1/auth/email/change/verify', { email: newEmail, current_email_code: currentEmailCode, new_email_code: newEmailCode })
      saveStoredUser(updated); setUser(updated); setCurrentEmailCode(''); setNewEmailCode(''); setCurrentEmailCodeSent(false); setNewEmailCodeSent(false); showSuccess('登录邮箱修改成功')
    } catch (value) { setError(errorMessage(value)) } finally { setLoading(false) }
  }
  const revokeSession = async (session: LoginSession) => {
    setError('')
    try {
      await post('/api/v1/auth/sessions/revoke', { session_id: session.id })
      if (session.is_current) { clearSession(); navigate('/login', { replace: true }); return }
      await loadSessions()
    } catch (value) { setError(errorMessage(value)) }
  }
  const logoutAll = async () => {
    setLoading(true); setError('')
    try { await post('/api/v1/auth/logout-all', {}); clearSession(); navigate('/login', { replace: true }) }
    catch (value) { setError(errorMessage(value)); setLoading(false) }
  }
  return <>
    <PageHeading eyebrow="ACCOUNT SECURITY" title="账户安全" description="管理密码、登录会话和邮箱验证状态。" />
    {toast && <div className="security-toast"><Check size={16} />{toast}</div>}
    <div className="security-list">
      <article className="panel security-item"><div className="security-icon"><LockKeyhole /></div><div><h2>登录密码</h2><p>建议定期更新密码，并使用不与其他网站重复的密码。</p><span>{user.password_configured ? '密码已设置' : '尚未设置密码，可直接创建密码'}</span></div><button className="button button-secondary" type="button" onClick={() => openDialog('password')}>{user.password_configured ? '修改密码' : '设置密码'}</button></article>
      <article className="panel security-item"><div className="security-icon"><Mail /></div><div><h2>邮箱验证</h2><p>用于验证码登录、找回密码和重要安全通知。</p><span className="verified"><Check size={14} />{user.email} 已验证</span></div><button className="button button-secondary" type="button" onClick={() => openDialog('email')}>更换邮箱</button></article>
      <article className="panel security-item"><div className="security-icon"><Fingerprint /></div><div><h2>登录会话</h2><p>查看并退出其他浏览器或设备上的登录会话。</p><span>当前共有 {sessions.length} 个活跃会话</span></div><button className="button button-secondary" type="button" onClick={() => openDialog('sessions')}>管理会话</button></article>
      <article className="panel security-item danger-item"><div className="security-icon"><KeyRound /></div><div><h2>退出全部设备</h2><p>撤销所有登录会话，所有设备都需要重新登录。</p></div><button className="button button-danger" type="button" onClick={() => openDialog('logout-all')}>退出全部设备</button></article>
    </div>
    {dialog && <div className="security-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}><section className="security-modal" role="dialog" aria-modal="true">
      <button className="security-modal-close" type="button" onClick={closeDialog} aria-label="关闭"><X size={18} /></button>
      {dialog === 'password' && <><div className="security-modal-title"><LockKeyhole /><div><h2>{user.password_configured ? '修改登录密码' : '设置登录密码'}</h2><p>新密码至少 8 位，并同时包含字母和数字。</p></div></div><form onSubmit={savePassword} className="security-modal-form">{user.password_configured && <label><span>当前密码</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>}<label><span>新密码</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label><span>确认新密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{error && <div className="auth-message error">{error}</div>}{message && <div className="auth-message success">{message}</div>}<button className="button button-primary" type="submit" disabled={loading}>{loading ? '正在保存…' : '保存密码'}</button></form></>}
      {dialog === 'email' && <><div className="security-modal-title"><Mail /><div><h2>更换登录邮箱</h2><p>需要同时验证当前邮箱和新邮箱，验证成功后立即生效。</p></div></div><form onSubmit={verifyEmail} className="security-modal-form"><label><span>当前邮箱</span><input value={user.email || ''} disabled /></label><div className="security-code-row"><label><span>当前邮箱验证码</span><input value={currentEmailCode} onChange={(event) => setCurrentEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位验证码" required /></label><button className="button button-secondary" type="button" disabled={loading} onClick={sendCurrentEmailCode}>{currentEmailCodeSent ? '重新发送' : '发送验证码'}</button></div><label><span>新邮箱</span><input type="email" value={newEmail} onChange={(event) => { setNewEmail(event.target.value); setNewEmailCodeSent(false) }} required /></label><div className="security-code-row"><label><span>新邮箱验证码</span><input value={newEmailCode} onChange={(event) => setNewEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位验证码" required /></label><button className="button button-secondary" type="button" disabled={loading || !newEmail} onClick={sendNewEmailCode}>{newEmailCodeSent ? '重新发送' : '发送验证码'}</button></div>{error && <div className="auth-message error">{error}</div>}{message && <div className="auth-message success">{message}</div>}<button className="button button-primary" type="submit" disabled={loading || !currentEmailCodeSent || !newEmailCodeSent}>{loading ? '正在验证…' : '验证并更换邮箱'}</button></form></>}
      {dialog === 'sessions' && <><div className="security-modal-title"><Fingerprint /><div><h2>登录会话</h2><p>可以单独退出不再使用的登录会话。</p></div></div><div className="session-list">{sessions.length ? sessions.map((session) => <div className="session-row" key={session.id}><div><strong>{session.is_current ? '当前设备' : '其他登录设备'}</strong><span>登录时间：{new Date(session.created_at).toLocaleString('zh-CN')}</span><small>{session.is_current ? '当前正在使用' : `有效期至 ${new Date(session.expires_at).toLocaleDateString('zh-CN')}`}</small></div><button className="button button-secondary" type="button" onClick={() => revokeSession(session)}>{session.is_current ? '退出当前设备' : '退出'}</button></div>) : <div className="security-empty">暂无活跃会话</div>}</div>{error && <div className="auth-message error">{error}</div>}</>}
      {dialog === 'logout-all' && <><div className="security-modal-title danger"><KeyRound /><div><h2>退出全部设备？</h2><p>包括当前设备在内的所有登录会话都会立即失效。</p></div></div>{error && <div className="auth-message error">{error}</div>}<div className="security-modal-actions"><button className="button button-secondary" type="button" onClick={closeDialog}>取消</button><button className="button button-danger" type="button" onClick={logoutAll} disabled={loading}>{loading ? '正在退出…' : '确认退出全部设备'}</button></div></>}
    </section></div>}
  </>
}
