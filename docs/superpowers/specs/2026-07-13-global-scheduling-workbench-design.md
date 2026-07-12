# FlowEngine 全局排程与 FlowView 排程工作台设计

## 1. 背景

FlowEngine 已有基于 OR-Tools CP-SAT 的排程原型，可以为具有固定资源 ID、预计时长和前置关系的任务生成无资源重叠计划，并输出静态 Gantt 图。该原型尚未保存计划版本、控制节点执行、接收实际反馈或向 FlowView 暴露查询接口。

本次改造将原型扩展为计划驱动执行的第一版，并在 FlowView 增加可供调度员持续使用的排程工作台。第一版不引入 `DeadlockDomain`，继续由现有 `Acquire` 机制负责最终资源一致性。

## 2. 目标

- 在 FlowEngine 中统一生成 flow 级和 node 级全局计划。
- 通过 `PlanGate` 让可排程节点按计划进入现有资源获取流程。
- 保存当前计划、历史版本、运行反馈及重排原因。
- 仅依赖节点开始、节点完成和资源获取/释放事件完成实际反馈。
- 支持自动与手动滚动重排。
- 在 FlowView 展示资源泳道、任务身份、计划与实际对比及重排版本差异。
- 保持未启用全局排程时的现有执行行为不变。

## 3. 非目标

- 不实现通用 APS、跨日生产日历或人员班次优化。
- 不根据设备进度或剩余时长做预测，因为设备当前只提供开始与完成事件。
- 不让求解器替代 `Acquire` 或绕过资源真实状态。
- 不在第一版自动放宽硬约束。
- 不在第一版使用历史数据训练时长模型。
- 不在第一版引入独立排程微服务。

## 4. 方案选择

采用 FlowEngine 原生排程域：

```text
FlowEngine.Execution
  快照、求解、计划版本、PlanGate、反馈、滚动重排

FlowEngine.Server
  当前计划、历史、版本对比、手动重排 API

Backend Demo
  注册排程能力，提供业务显示元数据和真实设备资源

FlowView
  排程工作台、资源泳道、计划/实际、版本差异
```

排程属于执行引擎，不由 Backend Demo 重复实现。Backend Demo 只提供仓储业务上下文和特定流程的候选任务描述。

## 5. 核心概念

### 5.1 计划版本

每次成功求解创建一个不可变的 `SchedulePlan`。滚动重排创建新版本并引用前一版本，不覆盖旧计划。失败的求解尝试单独记录，但不会替换当前已提交计划。

### 5.2 节点执行与资源占用

节点执行区间和资源占用区间不是同一个概念：

- `NodeExecution` 表示 operation 的计划开始、结束和实际执行时间。
- `ResourceOccupancy` 表示托盘或业务对象实际占用设备资源的时间。

operation 完成不代表资源释放。资源泳道以 `Acquire` 成功和资源释放事件为实际边界。托盘完成设备工作但尚未被取走时，资源占用条继续延伸。

CP-SAT 的资源互斥约束必须使用 `ResourceOccupancy` 区间，不能仅使用 operation 的执行时长。

### 5.3 循环节点

同一个 flow 可能多次访问同一 Node。计划项不能只使用 `(FlowTaskId, NodeId)` 作为键，统一使用：

```text
ScheduleOperationKey = FlowTaskId + NodeId + Occurrence
```

`Occurrence` 从 1 开始递增。运行时分支尚未确定时，不预先创建未知的下一次访问；分支确定后由下一轮快照加入候选集并触发重排。

FlowTask 在节点到达、进入 `PlanGate` 之前分配 occurrence，并在运行状态中持久化计数，确保重启后不会将循环访问错误关联到旧计划项。

## 6. 数据模型

### 6.1 SchedulePlan

```text
Id
Version
PreviousPlanId
HorizonStart
HorizonEnd
Status                 Draft | Committed | Superseded | Failed
SolverStatus
Trigger                 Initial | Manual | NodeStarted | NodeCompleted |
                        ResourceReleased | PlanMissed | ExecutionDelayed |
                        AcquireFailed
TriggerDetail
CreatedAt
CommittedAt
Makespan
```

### 6.2 SchedulePlanItem

