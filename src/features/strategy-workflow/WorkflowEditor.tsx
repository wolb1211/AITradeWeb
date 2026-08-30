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
import type { CustomStrategyWorkflow, WorkflowNode, WorkflowStageName } from './types'
import { NodeConfigPanel } from './NodeConfigPanel'
import { validateWorkflowDraft, type WorkflowValidationIssue } from './validation'
import { pruneWorkflowStage } from './graph'
import '@xyflow/react/dist/style.css'
import './workflow-editor.css'

type EditorNodeData = {
  workflowNode: WorkflowNode
  selected: boolean
  onSelect: (id: string) => void
  onAdd: (id: string, branch: 'next' | 'yes' | 'no') => void
}

const elk = new ELK()

function nodeClass(type: WorkflowNode['type']) {
  return `workflow-node workflow-node-${type}`
}

function nodeIcon(type: WorkflowNode['type']) {
  if (type === 'entry') return <Play size={16} />
  if (type === 'condition') return <GitBranch size={16} />
  if (type === 'vision_condition') return <Image size={16} />
  if (type === 'ai_condition') return <Bot size={16} />
  return <ShieldCheck size={16} />
}

function StrategyNode({ data }: NodeProps<FlowNode<EditorNodeData>>) {
  const node = data.workflowNode
  const condition = node.type === 'condition' || node.type === 'vision_condition' || node.type === 'ai_condition'
  return <div className={`${nodeClass(node.type)}${data.selected ? ' selected' : ''}`} onClick={() => data.onSelect(node.id)}>
    {node.type !== 'entry' && <Handle type="target" position={Position.Top} isConnectable={false} />}
    <div className="workflow-node-head">{nodeIcon(node.type)}<span>{node.type === 'entry' ? '流程入口' : condition ? '判断条件' : '执行动作'}</span></div>
    <strong>{node.label}</strong>
    {node.type === 'vision_condition' && <small>AI截图识别</small>}
    {node.type === 'ai_condition' && <small>开放语义判断</small>}
    {node.type === 'entry' && <>
      <Handle id="next" type="source" position={Position.Bottom} isConnectable={false} />
      <button className="workflow-add-button single" type="button" onClick={(event) => { event.stopPropagation(); data.onAdd(node.id, 'next') }} aria-label="添加下一步"><Plus size={14} /></button>
    </>}
    {condition && <div className="workflow-branches">
      <div><span className="yes"><Check size={12} />是</span><Handle id="yes" type="source" position={Position.Bottom} isConnectable={false} /><button type="button" onClick={(event) => { event.stopPropagation(); data.onAdd(node.id, 'yes') }}><Plus size={13} /></button></div>
      <div><span className="no"><X size={12} />否</span><Handle id="no" type="source" position={Position.Bottom} isConnectable={false} /><button type="button" onClick={(event) => { event.stopPropagation(); data.onAdd(node.id, 'no') }}><Plus size={13} /></button></div>
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
    children: stage.nodes.map((node) => ({ id: node.id, width: 220, height: node.type === 'condition' || node.type.includes('condition') ? 132 : 88 })),
    edges: stage.edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  })
  return new Map((graph.children || []).map((node) => [node.id, { x: node.x || 0, y: node.y || 0 }]))
}

function EditorCanvas({ value, stageName, selectedId, onSelect, onAdd }: {
  value: CustomStrategyWorkflow
  stageName: WorkflowStageName
  selectedId: string
  onSelect: (id: string) => void
  onAdd: (id: string, branch: 'next' | 'yes' | 'no') => void
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
    const frame = window.requestAnimationFrame(() => fitView({ padding: 0.22, duration: 280 }))
    return () => window.cancelAnimationFrame(frame)
  }, [fitView, nodesInitialized, positions])
  const nodes = useMemo<FlowNode<EditorNodeData>[]>(() => value[stageName].nodes.map((node) => ({
    id: node.id,
    type: 'strategy',
    position: positions.get(node.id) || node.position || { x: 0, y: 0 },
    data: { workflowNode: node, selected: selectedId === node.id, onSelect, onAdd },
    draggable: true,
  })), [onAdd, onSelect, positions, selectedId, stageName, value])
  const edges = useMemo<FlowEdge[]>(() => value[stageName].edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.source_handle,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { strokeWidth: 1.6 },
  })), [stageName, value])
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesConnectable={false} elementsSelectable fitView proOptions={{ hideAttribution: true }}>
    <Background gap={22} size={1} />
    <Controls showInteractive={false} />
  </ReactFlow>
}

