import { Trash2 } from 'lucide-react'
import type {
  WorkflowActionKind,
  WorkflowCondition,
  WorkflowDataRequirements,
  WorkflowNode,
  WorkflowOperand,
  WorkflowStageName,
} from './types'

const conditionOptions: Array<{ value: WorkflowCondition['kind']; label: string }> = [
  { value: 'comparison', label: '数值比较' },
  { value: 'cross', label: '上穿 / 下破' },
  { value: 'consecutive', label: '连续满足' },
  { value: 'indicator_trend', label: '指标连续上升 / 下降' },
  { value: 'candle_pattern', label: 'K线形态' },
  { value: 'market_structure', label: '市场结构' },
  { value: 'breakout', label: '突破 / 回踩' },
  { value: 'atr_distance', label: 'ATR距离' },
  { value: 'position_state', label: '持仓状态' },
  { value: 'group', label: 'AND / OR 条件组' },
]

const actionOptions: Record<WorkflowStageName, Array<{ value: WorkflowActionKind; label: string }>> = {
  open: [
    { value: 'open_buy', label: '开多' }, { value: 'open_sell', label: '开空' }, { value: 'no_action', label: '不操作' },
  ],
  position: [
    { value: 'close_all', label: '全部平仓' }, { value: 'close_partial', label: '部分平仓' },
    { value: 'add_buy', label: '加多仓' }, { value: 'add_sell', label: '加空仓' },
    { value: 'modify_sl', label: '修改止损' }, { value: 'modify_tp', label: '修改止盈' }, { value: 'hold', label: '保持持仓' },
  ],
}

function defaultOperand(kind: WorkflowOperand['kind']): WorkflowOperand {
  if (kind === 'indicator') return { kind, indicator: 'ema', alias: 'ema20', source: 'close', params: { length: 20 }, offset: -1 }
  if (kind === 'constant') return { kind, value: 0 }
  if (kind === 'position') return { kind, name: 'profit' }
  if (kind === 'candle') return { kind, name: 'close', offset: -1 }
  if (kind === 'derived') return { kind, name: 'recent_low', lookback: 5 }
  return { kind, name: 'bid' }
}

function defaultCondition(kind: WorkflowCondition['kind']): WorkflowCondition {
  if (kind === 'cross') return {
    kind, description: '最近3根已收盘K线内发生上穿',
    left: { kind: 'indicator', indicator: 'ema', alias: 'ema5', source: 'close', params: { length: 5 }, offset: -1 },
    right: { kind: 'indicator', indicator: 'ema', alias: 'ema30', source: 'close', params: { length: 30 }, offset: -1 },
    direction: 'above', lookback: 3,
  }
  if (kind === 'candle_pattern') return { kind, description: '出现指定K线形态', pattern: 'bullish_engulfing', lookback: 1 }
  if (kind === 'market_structure') return { kind, description: '出现指定市场结构', pattern: 'HH', lookback: 5 }
  if (kind === 'indicator_trend') return {
    kind, description: '指标连续上升', left: defaultOperand('indicator'), direction: 'up', count: 3, lookback: 3,
  }
  if (kind === 'consecutive') return {
    kind, description: '条件连续满足', left: defaultOperand('candle'), operator: 'gt', right: defaultOperand('constant'), count: 3, lookback: 3,
  }
  if (kind === 'position_state') return {
    kind, description: '当前持仓盈利', left: defaultOperand('position'), operator: 'gt', right: defaultOperand('constant'),
  }
  if (kind === 'atr_distance') return {
    kind, description: '价格距离达到指定ATR倍数', left: { kind: 'position', name: 'favorable_move' }, operator: 'gte',
    right: { kind: 'indicator', indicator: 'atr', alias: 'atr14', source: 'close', params: { length: 14 }, multiplier: 0.5 },
  }
  if (kind === 'group') return {
    kind, description: '组合条件', group_operator: 'all',
    conditions: [defaultCondition('comparison'), defaultCondition('comparison')],
  }
  return {
    kind, description: kind === 'breakout' ? '价格突破指定参考值' : '比较两个数据是否满足条件',
    left: defaultOperand('market_price'), operator: 'gt', right: defaultOperand('constant'), lookback: 1,
  }
}