```text
Id
PlanId
ItemKind                NodeExecution | ResourceOccupancy
FlowTaskId
NodeId
Occurrence
OperationTaskId         可空，运行时创建后回填
ResourceType            ResourceOccupancy 必填
ResourceId              ResourceOccupancy 必填
PlannedStart
PlannedEnd
ActualStart
ActualEnd
PredictedEnd
ExpectedDuration
Status                  Planned | Waiting | Running | Completed |
                        Delayed | Blocked | Canceled
DelayReason
IsFrozen
DisplayLabel
DisplayContextJson
```

`DisplayLabel` 是简短业务名称，例如 `IN-2407 / P-018 · 上架`。`DisplayContextJson` 可包含订单、托盘或其他宿主业务引用，但不能成为 FlowEngine 求解约束的来源。

### 6.3 ScheduleFeedback

```text
Id
PlanId
PlanItemId
FlowTaskId
NodeId
Occurrence
EventType               NodeStarted | NodeCompleted | ResourceAcquired |
                        ResourceReleased | PlanMissed | ExecutionDelayed |
                        AcquireFailed
OccurredAt
Detail
```

### 6.4 ScheduleSolveAttempt

```text
Id
PreviousPlanId
Trigger
StartedAt
FinishedAt
SolverStatus
FailureReason
CandidateCount
```

失败尝试可观测，但不成为当前计划。

## 7. 可排程候选与宿主扩展

新增 `IScheduleCandidateProvider`。它根据当前 FlowTask、已确定路径、固定资源 ID 和宿主业务状态生成：

- node 执行候选。
- resource occupancy 候选。
- 前置关系。
- flow 优先级和到期时间。
- 业务显示元数据。

Backend Demo 注册实现，将订单号、托盘号和设备标识映射到通用候选模型。没有宿主实现时，FlowEngine 使用 `FlowTaskId / NodeId` 作为显示信息。

第一版只接受确定的资源 ID。资源池选择和运行到节点后才确定资源 ID 的情况不进入本次模型。

## 8. 时长规则

预计执行时长按以下顺序解析：

```text
节点 estimatedDurationMilliseconds
  > operation 类型默认时长
  > 系统默认 1 秒
```

FlowView 使用秒作为输入单位，保存到 FlowEngine 时转换为毫秒。

资源占用时长由候选提供者根据资源获取点、设备 operation 和预期释放点计算。它可以长于单个 operation 的预计时长。

系统默认 1 秒只用于缺少配置的 node execution。候选提供者若无法确定资源获取点、释放点或占用区间，不得为 resource occupancy 使用 1 秒兜底；该候选应以明确的验证错误保持未排程。

第一版默认参数：

```text
DefaultExpectedDuration       1 秒
DelayTolerance                max(30 秒, ExpectedDuration * 10%)
DelayScanInterval             5 秒
ReplanDebounceWindow          3 秒
FreezeWindow                  30 秒
DelayedExtensionRatio         25%
SolverTimeLimit               10 秒
```

所有参数由排程选项配置，默认值不写死在 UI 中。

## 9. 求解模型

### 9.1 硬约束

- 同一 flow 已确定路径上的节点满足前置关系。
- 同一 `(ResourceType, ResourceId)` 的资源占用区间不能重叠。
- 已经开始的 node execution 和 resource occupancy 固定。
- 冻结窗口内尚未开始的计划项默认固定。
- 新计划不能安排在滚动窗口之外。
- 已知的资源获取到释放关系必须保持完整。

### 9.2 目标函数

第一版按以下优先级构建加权目标：

1. 获得可行计划。
2. 最小化超期时间。
3. 最小化 makespan。
4. 最小化相对上一计划的位移，降低计划抖动。

原型中的 `Priority` 字段进入目标权重，不再只作为未使用的预留字段。

### 9.3 未知分支

只有已确定或当前可可靠展开的路径进入快照。operation 完成后才确定的回路或分支，在结果确定时创建新的 occurrence，并触发滚动重排。求解器不为所有可能分支预留设备。

## 10. 计划驱动执行

### 10.1 Flow 级

启用全局排程后，新 FlowTask 先进入等待计划状态。初始计划提交且到达 flow 计划启动时间后，才进入现有 executor。

