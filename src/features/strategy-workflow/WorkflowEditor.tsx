import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
} from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { Bot, Check, GitBranch, Image, Play, Plus, ShieldCheck, Sparkles, X } from 'lucide-react'
import { apiRequest } from '../../lib/api'
import type { CustomStrategyWorkflow, IndicatorCatalogItem, WorkflowDataRequirements, WorkflowNode, WorkflowStage, WorkflowStageName } from './types'
import { NodeConfigPanel } from './NodeConfigPanel'
import { validateWorkflowDraft, type WorkflowValidationIssue } from './validation'
import { pruneWorkflowStage } from './graph'
import { describeWorkflowNode } from './labels'
import '@xyflow/react/dist/style.css'
import './workflow-editor.css'

type EditorNodeData = {
  workflowNode: WorkflowNode
  stageNodes: WorkflowNode[]
  dataRequirements: WorkflowDataRequirements
  selected: boolean
  onSelect: (id: string) => void
  onAdd: (id: string, branch: 'next' | 'yes' | 'no') => void
  readOnly?: boolean
}

function describeEntryData(requirements: WorkflowDataRequirements) {
  if (requirements.data_type === 'screenshot') return 'EA图表截图'
  const kline = `K线 × ${requirements.kline_count}`
  return requirements.data_type === 'both' ? `EA图表截图 + ${kline}` : kline
}

const elk = new ELK()

function nodeClass(type: WorkflowNode['type']) {
  return `workflow-node workflow-node-${type}`
}

function nodeIcon(type: WorkflowNode['type']) {
  if (type === 'entry') return <Play size={16} />
  if (type === 'condition') return <GitBranch size={16} />
  if (type === 'vision_extract') return <Image size={16} />
  if (type === 'ai_condition') return <Bot size={16} />
  return <ShieldCheck size={16} />
}

function StrategyNode({ data }: NodeProps<FlowNode<EditorNodeData>>) {
  const node = data.workflowNode
  const displayLabel = describeWorkflowNode(node, data.stageNodes)
  const condition = node.type === 'condition' || node.type === 'ai_condition'
  const sequential = node.type === 'entry' || node.type === 'vision_extract'
  return <div className={`${nodeClass(node.type)}${data.selected ? ' selected' : ''}`} onClick={() => data.onSelect(node.id)}>
    {node.type !== 'entry' && <Handle type="target" position={Position.Top} isConnectable={false} />}
    <div className="workflow-node-head">{nodeIcon(node.type)}<span>{node.type === 'entry' ? '数据入口' : node.type === 'vision_extract' ? '截图信息提取' : condition ? '判断条件' : '执行动作'}</span></div>
    <strong>{displayLabel}</strong>
    {node.type === 'entry' && <small className="workflow-entry-summary">{describeEntryData(data.dataRequirements)}</small>}
    {node.type === 'vision_extract' && <small>{node.output?.options.map((item) => item.label).join(' / ') || '固定枚举输出'}</small>}
    {node.type === 'ai_condition' && <small>开放语义判断</small>}
    {!data.readOnly && sequential && <>
      <Handle id="next" type="source" position={Position.Bottom} isConnectable={false} />
      <button className="workflow-add-button single" type="button" onClick={(event) => { event.stopPropagation(); data.onAdd(node.id, 'next') }} aria-label="添加下一步"><Plus size={14} /></button>
    </>}
    {condition && <div className="workflow-branches">
      <div><span className="yes"><Check size={12} />是</span><Handle id="yes" type="source" position={Position.Bottom} isConnectable={false} />{!data.readOnly && <button type="button" onClick={(event) => { event.stopPropagation(); data.onAdd(node.id, 'yes') }}><Plus size={13} /></button>}</div>
      <div><span className="no"><X size={12} />否</span><Handle id="no" type="source" position={Position.Bottom} isConnectable={false} />{!data.readOnly && <button type="button" onClick={(event) => { event.stopPropagation(); data.onAdd(node.id, 'no') }}><Plus size={13} /></button>}</div>
    </div>}
  </div>
}

const nodeTypes = { strategy: StrategyNode }

