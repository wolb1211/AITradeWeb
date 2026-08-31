import type { CustomStrategyWorkflow, WorkflowStage } from './types'

// New and legacy strategies start with data input only. Trading conditions and
// actions must be added explicitly by the user.
function defaultStage(stage: 'open' | 'position'): WorkflowStage {
  const entryId = `${stage}_entry`
  return {
    entry_node_id: entryId,
    data_requirements: { data_type: 'kline', kline_count: 100, call_mode: 'bar', call_value: 1 },
    nodes: [{ id: entryId, type: 'entry', stage, label: stage === 'open' ? 'EA提供开仓数据' : 'EA提供持仓数据' }],
    edges: [],
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