function IndicatorFields({ value, onChange, title }: { value: WorkflowOperand; onChange: (value: WorkflowOperand) => void; title: string }) {
  const length = Number(value.params?.length || 20)
  return <fieldset className="workflow-fieldset"><legend>{title}</legend>
    <div className="workflow-field-row"><label><span>指标</span><select value={value.indicator || 'ema'} onChange={(event) => onChange({ ...value, indicator: event.target.value, alias: `${event.target.value}${length}` })}>
      <option value="ema">EMA</option><option value="sma">SMA（MA）</option><option value="wma">WMA</option><option value="rsi">RSI</option><option value="atr">ATR</option><option value="macd">MACD</option><option value="bbands">布林带</option>
    </select></label><label><span>周期</span><input type="number" min="1" max="1000" value={length} onChange={(event) => { const next = Math.max(1, Number(event.target.value) || 1); onChange({ ...value, params: { ...value.params, length: next }, alias: `${value.indicator || 'ema'}${next}` }) }} /></label></div>
    <div className="workflow-field-row"><label><span>价格源</span><select value={value.source || 'close'} onChange={(event) => onChange({ ...value, source: event.target.value })}><option value="close">收盘价</option><option value="open">开盘价</option><option value="high">最高价</option><option value="low">最低价</option><option value="hl2">(最高+最低)/2</option><option value="ohlc4">OHLC平均</option></select></label><label><span>K线</span><select value={value.offset ?? -1} onChange={(event) => onChange({ ...value, offset: Number(event.target.value) })}><option value={-1}>最新已收盘</option><option value={-2}>前一根</option><option value={-3}>前两根</option></select></label></div>
  </fieldset>
}