async function layoutStage(workflow: CustomStrategyWorkflow, stageName: WorkflowStageName) {
  const stage = workflow[stageName]
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '46',
      'elk.layered.spacing.nodeNodeBetweenLayers': '72',
    },
    children: stage.nodes.map((node) => ({ id: node.id, width: 220, height: node.type === 'condition' || node.type.includes('condition') ? 132 : node.type === 'entry' || node.type === 'vision_extract' ? 104 : 88 })),
    edges: stage.edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  })
  const positions = new Map((graph.children || []).map((node) => [node.id, { x: node.x || 0, y: node.y || 0 }]))
  enforceBranchSides(stage, positions)
  return positions
}

function enforceBranchSides(stage: WorkflowStage, positions: Map<string, { x: number; y: number }>) {
  const outgoing = new Map<string, Map<string, string>>()
  stage.edges.forEach((edge) => {
    const branches = outgoing.get(edge.source) || new Map<string, string>()
    branches.set(edge.source_handle, edge.target)
    outgoing.set(edge.source, branches)
  })
  const descendants = (start: string) => {
    const result = new Set<string>()
    const queue = [start]
    while (queue.length) {
      const id = queue.shift()!
      if (result.has(id)) continue
      result.add(id)
      outgoing.get(id)?.forEach((target) => queue.push(target))
    }
    return result
  }
  const visited = new Set<string>()
  const queue = [stage.entry_node_id]
  while (queue.length) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    const branches = outgoing.get(nodeId)
    const yesId = branches?.get('yes')
    const noId = branches?.get('no')
    if (yesId && noId && yesId !== noId) {
      const yesPosition = positions.get(yesId)
      const noPosition = positions.get(noId)
      const parentPosition = positions.get(nodeId)
      const yesTree = descendants(yesId)
      const noTree = descendants(noId)
      const shiftExclusive = (tree: Set<string>, sharedTree: Set<string>, shift: number) => {
        if (!shift) return
        tree.forEach((id) => {
          if (sharedTree.has(id)) return
          const position = positions.get(id)
          if (position) positions.set(id, { ...position, x: position.x + shift })
        })
      }
      if (yesPosition && noPosition && yesPosition.x > noPosition.x) {
        const shift = yesPosition.x - noPosition.x
        shiftExclusive(yesTree, noTree, -shift)
        shiftExclusive(noTree, yesTree, shift)
      }
      if (parentPosition) {
        // Keep both child roots at the same distance from their parent. With
        // 220px cards, 140px on each side leaves a visible gap between sibling
        // cards and produces mirrored left/right connectors.
        const branchOffset = 140
        const adjustedYes = positions.get(yesId)
        const adjustedNo = positions.get(noId)
        if (adjustedYes) shiftExclusive(yesTree, noTree, parentPosition.x - branchOffset - adjustedYes.x)
        if (adjustedNo) shiftExclusive(noTree, yesTree, parentPosition.x + branchOffset - adjustedNo.x)
      }
    }
    branches?.forEach((target) => queue.push(target))
  }
}

function upstreamVisionNodes(stage: WorkflowStage, targetId: string) {
  const incoming = new Map<string, string[]>()
  stage.edges.forEach((edge) => incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]))
  const upstream = new Set<string>()
  const queue = [...(incoming.get(targetId) || [])]
  while (queue.length) {
    const id = queue.shift()!
    if (upstream.has(id)) continue
    upstream.add(id)
    queue.push(...(incoming.get(id) || []))
  }
  const canReachTargetWithout = (blockedId: string) => {
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
  return stage.nodes.filter((node) => upstream.has(node.id) && node.type === 'vision_extract' && !canReachTargetWithout(node.id))
}

function conditionReferencesVision(node: WorkflowNode, sourceId: string): boolean {
  if (node.type !== 'condition' || !node.condition) return false
  const visit = (condition: NonNullable<WorkflowNode['condition']>): boolean => (
    condition.left?.kind === 'vision_result' && condition.left.source_node_id === sourceId
  ) || (condition.conditions || []).some(visit)
  return visit(node.condition)
}

