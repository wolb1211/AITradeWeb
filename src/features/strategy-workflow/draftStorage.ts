import type { CustomStrategyWorkflow, WorkflowNode, WorkflowStage } from './types'
import { pruneWorkflowStage } from './graph'

type WorkflowDraft = {
  schema_version: 1
  saved_at: string
  workflow: CustomStrategyWorkflow
}

const PREFIX = 'gainlab_ai_trader:workflow_draft'
const SETTINGS_PREFIX = 'gainlab_ai_trader:strategy_settings_draft'

export type StrategySettingsDraftValue = {
  strategyName: string
  strategyStatus: string
  mtLogin: string
  eaDescription: string
  sizeMode: 'fixed' | 'risk'
  fixedVolume: string
  riskBaseMode: 'fixed_loss' | 'balance_percent'
  riskAmount: string
  riskPercent: string
  maxPositions: string
  allowAdd: boolean
}

type StrategySettingsDraft = {
  schema_version: 1
  saved_at: string
  settings: StrategySettingsDraftValue
}

const legacyResultLabels: Record<string, string> = {
  matched: '满足识别条件', not_matched: '不满足识别条件', bullish: '多头信号', bearish: '空头信号',
  long: '多头信号', short: '空头信号', none: '无信号', uncertain: '无法确认',
}

function migrateLegacyVisionNodes(stage: WorkflowStage): WorkflowStage {
  let nodes = [...stage.nodes]
  let edges = [...stage.edges]
  const legacyNodes = nodes.filter((node) => (node as unknown as { type: string }).type === 'vision_condition')
  legacyNodes.forEach((rawNode, legacyIndex) => {
    const legacy = rawNode as unknown as WorkflowNode & { expected_result?: string; result_options?: string[] }
    const rawOptions = Array.isArray(legacy.result_options) ? legacy.result_options : ['matched', 'not_matched']
    const values = [...new Set([...rawOptions.map((item) => String(item).replace(/[^A-Za-z0-9_-]/g, '_')), 'uncertain'])]
      .map((item, index) => /^[A-Za-z]/.test(item) ? item : `result_${index + 1}_${item}`)
    const expected = String(legacy.expected_result || values[0])
    const expectedValue = values.includes(expected) ? expected : values[0]
    const usedNodeIds = new Set(nodes.map((item) => item.id))
    let conditionId = `vr_${legacyIndex}_${legacy.id}`.slice(0, 64)
    let idAttempt = 1
    while (usedNodeIds.has(conditionId)) conditionId = `vr_${legacyIndex}_${idAttempt++}_${legacy.id}`.slice(0, 64)
    const outputKey = `vision_${legacy.id}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)
    const extractNode: WorkflowNode = {
      id: legacy.id, type: 'vision_extract', label: '截图提取：截图识别结果',
      instruction: legacy.instruction, lookback: legacy.lookback || 3, minimum_confidence: legacy.minimum_confidence || 0,
      output: {
        key: outputKey, label: '截图识别结果', type: 'enum', fallback: 'uncertain',
        options: values.map((value) => ({ value, label: legacyResultLabels[value] || value })),
      },
    }
    const conditionNode: WorkflowNode = {
      id: conditionId, type: 'condition', label: `截图识别结果等于${legacyResultLabels[expectedValue] || expectedValue}`,
      condition: {
        kind: 'vision_result', left: { kind: 'vision_result', source_node_id: legacy.id, output_key: outputKey },
        operator: 'eq', right: { kind: 'constant', value: expectedValue },
      },
    }
    nodes = [...nodes.filter((node) => node.id !== legacy.id), extractNode, conditionNode]
    const oldOutgoing = edges.filter((edge) => edge.source === legacy.id)
    edges = [
      ...edges.filter((edge) => edge.source !== legacy.id),
      { id: `vn_${legacyIndex}_${legacy.id}`.slice(0, 64), source: legacy.id, target: conditionId, source_handle: 'next' },
      ...oldOutgoing.map((edge) => ({ ...edge, source: conditionId })),
    ]
  })
  return { ...stage, nodes, edges }
}

export function workflowDraftKey(userId: string, deploymentId = 'new') {
  return `${PREFIX}:${userId || 'anonymous'}:${deploymentId || 'new'}`
}

export function loadWorkflowDraft(key: string): WorkflowDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null') as WorkflowDraft | null
    if (!value || value.schema_version !== 1 || value.workflow?.schema_version !== 1) return null
    if (!value.workflow.open || !value.workflow.position) return null
    return {
      ...value,
      workflow: {
        ...value.workflow,
        open: pruneWorkflowStage(migrateLegacyVisionNodes(value.workflow.open)),
        position: pruneWorkflowStage(migrateLegacyVisionNodes(value.workflow.position)),
      },
    }
  } catch {
    return null
  }
}

export function saveWorkflowDraft(key: string, workflow: CustomStrategyWorkflow) {
  const draft: WorkflowDraft = { schema_version: 1, saved_at: new Date().toISOString(), workflow }
  localStorage.setItem(key, JSON.stringify(draft))
  return draft
}

export function clearWorkflowDraft(key: string) {
  localStorage.removeItem(key)
}

export function strategySettingsDraftKey(userId: string, deploymentId = 'new') {
  return `${SETTINGS_PREFIX}:${userId || 'anonymous'}:${deploymentId || 'new'}`
}

export function loadStrategySettingsDraft(key: string): StrategySettingsDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null') as StrategySettingsDraft | null
    if (!value || value.schema_version !== 1 || !value.settings) return null
    return value
  } catch {
    return null
  }
}

export function saveStrategySettingsDraft(key: string, settings: StrategySettingsDraftValue) {
  const draft: StrategySettingsDraft = { schema_version: 1, saved_at: new Date().toISOString(), settings }
  localStorage.setItem(key, JSON.stringify(draft))
  return draft
}

export function clearStrategySettingsDraft(key: string) {
  localStorage.removeItem(key)
}
