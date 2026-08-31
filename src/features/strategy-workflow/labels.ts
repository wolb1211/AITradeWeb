import type { WorkflowCondition, WorkflowNode, WorkflowOperand, WorkflowPriceTarget } from './types'

const indicatorNames: Record<string, string> = {
  ema: 'EMA', sma: 'MA', wma: 'WMA', rsi: 'RSI', atr: 'ATR', macd: 'MACD', bbands: '布林带', stoch: 'KDJ',
}
const componentNames: Record<string, string> = {
  macd: 'MACD线', signal: '信号线', histogram: '柱状值', upper: '上轨', middle: '中轨', lower: '下轨',
  k: 'K值', d: 'D值', j: 'J值',
}
const operandNames: Record<string, string> = {
  bid: 'Bid', ask: 'Ask', open: '开盘价', high: '最高价', low: '最低价', close: '收盘价',
  side: '持仓方向', profit: '当前盈亏', open_price: '开仓价', current_price: '当前价', sl: '止损价', tp: '止盈价',
  volume: '持仓手数', favorable_move: '有利移动距离', recent_low: '近期最低价', recent_high: '近期最高价',
}
const operatorNames: Record<string, string> = { gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于', eq: '等于', neq: '不等于' }
const patternNames: Record<string, string> = {
  bullish_engulfing: '看涨吞没', bearish_engulfing: '看跌吞没', bullish_pinbar: '看涨 Pin Bar',
  bearish_pinbar: '看跌 Pin Bar', doji: '十字星', HH: '更高高点 HH', HL: '更高低点 HL', LH: '更低高点 LH', LL: '更低低点 LL',
}

export function describeWorkflowNode(node: WorkflowNode, nodes: WorkflowNode[] = []): string {
  if (node.type === 'entry') return node.stage === 'position' ? 'EA提供风控数据' : 'EA提供开仓数据'
  if (node.type === 'condition') return node.condition ? describeCondition(node.condition, nodes) : '请选择条件'
  if (node.type === 'vision_extract') return node.output?.label?.trim() ? `截图提取：${node.output.label.trim()}` : '请设置截图输出'
  if (node.type === 'ai_condition') return meaningfulInstruction(node.instruction) ? `AI：${shortText(node.instruction!)}` : '请选择AI判断规则'
  const action = node.action
  if (!action) return '请选择执行动作'
  if (action.kind === 'open_buy') return '开多'
  if (action.kind === 'open_sell') return '开空'
  if (action.kind === 'no_action') return '不操作'
  if (action.kind === 'close_all') return '全部平仓'
  if (action.kind === 'close_partial') return `部分平仓 ${describeVolume(action.volume)}`.trim()
  if (action.kind === 'add_buy') return `加多仓 ${describeVolume(action.volume)}`.trim()
  if (action.kind === 'add_sell') return `加空仓 ${describeVolume(action.volume)}`.trim()
  if (action.kind === 'modify_sl') return `修改止损至${describeTarget(action.target)}`
  if (action.kind === 'modify_tp') return `修改止盈至${describeTarget(action.target)}`
  if (action.kind === 'cancel_pending') return '取消挂单'
  return '保持持仓'
}

export function describeCondition(condition: WorkflowCondition, nodes: WorkflowNode[] = []): string {
  if (condition.kind === 'vision_result') {
    const source = nodes.find((node) => node.id === condition.left?.source_node_id && node.type === 'vision_extract')
    const output = source?.output
    const option = output?.options.find((item) => item.value === String(condition.right?.value ?? ''))
    return `${output?.label || '截图识别结果'} ${condition.operator === 'neq' ? '不等于' : '等于'} ${option?.label || '请选择结果'}`
  }
  if (condition.kind === 'cross') return `${condition.cross_mode === 'latest' ? `最近${condition.lookback || 2}根最新交叉：` : ''}${describeOperand(condition.left, nodes)} ${condition.direction === 'below' ? '下破' : '上穿'} ${describeOperand(condition.right, nodes)}`
  if (condition.kind === 'atr_distance') {
    const distanceName = condition.left?.name === 'stop_distance' ? '当前价格与止损的距离' : '有利方向移动距离'
    return `${distanceName} ${operatorNames[condition.operator || 'gte']} ${describeOperand(condition.right, nodes)}`
  }
  if (condition.kind === 'comparison' || condition.kind === 'breakout' || condition.kind === 'position_state') {
    return `${describeOperand(condition.left, nodes)} ${operatorNames[condition.operator || 'gt']} ${describeOperand(condition.right, nodes)}`
  }
  if (condition.kind === 'consecutive') return `连续${condition.count || 1}根 ${describeOperand(condition.left, nodes)} ${operatorNames[condition.operator || 'gt']} ${describeOperand(condition.right, nodes)}`
  if (condition.kind === 'indicator_trend') return `${describeOperand(condition.left, nodes)} 连续${condition.count || 1}根 ${condition.direction === 'down' ? '下降' : '上升'}`
  if (condition.kind === 'candle_pattern') return `${condition.lookback && condition.lookback > 1 ? `最近${condition.lookback}根` : ''}出现${patternNames[condition.pattern || ''] || condition.pattern || 'K线形态'}`
  if (condition.kind === 'market_structure') return `${condition.lookback && condition.lookback > 1 ? `最近${condition.lookback}根` : ''}出现${patternNames[condition.pattern || ''] || condition.pattern || '市场结构'}`
  if (condition.kind === 'group') return `${condition.conditions?.length || 0}个条件${condition.group_operator === 'any' ? '任一满足' : '全部满足'}`
  return condition.description?.trim() || '请选择条件'
}

export function describeOperand(operand?: WorkflowOperand, nodes: WorkflowNode[] = []): string {
  if (!operand) return '未设置'
  if (operand.kind === 'constant') {
    if (operand.value === 'buy') return '多单'
    if (operand.value === 'sell') return '空单'
    return formatNumber(operand.value)
  }
  if (operand.kind === 'vision_result') {
    const source = nodes.find((node) => node.id === operand.source_node_id && node.type === 'vision_extract')
    return source?.output?.label || '截图识别结果'
  }
  if (operand.kind !== 'indicator') return operandNames[operand.name || ''] || operand.name || '未设置'
  const name = indicatorNames[operand.indicator || ''] || (operand.indicator || '指标').toUpperCase()
  const params = operand.params || {}
  let period = ''
  if (operand.indicator === 'macd') period = `(${params.fast || 12},${params.slow || 26},${params.signal || 9})`
  else if (operand.indicator === 'bbands') period = `${params.length || 20}`
  else if (params.length) period = String(params.length)
  const component = componentNames[operand.component || ''] || ''
  const source = operand.source && operand.source !== 'close' ? `(${operandNames[operand.source] || operand.source})` : ''
  const multiplier = operand.multiplier !== undefined && operand.multiplier !== 1 ? `${formatNumber(operand.multiplier)}×` : ''
  const addend = operand.addend ? `${operand.addend > 0 ? '+' : ''}${formatNumber(operand.addend)}` : ''
  return `${multiplier}${name}${period}${component}${source}${addend}`
}

function describeVolume(volume?: { mode: string; value: number }) {
  if (!volume) return ''
  if (volume.mode === 'current_ratio') return `${formatNumber(volume.value * 100)}%`
  if (volume.mode === 'fixed') return `${formatNumber(volume.value)}手`
  if (volume.mode === 'previous_multiple') return `前单${formatNumber(volume.value)}倍`
  return '按开仓算法'
}

function describeTarget(target?: WorkflowPriceTarget) {
  if (!target) return '未设置价格'
  if (target.kind === 'entry_price') return target.operation === 'add' ? `开仓价 + ${formatNumber(target.offset_value || 0)}` : target.operation === 'subtract' ? `开仓价 - ${formatNumber(target.offset_value || 0)}` : '开仓价'
  if (target.kind === 'current_price') return '当前价'
  if (target.kind === 'recent_low') return `最近${target.lookback || 5}根最低价`
  if (target.kind === 'recent_high') return `最近${target.lookback || 5}根最高价`
  if (target.kind === 'atr_offset') return `当前价±${formatNumber(target.atr_multiplier || 0.5)} ATR`
  if (target.kind === 'fixed') return formatNumber(target.value)
  return target.indicator || '指标价格'
}

function meaningfulInstruction(value?: string) {
  const text = (value || '').trim()
  return text.length >= 5 && !text.startsWith('请描述')
}

function shortText(value: string) {
  const text = value.trim().replace(/\s+/g, ' ')
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

function formatNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? String(Number(number.toFixed(6))) : String(value ?? '未设置')
}
