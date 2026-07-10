# FlowView Agent 项目工作台设计

## 1. 背景与目标

FlowView 当前是 WMS + WCS Demo 的可视化前端，支持订单、流程定义、流程编辑、预检与仿真、任务执行图和运行控制。新功能要将它升级为一个以 Agent 任务为中心的交互软件，同时保留现有可视化能力。

第一阶段服务流程设计人员和仓库运维人员，核心目标是：

1. 根据用户的自然语言流程描述，构建符合 CentreX 架构标准的流程草稿。
2. 支持国内外主流大模型，并可按项目配置和切换模型。
3. 提供类似 Codex 的项目化工作方式：一个客户/仓库项目统一包含多条流程、Agent 对话、草稿版本和执行记录。
4. 对所有有副作用的操作先展示精确变更，由有权限的用户确认后执行。

## 2. 范围

### 2.1 第一阶段包含

- 客户/仓库项目工作空间。
- CentreX 登录和基于角色的权限控制。
- 可恢复的 Agent 对话与任务运行。
- 自然语言到结构化 CentreX 流程草稿。
- 流程校验、预检、仿真与可视化差异。
- 订单、任务、节点和资源的只读诊断。
- 经审批的草稿保存、流程发布及单任务取消、重试、跳过。
- Provider 级模型配置、能力检测和切换。
- 审计日志、错误恢复及跨服务关联 ID。

### 2.2 第一阶段不包含

- Agent 自主执行未经用户确认的写操作。
- 批量取消、批量跳过、批量发布等高风险操作。
- 由模型生成并执行任意代码或 SQL。
- 通用知识库编辑器、计费系统或模型训练平台。
- 替换 CentreX/FlowEngine 的流程运行时。

## 3. 方案选择

采用独立 Agent 服务方案：

```text
FlowView -> FlowAgent -> Backend Demo -> CentreX / FlowEngine
    |           |              |
    |           |              +-- 订单、流程、任务、资源 API
    |           +-- 模型、编排、工具、审批、会话、审计
    +-- 项目工作台、对话、预览、确认、结果视图
```

新建独立代码仓库，暂定名为 `FlowAgent`。FlowView 不保存模型密钥，也不负责执行 Agent 工具。Backend Demo 仍是 WMS 业务状态的权威来源，CentreX/FlowEngine 仍是流程结构与运行规则的权威来源。

不采用把 Agent 直接集成进 Backend Demo 的方案，因为它会把通用 Agent 能力与单个 Demo 业务绑定。不采用纯浏览器 Agent，因为它无法安全保管密钥，也无法可靠实现授权、审批、审计和长任务恢复。

## 4. 项目工作台

### 4.1 核心实体

`Project` 是顶层工作空间，代表一个客户与仓库组合。它包含：

- 项目成员及角色。
- 流程、草稿、版本与发布状态。
- Agent 会话及 AgentRun。
- 仿真、订单、任务与节点执行记录的引用。
- 项目级默认模型、可用模型策略和 CentreX 规则版本。
- 审批请求与审计记录。

FlowAgent 只保存对话、Agent 运行、审批、模型配置及业务对象引用。订单和流程运行数据不在 FlowAgent 中复制为第二份权威数据。

### 4.2 布局

采用 Agent 任务中心布局：

- 左栏显示项目切换、流程、Agent 任务、待确认变更和执行记录。
- 主区显示 Agent 会话、任务步骤、工具调用、校验结果及确认卡片。
- 流程画布、版本差异、仿真甘特图和执行详情作为独立结果页面或分屏打开。
- 顶栏显示当前项目、模型选择、环境和当前用户。

每次用户请求创建一个 `AgentRun`，而不只是追加一条聊天消息。AgentRun 记录状态、步骤、工具调用和产物，页面刷新或断线后仍能恢复。

### 4.3 核心数据关系

