# FlowEngine Server and Backend Scheduling Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose global scheduling APIs and make Backend Demo provide real warehouse candidates, business labels, persistence migrations, and end-to-end execution feedback.

**Architecture:** FlowEngine.Server maps scheduling runtime state to stable read/replan contracts. Backend Demo consumes the new FlowEngine preview, contributes fixed-console candidates and business display metadata, and persists scheduling entities in SQLite. Dynamic location, port, and pallet fallback resources remain outside fixed-resource scheduling.

**Tech Stack:** .NET 10, ASP.NET Core, FlowEngine dynamic controllers, EF Core SQLite, xUnit, WebApplicationFactory

**Repositories:** `/Users/qiping/Desktop/codes/work/FlowEngine`, then `/Users/qiping/Desktop/codes/work/Backend`

**Depends on:** `2026-07-13-flowengine-global-scheduling-core-implementation-plan.md`

---

### Task 1: Add stable SchedulePlans server contracts

**Files:**
- Create: `FlowEngine/src/FlowEngine.Server/src/Execution/SchedulePlanModels.cs`
- Create: `FlowEngine/src/FlowEngine.Server/src/Execution/SchedulePlansController.cs`
- Modify: `FlowEngine/src/FlowEngine.Server/src/Execution/ExecutionControllersServiceCollectionExtensions.cs`
- Test: `FlowEngine/src/FlowEngine.Server/test/Execution/SchedulePlansControllerTest.cs`

- [ ] **Step 1: Write failing controller tests**

Cover current, by-id, history, comparison, and replan. Assert current contains `LatestSolveAttempt`, allowing FlowView to poll manual-replan completion without another endpoint.

```csharp
var response = await controller.GetCurrentAsync();
var model = Assert.IsType<SchedulePlanModel>(Assert.IsType<OkObjectResult>(response).Value);
Assert.Equal(18, model.Version);
Assert.Equal(ScheduleSolveStatus.Running, model.LatestSolveAttempt!.Status);
```

- [ ] **Step 2: Run RED**

```bash
cd /Users/qiping/Desktop/codes/work/FlowEngine
dotnet test src/FlowEngine.Server/test/FlowEngine.Server.Test.csproj \
  --filter FullyQualifiedName~SchedulePlansControllerTest
```

Expected: controller and response contracts do not exist.

- [ ] **Step 3: Define exact response contracts**

Use `long` IDs and `DateTimeOffset` values. Include node and occupancy items, actual/predicted times, business label/context, status, trigger, and latest attempt.

```csharp
public sealed record SchedulePlanComparisonModel(
    long PlanId,
    long PreviousPlanId,
    IReadOnlyList<SchedulePlanChangeModel> Changes);

public sealed record SchedulePlanChangeModel(
    SchedulePlanChangeKind Kind,
    long? CurrentItemId,
    long? PreviousItemId,
    DateTimeOffset? PreviousStart,
    DateTimeOffset? CurrentStart,
    string? Reason);
```

- [ ] **Step 4: Implement and register the controller**

Mark the public controller `[ApiController]` and `[NonController]`. Register with `AddDynamicController<SchedulePlansController>()`. Provide:

```text
GET  /api/SchedulePlans/current
GET  /api/SchedulePlans/{id}
GET  /api/SchedulePlans/history
GET  /api/SchedulePlans/{id}/comparison?previousPlanId={id}
POST /api/SchedulePlans/replan
```

Return `202 Accepted` with `ScheduleSolveAttemptModel` from replan. Compute comparison server-side by schedule operation key and item kind.

- [ ] **Step 5: Run server tests and commit in FlowEngine**

```bash
dotnet test src/FlowEngine.Server/test/FlowEngine.Server.Test.csproj \
  --filter FullyQualifiedName~FlowEngine.Server.Execution.Test
git add src/FlowEngine.Server
git commit -m "Expose global scheduling APIs"
```

### Task 2: Package and consume one new preview version

**Files:**
- Verify: `FlowEngine/Directory.Build.props`
- Use: `Backend/scripts/pack-flowengine-preview.sh`
- Modify: `Backend/src/Backend.Demo/Backend.Demo.csproj`
- Modify: `Backend/src/Backend.Demo.SampleData/Backend.Demo.SampleData.csproj`

- [ ] **Step 1: Pack from the completed FlowEngine branch**

```bash
cd /Users/qiping/Desktop/codes/work/Backend
./scripts/pack-flowengine-preview.sh
ls .nupkg/flowengine/*preview.9.nupkg
```

Expected: FlowEngine, Execution, Equipment, and Server have the same version. Stop if the script generates `preview.6` or deletes the newer package.

- [ ] **Step 2: Update both Backend consumers**

Set all FlowEngine package references in both csproj files to the exact generated version.

- [ ] **Step 3: Restore and compile**

```bash
dotnet restore Backend.Demo.slnx --force-evaluate
dotnet build Backend.Demo.slnx --no-restore
```

Expected: build succeeds before Backend integration code is added.

- [ ] **Step 4: Commit package adoption**

```bash
git add src/Backend.Demo/Backend.Demo.csproj \
  src/Backend.Demo.SampleData/Backend.Demo.SampleData.csproj \
  .nupkg/flowengine
git commit -m "Use global scheduling FlowEngine preview"
```

### Task 3: Provide fixed-console schedule candidates

**Files:**
- Create: `Backend/src/Backend.Demo/Scheduling/BackendDemoScheduleCandidateProvider.cs`
- Create: `Backend/src/Backend.Demo/Scheduling/BackendDemoScheduleDisplayMetadata.cs`
- Modify: `Backend/src/Backend.Demo/DependencyInjection/BackendDemoApplicationServiceCollectionExtensions.cs`
- Test: `Backend/src/Backend.Demo.Tests/BackendDemoScheduleCandidateProviderTest.cs`

