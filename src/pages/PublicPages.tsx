import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Bot, BrainCircuit, Check, ChevronRight,
  Clock3, Crown, Layers3, LineChart, LockKeyhole, MonitorSmartphone,
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

export function PricingPage() {
  const loggedIn = hasSession()
  return (
    <div className="subpage pricing-page">
      <section className="subpage-hero pricing-hero">
        <div className="public-container">
          <span>PRICING &amp; SERVICES</span>
          <h1>简单、清晰的服务价格</h1>
          <p>会员服务与 GL AI 使用费用分开计算。按实际需要开通，不捆绑不必要的用量。</p>
        </div>
      </section>

      <section className="public-section pricing-section">
        <div className="public-container">
          <div className="pricing-grid">
            <article className="pricing-card pricing-card-primary">
              <div className="pricing-card-head">
                <div className="pricing-icon"><Crown /></div>
                <div><span>MEMBERSHIP</span><h2>VIP1 会员</h2></div>
                <em>推荐</em>
              </div>
              <div className="pricing-price"><small>¥</small><strong>3,980</strong><span>/ 年</span></div>
              <p>适合需要连接 MT4 / MT5，并长期运行 AI 策略的用户。</p>
              <ul>
                <li><Check />创建并管理策略 Key</li>
                <li><Check />使用 GL 策略库与策略配置功能</li>
                <li><Check />连接 MT4 / MT5 运行策略</li>
                <li><Check />查看 AI 调用、历史订单及运行统计</li>
                <li><Check />账户、策略与风险参数管理</li>
              </ul>
              <Link className="button button-primary button-large" to={loggedIn ? '/app' : '/register'}>
                {loggedIn ? '进入用户中心' : '注册并了解开通方式'}<ArrowRight size={17} />
              </Link>
            </article>

            <article className="pricing-card">
              <div className="pricing-card-head">
                <div className="pricing-icon"><WalletCards /></div>
                <div><span>GL AI BALANCE</span><h2>GL AI 余额</h2></div>
              </div>
              <div className="pricing-price"><small>¥</small><strong>50</strong><span>起充</span></div>
              <p>使用平台提供的 GL AI 模型时，从预充值余额中按实际 Token 用量扣费。</p>
              <ul>
                <li><Check />不同模型按各自输入、输出价格计费</li>
                <li><Check />调用明细、Token 用量和费用清晰可查</li>
                <li><Check />余额不足时提供醒目提醒</li>
                <li><Check />使用自定义 AI Key 时不扣除 GL AI 余额</li>
                <li><Check />模型收费标准可在用户中心查看</li>
              </ul>
              <Link className="button button-outline button-large" to={loggedIn ? '/app/wallet' : '/login'}>
                {loggedIn ? '查看 GL AI 余额' : '登录后查看'}<ArrowRight size={17} />
              </Link>
            </article>
          </div>

          <div className="pricing-note">
            <ShieldCheck />
            <div>
              <h3>费用说明</h3>
              <p>VIP1 是平台会员服务费，GL AI 余额用于支付平台模型调用费用，两项费用相互独立。目前采用转账后人工开通会员及充值余额，暂不提供在线支付。</p>
            </div>
          </div>

          <div className="pricing-faq-grid">
            <article><h3>会员是否包含 AI 用量？</h3><p>不包含。模型价格差异较大，AI 调用按实际 Token 用量单独计费，避免固定套餐造成浪费。</p></article>
            <article><h3>使用自己的 AI Key 还会扣费吗？</h3><p>不会扣除 GL AI 余额。第三方 AI 服务商产生的费用由用户与对应服务商自行结算。</p></article>
            <article><h3>到期后会发生什么？</h3><p>VIP 到期后不能继续创建和运行策略，但仍可登录用户中心查看已有信息和历史记录。</p></article>
          </div>
        </div>
      </section>
    </div>
  )
}