function EditorCanvas({ value, stageName, selectedId, onSelect, onAdd, readOnly }: {
  value: CustomStrategyWorkflow
  stageName: WorkflowStageName
  selectedId: string
  onSelect: (id: string) => void
  onAdd: (id: string, branch: 'next' | 'yes' | 'no') => void
  readOnly?: boolean
}) {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  useEffect(() => {
    let active = true
    void layoutStage(value, stageName).then((next) => {
      if (!active) return
      setPositions(next)
    })
    return () => { active = false }
  }, [fitView, stageName, value])
  useEffect(() => {
    if (!nodesInitialized || positions.size === 0) return
    // React Flow updates its internal node bounds one render after our ELK
    // positions arrive. Fit once on the next frame and once more shortly
    // after so the initial view includes the complete graph, not just entry.
    const fit = () => fitView({ padding: 0.35, duration: 280, maxZoom: 1 })
    const frame = window.requestAnimationFrame(() => {
      fit()
      window.requestAnimationFrame(fit)
    })
    const timer = window.setTimeout(fit, 500)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [fitView, nodesInitialized, positions])
  const nodes = useMemo<FlowNode<EditorNodeData>[]>(() => value[stageName].nodes.map((node) => ({
    id: node.id,
    type: 'strategy',
    position: positions.get(node.id) || node.position || { x: 0, y: 0 },
    data: { workflowNode: node, stageNodes: value[stageName].nodes, dataRequirements: value[stageName].data_requirements, selected: selectedId === node.id, onSelect, onAdd, readOnly },
    draggable: !readOnly,
  })), [onAdd, onSelect, positions, readOnly, selectedId, stageName, value])
  const edges = useMemo<FlowEdge[]>(() => value[stageName].edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.source_handle,
    type: 'smoothstep',
    pathOptions: {
      borderRadius: 10,
      offset: 18,
      // Child subtrees are laid out symmetrically, so both branches use the
      // same turn depth and form mirrored connectors.
      stepPosition: 0.5,
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: {
      strokeWidth: 1.6,
      stroke: edge.source_handle === 'yes' ? 'rgba(61, 190, 139, .72)' : edge.source_handle === 'no' ? 'rgba(235, 105, 116, .68)' : undefined,
    },
  })), [stageName, value])
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesConnectable={false} elementsSelectable fitView fitViewOptions={{ padding: 0.35, maxZoom: 1 }} onInit={(instance) => { window.setTimeout(() => instance.fitView({ padding: 0.35, duration: 280, maxZoom: 1 }), 600) }} proOptions={{ hideAttribution: true }}>
    <Background gap={22} size={1} />
    <Controls showInteractive={false} />
  </ReactFlow>
}

