import { LoaderCircle, Play, Plus, RefreshCcw, Rocket, SendHorizonal, SquareCheckBig, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResourceSummaryPanel } from '../components/ResourceSummaryPanel'
import { api } from '../lib/api'
import {
  applyOrderTaskSnapshots,
  createSuggestedOrderCode,
  getExecutionSteps,
  isTerminalFlowTaskStatus,
  toTaskSnapshot,
} from '../lib/flowExecution'
import { buildOrderResourceSummary } from '../lib/resourceSummary'
import { useOrderTaskDetail } from '../lib/useOrderTaskDetail'
import { PageHeader } from '../components/PageHeader'
import { FlowTaskStatusPill, StatusPill } from '../components/StatusPill'
import { useI18n } from '../i18n/useI18n'
import type {
  CreateInboundOrderModel,
  CreateOutboundOrderModel,
  InboundOrderModel,
  LocationModel,
  OrderKind,
  OutboundOrderModel,
  PalletModel,
  PortModel,
  SkuModel,
} from '../types'

type OrderModel = InboundOrderModel | OutboundOrderModel

export function OrdersPage({ kind }: { kind: OrderKind }) {
  const { t } = useI18n()
  const [orders, setOrders] = useState<OrderModel[]>([])
  const [skus, setSkus] = useState<SkuModel[]>([])
  const [locations, setLocations] = useState<LocationModel[]>([])
  const [ports, setPorts] = useState<PortModel[]>([])
  const [pallets, setPallets] = useState<PalletModel[]>([])
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
  const resourceSummary = useMemo(
    () => buildOrderResourceSummary(kind, selectedOrder, selectedTask, locations, ports, pallets, skus),
    [kind, selectedOrder, selectedTask, locations, ports, pallets, skus],
  )

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
      const [skuResponse, locationResponse, portResponse, palletResponse, orderResponse] = await Promise.all([
        api.getSkus(),
        api.getLocations(),
        api.getPorts(),
        api.getPallets(),
        kind === 'inbound' ? api.getInboundOrders() : api.getOutboundOrders(),
      ])

      setSkus(skuResponse.items)
      setLocations(locationResponse.items)
      setPorts(portResponse.items)
      setPallets(palletResponse.items)
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

  const title = kind === 'inbound' ? t('orders.inboundTitle') : t('orders.outboundTitle')
  const locationLabel = kind === 'inbound' ? t('orders.targetRack') : t('orders.sourceRack')
  const siteLabel = kind === 'inbound' ? t('orders.sourceStation') : t('orders.destinationStation')

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('orders.eyebrow')}
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
            <h3>{t('orders.activeQueue')}</h3>
            <span>{t('orders.orderCount', { count: orders.length })}</span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('masterData.code')}</th>
                  <th>{t('masterData.status')}</th>
                  <th>{t('orders.flow')}</th>
                  <th>{t('orders.task')}</th>
                  <th>{t('orders.updated')}</th>
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
                    <td colSpan={5} className="empty-cell">{t('orders.empty')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="detail-column">
          <div className="panel">
            <div className="panel-header">
              <h3>{t('orders.createOrder')}</h3>
              <span>{kind === 'inbound' ? t('orders.inFlow') : t('orders.outFlow')}</span>
            </div>

            <div className="form-grid">
              <label>
                <span>{t('orders.orderCode')}</span>
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
                <span>{t('masterData.sku')}</span>
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
                <span>{t('masterData.quantity')}</span>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
                />
              </label>

              <label className="wide">
                <span>{t('orders.remark')}</span>
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
                <span>{t('orders.createOrder')}</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => void createAndStartDemo()} disabled={busyAction !== null || skus.length === 0 || locations.length === 0}>
                {busyAction === 'create-and-start' ? <LoaderCircle size={16} className="spin" /> : <Rocket size={16} />}
                <span>{t('orders.createAndStartDemo')}</span>
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>{t('orders.selectedOrder')}</h3>
              <span>{selectedOrder?.code ?? t('masterData.none')}</span>
            </div>

            {selectedOrder ? (
              <>
                <div className="meta-grid">
                  <div>
                    <span className="meta-label">{t('masterData.status')}</span>
                    <StatusPill status={selectedOrder.status} />
                  </div>
                  <div>
                    <span className="meta-label">{t('orders.flow')}</span>
                    <strong>{selectedOrder.flowDefinitionCode ?? t('orders.pendingBinding')}</strong>
                  </div>
                  <div>
                    <span className="meta-label">{t('orders.version')}</span>
                    <strong>{selectedOrder.flowVersionNumber ?? '-'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">{t('orders.task')}</span>
                    <strong>{selectedOrder.flowTaskId ?? '-'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">{t('orders.taskStatus')}</span>
                    {selectedTask ? (
                      <FlowTaskStatusPill status={selectedTask.status} />
                    ) : selectedOrder.flowTaskId ? (
                      <strong>{taskLoading ? t('task.refreshing') : t('orders.unavailable')}</strong>
                    ) : (
                      <strong>{t('orders.idle')}</strong>
                    )}
                  </div>
                  <div>
                    <span className="meta-label">{t('orders.taskFinished')}</span>
                    <strong>{formatDate(selectedTask?.finishedTime)}</strong>
                  </div>
                </div>

                {taskError ? <div className="inline-note danger">{taskError}</div> : null}

                <div className="toolbar-row">
                  <button className="secondary-button" type="button" onClick={() => void runAction('submit')}>
                    <SendHorizonal size={16} />
                    <span>{busyAction === 'submit' ? t('orders.submitting') : t('orders.submit')}</span>
                  </button>
                  <button className="primary-button" type="button" onClick={() => void runAction('start-flow')}>
                    <Play size={16} />
                    <span>{busyAction === 'start-flow' ? t('orders.starting') : t('orders.startFlow')}</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void runAction('complete')}>
                    <SquareCheckBig size={16} />
                    <span>{t('orders.complete')}</span>
                  </button>
                  <button className="danger-button" type="button" onClick={() => void runAction('cancel')}>
                    <XCircle size={16} />
                    <span>{t('actions.cancel')}</span>
                  </button>
                  {selectedOrder.flowTaskId ? (
                    <Link className="secondary-button" to={`/tasks/${selectedOrder.flowTaskId}`}>
                      <span>{t('orders.executionGraph')}</span>
                    </Link>
                  ) : null}
                </div>

                <div className="line-list">
                  <h4>{t('orders.lines')}</h4>
                  <ul>
                    {selectedOrder.lines.map((line) => (
                      <li key={line.id || `${line.skuId}-${selectedOrder.id}`}>
                        <span>SKU {line.skuId}</span>
                        <span>{t('orders.qty')} {line.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {resourceSummary ? <ResourceSummaryPanel summary={resourceSummary} /> : null}

                <div className="line-list">
                  <h4>{t('orders.executionSteps')}</h4>
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
                      {selectedOrder.flowTaskId ? (taskLoading ? t('orders.refreshingExecution') : t('orders.noExecutableSteps')) : t('orders.startFlowHint')}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-panel">{t('orders.selectHint')}</div>
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
