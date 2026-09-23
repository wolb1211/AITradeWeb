import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { PageHeading } from '../components/Ui'
import { apiRequest } from '../lib/api'

/** The public base url never changes, so it is written down rather than guessed. */
const API_BASE = 'https://api.aitrader.gainlab.ai/v1'
const RATE_LIMIT_PER_MINUTE = 60

type ApiKey = {
  id: string
  name: string
  key_prefix: string
  status: string
  rpm_limit: number
  request_count: number
  created_at: string
  last_used_at: string
  revoked_at: string
}

type ModelOption = {
  model: string
  provider_name: string
  display_name: string
  input_price_per_million: string
  output_price_per_million: string
  supports_vision: boolean
}

export function ApiAccessPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [provider, setProvider] = useState('全部')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    // allSettled: the key list and the price list are independent, so one failing
    // must not blank the other.
    Promise.allSettled([
      apiRequest<{ list: ApiKey[] }>('/api/v1/auth/api-keys'),
      apiRequest<{ list: ModelOption[] }>('/api/v1/auth/ai-model-options'),
    ])
      .then(([keyResult, modelResult]) => {
        const problems: string[] = []
        if (keyResult.status === 'fulfilled') {
          setKeys(keyResult.value.list || [])
        } else {
          const reason = keyResult.reason
          problems.push(`读取 API Key 失败：${reason instanceof Error ? reason.message : '未知错误'}`)
        }
        if (modelResult.status === 'fulfilled') {
          setModels(modelResult.value.list || [])
        } else {
          const reason = modelResult.reason
          problems.push(`读取模型价格失败：${reason instanceof Error ? reason.message : '未知错误'}`)
        }
        setError(problems.join('；'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const activeKeys = useMemo(() => keys.filter((item) => item.status === 'active'), [keys])

  // provider_name 是「厂商 / 模型」，标签只按厂商分组。
  const providerOf = (value: string) => String(value || '').split('/')[0].trim()
  const providers = useMemo(
    () => ['全部', ...Array.from(new Set(models.map((item) => providerOf(item.provider_name)).filter(Boolean)))],
    [models]
  )
  const visibleModels = useMemo(
    () => (provider === '全部' ? models : models.filter((item) => providerOf(item.provider_name) === provider)),
    [models, provider]
  )

  const copy = async (value: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(tag)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('复制失败，请手动选择文本')
    }
  }

  const createKey = async () => {
    setBusy(true)
    try {
      const result = await apiRequest<{ key: string }>('/api/v1/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName.trim() || '我的应用' }),
      })
      setCreated(result.key)
      setDialogOpen(false)
      setKeyName('')
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }

  const revokeKey = async (id: string) => {
    setBusy(true)
    try {
      await apiRequest('/api/v1/auth/api-keys/revoke', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '撤销失败')
    } finally {
      setBusy(false)
    }
  }

  const formatPrice = (value: string) => Number(value || 0).toFixed(2)

  const curlSample = `curl ${API_BASE}/chat/completions \\
  -H "Authorization: Bearer ${activeKeys[0]?.key_prefix ? '你的API Key' : '你的API Key'}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"qwen-plus","messages":[{"role":"user","content":"你好"}]}'`

  const pythonSample = `from openai import OpenAI

client = OpenAI(base_url="${API_BASE}", api_key="你的API Key")
answer = client.chat.completions.create(
    model="qwen-plus",
    messages=[{"role": "user", "content": "你好"}],
)
print(answer.choices[0].message.content)`

  return <>
    {dialogOpen && <div className="security-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false) }}>
      <section className="security-modal api-key-dialog" role="dialog" aria-modal="true">
        <h2>生成新的 API Key</h2>
        <p>给这个 Key 起个名字，方便以后区分用途（例如「我的网站」「测试脚本」）。</p>
        <label className="api-key-dialog-field">
          <span>名称</span>
          <input
            value={keyName}
            maxLength={32}
            placeholder="我的应用"
            autoFocus
            onChange={(event) => setKeyName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !busy) createKey() }}
          />
        </label>
        <div className="api-key-dialog-actions">
          <button className="button button-secondary" type="button" onClick={() => setDialogOpen(false)}>取消</button>
          <button className="button" type="button" disabled={busy} onClick={createKey}>{busy ? '生成中…' : '生成'}</button>
        </div>
      </section>
    </div>}
    <PageHeading
      eyebrow="AI API"
      title="AI 开放接口"
      description="生成 API Key 后，可用任意 OpenAI 兼容客户端直接调用平台已上架的模型，费用从 GL AI 余额中实时扣除。"
    />

    {error && <div className="permission-notice"><KeyRound size={18} /><div><strong>操作失败</strong><span>{error}</span></div></div>}

    <section className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">ENDPOINT</span><h2>接入信息</h2></div>
      </div>
      <div className="api-access-grid">
        <div className="api-access-field">
          <span>接口地址（OpenAI 兼容）</span>
          <code>{API_BASE}</code>
          <button className="button button-secondary" type="button" onClick={() => copy(API_BASE, 'base')}>
            {copied === 'base' ? <Check size={14} /> : <Copy size={14} />} 复制
          </button>
        </div>
        <div className="api-access-field">
          <span>请求头</span>
          <code>Authorization: Bearer 你的API Key</code>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => copy('Authorization: Bearer ', 'header')}
          >
            {copied === 'header' ? <Check size={14} /> : <Copy size={14} />} 复制
          </button>
        </div>
        <div className="api-access-field">
          <span>限速</span>
          <code>{RATE_LIMIT_PER_MINUTE} 次 / 分钟 / 每个 Key</code>
          <span className="api-access-hint">余额为 0 时请求会被拒绝，不会产生欠费。</span>
        </div>
      </div>
    </section>

    <section className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">API KEYS</span><h2>我的 API Key</h2></div>
        <button className="button" type="button" disabled={busy} onClick={() => setDialogOpen(true)}>
          <Plus size={15} /> 生成新 Key
        </button>
      </div>

      {created && <div className="api-key-created">
        <strong>请立即复制并妥善保存，本 Key 只显示这一次。</strong>
        <code>{created}</code>
        <button className="button button-secondary" type="button" onClick={() => copy(created, 'new')}>
          {copied === 'new' ? <Check size={14} /> : <Copy size={14} />} 复制
        </button>
        <button className="button button-secondary" type="button" onClick={() => setCreated('')}>我已保存</button>
      </div>}

      {loading ? <div className="permission-loading">正在加载 API Key…</div> : keys.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>名称</th><th>Key</th><th>状态</th><th>限速</th><th>调用次数</th><th>最后使用</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
              {keys.map((item) => <tr key={item.id}>
                <td>{item.name || '-'}</td>
                <td><code className="usage-key">{item.key_prefix}</code></td>
                <td>
                  <span className={`api-key-status ${item.status === 'active' ? 'is-active' : ''}`}>
                    {item.status === 'active' ? '启用中' : '已撤销'}
                  </span>
                </td>
                <td>{item.rpm_limit} 次/分</td>
                <td>{item.request_count}</td>
                <td>{item.last_used_at ? new Date(item.last_used_at).toLocaleString() : '-'}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>
                  {item.status === 'active'
                    ? <button className="usage-detail-button" type="button" disabled={busy} onClick={() => revokeKey(item.id)}>
                        <Trash2 size={13} /> 撤销
                      </button>
                    : <span className="muted-cell">-</span>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      ) : <div className="permission-notice"><KeyRound size={18} /><div><strong>还没有 API Key</strong><span>点击右上角「生成新 Key」开始使用。</span></div></div>}
    </section>

    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">EXAMPLES</span><h2>调用示例</h2></div></div>
      <div className="api-sample">
        <div className="api-sample-head"><span>cURL</span>
          <button className="usage-detail-button" type="button" onClick={() => copy(curlSample, 'curl')}>
            {copied === 'curl' ? <Check size={13} /> : <Copy size={13} />} 复制
          </button>
        </div>
        <pre>{curlSample}</pre>
      </div>
      <div className="api-sample">
        <div className="api-sample-head"><span>Python（OpenAI SDK）</span>
          <button className="usage-detail-button" type="button" onClick={() => copy(pythonSample, 'py')}>
            {copied === 'py' ? <Check size={13} /> : <Copy size={13} />} 复制
          </button>
        </div>
        <pre>{pythonSample}</pre>
      </div>
      <div className="api-access-hint">
        说明：接口与 OpenAI 兼容，可直接使用官方 SDK；不支持流式（stream）返回；调用记录可在「使用记录」中按场景筛选查看。
      </div>
      <div className="api-access-hint">
        <strong>多轮对话：</strong>接口是无状态的，每次请求把<strong>完整历史</strong>放进 <code>messages</code> 即可（和 OpenAI 的用法一致），
        例如第二轮把「用户提问 + 上一轮回答 + 新提问」一起发过来。这样上下文由你完全掌控，费用也只按你实际发送的内容计算。
      </div>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">MODELS</span><h2>可用模型与价格</h2></div></div>
      <div className="api-provider-tabs">
        {providers.map((item) => <button
          key={item}
          type="button"
          className={`api-provider-tab ${provider === item ? 'is-active' : ''}`}
          onClick={() => setProvider(item)}
        >{item}</button>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>模型</th><th>服务商</th><th>图片输入</th><th>输入价格（元/百万 Token）</th><th>输出价格（元/百万 Token）</th></tr></thead>
          <tbody>
            {visibleModels.map((item) => <tr key={item.model}>
              <td><code className="usage-key">{item.model}</code></td>
              <td>{providerOf(item.provider_name) || '-'}</td>
              <td>{item.supports_vision ? '支持' : '不支持'}</td>
              <td>¥{formatPrice(item.input_price_per_million)}</td>
              <td>¥{formatPrice(item.output_price_per_million)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="api-access-hint">价格按平台计费标准实时同步；每次调用按实际输入 / 输出 Token 计算，从 GL AI 余额扣除。</div>
    </section>

  </>
}