### 10.2 Node 级 PlanGate

```text
Operation 到达
  -> 定位 FlowTaskId + NodeId + Occurrence
  -> 等待已提交计划
  -> 等待 PlannedStart
  -> 进入现有 Acquire
  -> 执行 operation
```

`PlanGate` 只控制何时允许尝试获取资源。`Acquire` 仍检查真实资源状态。计划到点但获取失败时：

- 记录 `AcquireFailed`。
- 当前节点保持等待。
- 请求滚动重排。
- 不绕过资源锁。

未启用排程或 operation 未标记为可排程时，保持现有执行行为。

## 11. 实际反馈与延迟判定

设备只提供开始与完成事件，因此第一版不估算实时进度。

### 11.1 开始

收到节点开始事件后：

- 写入 `ActualStart`。
- 设置 `PredictedEnd = ActualStart + ExpectedDuration`。
- 将对应节点固定。

### 11.2 完成

收到节点完成事件后：

- 写入 `ActualEnd`。
- 标记 node execution 完成。
- 若提前完成，请求一次可合并的滚动重排。
- 不据此结束 resource occupancy。

### 11.3 资源释放

收到资源释放事件后才写入 resource occupancy 的 `ActualEnd`。这是 FlowView 资源泳道和后续资源可用时间的事实来源。

### 11.4 延迟

后台每 5 秒扫描运行节点。超过 `PlannedEnd + DelayTolerance` 且没有完成事件时：

- 标记 `ExecutionDelayed`。
- 节点继续运行并保持资源占用。
- `PredictedEnd` 每轮增加原预计时长的 25%。
- 固定该节点，重排所有允许移动的后续节点。

第一次延迟以 `PlannedEnd + DelayTolerance` 为阈值。延长 `PredictedEnd` 后，只有当前时间再次超过 `PredictedEnd + DelayTolerance` 才产生下一次延迟反馈和重排，不能在每个扫描周期重复累加。

`ExecutionTimeout` 是独立的设备异常策略。排程延迟不能直接取消 operation。

### 11.5 计划未开始

到达 `PlannedStart + DelayTolerance` 仍未开始时记录 `PlanMissed`。常见原因是前置节点、PlanGate 或资源获取阻塞。

## 12. 滚动重排协调

自动触发包括：

- node started。
- node completed。
- resource released。
- plan missed。
- execution delayed。
- acquire failed。

FlowView 同时提供手动“立即重排”。

同一时间只允许一个求解任务运行。3 秒内的多个请求合并为一次快照，求解期间收到的新请求在当前求解结束后最多再触发一轮，避免并发计划互相覆盖。

## 13. API

FlowEngine.Server 新增：

```text
GET  /api/SchedulePlans/current
GET  /api/SchedulePlans/{id}
GET  /api/SchedulePlans/history
GET  /api/SchedulePlans/{id}/comparison?previousPlanId={id}
POST /api/SchedulePlans/replan
```

`replan` 返回已接受的 solve attempt。FlowView 轮询 attempt 或当前计划，不能假设请求返回时新计划已经提交。

当前计划响应包含：

- 计划摘要、求解状态和触发原因。
- node execution items。
- resource occupancy items。
- 实际开始、结束、偏差和延迟原因。
- 显示标签与业务上下文。
- 最近失败求解摘要。

comparison 响应只返回新增、删除、移动、冻结及状态变化的计划项，不让 FlowView 自行推导版本差异。

## 14. FlowView 排程工作台

新增 `/scheduling` 页面和侧栏入口，采用资源监控优先布局。

### 14.1 页面摘要

顶部显示：

- 当前计划版本和滚动窗口。
- 运行中、延迟和等待节点数量。
- 资源利用率。
- 预计完工时间。
- 手动重排按钮及最近求解状态。

### 14.2 资源泳道

每行表示一个确定资源，时间块使用 resource occupancy 数据。块内短标签为：

```text
订单或任务编号 / 托盘 · 节点名称
```

点击后打开右侧详情，显示：

- FlowTask 和 OperationTask。
- 订单、托盘等业务对象。
- Node、resource type 和 resource id。
- 计划与实际时间。
- 当前状态、偏差和重排原因。

