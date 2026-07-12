# FlowEngine Global Scheduling Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the CP-SAT prototype into a persisted rolling scheduler that distinguishes node execution from resource occupancy and gates flow/node execution without bypassing existing resource locks.

**Architecture:** `FlowEngine.Execution.Scheduling` owns candidate contracts, CP-SAT modeling, immutable plan versions, runtime feedback, rolling coordination, flow release, and `PlanGate`. `Acquire` remains the final resource authority. Unknown loop visits enter the next snapshot with an occurrence number.

**Tech Stack:** .NET 10, C#, Google OR-Tools CP-SAT, FlowEngine Data/EF abstractions, xUnit

**Repository:** `/Users/qiping/Desktop/codes/work/FlowEngine`

---

### Task 1: Separate execution from occupancy

**Files:**
- Modify: `src/FlowEngine.Execution/src/Scheduling/ScheduleTaskKey.cs`
- Replace: `src/FlowEngine.Execution/src/Scheduling/ScheduleTask.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/NodeExecution.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/ResourceOccupancy.cs`
- Modify: `src/FlowEngine.Execution/src/Scheduling/ScheduleProblem.cs`
- Modify: `src/FlowEngine.Execution/src/Scheduling/ScheduleResultItem.cs`
- Modify: `src/FlowEngine.Execution/src/Scheduling/CpSatScheduleSolver.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/CpSatScheduleSolverTest.cs`

- [ ] **Step 1: Write failing occurrence and occupancy tests**

Add one test with `Operation1` occurrences 1 and 2, and one test where a two-second node holds a resource for eight seconds. Assert repeated keys coexist and resource occupancy intervals do not overlap.

```csharp
var key = new ScheduleTaskKey(101L, "Operation1", occurrence: 2);
var occupancy = new ResourceOccupancy("Device", "device-1", TimeSpan.Zero, TimeSpan.FromSeconds(8));
var execution = new NodeExecution(key, TimeSpan.FromSeconds(2), occupancies: new[] { occupancy });
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~CpSatScheduleSolverTest
```

Expected: compilation fails because the occurrence and split interval contracts do not exist.

- [ ] **Step 3: Add the model contracts**

Use these shapes:

```csharp
public sealed record ScheduleTaskKey(long FlowTaskId, string NodeId, int Occurrence);

public enum ScheduleItemKind {
    NodeExecution,
    ResourceOccupancy,
}

public sealed record ResourceOccupancy(
    string ResourceType,
    string ResourceId,
    TimeSpan StartOffset,
    TimeSpan ExpectedDuration);
```

`NodeExecution` owns key, expected duration, predecessors, occupancies, priority, due time, optional fixed start, and optional previous start. Change `ScheduleProblem.Tasks` to `IReadOnlyList<NodeExecution>`. Add item kind and occurrence to result items.

- [ ] **Step 4: Model both interval kinds**

Create one execution interval per node. Create occupancy intervals with `occupancyStart == executionStart + StartOffset`. Group only occupancy intervals by `(ResourceType, ResourceId)` for `AddNoOverlap`. Emit both interval kinds in the result.

- [ ] **Step 5: Run scheduling tests and commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~FlowEngine.Execution.Scheduling.Test
git add src/FlowEngine.Execution/src/Scheduling src/FlowEngine.Execution/test/Scheduling
git commit -m "Separate schedule execution and occupancy"
```

### Task 2: Add rolling-schedule constraints and objectives

**Files:**
- Modify: `src/FlowEngine.Execution/src/Scheduling/CpSatScheduleSolver.cs`
- Modify: `src/FlowEngine.Execution/src/Scheduling/ScheduleResult.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/ScheduleSolverStatus.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/CpSatScheduleSolverTest.cs`

- [ ] **Step 1: Write failing behavior tests**

Add separate tests proving fixed work does not move, higher priority completes first when resource demand is equal, earlier due time wins, and previous start is preferred when higher-level objectives tie.

```csharp
var task = new NodeExecution(
    new ScheduleTaskKey(101L, "Work", 1),
    TimeSpan.FromMinutes(3),
    fixedStart: HorizonStart.AddMinutes(4));