export function WorkflowEditor({ value, onChange, onGenerateWithAi, draftStatus, fixedStage, readOnly }: {
  value: CustomStrategyWorkflow
  onChange?: (value: CustomStrategyWorkflow) => void
  onGenerateWithAi?: (stage: WorkflowStageName) => void
  draftStatus?: string
  fixedStage?: WorkflowStageName
  readOnly?: boolean
}) {
  const [activeStage, setActiveStage] = useState<WorkflowStageName>('open')
  const stageName = fixedStage || activeStage
  const [selectedId, setSelectedId] = useState(value.open.entry_node_id)
  const [addTarget, setAddTarget] = useState<{ source: string; branch: 'next' | 'yes' | 'no' } | null>(null)
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[] | null>(null)
  const [indicatorCatalog, setIndicatorCatalog] = useState<IndicatorCatalogItem[]>([])
  const selected = value[stageName].nodes.find((node) => node.id === selectedId)
  const availableVisionNodes = selected ? upstreamVisionNodes(value[stageName], selected.id) : []
  useEffect(() => { setSelectedId(value[stageName].entry_node_id) }, [stageName])
  useEffect(() => {
    let active = true
    apiRequest<{ list: IndicatorCatalogItem[] }>('/api/v1/auth/custom-strategy/indicators')
      .then((result) => { if (active) setIndicatorCatalog(result.list || []) })
      .catch(() => { if (active) setIndicatorCatalog([]) })
    return () => { active = false }
  }, [])
  const updateSelected = useCallback((nextNode: WorkflowNode) => {
    const stageNodes = value[stageName].nodes.map((node) => node.id === selectedId ? nextNode : node)
    const normalizedNode = { ...nextNode, label: describeWorkflowNode(nextNode, stageNodes) }
    onChange?.({
      ...value,
      [stageName]: {
        ...value[stageName],
        nodes: stageNodes.map((node) => node.id === selectedId ? normalizedNode : node),
      },
    })
  }, [onChange, selectedId, stageName, value])
  const updateRequirements = useCallback((requirements: CustomStrategyWorkflow[WorkflowStageName]['data_requirements']) => {
    onChange?.({ ...value, [stageName]: { ...value[stageName], data_requirements: requirements } })
  }, [onChange, stageName, value])
  const deleteSelected = useCallback(() => {
    if (!selected || selected.type === 'entry') return
    const stage = value[stageName]
    if (selected.type === 'vision_extract' && stage.nodes.some((node) => conditionReferencesVision(node, selected.id))) {
      window.alert('该截图输出已被后续判断条件使用，请先删除或修改相关判断。')
      return
    }
    if (selected.type === 'action') {
      const nextStage = pruneWorkflowStage({
        ...stage,
        nodes: stage.nodes.filter((node) => node.id !== selected.id),
        edges: stage.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id),
      })
      onChange?.({ ...value, [stageName]: nextStage })
      setSelectedId(stage.entry_node_id)
      return
    }
    const outgoing = stage.edges.filter((edge) => edge.source === selected.id)
    const fallback = outgoing.find((edge) => edge.source_handle === 'no')?.target || outgoing[0]?.target
    const incoming = stage.edges.filter((edge) => edge.target === selected.id)
    if (!fallback) {
      const nextStage = pruneWorkflowStage({
        ...stage,
        nodes: stage.nodes.filter((node) => node.id !== selected.id),
        edges: stage.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id),
      })
      onChange?.({ ...value, [stageName]: nextStage })
      setSelectedId(incoming[0]?.source || stage.entry_node_id)
      return
    }
    const removedIds = new Set(outgoing.map((edge) => edge.id))
    const edges = stage.edges
      .filter((edge) => !removedIds.has(edge.id))
      .map((edge) => incoming.some((item) => item.id === edge.id) ? { ...edge, target: fallback } : edge)
    const nextStage = pruneWorkflowStage({ ...stage, nodes: stage.nodes.filter((node) => node.id !== selected.id), edges })
    onChange?.({ ...value, [stageName]: nextStage })
    setSelectedId(stage.entry_node_id)
  }, [onChange, selected, stageName, value])
  const addNext = useCallback((source: string, branch: 'next' | 'yes' | 'no') => setAddTarget({ source, branch }), [])
  const insertNode = useCallback((type: 'condition' | 'vision_extract' | 'ai_condition' | 'action') => {
    if (!addTarget) return
    const stage = value[stageName]
    const currentEdge = stage.edges.find((edge) => edge.source === addTarget.source && edge.source_handle === addTarget.branch)
    const id = `${stageName}_${type}_${Date.now()}`
    let node: WorkflowNode
    if (type === 'condition') node = {
      id, type, label: '请选择条件',
    }
    else if (type === 'vision_extract') node = {
      id, type, label: '截图提取：截图识别结果', instruction: '请描述需要从EA图表截图中识别的内容，以及每种结果的明确特征',
      output: {
        key: `vision_${Date.now().toString(36)}`, label: '截图识别结果', type: 'enum',
        options: [
          { value: 'long', label: '多头信号' }, { value: 'short', label: '空头信号' },
          { value: 'none', label: '无信号' }, { value: 'uncertain', label: '无法确认' },
        ],
        fallback: 'uncertain',
      },
      lookback: 3, minimum_confidence: 0,
    }
    else if (type === 'ai_condition') node = {
      id, type, label: 'AI判断规则', instruction: '请描述需要AI判断的开放条件', data_type: 'kline',
    }
    else node = {
      id, type, label: stageName === 'open' ? '不操作' : '保持持仓',
      action: { kind: stageName === 'open' ? 'no_action' : 'hold' },
    }
    let nodes = [...stage.nodes, node]
    let edges = currentEdge
      ? stage.edges.map((edge) => edge.id === currentEdge.id ? { ...currentEdge, target: id } : edge)
      : [...stage.edges, { id: `${id}_incoming`, source: addTarget.source, target: id, source_handle: addTarget.branch }]
    if (type === 'action') {
      // The action ends this branch. Any old subtree that is no longer used
      // by another branch is removed by pruneWorkflowStage below.
    } else if (currentEdge && type === 'vision_extract') {
      edges = [...edges, { id: `${id}_next`, source: id, target: currentEdge.target, source_handle: 'next' }]
    } else if (currentEdge) {
      edges = [...edges,
        { id: `${id}_yes`, source: id, target: currentEdge.target, source_handle: 'yes' },
        { id: `${id}_no`, source: id, target: currentEdge.target, source_handle: 'no' },
      ]
    }
    const nextStage = pruneWorkflowStage({ ...stage, nodes, edges })
    onChange?.({ ...value, [stageName]: nextStage })
    setSelectedId(id)
    setAddTarget(null)
  }, [addTarget, onChange, stageName, value])
  return <div className={`workflow-editor-shell${readOnly ? ' workflow-editor-readonly' : ''}`}>
    <div className="workflow-editor-toolbar">
      {!fixedStage && <div className="workflow-stage-tabs">
        <button type="button" className={stageName === 'open' ? 'active' : ''} onClick={() => setActiveStage('open')}>开仓流程</button>
        <button type="button" className={stageName === 'position' ? 'active' : ''} onClick={() => setActiveStage('position')}>持仓风控</button>
      </div>}
      {fixedStage && <strong className="workflow-stage-caption">{fixedStage === 'open' ? '开仓流程图' : '持仓风控流程图'}</strong>}
      {!readOnly && <div className="workflow-toolbar-actions">{draftStatus && <span className="workflow-draft-status"><Check size={13} />{draftStatus}</span>}<button type="button" onClick={() => setValidationIssues(validateWorkflowDraft(value).filter((issue) => !fixedStage || issue.stage === fixedStage))}><Check size={16} />检查{fixedStage === 'open' ? '开仓' : fixedStage === 'position' ? '风控' : ''}流程</button><button className="workflow-ai-generate" type="button" onClick={() => onGenerateWithAi?.(stageName)}><Sparkles size={16} />AI帮我生成</button></div>}
    </div>
    <div className="workflow-editor-body">
      <div className="workflow-canvas"><ReactFlowProvider><EditorCanvas value={value} stageName={stageName} selectedId={selectedId} onSelect={setSelectedId} onAdd={addNext} readOnly={readOnly} /></ReactFlowProvider></div>
      {!readOnly && <NodeConfigPanel node={selected} nodes={value[stageName].nodes} visionSources={availableVisionNodes} indicatorCatalog={indicatorCatalog} stage={stageName} requirements={value[stageName].data_requirements} onChange={updateSelected} onRequirementsChange={updateRequirements} onDelete={deleteSelected} />}
    </div>
    {addTarget && <div className="workflow-add-menu" role="dialog" aria-label="添加流程节点">
      <div><strong>添加下一步</strong><button type="button" onClick={() => setAddTarget(null)}><X size={16} /></button></div>
      <button type="button" onClick={() => insertNode('condition')}><GitBranch size={17} /><span><strong>判断条件</strong><small>指标、价格、K线或持仓数据</small></span></button>
      <button type="button" onClick={() => insertNode('vision_extract')}><Image size={17} /><span><strong>截图信息提取</strong><small>从EA图表截图输出固定枚举结果</small></span></button>
      <button type="button" onClick={() => insertNode('ai_condition')}><Bot size={17} /><span><strong>AI判断规则</strong><small>处理暂时无法结构化的开放条件</small></span></button>
      <button type="button" onClick={() => insertNode('action')}><ShieldCheck size={17} /><span><strong>执行动作</strong><small>设置开仓、平仓或修改止损</small></span></button>
    </div>}
    {validationIssues && <div className="workflow-validation-dialog" role="dialog" aria-label="流程检查结果"><div><span className={validationIssues.length ? 'error' : 'success'}>{validationIssues.length ? <X size={18} /> : <Check size={18} />}</span><div><strong>{validationIssues.length ? `发现 ${validationIssues.length} 个问题` : '流程检查通过'}</strong><small>{validationIssues.length ? '请修改后再次检查' : fixedStage ? `${fixedStage === 'open' ? '开仓' : '风控'}流程结构完整` : '开仓和持仓风控流程结构完整'}</small></div><button type="button" onClick={() => setValidationIssues(null)}><X size={17} /></button></div>{validationIssues.length > 0 && <ul>{validationIssues.map((issue, index) => <li key={`${issue.stage}-${issue.nodeId}-${index}`}><b>{issue.stage === 'open' ? '开仓' : '风控'}</b><span>{issue.message}</span></li>)}</ul>}<button className="button button-primary" type="button" onClick={() => setValidationIssues(null)}>知道了</button></div>}
  </div>
}