operation 完成但资源未释放时，实际资源占用条保持开放状态。

### 14.3 计划与实际

同一时间轴叠加：

- 空心框：计划区间。
- 实心条：实际区间。
- 绿色：按时或提前。
- 红色：延迟。
- 仅计划框：尚未开始。

### 14.4 滚动重排展示

历史面板显示计划版本、触发时间、触发原因、求解状态和移动节点数。相邻版本对比显示节点原时间、新时间以及冻结未移动原因。

### 14.5 刷新策略

页面加载后每 5 秒刷新当前计划。手动重排后立即查询 solve attempt 并刷新。SignalR 增量通知作为后续优化，不是第一版依赖。

## 15. 错误与降级

### 15.1 无可行解

- 记录失败 solve attempt。
- 当前已提交计划继续生效。
- 新任务保持等待排程。
- FlowView 显示失败原因和最近成功计划。

### 15.2 求解超时

- 有 feasible solution 时提交 best feasible plan。
- 没有 feasible solution 时保留当前计划并记录超时。

### 15.3 API 或页面刷新失败

- FlowView 保留最后成功快照并显示数据时间。
- 不因读取失败触发写操作。
- 手动重排失败时恢复按钮并展示服务端原因。

### 15.4 计划与事实冲突

资源真实状态优先。`AcquireFailed` 进入反馈并触发重排，绝不强制占用资源。

## 16. 测试策略

### 16.1 FlowEngine

- 相同资源的 occupancy 不重叠。
- operation 完成但资源未释放时，occupancy 仍保持运行。
- 同一 Node 的多个 occurrence 生成独立计划项。
- 未知循环分支在确定后加入下一计划。
- 已运行和冻结节点不移动。
- 提前完成、延迟和 acquire failed 合并触发重排。
- `Priority`、超期、makespan 和稳定性目标按顺序生效。
- 未启用排程时现有行为不变。

### 16.2 FlowEngine.Server

- 当前计划、历史、详情和 comparison 返回稳定契约。
- 手动重排返回 solve attempt。
- 失败求解不替换当前计划。

### 16.3 Backend Demo

- 入库和出库任务提供固定设备资源与业务显示元数据。
- FlowTask 按计划启动。
- operation 经过 PlanGate 后进入 Acquire。
- 节点开始、完成和资源释放回写正确实际时间。
- HTTP 端到端测试可观察计划版本变化。

### 16.4 FlowView

- 页面摘要和刷新状态。
- 资源泳道按 resource 分组。
- 点击占用块展示完整任务身份。
- 计划与实际时间正确叠加。
- operation 完成但资源未释放时仍显示占用。
- 版本差异、冻结原因和失败求解状态。
- 手动重排按钮的提交、等待、成功和失败状态。

## 17. 分阶段实施

### 阶段一：模型与持久化

升级 task key，增加 node execution、resource occupancy、计划、反馈和 solve attempt 数据模型。

### 阶段二：协调器与 PlanGate

实现快照、目标函数、计划版本、滚动重排、延迟扫描、flow gate 和 node gate。

### 阶段三：Server 与 Backend Demo

提供 API，注册候选提供者，接入真实入库/出库流程和资源事件。

### 阶段四：FlowView

实现排程页面、资源泳道、任务详情、计划/实际和版本对比。

每个阶段完成后分别运行所属仓库的完整测试。阶段四完成后启动 Backend Demo 与 FlowView 做浏览器端到端验证。

## 18. 验收标准

- 多个 flow 竞争确定设备时，计划中的资源占用区间不重叠。
- 节点实际按 PlanGate 计划进入 Acquire。
- operation 完成但托盘未取走时，资源仍保持占用且 Gantt 正确展示。
- 提前完成、执行延迟和资源获取失败会产生新计划版本。
- 已运行和冻结节点不会被滚动重排移动。
- 调度员能从任意占用块定位 FlowTask、OperationTask、订单、托盘和资源。
- 调度员能对比计划与实际，并解释相邻计划版本的变化原因。
- 无可行解时系统保留上一成功计划，FlowView 清楚展示失败状态。
- 关闭全局排程后，现有 FlowEngine 与 Backend Demo 行为保持不变。
