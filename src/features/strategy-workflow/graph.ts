import type { WorkflowStage } from './types'

/** Remove nodes and edges that can no longer be reached from the stage entry. */
export function pruneWorkflowStage(stage: WorkflowStage): WorkflowStage {
  const nodeIds = new Set(stage.nodes.map((node) => node.id))
  const reachable = new Set<string>()
  const queue = nodeIds.has(stage.entry_node_id) ? [stage.entry_node_id] : []
  while (queue.length) {
    const nodeId = queue.shift()!
    if (reachable.has(nodeId)) continue
    reachable.add(nodeId)
    stage.edges
      .filter((edge) => edge.source === nodeId && nodeIds.has(edge.target))
      .forEach((edge) => queue.push(edge.target))
  }
  return {
    ...stage,
    nodes: stage.nodes.filter((node) => reachable.has(node.id)),
    edges: stage.edges.filter((edge) => reachable.has(edge.source) && reachable.has(edge.target)),
  }
}

