import type { CustomStrategyWorkflow, WorkflowStage } from './types'

function defaultStage(stage: 'open' | 'position'): WorkflowStage {
  const entryId = `${stage}_entry`
  const conditionId = `${stage}_condition_1`
  const yesId = `${stage}_action_yes`
  const noId = `${stage}_action_no`
  const isOpen = stage === 'open'
  return {
    entry_node_id: entryId,
    data_requirements: { data_type: 'kline', kline_count: 100, call_mode: 'bar', call_value: 1 },
    nodes: [
      { id: entryId, type: 'entry', stage, label: isOpen ? '开仓分析' : '持仓风控' },
      {
        id: conditionId,
        type: 'condition',
        label: isOpen ? 'EMA5 最近3根上穿 EMA30？' : '盈利达到 0.5 ATR？',
        condition: isOpen ? {
          kind: 'cross',
          description: '最近3根已收盘K线内，EMA5上穿EMA30',
          left: { kind: 'indicator', indicator: 'ema', alias: 'ema5', source: 'close', params: { length: 5 }, offset: -1 },
          right: { kind: 'indicator', indicator: 'ema', alias: 'ema30', source: 'close', params: { length: 30 }, offset: -1 },
          direction: 'above',
          lookback: 3,
        } : {
          kind: 'atr_distance',
          description: '持仓盈利距离达到0.5 ATR',
          left: { kind: 'position', name: 'favorable_move' },
          operator: 'gte',
          right: { kind: 'indicator', indicator: 'atr', alias: 'atr14', params: { length: 14 }, multiplier: 0.5 },
          lookback: 1,
        },
      },
      {
        id: yesId,
        type: 'action',
        label: isOpen ? '开多' : '移动止损至保本',
        action: isOpen
          ? { kind: 'open_buy' }
          : { kind: 'modify_sl', target: { kind: 'entry_price', operation: 'none' } },
      },
      { id: noId, type: 'action', label: isOpen ? '不操作' : '保持持仓', action: { kind: isOpen ? 'no_action' : 'hold' } },
    ],
    edges: [
      { id: `${stage}_edge_1`, source: entryId, target: conditionId, source_handle: 'next' },
      { id: `${stage}_edge_2`, source: conditionId, target: yesId, source_handle: 'yes' },
      { id: `${stage}_edge_3`, source: conditionId, target: noId, source_handle: 'no' },
    ],
  }
}

export function createDefaultWorkflow(): CustomStrategyWorkflow {
  return {
    schema_version: 1,
    workflow_version: 1,
    source_mode: 'visual',
    source_text: { open: '', position: '' },
    open: defaultStage('open'),
    position: defaultStage('position'),
  }
}
