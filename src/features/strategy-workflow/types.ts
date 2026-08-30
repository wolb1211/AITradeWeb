export type WorkflowStageName = 'open' | 'position'
export type WorkflowBranch = 'next' | 'yes' | 'no'

export type WorkflowDataRequirements = {
  data_type: 'kline' | 'screenshot' | 'both'
  kline_count: number
  call_mode: 'bar' | 'timer' | 'tick' | 'price_step'
  call_value: number
}

export type WorkflowOperand = {
  kind: 'indicator' | 'market_price' | 'candle' | 'position' | 'constant' | 'derived'
  name?: string
  value?: number | string | boolean | null
  indicator?: string
  component?: string
  alias?: string
  source?: string
  params?: Record<string, number | string>
  multiplier?: number
  addend?: number
  offset?: number
  lookback?: number
}

export type WorkflowCondition = {
  kind: 'comparison' | 'cross' | 'consecutive' | 'indicator_trend' | 'candle_pattern' | 'market_structure' | 'breakout' | 'atr_distance' | 'position_state' | 'group'
  description?: string
  left?: WorkflowOperand
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  right?: WorkflowOperand
  direction?: 'above' | 'below' | 'up' | 'down' | 'bullish' | 'bearish'
  lookback?: number
  count?: number
  pattern?: string
  group_operator?: 'all' | 'any'
  conditions?: WorkflowCondition[]
}

export type WorkflowPriceTarget = {
  kind: 'fixed' | 'entry_price' | 'current_price' | 'indicator' | 'recent_high' | 'recent_low' | 'atr_offset'
  value?: number
  indicator?: string
  lookback?: number
  operation?: 'none' | 'add' | 'subtract'
  offset_value?: number
  atr_multiplier?: number
}

export type WorkflowVolume = {
  mode: 'open_sizing' | 'fixed' | 'current_ratio' | 'previous_multiple'
  value: number
}

export type WorkflowActionKind = 'open_buy' | 'open_sell' | 'no_action' | 'close_all' | 'close_partial' | 'add_buy' | 'add_sell' | 'modify_sl' | 'modify_tp' | 'hold'

export type WorkflowNode = {
  id: string
  type: 'entry' | 'condition' | 'vision_condition' | 'ai_condition' | 'action'
  label: string
  stage?: WorkflowStageName
  condition?: WorkflowCondition
  instruction?: string
  expected_result?: string
  result_options?: string[]
  lookback?: number
  minimum_confidence?: number
  data_type?: 'kline' | 'screenshot' | 'both'
  action?: {
    kind: WorkflowActionKind
    volume?: WorkflowVolume
    target?: WorkflowPriceTarget
    stop_loss?: WorkflowPriceTarget
    take_profit?: WorkflowPriceTarget
    description?: string
  }
  position?: { x: number; y: number }
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  source_handle: WorkflowBranch
}

export type WorkflowStage = {
  entry_node_id: string
  data_requirements: WorkflowDataRequirements
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type CustomStrategyWorkflow = {
  schema_version: 1
  workflow_version: number
  source_mode: 'visual' | 'ai_generated' | 'legacy_import'
  source_text: { open: string; position: string }
  open: WorkflowStage
  position: WorkflowStage
}