export function CustomStrategyIntroPage() {
  const loggedIn = hasSession()
  return (
    <div className="subpage custom-intro-page">
      <section className="custom-intro-hero">
        <div className="public-container custom-intro-hero-grid">
          <div className="custom-intro-copy">
            <div className="hero-badge"><Sparkles size={15} />自然语言创建策略</div>
            <h1>不会编程，也能把交易想法<br />变成可运行的 <em>AI 策略</em></h1>
            <p>用日常语言写下开仓、平仓和持仓风控规则。GainLab 帮您解析逻辑、准备指标与提示词，并生成可以连接 MT4 / MT5 的策略 Key。</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to={loggedIn ? '/app/strategies/new/custom' : '/register'}>
                {loggedIn ? '自定义AI策略' : '注册并开始创建'}<ArrowRight size={18} />
              </Link>
              <a className="button button-outline button-large" href="#custom-workflow">查看创建流程</a>
            </div>
            <div className="hero-trust"><span><Check />无需编写 EA 代码</span><span><Check />支持 MT4 / MT5</span><span><Check />创建前确认解析结果</span></div>
          </div>

          <div className="custom-intro-demo">
            <div className="custom-intro-demo-head"><span>策略描述</span><small>NATURAL LANGUAGE</small></div>
            <div className="custom-rule-block">
              <strong>开仓规则</strong>
              <p>最近 3 根已收盘 K 线中，如果 EMA5 上穿 EMA30 做多，下破 EMA30 做空。</p>
            </div>
            <div className="custom-rule-block">
              <strong>持仓风控</strong>
              <p>盈利达到 0.5 ATR 后移动到保本；价格继续运行时，按 ATR 距离移动止损。</p>
            </div>
            <div className="custom-parse-flow">
              <span>自然语言</span><ChevronRight /><span>规则解析</span><ChevronRight /><span>AI 决策</span><ChevronRight /><span>MT 执行</span>
            </div>
            <div className="custom-parse-result"><span className="signal-dot" /><div><small>系统已识别</small><strong>EMA · ATR · 交叉条件 · 移动止损</strong></div></div>
          </div>
        </div>
      </section>

      <section className="public-section muted-section">
        <div className="public-container">
          <div className="section-heading centered"><span>NO-CODE STRATEGY</span><h2>您负责交易想法，系统负责技术实现</h2><p>无需学习编程语法，也不用自己处理接口、指标计算和 AI 请求格式。</p></div>
          <div className="custom-benefit-grid">
            <article><div className="feature-icon"><BookOpen /></div><h3>自然语言描述规则</h3><p>像写交易笔记一样，分别描述什么时候开仓，以及持仓后什么时候平仓、加仓或调整止损。</p></article>
            <article><div className="feature-icon"><BrainCircuit /></div><h3>AI 解析并等待确认</h3><p>保存前分析交易条件、所需指标和数据要求，将系统理解的完整结果展示给您确认。</p></article>
            <article><div className="feature-icon"><Layers3 /></div><h3>自动准备指标数据</h3><p>根据策略需要计算 EMA、ATR、RSI、MACD 等常用指标，并将行情数据组合成分析上下文。</p></article>
            <article><div className="feature-icon"><MonitorSmartphone /></div><h3>一个 Key 连接 EA</h3><p>策略创建完成后自动生成 Key，填入 GainLab EA，即可连接 MT4 / MT5 持续运行。</p></article>
          </div>
        </div>
      </section>

      <section className="public-section" id="custom-workflow">
        <div className="public-container">
          <div className="section-heading"><span>HOW IT WORKS</span><h2>从一句策略想法，到 EA 自动执行</h2><p>创建时完成规则解析，运行时由服务端准备数据并调用您选择的 AI 模型。</p></div>
          <div className="custom-workflow-grid">
            <article><span>01</span><h3>写下交易规则</h3><p>填写开仓逻辑、持仓风控，以及需要 EA 提供 K 线、截图或两者同时提供。</p></article>
            <article><span>02</span><h3>确认解析结果</h3><p>查看系统生成的开仓与风控模板、指标列表和未精确识别的条件，确认后再保存。</p></article>
            <article><span>03</span><h3>选择 AI 并生成 Key</h3><p>选择 GL 提供 AI 或配置自己的 AI Key，设置仓位算法和绑定的交易账号。</p></article>
            <article><span>04</span><h3>连接 EA 开始运行</h3><p>EA 按策略要求提交行情，服务端计算指标、请求 AI，并返回结构化操作指令。</p></article>
          </div>
        </div>
      </section>

      <section className="public-section custom-capability-section">
        <div className="public-container custom-capability-grid">
          <div>
            <span className="section-kicker">FLEXIBLE INPUT</span>
            <h2>不只支持简单的指标交叉</h2>
            <p>策略可以综合常用技术指标、K 线数据和图表截图。无论是趋势、形态还是图形信号，都可以按您的表达交给 AI 分析。</p>
            <ul><li><Check />常用技术指标及自定义参数</li><li><Check />K 线形态、价格结构与连续条件</li><li><Check />图表截图和自定义视觉指标</li><li><Check />开仓、平仓、加仓、部分平仓与止损修改</li></ul>
          </div>
          <aside>
            <ShieldCheck />
            <h3>策略逻辑由您定义</h3>
            <p>GainLab 的职责是准确传递数据、解析规则并执行策略，不会擅自添加您没有描述的交易条件。</p>
            <p>自然语言越清晰，AI 理解越稳定。正式运行前，建议先使用模拟账户观察和验证。</p>
          </aside>
        </div>
      </section>

      <section className="cta-section"><div className="public-container cta-inner"><div><span>TURN IDEAS INTO STRATEGIES</span><h2>把您的下一条交易规则写下来</h2><p>不必从学习编程开始，先从说清楚自己的交易逻辑开始。</p></div><Link className="button button-light button-large" to={loggedIn ? '/app/strategies/new/custom' : '/register'}>{loggedIn ? '自定义AI策略' : '免费注册'}<ArrowRight size={18} /></Link></div></section>
    </div>
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
      <section className="subpage-hero"><div className="public-container"><span>QUICK START</span><h1>使用指南</h1><p>查看 MT4 / MT5、EA 安装、策略配置与常见问题教程。</p></div></section>
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
