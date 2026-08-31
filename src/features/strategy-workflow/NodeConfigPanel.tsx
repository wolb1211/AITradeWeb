import { Plus, Trash2 } from 'lucide-react'
import { Select } from '@mantine/core'
import type {
  WorkflowActionKind,
  WorkflowCondition,
  WorkflowDataRequirements,
  IndicatorCatalogItem,
  IndicatorCatalogOutput,
  WorkflowNode,
  WorkflowOperand,
  WorkflowStageName,
} from './types'
import { describeWorkflowNode } from './labels'

const conditionOptions: Array<{ value: WorkflowCondition['kind']; label: string }> = [
  { value: 'comparison', label: '数值比较' },
  { value: 'vision_result', label: '截图识别结果' },
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

const comparisonOptions: Array<[string, string]> = [
  ['gt', '大于'], ['gte', '大于等于'], ['lt', '小于'], ['lte', '小于等于'], ['eq', '等于'], ['neq', '不等于'],
]

const actionOptions: Record<WorkflowStageName, Array<{ value: WorkflowActionKind; label: string }>> = {
  open: [
    { value: 'open_buy', label: '开多' }, { value: 'open_sell', label: '开空' }, { value: 'no_action', label: '不操作' },
  ],
  position: [
    { value: 'close_all', label: '全部平仓' }, { value: 'close_partial', label: '部分平仓' },
    { value: 'add_buy', label: '加多仓' }, { value: 'add_sell', label: '加空仓' },
    { value: 'modify_sl', label: '修改止损' }, { value: 'modify_tp', label: '修改止盈' },
    { value: 'cancel_pending', label: '取消挂单' }, { value: 'hold', label: '保持持仓' },
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

function defaultCondition(kind: WorkflowCondition['kind'], visionSources: WorkflowNode[] = []): WorkflowCondition {
  if (kind === 'vision_result') {
    const source = visionSources[0]
    const option = source?.output?.options.find((item) => item.value !== source.output?.fallback)
    return {
      kind, description: '判断截图信息提取结果',
      left: { kind: 'vision_result', source_node_id: source?.id || '', output_key: source?.output?.key || '' },
      operator: 'eq', right: { kind: 'constant', value: option?.value || '' },
    }
  }
  if (kind === 'cross') return {
    kind, description: '最近3根已收盘K线内发生上穿',
    left: { kind: 'indicator', indicator: 'ema', alias: 'ema5', source: 'close', params: { length: 5 }, offset: -1 },
    right: { kind: 'indicator', indicator: 'ema', alias: 'ema30', source: 'close', params: { length: 30 }, offset: -1 },
    direction: 'above', cross_mode: 'any', lookback: 3,
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

function indicatorAlias(value: WorkflowOperand) {
  const params = value.params || {}
  const suffix = Object.keys(params).sort().map((key) => params[key]).join('_') || 'value'
  return `${value.indicator || 'ema'}_${suffix}${value.component ? `_${value.component}` : ''}`
}

const fallbackIndicatorCatalog: IndicatorCatalogItem[] = [
  {
    name: 'ema', title: 'EMA 指数移动平均线', default_params: { length: 20 },
    parameters: [{ name: 'length', label: '周期', default: 20, description: '' }],
    sources: [{ value: 'close', label: '收盘价', formula: 'close' }],
    outputs: [{ component: 'value', title: 'EMA线', value_type: 'price_line', comparison_group: 'price', operators: comparisonOptions.map((item) => item[0]), right_operand_kinds: ['constant', 'indicator', 'market_price', 'candle'], compatible_groups: ['price'], condition_kinds: ['comparison', 'cross', 'consecutive', 'indicator_trend'], minimum_points: 2, default_constant: null, constant_options: [] }],
  },
]

function indicatorOutput(catalog: IndicatorCatalogItem[], value?: WorkflowOperand): IndicatorCatalogOutput | undefined {
  const definition = catalog.find((item) => item.name === value?.indicator)
  const outputs = Array.isArray(definition?.outputs) ? definition.outputs : []
  return outputs.find((item) => item.component === (value?.component || 'value')) || outputs[0]
}

function compatibleOperand(output: IndicatorCatalogOutput | undefined, current: WorkflowOperand | undefined, catalog: IndicatorCatalogItem[], conditionKind: string): WorkflowOperand {
  if (!output) return current || defaultOperand('indicator')
  const rightOperandKinds = Array.isArray(output.right_operand_kinds) ? output.right_operand_kinds : []
  const compatibleGroups = Array.isArray(output.compatible_groups) ? output.compatible_groups : []
  if (current && rightOperandKinds.includes(current.kind)) {
    if (current.kind !== 'indicator' || compatibleGroups.includes(indicatorOutput(catalog, current)?.comparison_group || '')) return current
  }
  if (rightOperandKinds.includes('indicator')) {
    const definition = catalog.find((item) => (item.outputs || []).some((itemOutput) => compatibleGroups.includes(itemOutput.comparison_group) && (itemOutput.condition_kinds || []).includes(conditionKind)))
    const selected = (definition?.outputs || []).find((item) => compatibleGroups.includes(item.comparison_group) && (item.condition_kinds || []).includes(conditionKind))
    if (definition && selected) {
      const operand: WorkflowOperand = { kind: 'indicator', indicator: definition.name, component: selected.component, params: { ...(definition.default_params || {}) }, source: definition.sources?.[0]?.value || 'ohlc', offset: -1 }
      return { ...operand, alias: indicatorAlias(operand) }
    }
  }
  if (rightOperandKinds.includes('market_price')) return defaultOperand('market_price')
  if (rightOperandKinds.includes('candle')) return defaultOperand('candle')
  return { kind: 'constant', value: output.default_constant ?? 0 }
}

function IndicatorFields({ value, onChange, title, catalog, compatibleGroups, conditionKind }: { value: WorkflowOperand; onChange: (value: WorkflowOperand) => void; title: string; catalog: IndicatorCatalogItem[]; compatibleGroups?: string[]; conditionKind?: string }) {
  const validCatalog = catalog.filter((item) => Array.isArray(item.outputs) && item.outputs.length > 0)
  const sourceCatalog = validCatalog.length ? validCatalog : fallbackIndicatorCatalog
  const availableCatalog = sourceCatalog.filter((item) => (item.outputs || []).some((output) => (
    (!compatibleGroups?.length || compatibleGroups.includes(output.comparison_group)) &&
    (!conditionKind || (output.condition_kinds || []).includes(conditionKind))
  )))
  const selectableCatalog = availableCatalog.length ? availableCatalog : sourceCatalog
  const indicator = value.indicator || 'ema'
  const params = value.params || {}
  const definition = selectableCatalog.find((item) => item.name === indicator) || selectableCatalog[0] || fallbackIndicatorCatalog[0]
  const outputs = (definition.outputs || []).filter((output) => (
    (!compatibleGroups?.length || compatibleGroups.includes(output.comparison_group)) &&
    (!conditionKind || (output.condition_kinds || []).includes(conditionKind))
  ))
  const selectableOutputs = outputs.length ? outputs : (definition.outputs || [])
  const selectedOutput = selectableOutputs.find((item) => item.component === (value.component || 'value')) || selectableOutputs[0]
  const update = (updates: Partial<WorkflowOperand>) => {
    const next = { ...value, ...updates }
    onChange({ ...next, alias: indicatorAlias(next) })
  }
  const selectIndicator = (nextIndicator: string) => {
    const nextDefinition = selectableCatalog.find((item) => item.name === nextIndicator) || selectableCatalog[0] || fallbackIndicatorCatalog[0]
    const nextOutputs = (nextDefinition.outputs || []).filter((output) => (
      (!compatibleGroups?.length || compatibleGroups.includes(output.comparison_group)) &&
      (!conditionKind || (output.condition_kinds || []).includes(conditionKind))
    ))
    const next: WorkflowOperand = {
      ...value,
      indicator: nextIndicator,
      params: { ...(nextDefinition.default_params || {}) },
      source: nextDefinition.sources?.[0]?.value || 'ohlc',
      component: nextOutputs[0]?.component || 'value',
    }
    onChange({ ...next, alias: indicatorAlias(next) })
  }
  return <fieldset className="workflow-fieldset"><legend>{title}</legend>{value.kind === 'position' && <button type="button" className="workflow-add-output" onClick={() => onChange({ ...value, name: 'stop_distance' })}>选择当前价格与止损的距离</button>}
    <label><span>指标</span><FormSelect value={definition.name} onChange={selectIndicator} data={selectableCatalog.map((item) => [item.name, item.title])} /></label>
    {(definition.parameters || []).length > 0 && <div className={`workflow-parameter-grid${(definition.parameters || []).length >= 3 ? ' three' : ''}`}>{(definition.parameters || []).map((parameter) => <label key={parameter.name}><span>{parameter.label}</span><input type="number" min="0.000001" step={Number.isInteger(parameter.default) ? 1 : 0.1} value={Number(params[parameter.name] ?? parameter.default)} onChange={(event) => update({ params: { ...params, [parameter.name]: Number(event.target.value) } })} /></label>)}</div>}
    {selectableOutputs.length > 1 && selectedOutput && <label><span>指标值</span><FormSelect value={selectedOutput.component} onChange={(component) => update({ component })} data={selectableOutputs.map((output) => [output.component, output.title])} /></label>}
    <div className="workflow-field-row">{(definition.sources || []).length > 0 && <label><span>价格源</span><FormSelect value={value.source || definition.sources[0].value} onChange={(source) => update({ source })} data={definition.sources.map((source) => [source.value, source.label])} /></label>}<label><span>K线</span><FormSelect value={String(value.offset ?? -1)} onChange={(offset) => update({ offset: Number(offset) })} data={[["-1", '最新已收盘'], ["-2", '前一根'], ["-3", '前两根']]} /></label></div>
  </fieldset>
}

function FormSelect({ value, data, onChange }: { value: string; data: Array<[string, string]>; onChange: (value: string) => void }) {
  const options = data.some(([itemValue]) => itemValue === 'side') && !data.some(([itemValue]) => itemValue === 'stop_distance')
    ? [...data, ['stop_distance', '当前价格与止损的距离'] as [string, string]]
    : data
  return <Select className="workflow-mantine-select" value={value} data={options.map(([itemValue, label]) => ({ value: itemValue, label }))} onChange={(next) => next !== null && onChange(next)} allowDeselect={false} searchable={options.length > 12} comboboxProps={{ withinPortal: true, zIndex: 1200 }} />
}

function OperandFields({ value, onChange, title, catalog, allowConstant = true, allowedKinds, compatibleGroups, conditionKind, positionSideConstant = false }: { value: WorkflowOperand; onChange: (value: WorkflowOperand) => void; title: string; catalog: IndicatorCatalogItem[]; allowConstant?: boolean; allowedKinds?: string[]; compatibleGroups?: string[]; conditionKind?: string; positionSideConstant?: boolean }) {
  let kinds: Array<{ value: WorkflowOperand['kind']; label: string }> = [
    { value: 'indicator', label: '技术指标' }, { value: 'market_price', label: '当前价格' }, { value: 'candle', label: 'K线价格' },
    { value: 'derived', label: '近期高低点' }, { value: 'position', label: '持仓数据' },
  ]
  if (allowConstant) kinds.push({ value: 'constant', label: '固定数值' })
  if (allowedKinds?.length) kinds = kinds.filter((item) => allowedKinds.includes(item.value))
  return <fieldset className="workflow-fieldset"><legend>{title}</legend>
    <label><span>数据类型</span><FormSelect value={value.kind} onChange={(kind) => onChange(defaultOperand(kind as WorkflowOperand['kind']))} data={kinds.map((item) => [item.value, item.label])} /></label>
    {value.kind === 'indicator' && <><IndicatorFields value={value} onChange={onChange} title="指标参数" catalog={catalog} compatibleGroups={compatibleGroups} conditionKind={conditionKind} /><div className="workflow-field-row"><label><span>指标倍数</span><input type="number" step="0.1" value={value.multiplier ?? 1} onChange={(event) => onChange({ ...value, multiplier: Number(event.target.value) })} /></label><label><span>再加数值</span><input type="number" step="0.1" value={value.addend ?? 0} onChange={(event) => onChange({ ...value, addend: Number(event.target.value) })} /></label></div></>}
    {value.kind === 'constant' && (positionSideConstant ? <label><span>持仓方向</span><FormSelect value={String(value.value || 'buy')} onChange={(next) => onChange({ ...value, value: next })} data={[["buy", "多单"], ["sell", "空单"]]} /> </label> : <label><span>数值</span><input type="number" value={Number(value.value || 0)} onChange={(event) => onChange({ ...value, value: Number(event.target.value) })} /></label>)}
    {value.kind === 'market_price' && <label><span>价格</span><FormSelect value={value.name || 'bid'} onChange={(name) => onChange({ ...value, name })} data={[["bid", "Bid"], ["ask", "Ask"]]} /></label>}
    {value.kind === 'candle' && <div className="workflow-field-row"><label><span>K线字段</span><FormSelect value={value.name || 'close'} onChange={(name) => onChange({ ...value, name })} data={[["open", "开盘价"], ["high", "最高价"], ["low", "最低价"], ["close", "收盘价"]]} /></label><label><span>K线</span><FormSelect value={String(value.offset ?? -1)} onChange={(offset) => onChange({ ...value, offset: Number(offset) })} data={[["-1", "最新已收盘"], ["-2", "前一根"], ["-3", "前两根"]]} /></label></div>}
    {value.kind === 'position' && <label><span>持仓字段</span><FormSelect value={value.name || 'profit'} onChange={(name) => onChange({ ...value, name })} data={[["side", "持仓方向"], ["profit", "当前盈亏"], ["open_price", "开仓价"], ["current_price", "当前价"], ["sl", "止损价"], ["tp", "止盈价"], ["volume", "持仓手数"], ["favorable_move", "有利方向移动距离"], ["stop_distance", "当前价格与止损的距离"]]} /></label>}
    {value.kind === 'derived' && <div className="workflow-field-row"><label><span>数据</span><FormSelect value={value.name || 'recent_low'} onChange={(name) => onChange({ ...value, name })} data={[["recent_low", "近期最低价"], ["recent_high", "近期最高价"]]} /></label><label><span>最近K线数</span><input type="number" min="1" max="1000" value={value.lookback || 5} onChange={(event) => onChange({ ...value, lookback: Number(event.target.value) })} /></label></div>}
  </fieldset>
}

function ConditionFields({ condition, visionSources, indicatorCatalog, onChange }: { condition?: WorkflowCondition; visionSources: WorkflowNode[]; indicatorCatalog: IndicatorCatalogItem[]; onChange: (value: WorkflowCondition) => void }) {
  if (!condition) return <label><span>条件类型</span><FormSelect value="" onChange={(kind) => onChange(defaultCondition(kind as WorkflowCondition['kind'], visionSources))} data={[["", "请选择条件"], ...conditionOptions.map((item): [string, string] => [item.value, item.label])]} /></label>
  const patch = (updates: Partial<WorkflowCondition>) => onChange({ ...condition, ...updates })
  const catalog = indicatorCatalog.length ? indicatorCatalog : fallbackIndicatorCatalog
  const leftCapability = condition.left?.kind === 'indicator' ? indicatorOutput(catalog, condition.left) : undefined
  const updateCrossLeft = (left: WorkflowOperand) => {
    const capability = indicatorOutput(catalog, left)
    patch({ left, right: compatibleOperand(capability, condition.right, catalog, 'cross') })
  }
  const visionSource = visionSources.find((node) => node.id === condition.left?.source_node_id)
  const selectVisionSource = (sourceId: string) => {
    const source = visionSources.find((node) => node.id === sourceId)
    const option = source?.output?.options.find((item) => item.value !== source.output?.fallback)
    patch({
      left: { kind: 'vision_result', source_node_id: sourceId, output_key: source?.output?.key || '' },
      right: { kind: 'constant', value: option?.value || '' },
    })
  }
  return <div className="workflow-condition-fields">
    <label className="workflow-primary-field"><span>条件类型</span><FormSelect value={condition.kind} onChange={(kind) => onChange(defaultCondition(kind as WorkflowCondition['kind'], visionSources))} data={conditionOptions.map((item) => [item.value, item.label])} /></label>
    {condition.kind === 'vision_result' && (visionSources.length ? <><label><span>截图输出</span><FormSelect value={condition.left?.source_node_id || visionSources[0].id} onChange={selectVisionSource} data={visionSources.map((item) => [item.id, item.output?.label || '截图识别结果'])} /></label><label><span>比较方式</span><FormSelect value={condition.operator || 'eq'} onChange={(operator) => patch({ operator: operator as 'eq' | 'neq' })} data={[["eq", "等于"], ["neq", "不等于"]]} /></label><label><span>识别结果</span><FormSelect value={String(condition.right?.value ?? '')} onChange={(result) => patch({ right: { kind: 'constant', value: result } })} data={(visionSource?.output?.options || visionSources[0].output?.options || []).map((item) => [item.value, item.label])} /></label></> : <p className="workflow-inline-note warning">当前节点前面没有截图信息提取节点，请先在流程上方添加截图信息提取。</p>)}
    {condition.kind === 'cross' && <><IndicatorFields title="左侧指标" value={condition.left || defaultOperand('indicator')} onChange={updateCrossLeft} catalog={catalog} conditionKind="cross" /><label className="workflow-primary-field"><span>交叉方向</span><FormSelect value={condition.direction || 'above'} onChange={(direction) => patch({ direction: direction as 'above' | 'below' })} data={[["above", "上穿"], ["below", "下破"]]} /></label><OperandFields title="右侧数据" value={condition.right || compatibleOperand(leftCapability, undefined, catalog, 'cross')} onChange={(right) => patch({ right })} catalog={catalog} allowedKinds={leftCapability?.right_operand_kinds} compatibleGroups={leftCapability?.compatible_groups} conditionKind="cross" /><label><span>交叉判断方式</span><FormSelect value={condition.cross_mode || 'any'} onChange={(cross_mode) => patch({ cross_mode: cross_mode as 'any' | 'latest' })} data={[["any", "范围内出现过"], ["latest", "以最近一次交叉为准"]]} /></label><label><span>最近检查范围</span><div className="workflow-suffix-input"><input type="number" min="2" max="100" value={condition.lookback || 3} onChange={(event) => patch({ lookback: Number(event.target.value) })} /><b>根已收盘K线</b></div></label></>}
    {condition.kind !== 'atr_distance' && ['comparison', 'breakout', 'position_state'].includes(condition.kind) && <><OperandFields title="左侧数据" value={condition.left || defaultOperand(condition.kind === 'position_state' ? 'position' : 'market_price')} onChange={(left) => patch({ left, right: left.kind === 'indicator' ? compatibleOperand(indicatorOutput(catalog, left), condition.right, catalog, 'comparison') : left.kind === 'position' && left.name === 'side' ? { kind: 'constant', value: 'buy' } : condition.right })} catalog={catalog} /><label><span>比较方式</span><FormSelect value={condition.operator || 'gt'} onChange={(operator) => patch({ operator: operator as WorkflowCondition['operator'] })} data={(leftCapability?.operators || comparisonOptions.map((item) => item[0])).map((operator) => comparisonOptions.find((item) => item[0] === operator) || [operator, operator])} /></label><OperandFields title="右侧数据" value={condition.right || defaultOperand('constant')} onChange={(right) => patch({ right })} catalog={catalog} allowedKinds={leftCapability?.right_operand_kinds} compatibleGroups={leftCapability?.compatible_groups} conditionKind="comparison" positionSideConstant={condition.left?.kind === 'position' && condition.left.name === 'side'} /></>}
    {condition.kind === 'atr_distance' && <>
      <label><span>距离对象</span><FormSelect value={condition.left?.kind === 'position' ? (condition.left.name || 'favorable_move') : 'favorable_move'} onChange={(name) => patch({ left: { ...(condition.left || defaultOperand('position')), kind: 'position', name } })} data={[["favorable_move", "有利方向移动距离"], ["stop_distance", "当前价格与止损的距离"]]} /></label>
      <label><span>比较方式</span><FormSelect value={condition.operator || 'gte'} onChange={(operator) => patch({ operator: operator as WorkflowCondition['operator'] })} data={comparisonOptions.filter(([value]) => ['gt', 'gte', 'lt', 'lte'].includes(value))} /></label>
      <div className="workflow-field-row"><label><span>ATR周期</span><input type="number" min="1" max="1000" value={Number(condition.right?.params?.length || 14)} onChange={(event) => { const length = Number(event.target.value) || 14; patch({ right: { ...(condition.right || {}), kind: 'indicator', indicator: 'atr', alias: `atr${length}`, params: { length }, source: 'close', multiplier: condition.right?.multiplier ?? 1 } }) }} /></label><label><span>ATR倍数</span><input type="number" min="0" step="0.1" value={condition.right?.multiplier ?? 1} onChange={(event) => patch({ right: { ...(condition.right || {}), kind: 'indicator', indicator: 'atr', params: { length: Number(condition.right?.params?.length || 14) }, source: 'close', multiplier: Number(event.target.value) } })} /></label></div>
    </>}    {condition.kind === 'indicator_trend' && <><IndicatorFields title="判断指标" value={condition.left || defaultOperand('indicator')} onChange={(left) => patch({ left })} catalog={catalog} conditionKind="indicator_trend" /><div className="workflow-field-row"><label><span>方向</span><FormSelect value={condition.direction || 'up'} onChange={(direction) => patch({ direction: direction as 'up' | 'down' })} data={[["up", "连续上升"], ["down", "连续下降"]]} /></label><label><span>连续数量</span><input type="number" min="2" max="100" value={condition.count || 3} onChange={(event) => patch({ count: Number(event.target.value), lookback: Number(event.target.value) })} /></label></div></>}
    {condition.kind === 'consecutive' && <><OperandFields title="左侧数据" value={condition.left || defaultOperand('candle')} onChange={(left) => patch({ left })} catalog={catalog} /><label><span>比较方式</span><FormSelect value={condition.operator || 'gt'} onChange={(operator) => patch({ operator: operator as WorkflowCondition['operator'] })} data={comparisonOptions} /></label><OperandFields title="右侧数据" value={condition.right || defaultOperand('constant')} onChange={(right) => patch({ right })} catalog={catalog} /><label><span>连续数量</span><div className="workflow-suffix-input"><input type="number" min="2" max="100" value={condition.count || 3} onChange={(event) => patch({ count: Number(event.target.value), lookback: Number(event.target.value) })} /><b>根K线</b></div></label></>}
    {condition.kind === 'candle_pattern' && <div className="workflow-field-row"><label><span>K线形态</span><FormSelect value={condition.pattern || 'bullish_engulfing'} onChange={(pattern) => patch({ pattern })} data={[["bullish_engulfing", "看涨吞没"], ["bearish_engulfing", "看跌吞没"], ["bullish_pinbar", "看涨 Pin Bar"], ["bearish_pinbar", "看跌 Pin Bar"], ["doji", "十字星"]]} /></label><label><span>最近范围</span><input type="number" min="1" max="100" value={condition.lookback || 1} onChange={(event) => patch({ lookback: Number(event.target.value) })} /></label></div>}
    {condition.kind === 'market_structure' && <div className="workflow-field-row"><label><span>结构</span><FormSelect value={condition.pattern || 'HH'} onChange={(pattern) => patch({ pattern })} data={[["HH", "更高高点 HH"], ["HL", "更高低点 HL"], ["LH", "更低高点 LH"], ["LL", "更低低点 LL"]]} /></label><label><span>检查范围</span><input type="number" min="2" max="100" value={condition.lookback || 5} onChange={(event) => patch({ lookback: Number(event.target.value) })} /></label></div>}
    {condition.kind === 'group' && <><label><span>组合方式</span><FormSelect value={condition.group_operator || 'all'} onChange={(group_operator) => patch({ group_operator: group_operator as 'all' | 'any' })} data={[["all", "全部满足（AND）"], ["any", "任一满足（OR）"]]} /></label><p className="workflow-inline-note">组合条件的子规则将在下一步改成可展开的规则列表；流程分支本身也可以连续添加多个判断节点。</p></>}
  </div>
}

const visionOutputTemplates: Array<{ value: string; label: string; options: Array<{ value: string; label: string }> }> = [
  { value: 'signal', label: '交易信号', options: [{ value: 'long', label: '多头信号' }, { value: 'short', label: '空头信号' }, { value: 'none', label: '无信号' }] },
  { value: 'trend', label: '趋势方向', options: [{ value: 'rising', label: '上涨' }, { value: 'falling', label: '下跌' }, { value: 'sideways', label: '震荡' }] },
  { value: 'breakout', label: '突破状态', options: [{ value: 'break_up', label: '向上突破' }, { value: 'break_down', label: '向下破位' }, { value: 'no_break', label: '未突破' }] },
  { value: 'transition', label: '状态变化', options: [{ value: 'turn_bullish', label: '转多' }, { value: 'turn_bearish', label: '转空' }, { value: 'unchanged', label: '未变化' }] },
  { value: 'presence', label: '是否出现', options: [{ value: 'present', label: '已出现' }, { value: 'absent', label: '未出现' }] },
  { value: 'position', label: '相对位置', options: [{ value: 'above', label: '上方' }, { value: 'below', label: '下方' }, { value: 'touching', label: '接触' }] },
]

function conditionUsesVisionOption(condition: WorkflowCondition | undefined, nodeId: string, value: string): boolean {
  if (!condition) return false
  if (condition.kind === 'vision_result' && condition.left?.source_node_id === nodeId && String(condition.right?.value ?? '') === value) return true
  return (condition.conditions || []).some((item) => conditionUsesVisionOption(item, nodeId, value))
}

function VisionExtractFields({ node, nodes, onChange }: { node: WorkflowNode; nodes: WorkflowNode[]; onChange: (node: WorkflowNode) => void }) {
  const output = node.output || {
    key: `vision_${Date.now().toString(36)}`, label: '截图识别结果', type: 'enum' as const,
    options: [{ value: 'long', label: '多头信号' }, { value: 'short', label: '空头信号' }, { value: 'none', label: '无信号' }, { value: 'uncertain', label: '无法确认' }],
    fallback: 'uncertain',
  }
  const usedValues = new Set(output.options.filter((option) => nodes.some((item) => item.type === 'condition' && conditionUsesVisionOption(item.condition, node.id, option.value))).map((item) => item.value))
  const emitOutput = (nextOutput: typeof output) => onChange({ ...node, output: nextOutput })
  const applyTemplate = (templateValue: string) => {
    const template = visionOutputTemplates.find((item) => item.value === templateValue)
    if (!template) return
    emitOutput({ ...output, options: [...template.options, { value: 'uncertain', label: '无法确认' }], fallback: 'uncertain' })
  }
  const addOption = () => {
    if (output.options.length >= 12) return
    const uncertainIndex = output.options.findIndex((item) => item.value === output.fallback)
    const next = { value: `result_${Date.now().toString(36)}`, label: '新结果' }
    const options = [...output.options]
    options.splice(uncertainIndex < 0 ? options.length : uncertainIndex, 0, next)
    emitOutput({ ...output, options })
  }
  const updateOptionLabel = (value: string, label: string) => emitOutput({ ...output, options: output.options.map((item) => item.value === value ? { ...item, label } : item) })
  const removeOption = (value: string) => emitOutput({ ...output, options: output.options.filter((item) => item.value !== value) })
  return <>
    <label><span>截图识别要求</span><textarea rows={7} value={node.instruction || ''} onChange={(event) => onChange({ ...node, instruction: event.target.value })} placeholder="写清需要识别的图形、颜色、位置或变化，以及各结果对应的特征" /></label>
    <div className="workflow-field-row"><label><span>输出名称</span><input value={output.label} maxLength={100} onChange={(event) => emitOutput({ ...output, label: event.target.value })} /></label><label><span>观察范围</span><div className="workflow-suffix-input"><input type="number" min="1" max="100" value={node.lookback || 3} onChange={(event) => onChange({ ...node, lookback: Number(event.target.value) })} /><b>根K线</b></div></label></div>
    {!usedValues.size && <label><span>常用结果模板</span><FormSelect value="" onChange={applyTemplate} data={[["", "请选择模板"], ...visionOutputTemplates.map((item): [string, string] => [item.value, item.label])]} /></label>}
    <fieldset className="workflow-fieldset workflow-vision-output"><legend>可选输出结果</legend>
      <div className="workflow-output-list">{output.options.map((option) => {
        const fixed = option.value === output.fallback
        const used = usedValues.has(option.value)
        const cannotDelete = fixed || used || output.options.length <= 2
        return <div key={option.value} className={fixed ? 'fixed' : ''}><input value={option.label} readOnly={fixed} maxLength={60} onChange={(event) => updateOptionLabel(option.value, event.target.value)} /><small>{fixed ? '系统兜底' : used ? '已被流程使用' : '固定枚举'}</small><button type="button" disabled={cannotDelete} title={fixed ? '系统兜底结果不能删除' : used ? '该结果已被后续判断使用' : '删除结果'} onClick={() => removeOption(option.value)}><Trash2 size={14} /></button></div>
      })}</div>
      <button className="workflow-add-output" type="button" disabled={output.options.length >= 12} onClick={addOption}><Plus size={14} />添加结果</button>
    </fieldset>
    <p className="workflow-inline-note">AI每次只能返回以上结果中的一个；无法可靠识别时统一返回“无法确认”。该节点完成后继续执行下一步判断。</p>
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
  const opensPosition = action.kind === 'open_buy' || action.kind === 'open_sell'
  const entryOffsetTarget = needsTarget && action.target?.kind === 'entry_price' ? <div className="workflow-field-row"><label><span>偏移方向</span><FormSelect value={action.target.operation || 'none'} onChange={(operation) => patchAction({ target: { ...action.target!, operation: operation as 'none' | 'add' | 'subtract' } })} data={[["none", "不偏移"], ["add", "加"], ["subtract", "减"]]} /></label><label><span>偏移价格</span><input type="number" min="0" step="0.01" value={action.target.offset_value || 0} onChange={(event) => patchAction({ target: { ...action.target!, offset_value: Number(event.target.value) } })} /></label></div> : null
  return <>
    <label><span>执行动作</span><FormSelect value={action.kind} onChange={(kind) => setKind(kind as WorkflowActionKind)} data={actionOptions[stage].map((item) => [item.value, item.label])} /></label>
    {needsVolume && <div className="workflow-field-row"><label><span>仓位方式</span><FormSelect value={action.volume?.mode || 'current_ratio'} onChange={(mode) => patchAction({ volume: { mode: mode as 'open_sizing' | 'fixed' | 'current_ratio' | 'previous_multiple', value: action.volume?.value || 1 } })} data={[["open_sizing", "使用开仓算法"], ["fixed", "固定手数"], ["current_ratio", "当前仓位比例"], ["previous_multiple", "前一单倍数"]]} /></label><label><span>数值</span><input type="number" min="0.01" step="0.01" value={action.volume?.value || 1} onChange={(event) => patchAction({ volume: { mode: action.volume?.mode || 'current_ratio', value: Number(event.target.value) } })} /></label></div>}
    {needsTarget && <><label><span>目标价格</span><FormSelect value={action.target?.kind || 'entry_price'} onChange={(kind) => patchAction({ target: { ...action.target, kind: kind as NonNullable<NonNullable<WorkflowNode['action']>['target']>['kind'] } })} data={[["entry_price", "开仓价"], ["current_price", "当前价格"], ["recent_low", "近期最低价"], ["recent_high", "近期最高价"], ["atr_offset", "距离当前价ATR倍数"], ["fixed", "固定价格"]]} /></label>{['recent_low', 'recent_high'].includes(action.target?.kind || '') && <label><span>最近K线数</span><input type="number" min="1" max="1000" value={action.target?.lookback || 5} onChange={(event) => patchAction({ target: { ...action.target!, lookback: Number(event.target.value) } })} /></label>}{action.target?.kind === 'atr_offset' && <label><span>ATR倍数</span><input type="number" min="0.01" step="0.1" value={action.target.atr_multiplier || 0.5} onChange={(event) => patchAction({ target: { ...action.target!, atr_multiplier: Number(event.target.value) } })} /></label>}</>}
    {entryOffsetTarget}
    {opensPosition && <>
      <fieldset className="workflow-fieldset workflow-action-rule"><legend>开仓价格</legend>
        <label><span>开仓方式</span><FormSelect value={action.entry_mode || 'market'} onChange={(entry_mode) => patchAction({ entry_mode: entry_mode as 'market' | 'pending', entry_price_rule: entry_mode === 'market' ? '' : action.entry_price_rule })} data={[["market", "市价开仓（默认）"], ["pending", "按规则挂单"]]} /></label>
        {action.entry_mode === 'pending' && <label><span>挂单价格规则</span><textarea rows={3} value={action.entry_price_rule || ''} onChange={(event) => patchAction({ entry_price_rule: event.target.value })} placeholder="例如：在最近 5 根K线最低价挂多单；或在当前价格下方 0.5 ATR 挂单" /></label>}
        <p className="workflow-inline-note">市价模式条件成立后直接开单；挂单模式由 AI 根据规则计算价格，并自动判断使用 Limit 或 Stop 挂单。</p>
      </fieldset>
      <fieldset className="workflow-fieldset workflow-action-rule"><legend>止损设置</legend><label><span>止损规则（可不填或输入 0）</span><textarea rows={3} value={action.stop_loss_rule || ''} onChange={(event) => patchAction({ stop_loss_rule: event.target.value, stop_loss: undefined })} placeholder="例如：最近 5 根已收盘K线最低价；或开仓价下方 1 ATR" /></label></fieldset>
      <fieldset className="workflow-fieldset workflow-action-rule"><legend>止盈设置</legend><label><span>止盈规则（可不填或输入 0）</span><textarea rows={3} value={action.take_profit_rule || ''} onChange={(event) => patchAction({ take_profit_rule: event.target.value, take_profit: undefined })} placeholder="例如：止损距离的 2 倍；或最近 20 根K线最高价" /></label></fieldset>
    </>}
    <label><span>动作说明</span><textarea rows={3} value={action.description || ''} onChange={(event) => patchAction({ description: event.target.value })} placeholder="可选，用于运行记录中说明此动作" /></label>
  </>
}

export function NodeConfigPanel({ node, nodes, visionSources, indicatorCatalog, stage, requirements, onChange, onRequirementsChange, onDelete }: { node?: WorkflowNode; nodes: WorkflowNode[]; visionSources: WorkflowNode[]; indicatorCatalog: IndicatorCatalogItem[]; stage: WorkflowStageName; requirements: WorkflowDataRequirements; onChange: (node: WorkflowNode) => void; onRequirementsChange: (value: WorkflowDataRequirements) => void; onDelete: () => void }) {
  if (!node) return <aside className="workflow-config-panel"><p>请选择一个节点进行设置。</p></aside>
  const canDelete = node.type !== 'entry'
  const emit = (nextNode: WorkflowNode) => onChange({ ...nextNode, label: describeWorkflowNode(nextNode, nodes) })
  const displayLabel = describeWorkflowNode(node, nodes)
  return <aside className="workflow-config-panel">
    <div className="workflow-config-title"><div><small>节点设置</small><h3>{displayLabel}</h3></div>{canDelete && <button type="button" title="删除节点" onClick={onDelete}><Trash2 size={16} /></button>}</div>
    {node.type === 'entry' && <><label><span>数据入口</span><input value={stage === 'open' ? 'EA提供开仓数据' : 'EA提供风控数据'} readOnly /></label><label><span>EA提供的数据</span><FormSelect value={requirements.data_type} onChange={(data_type) => onRequirementsChange({ ...requirements, data_type: data_type as WorkflowDataRequirements['data_type'] })} data={[["kline", "K线数据"], ["screenshot", "EA图表截图"], ["both", "K线 + EA图表截图"]]} /></label>{requirements.data_type !== 'screenshot' && <label><span>K线数量</span><div className="workflow-suffix-input"><input type="number" min="10" max="1000" step="10" value={requirements.kline_count} onChange={(event) => onRequirementsChange({ ...requirements, kline_count: Math.max(10, Number(event.target.value) || 10) })} /><b>根</b></div></label>}<p className="workflow-config-tip">入口由系统固定创建。点击节点下方的“+”添加第一条判断规则；实际指标需要更多历史数据时，服务端会自动提高K线数量。</p></>}
    {node.type === 'condition' && <ConditionFields condition={node.condition} visionSources={visionSources} indicatorCatalog={indicatorCatalog} onChange={(condition) => emit({ ...node, condition })} />}
    {node.type === 'vision_extract' && <VisionExtractFields node={node} nodes={nodes} onChange={emit} />}
    {node.type === 'ai_condition' && <><label><span>AI判断要求</span><textarea rows={7} value={node.instruction || ''} onChange={(event) => emit({ ...node, instruction: event.target.value })} /></label><label><span>提供给AI的数据</span><FormSelect value={node.data_type || 'kline'} onChange={(data_type) => emit({ ...node, data_type: data_type as 'kline' | 'screenshot' | 'both' })} data={[["kline", "K线"], ["screenshot", "截图"], ["both", "K线 + 截图"]]} /></label><p className="workflow-inline-note warning">此节点会调用AI，并在后台标记为“未精确化条件”。后续条件库支持后可转换为精确节点。</p></>}
    {node.type === 'action' && <ActionFields node={node} stage={stage} onChange={emit} />}
  </aside>
}