function OperandFields({ value, onChange, title, allowConstant = true }: { value: WorkflowOperand; onChange: (value: WorkflowOperand) => void; title: string; allowConstant?: boolean }) {
  const kinds: Array<{ value: WorkflowOperand['kind']; label: string }> = [
    { value: 'indicator', label: '技术指标' }, { value: 'market_price', label: '当前价格' }, { value: 'candle', label: 'K线价格' },
    { value: 'derived', label: '近期高低点' }, { value: 'position', label: '持仓数据' },
  ]
  if (allowConstant) kinds.push({ value: 'constant', label: '固定数值' })
  return <fieldset className="workflow-fieldset"><legend>{title}</legend>
    <label><span>数据类型</span><select value={value.kind} onChange={(event) => onChange(defaultOperand(event.target.value as WorkflowOperand['kind']))}>{kinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    {value.kind === 'indicator' && <><IndicatorFields value={value} onChange={onChange} title="指标参数" /><div className="workflow-field-row"><label><span>指标倍数</span><input type="number" step="0.1" value={value.multiplier ?? 1} onChange={(event) => onChange({ ...value, multiplier: Number(event.target.value) })} /></label><label><span>再加数值</span><input type="number" step="0.1" value={value.addend ?? 0} onChange={(event) => onChange({ ...value, addend: Number(event.target.value) })} /></label></div></>}
    {value.kind === 'constant' && <label><span>数值</span><input type="number" value={Number(value.value || 0)} onChange={(event) => onChange({ ...value, value: Number(event.target.value) })} /></label>}
    {value.kind === 'market_price' && <label><span>价格</span><select value={value.name || 'bid'} onChange={(event) => onChange({ ...value, name: event.target.value })}><option value="bid">Bid</option><option value="ask">Ask</option></select></label>}
    {value.kind === 'candle' && <div className="workflow-field-row"><label><span>K线字段</span><select value={value.name || 'close'} onChange={(event) => onChange({ ...value, name: event.target.value })}><option value="open">开盘价</option><option value="high">最高价</option><option value="low">最低价</option><option value="close">收盘价</option></select></label><label><span>K线</span><select value={value.offset ?? -1} onChange={(event) => onChange({ ...value, offset: Number(event.target.value) })}><option value={-1}>最新已收盘</option><option value={-2}>前一根</option><option value={-3}>前两根</option></select></label></div>}
    {value.kind === 'position' && <label><span>持仓字段</span><select value={value.name || 'profit'} onChange={(event) => onChange({ ...value, name: event.target.value })}><option value="side">持仓方向</option><option value="profit">当前盈亏</option><option value="open_price">开仓价</option><option value="current_price">当前价</option><option value="sl">止损价</option><option value="tp">止盈价</option><option value="volume">持仓手数</option><option value="favorable_move">有利方向移动距离</option></select></label>}
    {value.kind === 'derived' && <div className="workflow-field-row"><label><span>数据</span><select value={value.name || 'recent_low'} onChange={(event) => onChange({ ...value, name: event.target.value })}><option value="recent_low">近期最低价</option><option value="recent_high">近期最高价</option></select></label><label><span>最近K线数</span><input type="number" min="1" max="1000" value={value.lookback || 5} onChange={(event) => onChange({ ...value, lookback: Number(event.target.value) })} /></label></div>}
  </fieldset>
}

function ConditionFields({ condition, onChange }: { condition: WorkflowCondition; onChange: (value: WorkflowCondition) => void }) {
  const patch = (updates: Partial<WorkflowCondition>) => onChange({ ...condition, ...updates })
  return <>
    <label><span>条件类型</span><select value={condition.kind} onChange={(event) => onChange(defaultCondition(event.target.value as WorkflowCondition['kind']))}>{conditionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label><span>条件说明</span><textarea rows={3} value={condition.description || ''} onChange={(event) => patch({ description: event.target.value })} /></label>
    {condition.kind === 'cross' && <><IndicatorFields title="左侧指标" value={condition.left || defaultOperand('indicator')} onChange={(left) => patch({ left })} /><label><span>交叉方向</span><select value={condition.direction || 'above'} onChange={(event) => patch({ direction: event.target.value as 'above' | 'below' })}><option value="above">上穿</option><option value="below">下破</option></select></label><IndicatorFields title="右侧指标" value={condition.right || defaultOperand('indicator')} onChange={(right) => patch({ right })} /><label><span>最近检查范围</span><div className="workflow-suffix-input"><input type="number" min="2" max="100" value={condition.lookback || 3} onChange={(event) => patch({ lookback: Number(event.target.value) })} /><b>根已收盘K线</b></div></label></>}
    {['comparison', 'breakout', 'atr_distance', 'position_state'].includes(condition.kind) && <><OperandFields title="左侧数据" value={condition.left || defaultOperand(condition.kind === 'position_state' ? 'position' : 'market_price')} onChange={(left) => patch({ left })} /><label><span>比较方式</span><select value={condition.operator || 'gt'} onChange={(event) => patch({ operator: event.target.value as WorkflowCondition['operator'] })}><option value="gt">大于</option><option value="gte">大于等于</option><option value="lt">小于</option><option value="lte">小于等于</option><option value="eq">等于</option><option value="neq">不等于</option></select></label><OperandFields title="右侧数据" value={condition.right || defaultOperand('constant')} onChange={(right) => patch({ right })} /></>}
    {condition.kind === 'indicator_trend' && <><IndicatorFields title="判断指标" value={condition.left || defaultOperand('indicator')} onChange={(left) => patch({ left })} /><div className="workflow-field-row"><label><span>方向</span><select value={condition.direction || 'up'} onChange={(event) => patch({ direction: event.target.value as 'up' | 'down' })}><option value="up">连续上升</option><option value="down">连续下降</option></select></label><label><span>连续数量</span><input type="number" min="2" max="100" value={condition.count || 3} onChange={(event) => patch({ count: Number(event.target.value), lookback: Number(event.target.value) })} /></label></div></>}
    {condition.kind === 'consecutive' && <><OperandFields title="左侧数据" value={condition.left || defaultOperand('candle')} onChange={(left) => patch({ left })} /><label><span>比较方式</span><select value={condition.operator || 'gt'} onChange={(event) => patch({ operator: event.target.value as WorkflowCondition['operator'] })}><option value="gt">大于</option><option value="gte">大于等于</option><option value="lt">小于</option><option value="lte">小于等于</option><option value="eq">等于</option><option value="neq">不等于</option></select></label><OperandFields title="右侧数据" value={condition.right || defaultOperand('constant')} onChange={(right) => patch({ right })} /><label><span>连续数量</span><div className="workflow-suffix-input"><input type="number" min="2" max="100" value={condition.count || 3} onChange={(event) => patch({ count: Number(event.target.value), lookback: Number(event.target.value) })} /><b>根K线</b></div></label></>}
    {condition.kind === 'candle_pattern' && <div className="workflow-field-row"><label><span>K线形态</span><select value={condition.pattern || 'bullish_engulfing'} onChange={(event) => patch({ pattern: event.target.value })}><option value="bullish_engulfing">看涨吞没</option><option value="bearish_engulfing">看跌吞没</option><option value="bullish_pinbar">看涨 Pin Bar</option><option value="bearish_pinbar">看跌 Pin Bar</option><option value="doji">十字星</option></select></label><label><span>最近范围</span><input type="number" min="1" max="100" value={condition.lookback || 1} onChange={(event) => patch({ lookback: Number(event.target.value) })} /></label></div>}
    {condition.kind === 'market_structure' && <div className="workflow-field-row"><label><span>结构</span><select value={condition.pattern || 'HH'} onChange={(event) => patch({ pattern: event.target.value })}><option value="HH">更高高点 HH</option><option value="HL">更高低点 HL</option><option value="LH">更低高点 LH</option><option value="LL">更低低点 LL</option></select></label><label><span>检查范围</span><input type="number" min="2" max="100" value={condition.lookback || 5} onChange={(event) => patch({ lookback: Number(event.target.value) })} /></label></div>}
    {condition.kind === 'group' && <><label><span>组合方式</span><select value={condition.group_operator || 'all'} onChange={(event) => patch({ group_operator: event.target.value as 'all' | 'any' })}><option value="all">全部满足（AND）</option><option value="any">任一满足（OR）</option></select></label><p className="workflow-inline-note">组合条件的子规则将在下一步改成可展开的规则列表；流程分支本身也可以连续添加多个判断节点。</p></>}
  </>
}

function ActionFields({ node, stage, onChange }: { node: WorkflowNode; stage: WorkflowStageName; onChange: (node: WorkflowNode) => void }) {
  const action = node.action || { kind: stage === 'open' ? 'no_action' : 'hold' }
  const setKind = (kind: WorkflowActionKind) => {
    const next = { kind } as NonNullable<WorkflowNode['action']>
    if (kind === 'close_partial') next.volume = { mode: 'current_ratio', value: 0.5 }
    if (kind === 'add_buy' || kind === 'add_sell') next.volume = { mode: 'open_sizing', value: 1 }
    if (kind === 'modify_sl' || kind === 'modify_tp') next.target = { kind: 'entry_price', operation: 'none' }
    onChange({ ...node, label: actionOptions[stage].find((item) => item.value === kind)?.label || node.label, action: next })
  }
  const patchAction = (updates: Partial<NonNullable<WorkflowNode['action']>>) => onChange({ ...node, action: { ...action, ...updates } })
  const needsVolume = ['close_partial', 'add_buy', 'add_sell'].includes(action.kind)
  const needsTarget = ['modify_sl', 'modify_tp'].includes(action.kind)
  return <>
    <label><span>执行动作</span><select value={action.kind} onChange={(event) => setKind(event.target.value as WorkflowActionKind)}>{actionOptions[stage].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    {needsVolume && <div className="workflow-field-row"><label><span>仓位方式</span><select value={action.volume?.mode || 'current_ratio'} onChange={(event) => patchAction({ volume: { mode: event.target.value as 'open_sizing' | 'fixed' | 'current_ratio' | 'previous_multiple', value: action.volume?.value || 1 } })}><option value="open_sizing">使用开仓算法</option><option value="fixed">固定手数</option><option value="current_ratio">当前仓位比例</option><option value="previous_multiple">前一单倍数</option></select></label><label><span>数值</span><input type="number" min="0.01" step="0.01" value={action.volume?.value || 1} onChange={(event) => patchAction({ volume: { mode: action.volume?.mode || 'current_ratio', value: Number(event.target.value) } })} /></label></div>}
    {needsTarget && <><label><span>目标价格</span><select value={action.target?.kind || 'entry_price'} onChange={(event) => patchAction({ target: { ...action.target, kind: event.target.value as NonNullable<NonNullable<WorkflowNode['action']>['target']>['kind'] } })}><option value="entry_price">开仓价</option><option value="current_price">当前价格</option><option value="recent_low">近期最低价</option><option value="recent_high">近期最高价</option><option value="atr_offset">距离当前价ATR倍数</option><option value="fixed">固定价格</option></select></label>{['recent_low', 'recent_high'].includes(action.target?.kind || '') && <label><span>最近K线数</span><input type="number" min="1" max="1000" value={action.target?.lookback || 5} onChange={(event) => patchAction({ target: { ...action.target!, lookback: Number(event.target.value) } })} /></label>}{action.target?.kind === 'atr_offset' && <label><span>ATR倍数</span><input type="number" min="0.01" step="0.1" value={action.target.atr_multiplier || 0.5} onChange={(event) => patchAction({ target: { ...action.target!, atr_multiplier: Number(event.target.value) } })} /></label>}</>}
    <label><span>动作说明</span><textarea rows={3} value={action.description || ''} onChange={(event) => patchAction({ description: event.target.value })} placeholder="可选，用于运行记录中说明此动作" /></label>
  </>
}

export function NodeConfigPanel({ node, stage, requirements, onChange, onRequirementsChange, onDelete }: { node?: WorkflowNode; stage: WorkflowStageName; requirements: WorkflowDataRequirements; onChange: (node: WorkflowNode) => void; onRequirementsChange: (value: WorkflowDataRequirements) => void; onDelete: () => void }) {
  if (!node) return <aside className="workflow-config-panel"><p>请选择一个节点进行设置。</p></aside>
  const canDelete = node.type !== 'entry' && node.type !== 'action'
  return <aside className="workflow-config-panel">
    <div className="workflow-config-title"><div><small>节点设置</small><h3>{node.label}</h3></div>{canDelete && <button type="button" title="删除节点" onClick={onDelete}><Trash2 size={16} /></button>}</div>
    <label><span>显示名称</span><input value={node.label} onChange={(event) => onChange({ ...node, label: event.target.value })} /></label>
    {node.type === 'entry' && <><label><span>流程入口</span><input value={stage === 'open' ? '开仓分析' : '持仓风控'} readOnly /></label><label><span>EA提供的数据</span><select value={requirements.data_type} onChange={(event) => onRequirementsChange({ ...requirements, data_type: event.target.value as WorkflowDataRequirements['data_type'] })}><option value="kline">K线数据</option><option value="screenshot">图表截图</option><option value="both">K线 + 截图</option></select></label>{requirements.data_type !== 'screenshot' && <label><span>K线数量</span><div className="workflow-suffix-input"><input type="number" min="10" max="1000" step="10" value={requirements.kline_count} onChange={(event) => onRequirementsChange({ ...requirements, kline_count: Math.max(10, Number(event.target.value) || 10) })} /><b>根</b></div></label>}<p className="workflow-config-tip">入口由系统固定创建。点击节点下方的“+”添加第一条判断规则；实际指标需要更多历史数据时，服务端会自动提高K线数量。</p></>}
    {node.type === 'condition' && <ConditionFields condition={node.condition || defaultCondition('comparison')} onChange={(condition) => onChange({ ...node, condition })} />}
    {node.type === 'vision_condition' && <><label><span>截图识别要求</span><textarea rows={7} value={node.instruction || ''} onChange={(event) => onChange({ ...node, instruction: event.target.value })} /></label><div className="workflow-field-row"><label><span>成立结果</span><input value={node.expected_result || 'matched'} onChange={(event) => onChange({ ...node, expected_result: event.target.value })} /></label><label><span>观察范围</span><div className="workflow-suffix-input"><input type="number" min="1" max="100" value={node.lookback || 3} onChange={(event) => onChange({ ...node, lookback: Number(event.target.value) })} /><b>根K线</b></div></label></div><p className="workflow-inline-note">该节点只负责从截图提取事实，是否开仓或平仓仍由后面的流程动作决定。</p></>}
    {node.type === 'ai_condition' && <><label><span>AI判断要求</span><textarea rows={7} value={node.instruction || ''} onChange={(event) => onChange({ ...node, instruction: event.target.value })} /></label><label><span>提供给AI的数据</span><select value={node.data_type || 'kline'} onChange={(event) => onChange({ ...node, data_type: event.target.value as 'kline' | 'screenshot' | 'both' })}><option value="kline">K线</option><option value="screenshot">截图</option><option value="both">K线 + 截图</option></select></label><p className="workflow-inline-note warning">此节点会调用AI，并在后台标记为“未精确化条件”。后续条件库支持后可转换为精确节点。</p></>}
    {node.type === 'action' && <ActionFields node={node} stage={stage} onChange={onChange} />}
    {node.type !== 'entry' && <p className="workflow-config-tip">条件节点固定包含“是”和“否”两个分支；保存前系统会检查未连接、冲突和缺少参数的规则。</p>}
  </aside>
}
