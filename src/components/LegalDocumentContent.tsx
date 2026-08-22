export type LegalDocumentType = 'terms' | 'privacy'

type LegalSection = {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

const termsSections: LegalSection[] = [
  {
    title: '1. 服务性质与范围',
    paragraphs: ['GainLab AI Trader 是一个 AI 与 EA 策略技术交流平台，专注于：'],
    bullets: [
      'AI 策略模型的开发与调试',
      'EA（智能交易系统）代码编写与技术探讨',
      'MT4/MT5 平台对接与运行测试',
      '策略回测数据的对比分析与技术交流',
    ],
  },
  {
    title: '2. 账户与安全',
    paragraphs: [
      '用户应妥善保管登录凭据、策略部署 Key 及自定义 AI 密钥。',
      '因用户主动泄露凭据、在不安全设备上使用服务，或未采取合理安全措施而导致的损失，由用户自行承担。',
      '平台不会通过任何渠道主动索要用户的账户密码或 API 密钥。',
    ],
  },
  {
    title: '3. 数据处理与隐私',
    paragraphs: ['为提供技术交流服务，系统会处理以下数据：'],
    bullets: [
      '账户基本信息（如邮箱）',
      '策略配置与代码文件',
      '行情快照（用于策略测试与调试）',
      'AI 调用记录与用量统计',
      '交易历史（仅用于回测分析和故障排查）',
    ],
  },
  {
    title: '4. 技术交流边界与风险提示',
    paragraphs: ['本平台定位为技术交流社区，不提供任何形式的投资建议或收益保证。用户需明确理解并接受：'],
    bullets: [
      '平台输出的策略、模型或分析内容，仅为技术研究与学习用途',
      '金融市场具有固有风险，任何策略都无法保证盈利',
      '网络延迟、行情跳空、平台执行差异、模型局限性等因素，均可能导致回测结果与实际运行结果存在差异',
      '用户应自行评估策略的适用性，并根据自身风险承受能力做出独立决策',
      '历史回测表现不代表未来实际收益',
    ],
  },
  {
    title: '5. 免责声明',
    bullets: [
      '平台不对用户基于技术交流内容所做的任何交易决策承担责任',
      '平台不保证策略输出在实盘环境中的表现',
      '用户在使用本服务期间产生的任何直接或间接损失，平台仅在适用法律允许的范围内承担责任',
    ],
  },
  {
    title: '6. 条款变更',
    paragraphs: ['平台有权根据业务发展需要适时调整本服务条款。更新后的条款将在平台公布，继续使用服务即视为接受更新内容。'],
  },
  {
    title: '7. 联系方式',
    paragraphs: ['如对本条款有任何疑问，欢迎通过平台客服渠道与我们联系。'],
  },
]

export const legalLead: Record<LegalDocumentType, string> = {
  terms: '欢迎使用 GainLab AI Trader。在使用本服务前，请仔细阅读并理解以下条款。',
  privacy: '欢迎使用 GainLab AI Trader。本政策旨在说明我们如何收集、使用、共享和保护您的数据。本平台定位为 AI 与 EA 策略技术交流平台，我们深知策略代码与配置数据对您的重要性，并将以透明、负责任的方式处理您的信息。',
}

export function LegalDocumentContent({ type }: { type: LegalDocumentType }) {
  if (type === 'privacy') return <PrivacyDocumentContent />
  return <div className="legal-document-sections">
    {termsSections.map(section => <article key={section.title}>
      <h2>{section.title}</h2>
      {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {section.bullets && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
      {type === 'terms' && section.title === '1. 服务性质与范围' && <p>本平台提供的是技术交流与工具服务，所有输出内容（包括 AI 分析、策略代码、参数建议等）均不构成投资建议、交易指令或收益承诺。用户基于本平台进行的任何策略部署与实盘操作，均为独立决策行为。</p>}
      {type === 'terms' && section.title === '3. 数据处理与隐私' && <p>上述数据仅用于服务交付、用量统计、功能优化和故障排查，不会用于向用户推送投资建议或销售金融产品。</p>}
    </article>)}
  </div>
}

function LegalTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="legal-table-wrap"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.join('|')}>{row.map((cell, index) => <td key={`${index}-${cell}`}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function PrivacyDocumentContent() {
  return <div className="legal-document-sections">
    <article><h2>1. 我们收集的信息</h2><p>为提供技术交流与策略调试服务，我们可能处理以下数据：</p>
      <LegalTable headers={['数据类型', '具体内容', '用途说明']} rows={[
        ['账户信息', '注册邮箱、账户昵称等', '身份识别与账号管理'],
        ['策略数据', '策略配置、EA 代码、参数设置', '提供策略编辑、调试与交流服务'],
        ['运行数据', 'AI 调用记录、回测结果、运行日志', '用量统计、性能分析与故障排查'],
        ['连接信息', 'MT4/MT5 账户连接配置', '实现平台与交易端的对接'],
        ['行情快照', '策略运行时获取的市场数据', '用于策略回测、参数优化与技术交流'],
      ]} />
    </article>
    <article><h2>2. 信息的使用方式</h2><p>我们仅在“提供技术交流服务”这一核心目的下使用您的数据，具体包括：</p>
      <ul><li><strong>身份验证与账户安全：</strong>验证登录身份，保护账户安全</li><li><strong>策略技术服务：</strong>提供策略代码编辑、AI 分析接口、回测运行等功能</li><li><strong>用量统计与计费：</strong>计算 AI 调用量和服务费用</li><li><strong>运行统计展示：</strong>展示策略回测效果和运行状态（仅限您本人可见或您主动公开的部分）</li><li><strong>故障排查：</strong>定位和修复平台运行异常</li><li><strong>合规要求：</strong>满足法律法规要求的数据留存义务</li></ul>
      <p>我们不会将您的数据用于：</p><ul className="legal-negative-list"><li>向您推销金融产品或投资服务</li><li>分析您的交易行为并据此提供投资建议</li><li>出售或出租您的任何数据给第三方</li></ul>
    </article>
    <article><h2>3. 第三方 AI 服务</h2><p>当您使用平台接入的 AI 服务（无论是官方提供的还是您自定义的 AI 服务商）时，以下信息可能被发送至所选 AI 服务商：</p>
      <ul><li>您主动提交的策略代码片段或配置内容</li><li>策略运行所需的必要行情数据</li><li>AI 调用时的请求上下文</li></ul>
      <p>我们特别承诺：</p><ul><li>不会向任何 AI 服务商发送您的登录密码、账户凭据或 API 密钥</li><li>不会向 AI 服务商发送您的个人身份信息（如姓名、联系方式等）</li><li>使用第三方 AI 服务时，该服务商的数据处理行为同时受其自身隐私政策的约束</li></ul>
      <div className="legal-callout"><strong>提示</strong><span>如果您使用自定义 AI 密钥，请确保您选择的 AI 服务商具备可靠的数据保护措施。请勿在策略代码或配置中写入敏感凭据。</span></div>
    </article>
    <article><h2>4. 数据安全与保留</h2><h3>安全措施</h3><ul><li>我们采取行业通行的加密传输（如 TLS）和访问控制措施保护数据</li><li>敏感操作（如策略部署、密钥管理）需要身份验证</li><li>访问日志用于安全审计，防止未授权访问</li></ul>
      <h3>数据保留期限</h3><LegalTable headers={['数据类型', '保留期限']} rows={[
        ['AI 调用明细', '按平台公示周期保留（当前为 60 天）'],
        ['汇总账单与费用记录', '依据财务合规要求长期保存'],
        ['法律法规要求留存的数据', '按法定期限保存'],
        ['账户注销后的策略数据', '按平台注销规则处理'],
      ]} />
    </article>
    <article><h2>5. 您的权利</h2><p>作为用户，您拥有以下权利：</p><LegalTable headers={['权利', '说明', '操作方式']} rows={[
      ['修改账户资料', '更新邮箱、昵称、安全设置', '平台账户设置页自助操作'],
      ['修改安全凭据', '更新密码、部署 Key、AI 密钥', '平台安全设置页自助操作'],
      ['查询个人信息', '了解我们持有您的哪些数据', '联系平台管理员'],
      ['更正不准确信息', '修正错误的个人或账户数据', '联系平台管理员'],
      ['删除个人数据', '在适用法律允许范围内请求删除', '联系平台管理员'],
      ['撤回 AI 授权', '停止向第三方 AI 服务商发送数据', '关闭相关策略或移除自定义密钥'],
    ]} /><p>联系我们处理上述请求时，我们会在核实身份后于合理期限内（通常为 15 个工作日）完成处理。</p></article>
    <article><h2>6. 未成年人保护</h2><p>本平台面向专业技术人员和交易策略开发者，不面向未成年人提供服务。如发现未成年人的数据被收集，请联系我们删除。</p></article>
    <article><h2>7. 政策更新</h2><p>我们可能根据业务发展或法律法规要求更新本隐私政策。重大变更将以显著方式通知您（如站内公告、邮件通知），继续使用服务即视为接受更新后的政策。</p></article>
    <article><h2>8. 联系我们</h2><p>如对本隐私政策有任何疑问、意见或请求，请通过平台客服渠道联系管理员。</p></article>
  </div>
}
