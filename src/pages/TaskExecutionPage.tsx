import { Background, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, RefreshCcw, RotateCcw, SkipForward, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FlowTaskStatusPill } from '../components/StatusPill'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import { buildExecutionGraph, getExecutableActions, type ExecutableAction } from '../lib/flowExecution'
import { useOrderTaskDetail } from '../lib/useOrderTaskDetail'

export function TaskExecutionPage() {
  return (
    <ReactFlowProvider>
      <TaskExecutionWorkspace />
    </ReactFlowProvider>
  )
}

function TaskExecutionWorkspace() {
  const navigate = useNavigate()
  const taskId = Number(useParams().id)
  const { task, loading, error, refresh } = useOrderTaskDetail({
    taskId: Number.isFinite(taskId) ? taskId : null,
    fetchTask: api.getFlowTask,
    pollIntervalMs: 1500,
  })
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const graph = useMemo(() => buildExecutionGraph(task), [task])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const activeSelectedNodeId =
    selectedNodeId && graph.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : graph.nodes[0]?.id ?? null
  const selectedNode = graph.nodes.find((node) => node.id === activeSelectedNodeId) ?? graph.nodes[0] ?? null
  const selectedDetail = selectedNode?.data.detail ?? null
  const actionSet = useMemo(() => getExecutableActions(task, selectedDetail), [task, selectedDetail])

  async function runFlowAction(action: ExecutableAction) {
    if (!task) {
      return
    }

    try {
      setBusyAction(`flow-${action}`)
      setActionError(null)
      setMessage(null)
      await api.flowTaskAction(task.id, action === 'retry' ? 'restart' : action)
      await refresh()
      setMessage(`Flow task ${task.id} ${action} requested.`)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : `Failed to ${action} flow task.`)
    } finally {
      setBusyAction(null)
    }
  }

  async function runNodeAction(action: ExecutableAction) {
    if (!selectedDetail) {
      return
    }

    try {
      setBusyAction(`node-${selectedDetail.id}-${action}`)
      setActionError(null)
      setMessage(null)
      const apiAction = action === 'retry' ? 'restart' : action
      if (selectedDetail.executableType === 1) {
        await api.flowTaskAction(selectedDetail.id, apiAction)
      } else {
        await api.operationTaskAction(selectedDetail.id, apiAction)
      }
      await refresh()
      setMessage(`Node ${selectedDetail.nodeId ?? selectedDetail.id} ${action} requested.`)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : `Failed to ${action} node.`)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="page task-execution-page">
      <PageHeader
        eyebrow="Execution Trace"
        title={`Flow Task ${Number.isFinite(taskId) ? taskId : '-'}`}
        actions={
          <div className="toolbar-row">
            <button className="secondary-button" type="button" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} />
              <span>Back to orders</span>
            </button>
            <button className="icon-button" type="button" onClick={() => void refresh()}>
              <RefreshCcw size={16} />
            </button>
          </div>
        }
      />

      {message ? <div className="banner success">{message}</div> : null}
      {error || actionError ? <div className="banner error">{actionError ?? error}</div> : null}

      <div className="flow-editor-layout execution-layout">
        <section className="panel editor-sidebar">
          <div className="panel-header">
            <h3>Task summary</h3>
            <span>{loading ? 'Refreshing…' : task?.flowId ?? 'Unknown flow'}</span>
          </div>
          {task ? (
            <div className="line-list">
              <div className="meta-grid">
                <div>
                  <span className="meta-label">Status</span>
                  <FlowTaskStatusPill status={task.status} />
                </div>
                <div>
                  <span className="meta-label">Flow</span>
                  <strong>{task.flowId}</strong>
                </div>
                <div>
                  <span className="meta-label">Started</span>
                  <strong>{formatDate(task.startingTime)}</strong>
                </div>
                <div>
                  <span className="meta-label">Finished</span>
                  <strong>{formatDate(task.finishedTime)}</strong>
                </div>
              </div>

              <div className="toolbar-row page-actions padded">
                {actionSet.flowActions.map((action) => (
                  <ActionButton
                    key={action}
                    action={action}
                    busy={busyAction === `flow-${action}`}
                    onClick={() => void runFlowAction(action)}
                  />
                ))}
              </div>

              <div className="line-list">
                <h4>Execution nodes</h4>
                {graph.nodes.length > 0 ? (
                  <ul className="execution-list">
                    {graph.nodes.map((node) => (
                      <li
                        key={node.id}
                        className={activeSelectedNodeId === node.id ? 'selected-list-row' : undefined}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <div>
                          <strong>{node.data.label}</strong>
                          <p>{formatDate(node.data.detail.startingTime)} to {formatDate(node.data.detail.finishedTime)}</p>
                        </div>
                        <FlowTaskStatusPill status={node.data.detail.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-panel compact">No execution nodes yet.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-panel">Waiting for task details…</div>
          )}
        </section>

        <section className="panel canvas-panel execution-canvas-panel">
          <ReactFlow
            fitView
            nodes={graph.nodes}
            edges={graph.edges}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </section>

        <section className="panel inspector-panel">
          <div className="panel-header">
            <h3>Node detail</h3>
            <span>{selectedNode?.data.label ?? 'None'}</span>
          </div>
          {selectedDetail ? (
            <div className="line-list">
              <div className="meta-grid">
                <div>
                  <span className="meta-label">Node</span>
                  <strong>{selectedDetail.nodeId}</strong>
                </div>
                <div>
                  <span className="meta-label">Executable Id</span>
                  <strong>{selectedDetail.id}</strong>
                </div>
                <div>
                  <span className="meta-label">Scheduled</span>
                  <strong>{formatDate(selectedDetail.scheduledTime)}</strong>
                </div>
                <div>
                  <span className="meta-label">Started</span>
                  <strong>{formatDate(selectedDetail.startingTime)}</strong>
                </div>
                <div>
                  <span className="meta-label">Finished</span>
                  <strong>{formatDate(selectedDetail.finishedTime)}</strong>
                </div>
                <div>
                  <span className="meta-label">Status</span>
                  <FlowTaskStatusPill status={selectedDetail.status} />
                </div>
              </div>

              {actionSet.nodeActions.length ? (
                <div className="toolbar-row page-actions padded">
                  {actionSet.nodeActions.map((action) => (
                    <ActionButton
                      key={`${selectedDetail.id}-${action}`}
                      action={action}
                      busy={busyAction === `node-${selectedDetail.id}-${action}`}
                      onClick={() => void runNodeAction(action)}
                    />
                  ))}
                </div>
              ) : null}

              {task?.variableEntities?.length ? (
                <div className="line-list">
                  <h4>Flow variables</h4>
                  <ul>
                    {task.variableEntities.map((variable) => (
                      <li key={variable.id}>
                        <span>{variable.id}</span>
                        <span>{variable.value ?? '-'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="empty-panel">Select an execution node to inspect it.</div>
          )}
        </section>
      </div>
    </div>
  )
}

function ActionButton({
  action,
  busy,
  onClick,
}: {
  action: ExecutableAction
  busy: boolean
  onClick: () => void
}) {
  if (action === 'cancel') {
    return (
      <button className="danger-button" type="button" disabled={busy} onClick={onClick}>
        <XCircle size={16} />
        <span>{busy ? 'Canceling…' : 'Cancel'}</span>
      </button>
    )
  }

  if (action === 'skip') {
    return (
      <button className="secondary-button" type="button" disabled={busy} onClick={onClick}>
        <SkipForward size={16} />
        <span>{busy ? 'Skipping…' : 'Skip'}</span>
      </button>
    )
  }

  return (
    <button className="secondary-button" type="button" disabled={busy} onClick={onClick}>
      <RotateCcw size={16} />
      <span>{busy ? 'Retrying…' : 'Retry'}</span>
    </button>
  )
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}