```text
Project
  +-- ProjectMember -> User / Role
  +-- FlowReference -> Backend FlowDefinition
  +-- Conversation
  |     +-- Message
  |     +-- AgentRun
  |           +-- RunStep
  |           +-- ToolCall
  |           +-- Artifact
  |           +-- ApprovalRequest
  +-- ModelPolicy
  +-- AuditEvent
```

Artifact 支持流程计划、流程变更集、流程草稿、校验报告、仿真结果、运维诊断和操作建议。大型产物保存为独立对象，消息仅引用其 ID 和摘要。

## 5. Agent 架构

### 5.1 独立组件

- `Conversation Service`：管理项目对话、消息和上下文窗口。
- `Run Orchestrator`：驱动可恢复的 AgentRun 状态机。
- `Model Gateway`：统一 Provider 协议、流式输出、工具调用、结构化输出、取消与用量。
- `Context Builder`：按当前项目、页面和用户权限构建最小必要上下文。
- `Tool Registry`：注册带 JSON Schema、风险等级和权限要求的工具。
- `Flow Compiler`：将模型生成的结构化流程计划编译为 CentreX 流程变更集。
- `Flow Validator`：执行 Schema、CentreX 规则、Backend 预检与仿真校验。
- `Approval Service`：创建、确认、失效和消费审批请求。
- `Audit Service`：记录模型、用户、工具、审批与执行结果。

各组件通过稳定接口协作。Provider SDK、CentreX 流程格式或 Backend API 的变化不应改变 FlowView 的 AgentRun UI 协议。

### 5.2 流程生成数据流

```text
用户描述
  -> Agent 需求理解与缺失信息检查
  -> 结构化 FlowPlan
  -> 读取当前 CentreX 操作目录与约束
  -> Flow Compiler 生成 FlowChangeSet
  -> Schema 与 CentreX 规则校验
  -> Backend 预检和仿真
  -> FlowView 展示画布、语义差异和风险
  -> 用户确认
  -> 服务端再次校验权限、版本和状态
  -> 保存草稿或发布
  -> 记录结果与审计事件
```

模型不能直接输出最终可执行流程文档。模型只生成受限的 FlowPlan 或工具参数；确定性的 Flow Compiler 负责产生 FlowChangeSet 和目标草稿。

### 5.3 运维诊断数据流

Agent 可直接调用只读工具查询订单、任务、节点、事件和资源状态，生成带证据的诊断。取消、重试和跳过等建议必须形成 ApprovalRequest，展示目标对象、当前状态、预期操作和风险，确认后才可执行。

## 6. 工具与审批

### 6.1 风险等级

| 等级 | 行为 | 规则 |
| --- | --- | --- |
| Read | 查询与诊断 | 可直接执行，必须审计 |
| Draft | 生成或修改草稿 | 可生成，不可保存；先展示差异并确认 |
| Execute | 发布或单任务运行控制 | 展示影响和前置状态；有权限用户确认 |
| High Risk | 批量或跨项目写操作 | 第一阶段禁用 |

### 6.2 ApprovalRequest

ApprovalRequest 是不可变对象，至少绑定：

- 项目、用户和所需权限。
- 工具名称和规范化参数哈希。
- 目标对象 ID、版本及前置状态。
- 变更集或操作摘要。
- 创建时间、过期时间和一次性 nonce。
- 生成该变更的 AgentRun、模型和规则版本。

确认时服务端重新检查登录状态、权限、参数哈希、对象版本和前置状态。任何一项变化都会使审批失效，并要求重新预览。审批只能消费一次。

## 7. 模型兼容

### 7.1 首批 Provider

首批实现以下六个 Provider，覆盖主流国际与国内模型：

- OpenAI
- Anthropic Claude
- Google Gemini
- xAI Grok
- DeepSeek
- Alibaba Qwen

Provider 列表不是固定榜单。新增或下线模型只改变配置与适配器，不改变 Agent、工具或 UI 协议。

参考官方能力文档：

- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
- Anthropic Tool Use: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use
- Gemini Function Calling: https://ai.google.dev/gemini-api/docs/function-calling
- xAI Function Calling: https://docs.x.ai/developers/tools/function-calling
- DeepSeek Function Calling: https://api-docs.deepseek.com/guides/function_calling/
- Qwen Function Calling: https://help.aliyun.com/en/model-studio/qwen-function-calling

### 7.2 统一能力模型

Model Gateway 统一暴露：

- 流式文本与结构化事件。
- JSON Schema 结构化输出。
- 工具调用和工具结果。
- 取消、超时、重试和限流。
- Token 用量、费用元数据和 Provider 请求 ID。

每个具体模型注册能力：`chat`、`streaming`、`structuredOutput`、`toolCalling`、`parallelToolCalling`、`contextWindow` 和 `dataPolicy`。流程生成与执行型 Agent 必须同时通过结构化输出和工具调用能力测试；不满足要求的模型只可用于普通问答。

模型密钥只存储在 FlowAgent 服务端的 Secret Store 中。项目只能引用凭据 ID，API 和日志不能返回密钥原文。

## 8. 身份与权限

### 8.1 登录链路

复用 CentreX 已有用户、JWT 登录、角色和权限能力。浏览器不将上游 JWT 持久化到 localStorage。建议链路为：

1. FlowView 向 FlowAgent 登录端点提交凭据。
2. FlowAgent 调用 CentreX/Backend 登录接口并安全保存上游令牌。
3. FlowAgent 向浏览器设置 HttpOnly、Secure、SameSite 会话 Cookie。
4. FlowAgent 代表用户访问 Backend 时传递短期身份令牌。
5. Backend 在每个业务 API 和 SignalR 连接上执行认证与权限检查。

生产部署优先让 FlowView 与 FlowAgent 经同一反向代理域名提供，减少跨域 Cookie 和 CSRF 风险。所有写请求使用 SameSite Cookie、Origin 校验和 CSRF token 组合防护。

### 8.2 权限集合

至少定义：

- 项目管理和成员管理。
- 流程查看、编辑和发布。
- 运行记录查看。
- 任务取消、重试和跳过。
- 模型策略和密钥管理。

流程设计人员默认拥有流程查看、编辑和仿真权限；仓库运维人员默认拥有运行记录查看和获批的单任务控制权限。管理员负责项目成员及模型配置。角色是默认权限集合，服务端最终按具体权限授权。

Agent 的有效权限永远是当前用户权限、项目策略和工具风险策略的交集。

## 9. API 与实时事件边界

FlowView 只依赖 FlowAgent 的稳定 Agent API，并继续使用 Backend 的业务读取页面 API。核心 Agent API 形态为：

- 项目、成员和项目配置。
- 对话、消息和 AgentRun。
- AgentRun 流式事件。
- Artifact 内容与预览。
- ApprovalRequest 查询、确认和拒绝。
- Provider、模型能力和项目 ModelPolicy。

AgentRun 事件至少包含 message delta、step started/completed、tool requested/completed、artifact created、approval required、run completed/failed/cancelled。事件携带单调递增序号；FlowView 重连时按最后序号补取，避免消息丢失或重复。

## 10. 错误处理与安全

- AgentRun 使用持久化状态机，支持断线恢复、取消和有界重试。
- 写工具使用幂等键；网络重试不能产生重复发布或重复运行控制。
- 模型输出依次通过 JSON Schema、CentreX 规则和 Backend 预检，任何失败都不能进入审批执行。
- Backend/CentreX 状态或版本变化会使旧审批失效。
- 模型切换不会继承未消费审批；必须重新生成或重新校验。
- 订单名称、流程描述、日志和工具结果均视为不可信数据，不得覆盖系统策略或授权规则。
- 工具参数在执行前由服务端白名单 Schema 校验，禁止任意 URL、路径、SQL 或代码执行。
- 日志记录结构化错误、关联 ID 和恢复建议，不记录密码、JWT、API key 或完整敏感提示内容。

