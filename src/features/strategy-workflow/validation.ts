import type { CustomStrategyWorkflow, WorkflowNode, WorkflowStageName } from './types'

export type WorkflowValidationIssue = { stage: WorkflowStageName; nodeId?: string; message: string }

export function validateWorkflowDraft(workflow: CustomStrategyWorkflow): WorkflowValidationIssue[] {
  return (['open', 'position'] as WorkflowStageName[]).flatMap((stageName) => validateStage(workflow, stageName))
}

function validateStage(workflow: CustomStrategyWorkflow, stageName: WorkflowStageName): WorkflowValidationIssue[] {
  const stage = workflow[stageName]
  const issues: WorkflowValidationIssue[] = []
  const nodes = new Map(stage.nodes.map((node) => [node.id, node]))
  const entry = nodes.get(stage.entry_node_id)
  if (!entry || entry.type !== 'entry') issues.push({ stage: stageName, message: '缺少有效的流程入口' })
  const outgoing = new Map<string, Set<string>>()
  stage.edges.forEach((edge) => {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) issues.push({ stage: stageName, message: `连线 ${edge.id} 指向了不存在的节点` })
    const handles = outgoing.get(edge.source) || new Set<string>()
    if (handles.has(edge.source_handle)) issues.push({ stage: stageName, nodeId: edge.source, message: '同一个分支存在重复连线' })
    handles.add(edge.source_handle)
    outgoing.set(edge.source, handles)
  })
  stage.nodes.forEach((node) => {
    if (!node.label.trim()) issues.push({ stage: stageName, nodeId: node.id, message: '节点名称不能为空' })
    const handles = outgoing.get(node.id) || new Set<string>()
    if (node.type === 'entry' && (!handles.has('next') || handles.size !== 1)) issues.push({ stage: stageName, nodeId: node.id, message: '入口必须连接一个下一步' })
    if (isCondition(node) && (!handles.has('yes') || !handles.has('no') || handles.size !== 2)) issues.push({ stage: stageName, nodeId: node.id, message: '判断节点必须同时连接“是”和“否”分支' })
    if (node.type === 'action' && handles.size > 0) issues.push({ stage: stageName, nodeId: node.id, message: '动作执行后应结束，不能继续连接节点' })
    if (node.type === 'condition' && !node.condition) issues.push({ stage: stageName, nodeId: node.id, message: '请选择并配置判断条件' })
    if (node.type === 'vision_condition' && (node.instruction || '').trim().length < 5) issues.push({ stage: stageName, nodeId: node.id, message: '请完整填写截图识别要求' })
    if (node.type === 'ai_condition' && (node.instruction || '').trim().length < 5) issues.push({ stage: stageName, nodeId: node.id, message: '请完整填写AI判断要求' })
  })
  const reachable = new Set<string>()
  const queue = entry ? [entry.id] : []
  while (queue.length) {
    const id = queue.shift()!
    if (reachable.has(id)) continue
    reachable.add(id)
    stage.edges.filter((edge) => edge.source === id).forEach((edge) => queue.push(edge.target))
  }
  const unreachable = stage.nodes.filter((node) => !reachable.has(node.id))
  if (unreachable.length) issues.push({ stage: stageName, message: `存在未连接节点：${unreachable.map((node) => node.label || node.id).join('、')}` })
  return issues
}

function isCondition(node: WorkflowNode) {
  return node.type === 'condition' || node.type === 'vision_condition' || node.type === 'ai_condition'
}