Assert.Equal(HorizonStart.AddMinutes(4), Solve(task).NodeItems.Single().PlannedStartTime);
```

- [ ] **Step 2: Run RED**

Run the Task 1 test command. Expected: current solver ignores these fields.

- [ ] **Step 3: Implement constraints and weighted objective**

Pin fixed starts with equality. Model lateness and absolute movement. Use finite-horizon weights so objective priority is: weighted lateness, priority-weighted completion, makespan, total movement. Return solver status, objective value, and best bound.

- [ ] **Step 4: Run tests and commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~FlowEngine.Execution.Scheduling.Test
git add src/FlowEngine.Execution/src/Scheduling src/FlowEngine.Execution/test/Scheduling
git commit -m "Add rolling schedule objectives"
```

### Task 3: Persist plans, feedback, and solve attempts

**Files:**
- Create: `src/FlowEngine.Execution/src/Scheduling/SchedulePlan.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/SchedulePlanItem.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/RuntimeScheduleFeedback.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/ScheduleSolveAttempt.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/ISchedulePlanStore.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/DbSchedulePlanStore.cs`
- Modify: `src/FlowEngine.Execution/src/DependencyInjection/ExecutionServiceCollectionExtensions.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/SchedulePlanPersistenceTest.cs`

- [ ] **Step 1: Write a failing current-plan test**

Save and commit version 1, commit version 2, then assert version 1 is superseded and version 2 is current. Save a failed attempt and assert it does not replace current.