- [ ] **Step 1: Write failing mapping tests**

Assert these fixed mappings:

```text
ConveyorToInboundPort          ConsoleInfo / ConveyorConsole.NAME
StackCraneMoveToRack           ConsoleInfo / StackCraneConsole.NAME
StackCraneMoveToOutboundPort   ConsoleInfo / StackCraneConsole.NAME
ConveyorFromOutboundPort       ConsoleInfo / ConveyorConsole.NAME
```

Also assert duration comes from node metadata, missing node duration falls back to one second, a fixed occupancy without a known release boundary is rejected, and dynamic Location/Port/Pallet resources are not emitted as fixed occupancies.

- [ ] **Step 2: Run RED**

```bash
cd /Users/qiping/Desktop/codes/work/Backend
dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj \
  --filter FullyQualifiedName~BackendDemoScheduleCandidateProviderTest
```

- [ ] **Step 3: Implement provider and display metadata**

Use `IReader` to correlate `FlowTaskId` with inbound/outbound orders. Produce labels such as `IN-1001 / PLT-IN-1001 · 上架` and JSON context containing order type/id/code, SKU, pallet, and known source/target location.

For outbound fallback, use the actually acquired source resource. Never identify the requested source location as the actual source after fallback.

```csharp
services.AddSingleton<IScheduleCandidateProvider, BackendDemoScheduleCandidateProvider>();
```

- [ ] **Step 4: Run tests and commit**

```bash
dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj \
  --filter FullyQualifiedName~BackendDemoScheduleCandidateProviderTest
git add src/Backend.Demo/Scheduling \
  src/Backend.Demo/DependencyInjection \
  src/Backend.Demo.Tests/BackendDemoScheduleCandidateProviderTest.cs
git commit -m "Provide warehouse schedule candidates"
```

### Task 4: Register scheduling persistence and migrate SQLite

**Files:**
- Modify: `Backend/src/Backend.Demo/DependencyInjection/BackendDemoApplicationServiceCollectionExtensions.cs`
- Modify: `Backend/src/Backend.Demo/DependencyInjection/BackendDemoDataServiceCollectionExtensions.cs`
- Modify: `Backend/src/Backend.Demo.Tests/EntityRegistrationTest.cs`
- Modify: `Backend/src/Backend.Demo.Tests/BackendDemoInitializationTest.cs`
- Create: migration files matching `Backend/src/Backend.Demo/Migrations/*_AddGlobalScheduling.cs`
- Create: migration files matching `Backend/src/Backend.Demo/Migrations/*_AddGlobalScheduling.Designer.cs`
- Modify: `Backend/src/Backend.Demo/Migrations/DataDbContextModelSnapshot.cs`

- [ ] **Step 1: Write failing DI and model assertions**

Resolve scheduling coordinator/store/provider. Assert EF model contains plan, item, feedback, and solve-attempt entities. Run initialization twice and assert it is idempotent.

- [ ] **Step 2: Run RED**

```bash
dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj \
  --filter "FullyQualifiedName~EntityRegistrationTest|FullyQualifiedName~BackendDemoInitializationTest"
```

- [ ] **Step 3: Complete DI and generate migration**

Prefer entity registration supplied by `AddExecution/AddScheduling`; add explicit entities only if the package contract requires host opt-in.

```bash
dotnet ef migrations add AddGlobalScheduling \
  --project src/Backend.Demo \
  --startup-project src/Backend.Demo
```

Use the filenames generated by EF; do not hand-author migration metadata.

- [ ] **Step 4: Re-run tests and commit**

```bash
dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj \
  --filter "FullyQualifiedName~EntityRegistrationTest|FullyQualifiedName~BackendDemoInitializationTest"
git add src/Backend.Demo src/Backend.Demo.Tests
git commit -m "Persist Backend scheduling state"
```

### Task 5: Verify plan-driven execution through HTTP

**Files:**
- Create: `Backend/src/Backend.Demo.Tests/BackendDemoSchedulingApiSmokeTest.cs`
- Reuse patterns from: `Backend/src/Backend.Demo.Tests/BackendDemoApiSmokeTest.cs`

- [ ] **Step 1: Write a failing two-flow contention test**

Use existing `WebApplicationFactory<Program>`, temporary SQLite, and adjustable operation delays. Start two orders using the same console. Poll `/api/SchedulePlans/current` and assert occupancy intervals do not overlap.

- [ ] **Step 2: Add gate and feedback assertions**

Assert the later operation does not get `StartingTime` before planned release. Assert node completion closes node execution but occupancy remains open. Assert resource release closes occupancy.

- [ ] **Step 3: Add rolling replan assertions**

Delay an operation beyond tolerance and wait for plan version increment. Call `POST /api/SchedulePlans/replan`; poll current until `LatestSolveAttempt.Id` matches the returned attempt and reaches a terminal status.

- [ ] **Step 4: Run RED**

```bash
dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj \
  --filter FullyQualifiedName~BackendDemoSchedulingApiSmokeTest \
  -m:1 /nr:false
```

Expected before final wiring: API, gate timing, or feedback assertion fails for the missing integration.

- [ ] **Step 5: Make only integration fixes required by the test**

Limit changes to candidate mapping, DI, timing configuration, and API mapping. Do not schedule dynamic fallback Location/Port resources as fixed IDs.

- [ ] **Step 6: Run full Backend verification and commit**

```bash
dotnet test Backend.Demo.slnx --no-restore -v minimal -m:1 /nr:false
git add src
git commit -m "Verify Backend plan-driven scheduling"
```
