import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Bot, BrainCircuit, Check, ChevronRight,
  Clock3, Layers3, LineChart, LockKeyhole, MonitorSmartphone,
  RefreshCcw, ShieldCheck, Sparkles, WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { LegalDocumentContent, legalLead } from '../components/LegalDocumentContent'
import { SHOW_OFFICIAL_STRATEGIES } from '../config/features'
import { apiRequest, hasSession } from '../lib/api'

const steps = [
  { number: '01', title: '创建策略', text: '从官方策略库选择策略，配置分析方式、模型与风险参数。' },
  { number: '02', title: '复制部署 Key', text: '保存后由系统生成唯一部署 Key，用于连接您的交易终端。' },
  { number: '03', title: '连接 MT4/MT5', text: '在 EA 中填入 Key，系统自动获取策略要求并开始分析。' },
  { number: '04', title: '查看运行数据', text: '统一查看信号、历史订单、AI 用量与策略盈亏表现。' },
]

export function HomePage() {
  const loggedIn = hasSession()
  return (
    <>
      <section className="hero-section">
        <div className="hero-grid" />
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="public-container hero-inner">
          <div className="hero-copy">
            <div className="hero-badge"><Sparkles size={15} />面向 MT4 / MT5 的 AI 策略平台</div>
            <h1>让每一个交易策略<br />成为可部署的 <em>AI 系统</em></h1>
            <p>连接策略、AI 分析和交易终端。通过一套清晰、可控、可追踪的工作流，为每次开单与持仓管理提供决策支持。</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to={loggedIn ? '/app' : '/register'}>{loggedIn ? '进入用户中心' : '创建第一个策略'}<ArrowRight size={18} /></Link>
              <Link className="button button-outline button-large" to="/guide">查看接入方式</Link>
            </div>
            <div className="hero-trust"><span><Check />官方策略库</span><span><Check />自定义 AI</span><span><Check />全程可追踪</span></div>
          </div>
          <div className="terminal-card">
            <div className="terminal-head"><div><i /><i /><i /></div><span>AI STRATEGY RUNTIME</span><small>LIVE</small></div>
            <div className="terminal-strategy">
              <div className="terminal-icon"><BrainCircuit /></div>
              <div><small>当前策略</small><strong>GL 趋势自动分析策略</strong><span>PA_AGENT_V1 · XAUUSD · M15</span></div>
            </div>
            <div className="terminal-flow">
              <div><span>行情数据</span><strong>100 KLINES</strong></div><ChevronRight />
              <div><span>本地预筛选</span><strong>PA ENGINE</strong></div><ChevronRight />
              <div><span>AI 决策</span><strong>ANALYZING</strong></div>
            </div>
            <div className="terminal-signal">
              <div><span className="signal-dot" /><small>最新决策</small><strong>等待有效交易机会</strong></div>
              <span className="confidence">CONFIDENCE 82%</span>
            </div>
            <div className="terminal-stats"><div><small>今日分析</small><strong>126</strong></div><div><small>有效信号</small><strong>8</strong></div><div><small>运行状态</small><strong className="green-text">正常</strong></div></div>
          </div>
        </div>
      </section>

      <section className="metric-strip">
        <div className="public-container metric-grid">
          <div><strong>2</strong><span>交易终端</span><small>MT4 / MT5</small></div>
          <div><strong>24/7</strong><span>策略服务</span><small>持续响应终端请求</small></div>
          <div><strong>100%</strong><span>决策留痕</span><small>分析、用量和订单记录</small></div>
          <div><strong>BYOK</strong><span>自定义模型</span><small>支持兼容 OpenAI 的接口</small></div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading centered"><span>完整闭环</span><h2>从想法到 MT 执行，只需要四步</h2><p>策略配置、终端接入和运行统计集中在一个系统中，不再依赖复杂的手工流程。</p></div>
          <div className="steps-grid">{steps.map((step) => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        </div>
      </section>

      <section className="public-section muted-section">
        <div className="public-container">
          <div className="section-heading"><span>核心能力</span><h2>策略需要的不只是一次 AI 对话</h2><p>把策略约束、模型选择、资金管理和终端执行组合成稳定的运行系统。</p></div>
          <div className="feature-grid">
            <article className="feature-card feature-large"><div className="feature-icon"><Bot /></div><h3>可部署的策略配置</h3><p>官方策略、自定义分析逻辑、开单与风控模型都保存为独立部署，使用唯一 Key 连接终端。</p><div className="code-preview"><span>deployment_key</span><code>gl_••••••••_x7p2</code><small><LockKeyhole size={13} />仅用于您的交易终端</small></div></article>
            <article className="feature-card"><div className="feature-icon"><BrainCircuit /></div><h3>双阶段 AI 决策</h3><p>开单分析与持仓风控可以选择不同模型和配置。</p></article>
            <article className="feature-card"><div className="feature-icon"><ShieldCheck /></div><h3>风险与仓位约束</h3><p>支持固定手数、以损定仓、持仓上限和加仓开关。</p></article>
            <article className="feature-card"><div className="feature-icon"><WalletCards /></div><h3>清晰的 AI 计费</h3><p>按模型输入、输出 Token 价格计算人民币费用，余额和每笔用量都有流水。</p></article>
            <article className="feature-card"><div className="feature-icon"><BarChart3 /></div><h3>运行数据可追踪</h3><p>集中查看分析、信号、订单、Token 用量与累计盈亏。</p></article>
          </div>
        </div>
      </section>

      {SHOW_OFFICIAL_STRATEGIES && <section className="public-section">
        <div className="public-container strategy-highlight">
          <div className="strategy-visual"><div className="chart-lines"><i /><i /><i /><i /><i /></div><div className="chart-label label-buy">BUY</div><div className="chart-label label-hold">HOLD</div><LineChart /></div>
          <div className="strategy-copy"><span className="section-kicker">首个官方策略</span><h2>GL 趋势自动分析策略</h2><p>结合价格行为、本地指标预筛选和 AI 决策，识别突破、趋势延续与震荡行情，并为 MT 终端返回结构化开单及风控动作。</p><ul><li><Check />低成本规则先过滤无效行情</li><li><Check />AI 只在候选交易机会出现时参与</li><li><Check />支持固定手数与风险金额计算</li></ul><Link className="text-action" to="/official-strategies">查看策略详情<ArrowRight size={17} /></Link></div>
        </div>
      </section>}

      <section className="cta-section"><div className="public-container cta-inner"><div><span>READY TO START?</span><h2>部署您的第一个 AI 交易策略</h2><p>创建账户、选择策略并连接 MT4/MT5，所有配置都可以随时调整。</p></div><Link className="button button-light button-large" to="/register">免费创建账户<ArrowRight size={18} /></Link></div></section>
    </>
  )
}

export function OfficialStrategiesPage() {
  return (
    <div className="subpage">
      <section className="subpage-hero"><div className="public-container"><span>OFFICIAL STRATEGIES</span><h1>经过结构化设计的官方策略</h1><p>每个官方策略都定义了数据要求、分析流程、模型配置和风险边界，用户只需完成个性化运行设置。</p></div></section>
      <section className="public-section"><div className="public-container">
        <div className="official-card">
          <div className="official-main"><div className="official-title"><div className="strategy-logo"><BrainCircuit /></div><div><span className="official-badge">GAINLAB OFFICIAL</span><h2>GL 趋势自动分析策略</h2><p>PA Agent · 版本 1.0</p></div></div><p className="official-description">策略结合价格行为、波动结构与动量特征，先通过本地算法识别可能的突破、趋势和反转候选，再由 AI 对市场结构、信号质量与风险空间进行最终判断。</p><div className="strategy-tags"><span>价格行为</span><span>趋势跟踪</span><span>AI 风控</span><span>MT4 / MT5</span></div><Link className="button button-primary" to="/register">使用此策略<ArrowRight size={17} /></Link></div>
          <div className="official-side"><h3>运行要求</h3><div><Layers3 /><span>开单分析数据</span><strong>K 线 / 100</strong></div><div><RefreshCcw /><span>持仓风控数据</span><strong>K 线 / 100</strong></div><div><Clock3 /><span>调用方式</span><strong>每根 K 线</strong></div><div><MonitorSmartphone /><span>支持终端</span><strong>MT4 / MT5</strong></div></div>
        </div>
        <div className="logic-grid"><article><span>01</span><h3>本地特征分析</h3><p>计算趋势、波动率、K 线形态、空间与结构位置，过滤重叠震荡等低质量环境。</p></article><article><span>02</span><h3>AI 综合判断</h3><p>将候选机会、行情特征和策略规则发送给指定模型，获得结构化交易判断。</p></article><article><span>03</span><h3>风险约束</h3><p>服务端对 AI 结果再次执行止损距离、仓位算法和交易空间检查。</p></article><article><span>04</span><h3>终端执行</h3><p>向 MT 返回开仓、平仓、修改止损或继续持有等明确动作。</p></article></div>
      </div></section>
    </div>
  )
}

export function GuidePage() {
  const [guides, setGuides] = useState<GuideListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loggedIn = hasSession()
  useEffect(() => {
    apiRequest<{ list: GuideListItem[] }>('/api/v1/guides')
      .then(result => setGuides(result.list || []))
      .catch(reason => setError(reason instanceof Error ? reason.message : '教程列表加载失败'))
      .finally(() => setLoading(false))
  }, [])
  return (
    <div className="subpage">
      <section className="subpage-hero"><div className="public-container"><span>QUICK START</span><h1>接入指南</h1><p>查看 MT4 / MT5、EA 安装、策略配置与常见问题教程。</p></div></section>
      <section className="public-section"><div className="public-container guide-layout">
        <div className="guide-article-list">
          {loading ? <div className="guide-list-state">正在加载教程...</div> : error ? <div className="guide-list-state is-error">{error}</div> : guides.length ? guides.map((guide, index) => (
            <Link className="guide-list-item" to={`/guide/${guide.id}`} key={guide.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div className="guide-icon"><BookOpen /></div>
              <div><h3>{guide.title}</h3><p>{guide.summary || '查看教程详细内容'}</p></div>
              <ChevronRight />
            </Link>
          )) : <div className="guide-list-state">暂无已发布教程</div>}
        </div>
        <aside className="guide-aside"><h3>接口地址</h3><code>https://api.aitrader.gainlab.ai</code><p>MT4 和 MT5 使用相同服务地址，请将完整域名加入允许 WebRequest 的 URL 列表。</p><div className="notice"><ShieldCheck /><span><strong>保护您的策略 Key</strong><small>不要在聊天、截图或公开代码中分享部署 Key。</small></span></div><Link className="button button-primary" to={loggedIn ? '/app' : '/login'}>进入用户中心</Link></aside>
      </div></section>
    </div>
  )
}

type GuideBlock =
  | { type: 'heading' | 'paragraph'; text: string }
  | { type: 'image'; url: string; caption?: string }

type GuideListItem = {
  id: string
  title: string
  summary: string
  updated_at: string
}

type GuideArticle = GuideListItem & { content: GuideBlock[] }

export function GuideDetailPage() {
  const { id = '' } = useParams()
  const [guide, setGuide] = useState<GuideArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    setLoading(true)
    apiRequest<GuideArticle>(`/api/v1/guides/${encodeURIComponent(id)}`)
      .then(setGuide)
      .catch(reason => setError(reason instanceof Error ? reason.message : '教程加载失败'))
      .finally(() => setLoading(false))
  }, [id])
  if (loading) return <div className="subpage"><section className="public-section"><div className="public-container guide-detail-state">正在加载教程...</div></section></div>
  if (error || !guide) return <div className="subpage"><section className="public-section"><div className="public-container guide-detail-state"><p>{error || '教程不存在或尚未发布'}</p><Link className="text-action" to="/guide"><ArrowLeft size={16} />返回教程列表</Link></div></section></div>
  return <div className="subpage guide-detail-page">
    <section className="subpage-hero"><div className="public-container"><Link className="guide-back" to="/guide"><ArrowLeft />全部教程</Link><span>GUIDE</span><h1>{guide.title}</h1>{guide.summary && <p>{guide.summary}</p>}</div></section>
    <section className="public-section"><article className="public-container guide-article-content">
      {(guide.content || []).length ? guide.content.map((block, index) => {
        if (block.type === 'heading') return <h2 key={index}>{block.text}</h2>
        if (block.type === 'image') return <figure key={index}><img src={block.url} alt={block.caption || guide.title} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
        return <p key={index}>{block.text}</p>
      }) : <div className="guide-detail-state">该教程暂时没有正文内容</div>}
    </article></section>
  </div>
}

export function LegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const privacy = type === 'privacy'
  return (
    <div className="legal-page"><div className="public-container legal-container"><div className="legal-brand"><Brand /></div><span>最后更新：2026 年 8 月 20 日</span><h1>{privacy ? 'GainLab AI Trader 隐私政策' : 'GainLab AI Trader 服务条款'}</h1><p className="legal-lead">{legalLead[type]}</p>
      <LegalDocumentContent type={type} />
      <Link className="text-action" to="/">返回首页<ArrowRight size={16} /></Link>
    </div></div>
  )
}
