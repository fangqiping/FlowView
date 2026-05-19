import { LoaderCircle, Play, Plus, RefreshCcw, Rocket, SendHorizonal, SquareCheckBig, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import {
  applyOrderTaskSnapshots,
  createSuggestedOrderCode,
  getExecutionSteps,
  isTerminalFlowTaskStatus,
  toTaskSnapshot,
} from '../lib/flowExecution'
import { useOrderTaskDetail } from '../lib/useOrderTaskDetail'
import { PageHeader } from '../components/PageHeader'
import { FlowTaskStatusPill, StatusPill } from '../components/StatusPill'
import type {
  CreateInboundOrderModel,
  CreateOutboundOrderModel,
  InboundOrderModel,
  LocationModel,
  OrderKind,
  OutboundOrderModel,
  SkuModel,
} from '../types'

type OrderModel = InboundOrderModel | OutboundOrderModel

export function OrdersPage({ kind }: { kind: OrderKind }) {
  const [orders, setOrders] = useState<OrderModel[]>([])
  const [skus, setSkus] = useState<SkuModel[]>([])
  const [locations, setLocations] = useState<LocationModel[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '',
    siteCode: kind === 'inbound' ? 'IN-01' : 'OUT-01',
    skuId: 0,
    quantity: 1,
    locationId: 0,
    remark: '',
  })

  const rawSelectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? orders[0] ?? null,
    [orders, selectedId],
  )
  const lastTerminalTaskIdRef = useRef<number | null>(null)
  const terminalTaskSnapshotsRef = useRef(new Map<number, { status: number; completedTime?: string | null }>())
  const {
    task: selectedTask,
    loading: taskLoading,
    error: taskError,
  } = useOrderTaskDetail({
    taskId: rawSelectedOrder?.flowTaskId ?? null,
    fetchTask: api.getFlowTask,
    pollIntervalMs: 1500,
  })
  const displayOrders = useMemo(() => {
    const snapshots = new Map(terminalTaskSnapshotsRef.current)
    if (selectedTask && isTerminalFlowTaskStatus(selectedTask.status)) {
      snapshots.set(selectedTask.id, toTaskSnapshot(selectedTask))
    }

    return applyOrderTaskSnapshots(orders, snapshots)
  }, [orders, selectedTask])
  const selectedOrder = useMemo(
    () => displayOrders.find((order) => order.id === selectedId) ?? displayOrders[0] ?? null,
    [displayOrders, selectedId],
  )
  const executionSteps = useMemo(() => getExecutionSteps(selectedTask), [selectedTask])

  useEffect(() => {
    void loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  useEffect(() => {
    if (!selectedTask || !isTerminalFlowTaskStatus(selectedTask.status)) {
      return
    }

    terminalTaskSnapshotsRef.current.set(selectedTask.id, toTaskSnapshot(selectedTask))

    if (lastTerminalTaskIdRef.current === selectedTask.id) {
      return
    }

    lastTerminalTaskIdRef.current = selectedTask.id
    void loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask])

  async function loadPage() {
    try {
      setError(null)
      setMessage(null)
      const [skuResponse, locationResponse, orderResponse] = await Promise.all([
        api.getSkus(),
        api.getLocations(),
        kind === 'inbound' ? api.getInboundOrders() : api.getOutboundOrders(),
      ])

      setSkus(skuResponse.items)
      setLocations(locationResponse.items)
      setOrders(orderResponse.items)

      const defaultRack =
        locationResponse.items.find((item) => item.code === 'RACK-A1')?.id ?? locationResponse.items[0]?.id ?? 0
      setForm((current) => ({
        ...current,
        skuId: current.skuId || skuResponse.items[0]?.id || 0,
        locationId: current.locationId || defaultRack,
      }))
      setSelectedId((current) => current ?? orderResponse.items[0]?.id ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load orders.')
    }
  }

  async function createOrder() {
    try {
      setBusyAction('create')
      setError(null)
      setMessage(null)

      const payload: CreateInboundOrderModel | CreateOutboundOrderModel =
        kind === 'inbound'
          ? {
              code: form.code,
              source: form.siteCode,
              remark: form.remark,
              lines: [
                {
                  skuId: form.skuId,
                  quantity: form.quantity,
                  targetLocationId: form.locationId,
                },
              ],
            }
          : {
              code: form.code,
              destination: form.siteCode,
              remark: form.remark,
              lines: [
                {
                  skuId: form.skuId,
                  quantity: form.quantity,
                  sourceLocationId: form.locationId,
                },
              ],
            }

      const created =
        kind === 'inbound'
          ? await api.createInboundOrder(payload as CreateInboundOrderModel)
          : await api.createOutboundOrder(payload as CreateOutboundOrderModel)

      await loadPage()
      setSelectedId(created.id)
      setForm((current) => ({
        ...current,
        code: '',
        remark: '',
      }))
      setMessage(`Created ${created.code}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create order.')
    } finally {
      setBusyAction(null)
    }
  }

  async function runAction(action: 'submit' | 'start-flow' | 'complete' | 'cancel') {
    if (!selectedOrder) {
      return
    }

    try {
      setBusyAction(action)
      setError(null)
      setMessage(null)
      await api.orderAction(kind, selectedOrder.id, action)
      await loadPage()
      setSelectedId(selectedOrder.id)
      setMessage(`${selectedOrder.code} ${action} completed.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Failed to ${action} order.`)
    } finally {
      setBusyAction(null)
    }
  }

  async function createAndStartDemo() {
    try {
      setBusyAction('create-and-start')
      setError(null)
      setMessage(null)

      const payload: CreateInboundOrderModel | CreateOutboundOrderModel =
        kind === 'inbound'
          ? {
              code: form.code || createSuggestedOrderCode(kind),
              source: form.siteCode,
              remark: form.remark || 'Created from FlowView demo lane.',
              lines: [
                {
                  skuId: form.skuId,
                  quantity: form.quantity,
                  targetLocationId: form.locationId,
                },
              ],
            }
          : {
              code: form.code || createSuggestedOrderCode(kind),
              destination: form.siteCode,
              remark: form.remark || 'Created from FlowView demo lane.',
              lines: [
                {
                  skuId: form.skuId,
                  quantity: form.quantity,
                  sourceLocationId: form.locationId,
                },
              ],
            }

      const created =
        kind === 'inbound'
          ? await api.createInboundOrder(payload as CreateInboundOrderModel)
          : await api.createOutboundOrder(payload as CreateOutboundOrderModel)

      await api.orderAction(kind, created.id, 'submit')
      const started = await api.orderAction(kind, created.id, 'start-flow')
      await loadPage()
      setSelectedId(started.id)
      setForm((current) => ({
        ...current,
        code: '',
        remark: '',
      }))
      setMessage(`Created and started ${started.code}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create and start demo order.')
    } finally {
      setBusyAction(null)
    }
  }

  const title = kind === 'inbound' ? 'Inbound Orders' : 'Outbound Orders'
  const locationLabel = kind === 'inbound' ? 'Target Rack' : 'Source Rack'
  const siteLabel = kind === 'inbound' ? 'Source Station' : 'Destination Station'

  return (
    <div className="page">
      <PageHeader
        eyebrow="Warehouse Execution"
        title={title}
        actions={
          <button className="icon-button" type="button" onClick={() => void loadPage()}>
            <RefreshCcw size={16} />
          </button>
        }
      />

      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      <div className="workspace-grid">
        <section className="panel table-panel">
          <div className="panel-header">
            <h3>Active queue</h3>
            <span>{orders.length} orders</span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Flow</th>
                  <th>Task</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={selectedOrder?.id === order.id ? 'selected' : ''}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td>{order.code}</td>
                    <td><StatusPill status={order.status} /></td>
                    <td>{order.flowDefinitionCode ?? '-'}</td>
                    <td>{order.flowTaskId ?? '-'}</td>
                    <td>{formatDate(order.updatedTime)}</td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">No orders yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="detail-column">
          <div className="panel">
            <div className="panel-header">
              <h3>Create order</h3>
              <span>{kind === 'inbound' ? 'IN flow' : 'OUT flow'}</span>
            </div>

            <div className="form-grid">
              <label>
                <span>Order code</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder={kind === 'inbound' ? 'IN-1001' : 'OUT-1001'}
                />
              </label>

              <label>
                <span>{siteLabel}</span>
                <input
                  value={form.siteCode}
                  onChange={(event) => setForm((current) => ({ ...current, siteCode: event.target.value }))}
                />
              </label>

              <label>
                <span>SKU</span>
                <select
                  value={form.skuId}
                  onChange={(event) => setForm((current) => ({ ...current, skuId: Number(event.target.value) }))}
                >
                  {skus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.code} · {sku.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{locationLabel}</span>
                <select
                  value={form.locationId}
                  onChange={(event) => setForm((current) => ({ ...current, locationId: Number(event.target.value) }))}
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} · {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Quantity</span>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
                />
              </label>

              <label className="wide">
                <span>Remark</span>
                <textarea
                  rows={3}
                  value={form.remark}
                  onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
                />
              </label>
            </div>

            <div className="toolbar-row page-actions padded">
              <button className="primary-button" type="button" onClick={() => void createOrder()} disabled={busyAction !== null || !form.code}>
                {busyAction === 'create' ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
                <span>Create order</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => void createAndStartDemo()} disabled={busyAction !== null || skus.length === 0 || locations.length === 0}>
                {busyAction === 'create-and-start' ? <LoaderCircle size={16} className="spin" /> : <Rocket size={16} />}
                <span>Create &amp; Start Demo</span>
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Selected order</h3>
              <span>{selectedOrder?.code ?? 'None'}</span>
            </div>

            {selectedOrder ? (
              <>
                <div className="meta-grid">
                  <div>
                    <span className="meta-label">Status</span>
                    <StatusPill status={selectedOrder.status} />
                  </div>
                  <div>
                    <span className="meta-label">Flow</span>
                    <strong>{selectedOrder.flowDefinitionCode ?? 'Pending binding'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Version</span>
                    <strong>{selectedOrder.flowVersionNumber ?? '-'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Task</span>
                    <strong>{selectedOrder.flowTaskId ?? '-'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Task status</span>
                    {selectedTask ? (
                      <FlowTaskStatusPill status={selectedTask.status} />
                    ) : selectedOrder.flowTaskId ? (
                      <strong>{taskLoading ? 'Refreshing…' : 'Unavailable'}</strong>
                    ) : (
                      <strong>Idle</strong>
                    )}
                  </div>
                  <div>
                    <span className="meta-label">Task finished</span>
                    <strong>{formatDate(selectedTask?.finishedTime)}</strong>
                  </div>
                </div>

                {taskError ? <div className="inline-note danger">{taskError}</div> : null}

                <div className="toolbar-row">
                  <button className="secondary-button" type="button" onClick={() => void runAction('submit')}>
                    <SendHorizonal size={16} />
                    <span>{busyAction === 'submit' ? 'Submitting…' : 'Submit'}</span>
                  </button>
                  <button className="primary-button" type="button" onClick={() => void runAction('start-flow')}>
                    <Play size={16} />
                    <span>{busyAction === 'start-flow' ? 'Starting…' : 'Start flow'}</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void runAction('complete')}>
                    <SquareCheckBig size={16} />
                    <span>Complete</span>
                  </button>
                  <button className="danger-button" type="button" onClick={() => void runAction('cancel')}>
                    <XCircle size={16} />
                    <span>Cancel</span>
                  </button>
                  {selectedOrder.flowTaskId ? (
                    <Link className="secondary-button" to={`/tasks/${selectedOrder.flowTaskId}`}>
                      <span>Execution graph</span>
                    </Link>
                  ) : null}
                </div>

                <div className="line-list">
                  <h4>Lines</h4>
                  <ul>
                    {selectedOrder.lines.map((line) => (
                      <li key={line.id || `${line.skuId}-${selectedOrder.id}`}>
                        <span>SKU {line.skuId}</span>
                        <span>Qty {line.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="line-list">
                  <h4>Execution steps</h4>
                  {executionSteps.length > 0 ? (
                    <ul className="execution-list">
                      {executionSteps.map((step) => (
                        <li key={step.id}>
                          <div>
                            <strong>{step.nodeId}</strong>
                            <p>{formatDate(step.startingTime)} &rarr; {formatDate(step.finishedTime)}</p>
                          </div>
                          <FlowTaskStatusPill status={step.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-panel compact">
                      {selectedOrder.flowTaskId ? (taskLoading ? 'Refreshing execution details…' : 'No executable steps yet.') : 'Start a flow to see execution steps.'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-panel">Select an order to inspect its flow binding and actions.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}
