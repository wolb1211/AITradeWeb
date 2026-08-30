import type { CustomStrategyWorkflow, WorkflowNode, WorkflowStageName } from './types'

export type WorkflowValidationIssue = { stage: WorkflowStageName; nodeId?: string; message: string }

export function validateWorkflowDraft(workflow: CustomStrategyWorkflow): WorkflowValidationIssue[] {
  return (['open', 'position'] as WorkflowStageName[]).flatMap((stageName) => validateStage(workflow, stageName))
}

function validateStage(workflow: CustomStrategyWorkflow, stageName: WorkflowStageName): WorkflowValidationIssue[] {
  const stage = workflow[stageName]
  const issues: WorkflowValidationIssue[] = []
  const nodes = new Map(stage.nodes.map((node) => [node.id, node]))
  const canReachWithout = (targetId: string, blockedId: string) => {
    const visited = new Set<string>()
    const queue = stage.entry_node_id === blockedId ? [] : [stage.entry_node_id]
    while (queue.length) {
      const id = queue.shift()!
      if (id === blockedId || visited.has(id)) continue
      if (id === targetId) return true
      visited.add(id)
      stage.edges.filter((edge) => edge.source === id && edge.target !== blockedId).forEach((edge) => queue.push(edge.target))
    }
    return false
  }
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
    if ((node.type === 'entry' || node.type === 'vision_extract') && (!handles.has('next') || handles.size !== 1)) issues.push({ stage: stageName, nodeId: node.id, message: `${node.type === 'entry' ? '入口' : '截图信息提取节点'}必须连接一个下一步` })
    if (isCondition(node) && (!handles.has('yes') || !handles.has('no') || handles.size !== 2)) issues.push({ stage: stageName, nodeId: node.id, message: '判断节点必须同时连接“是”和“否”分支' })
    if (node.type === 'action' && handles.size > 0) issues.push({ stage: stageName, nodeId: node.id, message: '动作执行后应结束，不能继续连接节点' })
    if (node.type === 'condition' && !node.condition) issues.push({ stage: stageName, nodeId: node.id, message: '请选择并配置判断条件' })
    if (node.type === 'vision_extract') {
      if ((node.instruction || '').trim().length < 5) issues.push({ stage: stageName, nodeId: node.id, message: '请完整填写截图识别要求' })
      if (!(node.output?.label || '').trim()) issues.push({ stage: stageName, nodeId: node.id, message: '请填写截图输出名称' })
      const values = node.output?.options.map((item) => item.value) || []
      const labels = node.output?.options.map((item) => item.label.trim()) || []
      if (values.length < 2 || labels.some((item) => !item)) issues.push({ stage: stageName, nodeId: node.id, message: '截图输出至少需要两个有效结果' })
      if (new Set(values).size !== values.length || new Set(labels).size !== labels.length) issues.push({ stage: stageName, nodeId: node.id, message: '截图输出结果不能重复' })
      if (!values.includes(node.output?.fallback || '')) issues.push({ stage: stageName, nodeId: node.id, message: '截图输出缺少“无法确认”兜底结果' })
    }
    if (node.type === 'condition' && node.condition?.kind === 'vision_result') {
      const source = nodes.get(node.condition.left?.source_node_id || '')
      const allowed = source?.type === 'vision_extract' ? source.output?.options.map((item) => item.value) || [] : []
      if (!source || source.type !== 'vision_extract') issues.push({ stage: stageName, nodeId: node.id, message: '引用的截图信息提取节点不存在' })
      else if (canReachWithout(node.id, source.id)) issues.push({ stage: stageName, nodeId: node.id, message: '该判断存在未经过截图信息提取的路径' })
      else if (!allowed.includes(String(node.condition.right?.value ?? ''))) issues.push({ stage: stageName, nodeId: node.id, message: '请选择截图节点允许输出的识别结果' })
    }
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
  return node.type === 'condition' || node.type === 'ai_condition'
}