- [ ] **Step 2: Run RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~SchedulePlanPersistenceTest
```

- [ ] **Step 3: Implement entities and transactional store**

Use `long` IDs and explicit foreign keys. `CommitAsync` supersedes old current and commits new current in one writer transaction.

```csharp
public interface ISchedulePlanStore {
    Task<SchedulePlan?> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task<SchedulePlan?> GetByIdAsync(long id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SchedulePlan>> GetHistoryAsync(CancellationToken cancellationToken = default);
    Task CommitAsync(SchedulePlan plan, CancellationToken cancellationToken = default);
    Task AddFeedbackAsync(RuntimeScheduleFeedback feedback, CancellationToken cancellationToken = default);
    Task AddSolveAttemptAsync(ScheduleSolveAttempt attempt, CancellationToken cancellationToken = default);
}
```

Register plan, item, feedback, and attempt entities with `AddDataCore`, and register the database store.

- [ ] **Step 4: Run persistence and complete Execution tests; commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj
git add src/FlowEngine.Execution
git commit -m "Persist schedule plans and feedback"
```

### Task 4: Build snapshots and coordinate rolling replans

**Files:**
- Create: `src/FlowEngine.Execution/src/Scheduling/IScheduleCandidateProvider.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/SchedulingSnapshotBuilder.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/IGlobalScheduleCoordinator.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/GlobalScheduleCoordinator.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/GlobalSchedulingOptions.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/GlobalScheduleCoordinatorTest.cs`

- [ ] **Step 1: Write failing freeze and coalescing tests**

Use fake providers and solver. Assert started and 30-second-window items become fixed, candidates without a bounded resource release interval are rejected, three triggers inside three seconds cause one solve, and triggers during solving cause at most one follow-up.

- [ ] **Step 2: Run RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~GlobalScheduleCoordinatorTest
```

- [ ] **Step 3: Define provider and coordinator contracts**

```csharp
public interface IScheduleCandidateProvider {
    Task<IReadOnlyList<NodeExecution>> GetCandidatesAsync(
        ScheduleCandidateContext context,
        CancellationToken cancellationToken = default);
}

public interface IGlobalScheduleCoordinator {
    Task<ScheduleSolveAttempt> RequestReplanAsync(
        ScheduleTrigger trigger,
        string? detail = null,
        CancellationToken cancellationToken = default);
}
```

- [ ] **Step 4: Implement one-reader coordination**

Use a `Channel<ReplanRequest>` with one reader. Drain requests for the debounce window, build one snapshot, solve, persist an attempt, and commit only feasible plans. Keep one pending flag for requests arriving during solve.

- [ ] **Step 5: Run tests and commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~GlobalScheduleCoordinatorTest
git add src/FlowEngine.Execution/src/Scheduling src/FlowEngine.Execution/test/Scheduling
git commit -m "Add rolling schedule coordination"
```

### Task 5: Record runtime facts at real boundaries

**Files:**
- Create: `src/FlowEngine.Execution/src/Scheduling/IScheduleRuntimeFeedback.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/ScheduleRuntimeFeedback.cs`
- Modify: `src/FlowEngine.Execution/src/Resource/AcquireResourceTask.cs`
- Modify: `src/FlowEngine.Execution/src/Resource/ReleaseResourceTask.cs`
- Modify: `src/FlowEngine.Execution/src/FlowEngine/ResourceStore.cs`
- Modify: `src/FlowEngine.Execution/src/Consoles/OperationTask.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/ScheduleRuntimeFeedbackTest.cs`

- [ ] **Step 1: Write failing boundary tests**

Assert node completion closes only node execution; resource occupancy remains open until ResourceManager releases the resource.

```csharp
await feedback.NodeCompletedAsync(operationTask);
Assert.NotNull(nodeItem.ActualEnd);
Assert.Null(occupancyItem.ActualEnd);
await feedback.ResourceReleasedAsync(flowTaskId, resource, releasedAt);
Assert.Equal(releasedAt, occupancyItem.ActualEnd);
```

- [ ] **Step 2: Run RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~ScheduleRuntimeFeedbackTest
```

- [ ] **Step 3: Implement explicit feedback calls**

Call node started before `DoStartAsync` and node completed after successful processing. Record acquisition immediately after `AcquireResourceTask` returns successfully, where `ParentFlowTaskId` and the acquired resource are both known. Record release in explicit `ReleaseResourceTask` and in `ResourceStore.ReleaseAsync` for flow-finalization releases. Deduplicate release feedback by open occupancy item. On acquire failure, write `AcquireFailed` and request a replan; node completion and resource release also request coalesced replans. Keep `ResourceLockEvent` as audit history; do not use its delayed acquire write as the acquisition timestamp.

- [ ] **Step 4: Run resource and scheduling tests; commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter "FullyQualifiedName~Scheduling|FullyQualifiedName~Resource"
git add src/FlowEngine.Execution
git commit -m "Record schedule runtime feedback"
```

### Task 6: Gate operation execution

**Files:**
- Create: `src/FlowEngine.Execution/src/Scheduling/IPlanGate.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/PlanGate.cs`
- Modify: `src/FlowEngine.Execution/src/Consoles/ConsoleBase.cs`
- Modify: `src/FlowEngine.Execution/src/Consoles/OperationTask.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/PlanGateTest.cs`

- [ ] **Step 1: Write failing gate tests**

Cover planned-start waiting, cancellation, disabled scheduling, missing committed item, and occurrence matching. Assert `StartingTime` remains null while gated.

- [ ] **Step 2: Run RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~PlanGateTest
```

- [ ] **Step 3: Implement the gate**

```csharp
public interface IPlanGate {
    Task WaitAsync(IOperationTask task, CancellationToken cancellationToken = default);
}
```

Assign and persist occurrence before the gate. Wait in `OperationTask.ExecuteAsync` before `Scheduled -> Starting`. Never wait in `FlowTask.ScheduleExecutableAsync` or `ConsoleBase.ScheduleAsync`, which may be called while flow state is locked.

- [ ] **Step 4: Run console/flow tests and commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter "FullyQualifiedName~PlanGateTest|FullyQualifiedName~Consoles.Test|FullyQualifiedName~FlowEngine.Test"
git add src/FlowEngine.Execution
git commit -m "Gate operation execution by schedule"
```

### Task 7: Gate flow startup and recover waiting flows

**Files:**
- Modify: `src/FlowEngine.Execution/src/FlowEngine/FlowScheduler.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/IFlowPlanGate.cs`
- Create: `src/FlowEngine.Execution/src/Scheduling/FlowPlanGate.cs`
- Test: `src/FlowEngine.Execution/test/FlowEngine/FlowSchedulerPlanGateTest.cs`

- [ ] **Step 1: Write failing flow-gate tests**

Assert enabled scheduling stores but does not enqueue before planned start, releases at planned start, recovers waiting tasks on `StartAsync`, and preserves existing behavior when disabled.

- [ ] **Step 2: Run RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~FlowSchedulerPlanGateTest
```

- [ ] **Step 3: Integrate delayed enqueue**

Keep FlowScheduler responsible for create/store. Delegate delayed release to `IFlowPlanGate`; never occupy a limited executor slot while waiting. Recover persisted scheduled tasks at startup.

- [ ] **Step 4: Run tests and commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~FlowEngine.Test
git add src/FlowEngine.Execution
git commit -m "Gate flow startup by schedule"
```

### Task 8: Detect misses and repeated delay thresholds

**Files:**
- Create: `src/FlowEngine.Execution/src/Scheduling/ScheduleDelayMonitor.cs`
- Modify: `src/FlowEngine.Execution/src/Scheduling/GlobalSchedulingOptions.cs`
- Modify: `src/FlowEngine.Execution/src/Scheduling/SchedulingServiceCollectionExtensions.cs`
- Test: `src/FlowEngine.Execution/test/Scheduling/ScheduleDelayMonitorTest.cs`

- [ ] **Step 1: Write fake-clock tests**

Assert first delay at `PlannedEnd + tolerance`, no duplicate on every five-second scan, next delay only after `PredictedEnd + tolerance`, and plan miss at `PlannedStart + tolerance`.

- [ ] **Step 2: Run RED**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~ScheduleDelayMonitorTest
```

- [ ] **Step 3: Implement monitor and defaults**

Use `TimeProvider`. Defaults: one-second node duration, five-second scan, three-second debounce, 30-second freeze, `max(30 seconds, 10%)` tolerance, 25% delayed extension, ten-second solver limit.

- [ ] **Step 4: Run scheduling tests and commit**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj \
  --filter FullyQualifiedName~FlowEngine.Execution.Scheduling.Test
git add src/FlowEngine.Execution
git commit -m "Add schedule delay detection"
```

### Task 9: Complete DI, verification, and package version

**Files:**
- Modify: `src/FlowEngine.Execution/src/Scheduling/SchedulingServiceCollectionExtensions.cs`
- Modify: `src/FlowEngine.Execution/test/Scheduling/SchedulingServiceCollectionExtensionsTest.cs`
- Modify: `Directory.Build.props`

- [ ] **Step 1: Extend the DI test**

Resolve solver, store, coordinator, node/flow gates, feedback service, and hosted delay monitor.

- [ ] **Step 2: Run RED, then complete registrations**

Use `TryAdd*` for overridable providers. Set a unique package version above Backend's `preview.8`, such as `preview.9`.

- [ ] **Step 3: Run complete verification**

```bash
dotnet test src/FlowEngine.Execution/test/FlowEngine.Execution.Test.csproj
dotnet test FlowEngine.sln
dotnet pack src/FlowEngine.Execution/src/FlowEngine.Execution.csproj \
  -o /tmp/flowengine-scheduling-pack
```

Expected: all tests pass and a new preview package is produced.

- [ ] **Step 4: Commit**

```bash
git add Directory.Build.props src/FlowEngine.Execution
git commit -m "Complete global scheduling runtime"
```