export function WorkflowEditor({ value, onChange, onGenerateWithAi, draftStatus }: {
  value: CustomStrategyWorkflow
  onChange: (value: CustomStrategyWorkflow) => void
  onGenerateWithAi?: () => void
  draftStatus?: string
}) {
  const [stageName, setStageName] = useState<WorkflowStageName>('open')
  const [selectedId, setSelectedId] = useState(value.open.entry_node_id)
  const [addTarget, setAddTarget] = useState<{ source: string; branch: 'next' | 'yes' | 'no' } | null>(null)
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[] | null>(null)
  const selected = value[stageName].nodes.find((node) => node.id === selectedId)
  useEffect(() => { setSelectedId(value[stageName].entry_node_id) }, [stageName])
  const updateSelected = useCallback((nextNode: WorkflowNode) => {
    onChange({
      ...value,
      [stageName]: {
        ...value[stageName],
        nodes: value[stageName].nodes.map((node) => node.id === selectedId ? nextNode : node),
      },
    })
  }, [onChange, selectedId, stageName, value])
  const updateRequirements = useCallback((requirements: CustomStrategyWorkflow[WorkflowStageName]['data_requirements']) => {
    onChange({ ...value, [stageName]: { ...value[stageName], data_requirements: requirements } })
  }, [onChange, stageName, value])
  const deleteSelected = useCallback(() => {
    if (!selected || selected.type === 'entry') return
    const stage = value[stageName]
    if (selected.type === 'action') {
      const nextStage = pruneWorkflowStage({
        ...stage,
        nodes: stage.nodes.filter((node) => node.id !== selected.id),
        edges: stage.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id),
      })
      onChange({ ...value, [stageName]: nextStage })
      setSelectedId(stage.entry_node_id)
      return
    }
    const outgoing = stage.edges.filter((edge) => edge.source === selected.id)
    const fallback = outgoing.find((edge) => edge.source_handle === 'no')?.target || outgoing[0]?.target
    if (!fallback) return
    const incoming = stage.edges.filter((edge) => edge.target === selected.id)
    const removedIds = new Set(outgoing.map((edge) => edge.id))
    const edges = stage.edges
      .filter((edge) => !removedIds.has(edge.id))
      .map((edge) => incoming.some((item) => item.id === edge.id) ? { ...edge, target: fallback } : edge)
    const nextStage = pruneWorkflowStage({ ...stage, nodes: stage.nodes.filter((node) => node.id !== selected.id), edges })
    onChange({ ...value, [stageName]: nextStage })
    setSelectedId(stage.entry_node_id)
  }, [onChange, selected, stageName, value])
  const addNext = useCallback((source: string, branch: 'next' | 'yes' | 'no') => setAddTarget({ source, branch }), [])
  const insertNode = useCallback((type: 'condition' | 'vision_condition' | 'ai_condition' | 'action') => {
    if (!addTarget) return
    const stage = value[stageName]
    const currentEdge = stage.edges.find((edge) => edge.source === addTarget.source && edge.source_handle === addTarget.branch)
    const id = `${stageName}_${type}_${Date.now()}`
    let node: WorkflowNode
    if (type === 'condition') node = {
      id, type, label: '新判断条件',
      condition: {
        kind: 'comparison', description: '请设置判断条件',
        left: { kind: 'market_price', name: 'bid' }, operator: 'gt', right: { kind: 'constant', value: 0 },
      },
    }
    else if (type === 'vision_condition') node = {
      id, type, label: '截图识别规则', instruction: '请描述需要从最新截图中识别的信号',
      expected_result: 'matched', result_options: ['matched', 'not_matched'], lookback: 3, minimum_confidence: 0,
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
    } else if (currentEdge) {
      edges = [...edges,
        { id: `${id}_yes`, source: id, target: currentEdge.target, source_handle: 'yes' },
        { id: `${id}_no`, source: id, target: currentEdge.target, source_handle: 'no' },
      ]
    }
    const nextStage = pruneWorkflowStage({ ...stage, nodes, edges })
    onChange({ ...value, [stageName]: nextStage })
    setSelectedId(id)
    setAddTarget(null)
  }, [addTarget, onChange, stageName, value])
  return <div className="workflow-editor-shell">
    <div className="workflow-editor-toolbar">
      <div className="workflow-stage-tabs">
        <button type="button" className={stageName === 'open' ? 'active' : ''} onClick={() => setStageName('open')}>开仓流程</button>
        <button type="button" className={stageName === 'position' ? 'active' : ''} onClick={() => setStageName('position')}>持仓风控</button>
      </div>
      <div className="workflow-toolbar-actions">{draftStatus && <span className="workflow-draft-status"><Check size={13} />{draftStatus}</span>}<button type="button" onClick={() => setValidationIssues(validateWorkflowDraft(value))}><Check size={16} />检查流程</button><button className="workflow-ai-generate" type="button" onClick={onGenerateWithAi}><Sparkles size={16} />AI帮我生成</button></div>
    </div>
    <div className="workflow-editor-body">
      <div className="workflow-canvas"><ReactFlowProvider><EditorCanvas value={value} stageName={stageName} selectedId={selectedId} onSelect={setSelectedId} onAdd={addNext} /></ReactFlowProvider></div>
      <NodeConfigPanel node={selected} stage={stageName} requirements={value[stageName].data_requirements} onChange={updateSelected} onRequirementsChange={updateRequirements} onDelete={deleteSelected} />
    </div>
    {addTarget && <div className="workflow-add-menu" role="dialog" aria-label="添加流程节点">
      <div><strong>添加下一步</strong><button type="button" onClick={() => setAddTarget(null)}><X size={16} /></button></div>
      <button type="button" onClick={() => insertNode('condition')}><GitBranch size={17} /><span><strong>判断条件</strong><small>指标、价格、K线或持仓数据</small></span></button>
      <button type="button" onClick={() => insertNode('vision_condition')}><Image size={17} /><span><strong>截图识别规则</strong><small>识别图表中的自定义视觉信号</small></span></button>
      <button type="button" onClick={() => insertNode('ai_condition')}><Bot size={17} /><span><strong>AI判断规则</strong><small>处理暂时无法结构化的开放条件</small></span></button>
      <button type="button" onClick={() => insertNode('action')}><ShieldCheck size={17} /><span><strong>执行动作</strong><small>设置开仓、平仓或修改止损</small></span></button>
    </div>}
    {validationIssues && <div className="workflow-validation-dialog" role="dialog" aria-label="流程检查结果"><div><span className={validationIssues.length ? 'error' : 'success'}>{validationIssues.length ? <X size={18} /> : <Check size={18} />}</span><div><strong>{validationIssues.length ? `发现 ${validationIssues.length} 个问题` : '流程检查通过'}</strong><small>{validationIssues.length ? '请修改后再次检查' : '开仓和持仓风控流程结构完整'}</small></div><button type="button" onClick={() => setValidationIssues(null)}><X size={17} /></button></div>{validationIssues.length > 0 && <ul>{validationIssues.map((issue, index) => <li key={`${issue.stage}-${issue.nodeId}-${index}`}><b>{issue.stage === 'open' ? '开仓' : '风控'}</b><span>{issue.message}</span></li>)}</ul>}<button className="button button-primary" type="button" onClick={() => setValidationIssues(null)}>知道了</button></div>}
  </div>
}