## 11. 测试与验收

### 11.1 测试层级

- 单元测试：Provider 适配、FlowPlan/FlowChangeSet、规则校验、权限和审批状态机。
- 契约测试：FlowAgent 对 Backend/CentreX API 及 AgentRun 事件协议。
- 集成测试：自然语言到流程草稿、预检、确认、保存的完整闭环。
- 端到端测试：登录、项目切换、流式对话、结果视图、差异预览、运维审批及断线恢复。
- 模型能力测试：使用同一组固定样例验证结构化流程生成、工具选择、无效参数拒绝和中文质量。

### 11.2 第一阶段验收场景

1. 流程设计人员登录项目，描述一条包含顺序、分支、变量绑定和子流程的流程。
2. Agent 生成符合 CentreX 当前操作目录的结构化草稿，完成规则校验、预检和仿真。
3. FlowView 展示流程画布、语义差异及风险；未确认前 Backend 不发生写入。
4. 用户确认后保存草稿，审计记录可追溯用户、模型、变更集和结果。
5. 运维人员查询失败任务，Agent 使用只读证据解释失败原因并提出允许的单任务操作。
6. 未授权用户无法确认或直接调用写工具；对象状态变化后旧审批不可执行。
7. 任一首批 Provider 在通过能力测试后可完成同一流程生成闭环，切换 Provider 不改变 FlowView 交互。

## 12. 跨仓库协作与问题文档

开发阶段允许联动修改 FlowView、Backend、CentreX/FlowEngine，并新增 FlowAgent 仓库。每项修改仍应归属到能力的权威仓库；不能安全或兼容地完成的依赖升级，在 FlowView 的 `docs/integration-issues/` 下输出问题文档。

问题文档必须包含：

- 受影响仓库、版本或提交。
- 当前行为和可复现证据。
- FlowView/FlowAgent 所需能力及业务影响。
- 建议 API、数据结构或权限变化。
- 兼容性、迁移和回滚要求。
- 验收测试。

已知需要在实施计划阶段验证的依赖包括：Backend Demo 当前的全放行授权占位、CentreX JWT 的刷新/撤销策略、SignalR 身份传递、流程规则/Schema 的机器可读导出，以及可供 Agent 消费的预检错误结构。

## 13. 分阶段交付

1. 身份与项目骨架：CentreX 登录、项目、成员、会话和 AgentRun UI。
2. 模型网关：首批 Provider、流式事件、能力测试和密钥管理。
3. 流程设计 Agent：FlowPlan、Flow Compiler、校验、画布/差异预览和草稿审批保存。
4. 运维 Agent：只读诊断、证据展示和获批的单任务控制。
5. 加固：审计、幂等、恢复、模型评测、端到端安全测试和部署文档。

每一阶段应可独立演示和回滚。运维写工具不能早于身份权限、审批与审计基础投入使用。

### 13.1 实施规划边界

本文是跨仓库总体架构规格，不把五个阶段合并为一次大规模实现。后续按以下独立子项目逐个执行“规格补充、实施计划、开发与验收”：

1. 首个实施计划只覆盖“身份与项目骨架”，同时创建 FlowAgent 最小可运行服务及 FlowView Agent 任务中心外壳。
2. 模型网关作为第二个独立实施计划，以统一能力接口和 Provider 契约测试为验收边界。
3. 流程设计 Agent 作为第三个独立实施计划，以“描述到已确认草稿”的闭环为验收边界。
4. 运维 Agent 作为第四个独立实施计划，以只读诊断和单任务获批操作为验收边界。
5. 生产加固作为第五个独立实施计划，在前四项能力稳定后执行。

若首个子项目发现 CentreX/Backend 缺少必须的身份接口，先输出 `docs/integration-issues/` 问题文档并将对应工作列为显式依赖，不能用前端模拟身份或放宽权限绕过。
