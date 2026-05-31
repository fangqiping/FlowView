import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Network, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { api, extractDesignError } from '../lib/api'
import { appendBinding, removeBinding, updateBinding } from '../lib/bindingEditor'
import {
  addOperationNode,
  addSubFlowNode,
  buildDraftDocument,
  buildFlowGraph,
  connectEdges,
  createEmptyDraft,
  type FlowEdge,
  type FlowNode,
  LOCAL_OPERATION_LIBRARY,
  EDITOR_VARIABLE_TYPES,
  parseDraftDocument,
  ROOT_NODE_ID,
  toPascalCase,
  type FlowNodeData,
} from '../lib/flowDraft'
import { findSubFlowCandidate } from '../lib/subflowBindings'
import { emptyOutgoingRoute, getOutgoingRoute, replaceOutgoingRoute, type OutgoingRouteMode, type OutgoingRouteState } from '../lib/routeEditor'
import type {
  DraftBinding,
  DraftVariable,
  FlowCatalogModel,
  FlowDefinitionSummaryModel,
  FlowDependencyPublishPlanModel,
  FlowDraftModel,
} from '../types'

export function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditorWorkspace />
    </ReactFlowProvider>
  )
}

function FlowEditorWorkspace() {
  const { code = 'inbound-basic' } = useParams()
  const navigate = useNavigate()
  const reactFlow = useReactFlow<FlowNode, FlowEdge>()

  const [draftModel, setDraftModel] = useState<FlowDraftModel | null>(null)
  const [catalog, setCatalog] = useState<FlowCatalogModel | null>(null)
  const [definitions, setDefinitions] = useState<FlowDefinitionSummaryModel[]>([])
  const [variables, setVariables] = useState<DraftVariable[]>([])
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dependencyPlan, setDependencyPlan] = useState<FlowDependencyPublishPlanModel | null>(null)
  const [meta, setMeta] = useState({ name: code, description: '' })
  const subFlowCandidates = useMemo(
    () => definitions
      .filter((definition) => definition.code !== code)
      .map((definition) => findSubFlowCandidate(definition.code, definitions, catalog))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null),
    [definitions, catalog, code],
  )

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId && node.id !== ROOT_NODE_ID) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedSubFlowCandidate = useMemo(
    () => selectedNode?.data.kind === 'subflow'
      ? findSubFlowCandidate(selectedNode.data.flowId, definitions, catalog)
      : null,
    [selectedNode, definitions, catalog],
  )
  const selectedOutgoingRoute = useMemo(
    () => selectedNode ? getOutgoingRoute(edges, selectedNode.id) : emptyOutgoingRoute(),
    [edges, selectedNode],
  )
  const editableTargetNodes = useMemo(
    () => nodes.filter((node) => node.id !== selectedNode?.id && node.id !== ROOT_NODE_ID),
    [nodes, selectedNode],
  )
  const boolVariables = useMemo(
    () => variables.filter((variable) => variable.type.toLowerCase() === 'bool' || variable.type.toLowerCase() === 'boolean'),
    [variables],
  )
  const intVariables = useMemo(
    () => variables.filter((variable) => variable.type.toLowerCase() === 'int' || variable.type.toLowerCase() === 'int32'),
    [variables],
  )

  useEffect(() => {
    void loadEditor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function loadEditor() {
    try {
      setBusy('load')
      setError(null)
      const [draft, flowCatalog, flowDefinitions] = await Promise.all([
        api.getFlowDraft(code).catch(() => null),
        api.getFlowCatalog(),
        api.getFlowDefinitions(),
      ])

      const model = draft ?? {
        code,
        name: toPascalCase(code),
        description: '',
        revision: 0,
        draftDocumentJson: JSON.stringify(createEmptyDraft(code)),
        updatedAt: new Date().toISOString(),
        updatedBy: 'local',
      }

      const document = parseDraftDocument(model.draftDocumentJson, code)
      const graph = buildFlowGraph(document)

      setDraftModel(model)
      setMeta({ name: model.name, description: model.description ?? '' })
      setCatalog(flowCatalog)
      setDefinitions(flowDefinitions)
      setVariables(document.variables)
      setNodes(graph.nodes)
      setEdges(graph.edges)
      setSelectedNodeId(graph.nodes.find((node) => node.id !== ROOT_NODE_ID)?.id ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load flow editor.')
    } finally {
      setBusy(null)
    }
  }

  function updateSelectedNode(patch: Partial<FlowNodeData>) {
    if (!selectedNode) {
      return
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node,
      ),
    )
  }

  function updateBindings(
    key: 'inputs' | 'outputs',
    index: number,
    field: keyof DraftBinding,
    value: string,
  ) {
    if (!selectedNode) {
      return
    }

    updateSelectedNode({ [key]: updateBinding(selectedNode.data[key], index, field, value) })
  }

  function appendNodeBinding(key: 'inputs' | 'outputs') {
    if (!selectedNode) {
      return
    }

    updateSelectedNode({ [key]: appendBinding(selectedNode.data[key]) })
  }

  function removeNodeBinding(key: 'inputs' | 'outputs', index: number) {
    if (!selectedNode) {
      return
    }

    updateSelectedNode({ [key]: removeBinding(selectedNode.data[key], index) })
  }

  function updateSubFlowInputBinding(childVariableId: string, parentVariableId: string) {
    if (!selectedNode) {
      return
    }

    updateSelectedNode({
      inputs: [
        ...selectedNode.data.inputs.filter((binding) => binding.destination !== childVariableId),
        ...(parentVariableId ? [{ source: parentVariableId, destination: childVariableId }] : []),
      ],
    })
  }

  function updateSubFlowOutputBinding(childVariableId: string, parentVariableId: string) {
    if (!selectedNode) {
      return
    }

    updateSelectedNode({
      outputs: [
        ...selectedNode.data.outputs.filter((binding) => binding.source !== childVariableId),
        ...(parentVariableId ? [{ source: childVariableId, destination: parentVariableId }] : []),
      ],
    })
  }

  function addVariable() {
    setVariables((current) => [
      ...current,
      {
        id: `Variable${current.length + 1}`,
        type: 'string',
        usage: 'inputOutput',
        initialValue: '',
      },
    ])
  }

  async function saveDraft() {
    if (!draftModel) {
      return
    }

    try {
      setBusy('save')
      setError(null)
      const viewport = reactFlow.getViewport()
      const document = buildDraftDocument(code, meta.name, variables, nodes, edges, viewport)
      const saved = await api.saveFlowDraft(code, {
        name: meta.name,
        description: meta.description,
        revision: draftModel.revision,
        draftDocumentJson: JSON.stringify(document),
      })
      setDraftModel(saved)
      setMessage(`Saved revision ${saved.revision}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save draft.')
    } finally {
      setBusy(null)
    }
  }

  async function preflightDraft() {
    if (!draftModel) {
      return
    }

    try {
      setBusy('preflight')
      setError(null)
      const result = await api.preflightFlow(code, draftModel.revision)
      setMessage(`Preflight passed on revision ${result.sourceDraftRevision}.`)
    } catch (caught) {
      const model = extractDesignError(caught)
      setError(model ? `${model.errorCode}: ${model.detail}` : caught instanceof Error ? caught.message : 'Preflight failed.')
    } finally {
      setBusy(null)
    }
  }

  async function publishDraft() {
    if (!draftModel) {
      return
    }

    try {
      setBusy('publish')
      setError(null)
      const result = await api.publishFlow(code, { expectedRevision: draftModel.revision })
      setMessage(`Published ${result.code} v${result.versionNumber}.`)
      await loadEditor()
    } catch (caught) {
      const model = extractDesignError(caught)
      setError(model ? `${model.errorCode}: ${model.detail}` : caught instanceof Error ? caught.message : 'Publish failed.')
    } finally {
      setBusy(null)
    }
  }

  async function preflightWithSubflows() {
    if (!draftModel) {
      return
    }

    try {
      setBusy('dependency-preflight')
      setError(null)
      const plan = await api.preflightFlowWithDependencies(code, draftModel.revision)
      setDependencyPlan(plan)
    } catch (caught) {
      const model = extractDesignError(caught)
      setError(model ? `${model.errorCode}: ${model.detail}` : caught instanceof Error ? caught.message : 'Dependency preflight failed.')
    } finally {
      setBusy(null)
    }
  }

  async function publishWithSubflows() {
    if (!draftModel) {
      return
    }

    try {
      setBusy('dependency-publish')
      setError(null)
      const result = await api.publishFlowWithDependencies(code, draftModel.revision)
      setDependencyPlan(null)
      setMessage(`Published ${result.versions.map((version) => `${version.code} v${version.versionNumber}`).join(', ')}.`)
      await loadEditor()
    } catch (caught) {
      const model = extractDesignError(caught)
      setError(model ? `${model.errorCode}: ${model.detail}` : caught instanceof Error ? caught.message : 'Dependency publish failed.')
    } finally {
      setBusy(null)
    }
  }

  function removeSelectedNode() {
    if (!selectedNode) {
      return
    }
    setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id))
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    setSelectedNodeId(null)
  }

  function updateSelectedOutgoingRoute(patch: Partial<OutgoingRouteState>) {
    if (!selectedNode) {
      return
    }

    const nextRoute = normalizeOutgoingRoute({ ...selectedOutgoingRoute, ...patch })
    setEdges((current) => replaceOutgoingRoute(current, selectedNode.id, nextRoute))
  }

  function updateRouteMode(mode: OutgoingRouteMode) {
    const firstTarget = selectedOutgoingRoute.directTargets[0] ?? editableTargetNodes[0]?.id ?? ''
    if (mode === 'condition') {
      updateSelectedOutgoingRoute({
        mode,
        condition: boolVariables[0]?.id ?? '',
        trueTarget: firstTarget,
        falseTarget: '',
        directTargets: [],
        switchTargets: [],
      })
      return
    }

    if (mode === 'switch') {
      updateSelectedOutgoingRoute({
        mode,
        condition: intVariables[0]?.id ?? '',
        switchTargets: selectedOutgoingRoute.directTargets.length ? selectedOutgoingRoute.directTargets : [firstTarget],
        directTargets: [],
        trueTarget: '',
        falseTarget: '',
      })
      return
    }

    updateSelectedOutgoingRoute({
      mode,
      condition: '',
      directTargets: selectedOutgoingRoute.trueTarget ? [selectedOutgoingRoute.trueTarget] : selectedOutgoingRoute.switchTargets,
      trueTarget: '',
      falseTarget: '',
      switchTargets: [],
    })
  }

  function normalizeOutgoingRoute(route: OutgoingRouteState): OutgoingRouteState {
    if (route.mode === 'condition') {
      return { ...route, directTargets: [], switchTargets: [] }
    }
    if (route.mode === 'switch') {
      return { ...route, directTargets: [], trueTarget: '', falseTarget: '' }
    }
    return { ...route, condition: '', trueTarget: '', falseTarget: '', switchTargets: [] }
  }

  function updateSwitchTarget(index: number, target: string) {
    updateSelectedOutgoingRoute({
      switchTargets: selectedOutgoingRoute.switchTargets.map((item, itemIndex) => itemIndex === index ? target : item),
    })
  }

  function appendSwitchTarget() {
    const nextTarget = editableTargetNodes.find((node) => !selectedOutgoingRoute.switchTargets.includes(node.id))?.id
      ?? editableTargetNodes[0]?.id
      ?? ''
    updateSelectedOutgoingRoute({ switchTargets: [...selectedOutgoingRoute.switchTargets, nextTarget] })
  }

  function removeSwitchTarget(index: number) {
    updateSelectedOutgoingRoute({
      switchTargets: selectedOutgoingRoute.switchTargets.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  return (
    <div className="page flow-editor-page">
      <PageHeader
        eyebrow="Graph Designer"
        title={`Flow Editor · ${code}`}
        actions={
          <div className="toolbar-row">
            <button className="icon-button" type="button" onClick={() => void loadEditor()}>
              <RefreshCcw size={16} />
            </button>
            <button className="secondary-button" type="button" onClick={() => void saveDraft()}>
              <Save size={16} />
              <span>{busy === 'save' ? 'Saving…' : 'Save draft'}</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => void preflightDraft()}>
              <CheckCircle2 size={16} />
              <span>{busy === 'preflight' ? 'Checking…' : 'Preflight'}</span>
            </button>
            <button className="primary-button" type="button" onClick={() => void publishDraft()}>
              <Link2 size={16} />
              <span>{busy === 'publish' ? 'Publishing…' : 'Publish'}</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => void preflightWithSubflows()}>
              <Network size={16} />
              <span>{busy === 'dependency-preflight' ? 'Checking…' : 'Publish with subflows'}</span>
            </button>
          </div>
        }
      />

      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      <div className="flow-editor-layout">
        <section className="panel editor-sidebar">
          <div className="panel-header">
            <h3>Definition</h3>
            <span>{draftModel?.revision ?? 0}</span>
          </div>

          <div className="form-grid compact">
            <label>
              <span>Name</span>
              <input value={meta.name} onChange={(event) => setMeta((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Description</span>
              <textarea rows={3} value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>

          <div className="library-section">
            <div className="panel-header">
              <h4>Node library</h4>
              <span>Local + catalog</span>
            </div>
            <div className="stack-list">
              {LOCAL_OPERATION_LIBRARY.map((template) => (
                <button key={template.key} type="button" className="list-item-button" onClick={() => setNodes((current) => addOperationNode(current, template))}>
                  <div>
                    <strong>{template.name}</strong>
                    <p>{template.consoleId}</p>
                  </div>
                  <Plus size={16} />
                </button>
              ))}
              {subFlowCandidates.map((template) => (
                <button key={template.code} type="button" className="list-item-button" onClick={() => setNodes((current) => addSubFlowNode(current, template))}>
                  <div>
                    <strong>{template.name}</strong>
                    <p>{template.activeVersionNumber ? `${template.code} v${template.activeVersionNumber}` : template.code}</p>
                  </div>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          </div>

          <div className="library-section">
            <div className="panel-header">
              <h4>Variables</h4>
              <button className="icon-button" type="button" onClick={addVariable}>
                <Plus size={16} />
              </button>
            </div>
            <div className="variable-list">
              {variables.map((variable, index) => (
                <div key={`${variable.id}-${index}`} className="variable-row">
                  <input
                    value={variable.id}
                    onChange={(event) =>
                      setVariables((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, id: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <select
                    value={variable.type}
                    onChange={(event) =>
                      setVariables((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, type: event.target.value } : item,
                        ),
                      )
                    }
                  >
                    {EDITOR_VARIABLE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <select
                    value={variable.usage}
                    onChange={(event) =>
                      setVariables((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, usage: event.target.value as DraftVariable['usage'] } : item,
                        ),
                      )
                    }
                  >
                    <option value="input">input</option>
                    <option value="output">output</option>
                    <option value="inputOutput">inputOutput</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel canvas-panel">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(connection) => setEdges((current) => connectEdges(current, connection))}
            onNodeClick={(_, node) => setSelectedNodeId(node.id === ROOT_NODE_ID ? null : node.id)}
            fitView
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </section>

        <section className="panel inspector-panel">
          <div className="panel-header">
            <h3>Inspector</h3>
            {selectedNode ? (
              <button className="icon-button" type="button" onClick={removeSelectedNode}>
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>

          {selectedNode ? (
            <>
              <div className="form-grid compact">
                <label>
                  <span>Node id</span>
                  <input
                    value={selectedNode.id}
                    onChange={(event) =>
                      setNodes((current) =>
                        current.map((node) =>
                          node.id === selectedNode.id
                            ? { ...node, id: event.target.value, data: { ...node.data, label: event.target.value } }
                            : node,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <span>Description</span>
                  <input
                    value={selectedNode.data.description}
                    onChange={(event) => updateSelectedNode({ description: event.target.value })}
                  />
                </label>
                {selectedNode.data.kind === 'operation' ? (
                  <>
                    <label>
                      <span>Console</span>
                      <input
                        value={selectedNode.data.consoleId}
                        onChange={(event) => updateSelectedNode({ consoleId: event.target.value })}
                      />
                    </label>
                    <label className="wide">
                      <span>Operation task type</span>
                      <input
                        value={selectedNode.data.operationTaskType}
                        onChange={(event) => updateSelectedNode({ operationTaskType: event.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <label className="wide">
                    <span>Child flow code</span>
                    <input
                      value={selectedNode.data.flowId}
                      onChange={(event) => updateSelectedNode({ flowId: event.target.value })}
                    />
                  </label>
                )}
              </div>

              <div className="library-section route-editor-section">
                <div className="panel-header nested">
                  <h4>Outgoing routes</h4>
                  <span>{selectedOutgoingRoute.mode}</span>
                </div>
                <div className="route-editor-grid">
                  <label>
                    <span>Route mode</span>
                    <select
                      aria-label="Route mode"
                      value={selectedOutgoingRoute.mode}
                      onChange={(event) => updateRouteMode(event.target.value as OutgoingRouteMode)}
                    >
                      <option value="direct">Direct</option>
                      <option value="condition">Condition</option>
                      <option value="switch">Switch</option>
                    </select>
                  </label>
                  {selectedOutgoingRoute.mode === 'condition' ? (
                    <>
                      <label>
                        <span>Condition variable</span>
                        <select
                          aria-label="Condition variable"
                          value={selectedOutgoingRoute.condition}
                          onChange={(event) => updateSelectedOutgoingRoute({ condition: event.target.value })}
                        >
                          <option value="">Select bool variable</option>
                          {boolVariables.map((variable) => (
                            <option key={variable.id} value={variable.id}>{variable.id}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>True target</span>
                        <select
                          aria-label="True target"
                          value={selectedOutgoingRoute.trueTarget}
                          onChange={(event) => updateSelectedOutgoingRoute({ trueTarget: event.target.value })}
                        >
                          <option value="">No true target</option>
                          {editableTargetNodes.map((node) => (
                            <option key={node.id} value={node.id}>{node.id}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>False target</span>
                        <select
                          aria-label="False target"
                          value={selectedOutgoingRoute.falseTarget}
                          onChange={(event) => updateSelectedOutgoingRoute({ falseTarget: event.target.value })}
                        >
                          <option value="">No false target</option>
                          {editableTargetNodes.map((node) => (
                            <option key={node.id} value={node.id}>{node.id}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                  {selectedOutgoingRoute.mode === 'direct' ? (
                    <label>
                      <span>Target</span>
                      <select
                        aria-label="Direct target"
                        value={selectedOutgoingRoute.directTargets[0] ?? ''}
                        onChange={(event) => updateSelectedOutgoingRoute({ directTargets: event.target.value ? [event.target.value] : [] })}
                      >
                        <option value="">No target</option>
                        {editableTargetNodes.map((node) => (
                          <option key={node.id} value={node.id}>{node.id}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {selectedOutgoingRoute.mode === 'switch' ? (
                    <>
                      <label>
                        <span>Switch variable</span>
                        <select
                          aria-label="Switch variable"
                          value={selectedOutgoingRoute.condition}
                          onChange={(event) => updateSelectedOutgoingRoute({ condition: event.target.value })}
                        >
                          <option value="">Select int variable</option>
                          {intVariables.map((variable) => (
                            <option key={variable.id} value={variable.id}>{variable.id}</option>
                          ))}
                        </select>
                      </label>
                      <div className="route-case-list">
                        {selectedOutgoingRoute.switchTargets.map((target, index) => (
                          <label key={`${index}-${target}`}>
                            <span>Case {index}</span>
                            <select
                              aria-label={`Case ${index} target`}
                              value={target}
                              onChange={(event) => updateSwitchTarget(index, event.target.value)}
                            >
                              <option value="">No target</option>
                              {editableTargetNodes.map((node) => (
                                <option key={node.id} value={node.id}>{node.id}</option>
                              ))}
                            </select>
                            <button className="icon-button" type="button" aria-label={`Remove case ${index}`} onClick={() => removeSwitchTarget(index)}>
                              <Trash2 size={16} />
                            </button>
                          </label>
                        ))}
                        <button className="secondary-button" type="button" onClick={appendSwitchTarget}>
                          <Plus size={16} />
                          <span>Add case</span>
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {selectedNode.data.kind === 'subflow' ? (
                <div className="library-section">
                  <div className="panel-header">
                    <h4>Subflow contract</h4>
                    {selectedSubFlowCandidate ? (
                      <button className="secondary-button" type="button" onClick={() => navigate(`/flows/${selectedSubFlowCandidate.code}/editor`)}>
                        <ExternalLink size={16} />
                        <span>Open subflow</span>
                      </button>
                    ) : null}
                  </div>
                  {selectedSubFlowCandidate ? (
                    <div className="stack-list">
                      <h5>Inputs</h5>
                      {selectedSubFlowCandidate.inputs.map((input) => (
                        <label key={input.id} className="binding-row">
                          <span>{input.id}</span>
                          <select
                            value={selectedNode.data.inputs.find((binding) => binding.destination === input.id)?.source ?? ''}
                            onChange={(event) => updateSubFlowInputBinding(input.id, event.target.value)}
                          >
                            <option value="">Unbound</option>
                            {variables.map((variable) => (
                              <option key={variable.id} value={variable.id}>{variable.id}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                      {selectedSubFlowCandidate.inputs.length === 0 ? <div className="empty-panel compact">No input contract.</div> : null}
                      <h5>Outputs</h5>
                      {selectedSubFlowCandidate.outputs.map((output) => (
                        <label key={output.id} className="binding-row">
                          <span>{output.id}</span>
                          <select
                            value={selectedNode.data.outputs.find((binding) => binding.source === output.id)?.destination ?? ''}
                            onChange={(event) => updateSubFlowOutputBinding(output.id, event.target.value)}
                          >
                            <option value="">Unbound</option>
                            {variables.map((variable) => (
                              <option key={variable.id} value={variable.id}>{variable.id}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                      {selectedSubFlowCandidate.outputs.length === 0 ? <div className="empty-panel compact">No output contract.</div> : null}
                    </div>
                  ) : (
                    <div className="empty-panel compact">No published signature found for this subflow code.</div>
                  )}
                </div>
              ) : null}

              {selectedNode.data.kind === 'operation' ? (
                <div className="library-section">
                <div className="panel-header">
                  <h4>Input bindings</h4>
                  <button className="icon-button" type="button" onClick={() => appendNodeBinding('inputs')}>
                    <Plus size={16} />
                  </button>
                </div>
                {selectedNode.data.inputs.length > 0 ? selectedNode.data.inputs.map((binding, index) => (
                  <div key={`${binding.destination}-${index}`} className="binding-row">
                    <input
                      value={binding.source}
                      onChange={(event) => updateBindings('inputs', index, 'source', event.target.value)}
                    />
                    <input
                      value={binding.destination}
                      onChange={(event) => updateBindings('inputs', index, 'destination', event.target.value)}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => removeNodeBinding('inputs', index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )) : <div className="empty-panel compact">No input bindings yet.</div>}
                </div>
              ) : null}

              {selectedNode.data.kind === 'operation' ? (
                <div className="library-section">
                <div className="panel-header">
                  <h4>Output bindings</h4>
                  <button className="icon-button" type="button" onClick={() => appendNodeBinding('outputs')}>
                    <Plus size={16} />
                  </button>
                </div>
                {selectedNode.data.outputs.length > 0 ? selectedNode.data.outputs.map((binding, index) => (
                  <div key={`${binding.source}-${index}`} className="binding-row">
                    <input
                      value={binding.source}
                      onChange={(event) => updateBindings('outputs', index, 'source', event.target.value)}
                    />
                    <input
                      value={binding.destination}
                      onChange={(event) => updateBindings('outputs', index, 'destination', event.target.value)}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => removeNodeBinding('outputs', index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )) : <div className="empty-panel compact">No output bindings yet.</div>}
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-panel">
              <AlertTriangle size={20} />
              <span>Select a node on the canvas to edit bindings and task metadata.</span>
            </div>
          )}

          <div className="library-section">
            <div className="panel-header">
              <h4>Navigation</h4>
            </div>
            <button className="secondary-button" type="button" onClick={() => navigate('/flows')}>
              <Link2 size={16} />
              <span>Back to definitions</span>
            </button>
          </div>
        </section>
      </div>

      {dependencyPlan ? (
        <div className="modal-scrim" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Publish with subflows">
            <div className="panel-header">
              <h3>Publish with subflows</h3>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setDependencyPlan(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="version-list">
                {dependencyPlan.publishOrder.map((entry) => (
                  <div key={entry.code} className="version-row">
                    <div>
                      <strong>{entry.publishOrder}. {entry.code} r{entry.revision}</strong>
                      <p>{entry.referencedBy.length ? `Referenced by ${entry.referencedBy.join(', ')}` : 'Root flow'}</p>
                    </div>
                  </div>
                ))}
              </div>
              {dependencyPlan.warnings.map((warning) => (
                <div key={`${warning.code}-${warning.warningCode}`} className="inline-note danger">
                  {warning.detail}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDependencyPlan(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={() => void publishWithSubflows()}>
                {busy === 'dependency-publish' ? 'Publishing…' : 'Confirm publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
