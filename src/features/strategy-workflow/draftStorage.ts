import type { CustomStrategyWorkflow } from './types'
import { pruneWorkflowStage } from './graph'

type WorkflowDraft = {
  schema_version: 1
  saved_at: string
  workflow: CustomStrategyWorkflow
}

const PREFIX = 'gainlab_ai_trader:workflow_draft'

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
        open: pruneWorkflowStage(value.workflow.open),
        position: pruneWorkflowStage(value.workflow.position),
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
