# Agent Identity and Project Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working login-to-project-workspace slice across Backend Demo, a new FlowAgent service, and FlowView without adding model calls or flow generation.

**Architecture:** Backend Demo activates FlowEngine/CentreX JWT authentication and becomes the identity authority. A new ASP.NET Core `FlowAgent` BFF exchanges credentials for an upstream token, stores that token in a protected server-side session, exposes project/conversation APIs, and authenticates FlowView with an HttpOnly cookie. FlowView adds protected routes, project selection, and the Codex-style Agent workspace shell.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core SQLite, ASP.NET Data Protection/Cookie Authentication, xUnit, React 19, TypeScript 6, React Router 7, Vitest, Testing Library.

---

## Scope and repository map

This plan implements only phase 1 of `docs/superpowers/specs/2026-07-10-flowview-agent-workspace-design.md`.

- `../Backend`: enable JWT identity, seed an opt-in development user, require authentication, and document configuration.
- `../FlowAgent` (new repository): own browser sessions, projects, project members, conversations, and empty AgentRun records.
- `FlowView`: add login, protected routing, projects, and an Agent workspace shell.
- No Provider SDK, prompt orchestration, flow compiler, tool execution, approval execution, or operational control is included.

## Planned file structure

### Backend

- `src/Backend.Demo/Domain/User.cs`: concrete FlowEngine identity user.
- `src/Backend.Demo/Authentication/DemoAdminOptions.cs`: opt-in development seed configuration.
- `src/Backend.Demo/DependencyInjection/BackendDemoAuthenticationExtensions.cs`: JWT and authenticated policy registration.
- `src/Backend.Demo/Controllers/SessionController.cs`: authenticated current-user contract for FlowAgent.
- `src/Backend.Demo/DependencyInjection/BackendDemoInitializer.cs`: seed the configured development user.
- `src/Backend.Demo/Program.cs`: middleware order and authentication registration.
- `src/Backend.Demo.Tests/BackendDemoAuthenticationTest.cs`: login and unauthenticated API coverage.
- `README.md`: environment variables and login endpoint.

### FlowAgent

- `src/FlowAgent.Api/Program.cs`: composition root and HTTP pipeline.
- `src/FlowAgent.Api/Auth/*`: Backend identity client, protected upstream session, cookie login endpoints.
- `src/FlowAgent.Api/Projects/*`: project/member entities, DTOs, service, endpoints.
- `src/FlowAgent.Api/Conversations/*`: conversation and empty AgentRun entities/endpoints.
- `src/FlowAgent.Api/Persistence/FlowAgentDbContext.cs`: EF model only.
- `src/FlowAgent.Api/Migrations/*`: SQLite schema.
- `test/FlowAgent.Api.Tests/*`: API-level authentication, ownership, and persistence tests.

### FlowView

- `src/agent/types.ts`: Agent API contracts.
- `src/agent/api.ts`: credentialed BFF client.
- `src/auth/AuthProvider.tsx`: session bootstrap and login/logout actions.
- `src/auth/ProtectedRoute.tsx`: route gate.
- `src/pages/LoginPage.tsx`: login form.
- `src/pages/ProjectsPage.tsx`: accessible projects and project creation.
- `src/pages/AgentWorkspacePage.tsx`: selected project's task-center shell.
- `src/components/AgentShell.tsx`: Codex-style project/conversation navigation.
- `src/App.tsx`, `src/main.tsx`, `src/index.css`, i18n files: route and presentation integration.

## Task 1: Activate identity in Backend Demo

**Files:**
- Create: `../Backend/src/Backend.Demo/Domain/User.cs`
- Create: `../Backend/src/Backend.Demo/Authentication/DemoAdminOptions.cs`
- Create: `../Backend/src/Backend.Demo/DependencyInjection/BackendDemoAuthenticationExtensions.cs`
- Create: `../Backend/src/Backend.Demo/Controllers/SessionController.cs`
- Modify: `../Backend/src/Backend.Demo/DependencyInjection/BackendDemoApplicationServiceCollectionExtensions.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/InboundOrdersController.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/OutboundOrdersController.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/WarehousesController.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/LocationsController.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/PortsController.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/PalletsController.cs`
- Modify: `../Backend/src/Backend.Demo/Controllers/SkusController.cs`
- Modify: `../Backend/src/Backend.Demo/Program.cs`
- Test: `../Backend/src/Backend.Demo.Tests/BackendDemoAuthenticationTest.cs`

- [ ] **Step 1: Write the unauthenticated API test**

Create an API test whose factory supplies a temporary SQLite database and JWT settings, then assert that a protected endpoint rejects an anonymous request:

```csharp
[Fact]
public async Task Warehouses_WithoutToken_ReturnsUnauthorized() {
    await using var factory = CreateFactory();
    using var client = factory.CreateClient();

    var response = await client.GetAsync("/api/Warehouses?ShouldPaginate=false");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj --filter BackendDemoAuthenticationTest.Warehouses_WithoutToken_ReturnsUnauthorized`

Expected: FAIL because the current policy returns success for anonymous callers.

- [ ] **Step 3: Add the concrete identity user and authentication registration**

Use a concrete user with no `[Entity]` attribute, as required by FlowEngine `UserBase`:

```csharp
using FlowEngine.Server.Authentication;

namespace Backend.Demo.Domain;

public sealed class User : UserBase;
```

Register the identity model with the existing data context, configure JWT from `JwtToken`, and replace the all-pass policy:

```csharp
using Backend.Demo.Domain;
using FlowEngine.Server.Authentication.Jwt;
using FlowEngine.Server.Authorization.Permissions;

namespace Backend.Demo.DependencyInjection;

public static class BackendDemoAuthenticationExtensions {
    public static IServiceCollection AddBackendDemoAuthentication(
        this IServiceCollection services,
        IConfiguration configuration) {
        services.AddJwtAuthentication<User>(configuration.GetSection(JwtTokenOptions.NAME));
        services.AddAuthorization(options => {
            options.AddPolicy(PermissionsConstants.PolicyName, policy => policy.RequireAuthenticatedUser());
        });
        return services;
    }
}
```

Add `typeof(User)` to the `AddEntities(...)` call. In `Program.cs`, call `AddBackendDemoAuthentication(builder.Configuration)`, call `app.UseAuthentication()` before `app.UseAuthorization()`, and remove the current `RequireAssertion(_ => true)` policy.

Add `[Authorize(Policy = PermissionsConstants.PolicyName)]` to each Backend Demo business controller. Do not use a global fallback policy because FlowEngine's generated `/api/Account/Login` action must remain anonymous.

Add an authenticated identity endpoint so FlowAgent never trusts claims obtained by merely decoding a JWT:

```csharp
using System.Security.Claims;
using FlowEngine.Server.Authorization.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Demo.Controllers;

[ApiController]
[Route("api/Session")]
[Authorize(Policy = PermissionsConstants.PolicyName)]
public sealed class SessionController : ControllerBase {
    [HttpGet("Me")]
    public IActionResult Me() => Ok(new {
        Id = User.FindFirstValue(ClaimTypes.NameIdentifier),
        UserName = User.Identity?.Name
    });
}
```

- [ ] **Step 4: Create the identity migration**

Run:

```bash
dotnet ef migrations add AddDemoIdentity \
  --project src/Backend.Demo/Backend.Demo.csproj \
  --startup-project src/Backend.Demo/Backend.Demo.csproj
```

Expected: a migration containing ASP.NET Identity user/token tables and updated `DataDbContextModelSnapshot.cs`.

- [ ] **Step 5: Run the focused test and the Backend suite**

Run: `dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj --filter BackendDemoAuthenticationTest`

Expected: PASS.

Do not commit this intermediate state: existing smoke tests will receive 401 until Task 2 authenticates their shared client. Continue directly to Task 2.

## Task 2: Seed a development user and authenticate Backend tests

**Files:**
- Modify: `../Backend/src/Backend.Demo/Authentication/DemoAdminOptions.cs`
- Modify: `../Backend/src/Backend.Demo/DependencyInjection/BackendDemoInitializer.cs`
- Modify: `../Backend/src/Backend.Demo.Tests/BackendDemoAuthenticationTest.cs`
- Modify: `../Backend/src/Backend.Demo.Tests/BackendDemoApiSmokeTest.cs`
- Modify: `../Backend/README.md`

- [ ] **Step 1: Add a failing login test**

```csharp
[Fact]
public async Task Login_WithSeededCredentials_ReturnsJwt() {
    await using var factory = CreateFactory();
    using var client = factory.CreateClient();

    var response = await client.PostAsJsonAsync("/api/Account/Login", new {
        UserName = "flow-admin",
        Password = "Test-only-Password1!",
        RememberMe = false
    });

    response.EnsureSuccessStatusCode();
    var token = await response.Content.ReadFromJsonAsync<string>();
    Assert.False(string.IsNullOrWhiteSpace(token));
}
```

The test factory must set `DemoAdmin:UserName`, `DemoAdmin:Password`, `JwtToken:Secret`, `JwtToken:Issuer`, `JwtToken:Audience`, and `JwtToken:Expiration` through `UseSetting`.

- [ ] **Step 2: Run the login test and verify it fails**

Run: `dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj --filter Login_WithSeededCredentials_ReturnsJwt`

Expected: FAIL because no user is seeded.

- [ ] **Step 3: Implement opt-in user seeding**

Define options without committed credentials:

```csharp
namespace Backend.Demo.Authentication;

public sealed class DemoAdminOptions {
    public const string SectionName = "DemoAdmin";
    public string? UserName { get; init; }
    public string? Password { get; init; }
}
```

Inject `UserManager<User>` and `IOptions<DemoAdminOptions>` into `BackendDemoInitializer`. At the start of initialization, create the user only when both values are non-empty:

```csharp
private async Task EnsureDemoAdminAsync() {
    var options = _demoAdminOptions.Value;
    if (string.IsNullOrWhiteSpace(options.UserName) || string.IsNullOrWhiteSpace(options.Password)) {
        _logger.LogWarning("Demo admin is not configured; set DemoAdmin__UserName and DemoAdmin__Password.");
        return;
    }

    if (await _userManager.FindByNameAsync(options.UserName) is not null) return;
    var result = await _userManager.CreateAsync(new User {
        UserName = options.UserName,
        Enabled = true
    }, options.Password);
    if (!result.Succeeded) {
        throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
    }
}
```

- [ ] **Step 4: Make existing smoke tests send a real bearer token**

In `InitializeAsync`, after creating the factory, post the configured test credentials, read the JWT, and set:

```csharp
_client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", token);
```

Do not replace production authentication with a test-only bypass scheme.

- [ ] **Step 5: Run all Backend tests**

Run: `dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj`

Expected: PASS with no anonymous access to protected APIs.

Also extend `BackendDemoAuthenticationTest` to call `/api/Session/Me` with the bearer token and assert the configured user id and name are returned.

- [ ] **Step 6: Document local secrets and commit**

Document these environment variables in Backend `README.md`:

```text
JwtToken__Secret=<at-least-32-random-characters>
JwtToken__Issuer=backend-demo
JwtToken__Audience=flow-clients
JwtToken__Expiration=15
DemoAdmin__UserName=flow-admin
DemoAdmin__Password=<development-only-password>
```

Commit:

```bash
git add src/Backend.Demo src/Backend.Demo.Tests README.md
git commit -m "Seed authenticated Backend Demo user"
```

## Task 3: Scaffold FlowAgent and implement the login BFF

**Files:**
- Create: `../FlowAgent/FlowAgent.slnx`
- Create: `../FlowAgent/src/FlowAgent.Api/FlowAgent.Api.csproj`
- Create: `../FlowAgent/src/FlowAgent.Api/Program.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Auth/BackendIdentityClient.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Auth/AuthSession.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Auth/UserProfile.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Auth/AuthEndpoints.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Auth/OriginGuardMiddleware.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Persistence/FlowAgentDbContext.cs`
- Create: `../FlowAgent/test/FlowAgent.Api.Tests/FlowAgent.Api.Tests.csproj`
- Test: `../FlowAgent/test/FlowAgent.Api.Tests/AuthEndpointsTest.cs`

- [ ] **Step 1: Create the new repository and solution**

Run from `/Users/qiping/Desktop/codes/work`:

```bash
mkdir FlowAgent
cd FlowAgent
git init
dotnet new sln -n FlowAgent --format slnx
dotnet new web -n FlowAgent.Api -o src/FlowAgent.Api --framework net10.0
dotnet new xunit -n FlowAgent.Api.Tests -o test/FlowAgent.Api.Tests --framework net10.0
dotnet sln add src/FlowAgent.Api/FlowAgent.Api.csproj test/FlowAgent.Api.Tests/FlowAgent.Api.Tests.csproj
dotnet add test/FlowAgent.Api.Tests/FlowAgent.Api.Tests.csproj reference src/FlowAgent.Api/FlowAgent.Api.csproj
dotnet add src/FlowAgent.Api/FlowAgent.Api.csproj package Microsoft.EntityFrameworkCore.Sqlite --version 10.0.0
dotnet add src/FlowAgent.Api/FlowAgent.Api.csproj package Microsoft.EntityFrameworkCore.Design --version 10.0.0
dotnet add test/FlowAgent.Api.Tests/FlowAgent.Api.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing --version 10.0.0
```

Expected: `dotnet build FlowAgent.slnx` succeeds.

- [ ] **Step 2: Write failing login, me, and logout tests**

Use a stub Backend handler that returns a JWT string for `/api/Account/Login`. Verify:

```csharp
Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
Assert.Contains("flowagent.session=", login.Headers.GetValues("Set-Cookie").Single());
Assert.Equal("flow-admin", (await me.Content.ReadFromJsonAsync<CurrentUserDto>())!.UserName);
Assert.Equal(HttpStatusCode.Unauthorized, loggedOutMe.StatusCode);
```

- [ ] **Step 3: Implement protected server-side sessions**

`AuthSession` contains `Id`, `UserId`, `UserName`, `ProtectedUpstreamToken`, `CreatedAt`, `ExpiresAt`, and `RevokedAt`. `UserProfile` contains the verified Backend user id, current user name, and last-login time; login upserts it so project administrators can add users who have previously logged in. Protect the upstream JWT with `IDataProtector` before persistence. Configure ASP.NET Cookie Authentication with:

```csharp
options.Cookie.Name = "flowagent.session";
options.Cookie.HttpOnly = true;
options.Cookie.SameSite = SameSiteMode.Lax;
options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
options.SlidingExpiration = false;
options.Events.OnRedirectToLogin = context => {
    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
    return Task.CompletedTask;
};
```

The cookie principal contains only `NameIdentifier`, `Name`, and `flowagent_session_id`. `OnValidatePrincipal` must reject missing, expired, or revoked session rows.

Configure credentialed CORS from the exact `Cors:Origins` allowlist. Add `OriginGuardMiddleware` before endpoint execution: for POST, PUT, PATCH, and DELETE, reject a present `Origin` header unless it exactly matches the allowlist. Tests must send the configured origin for browser-style writes. This protects login and session writes from cross-origin form submission without inventing a development-only bypass.

- [ ] **Step 4: Implement auth endpoints**

Expose:

```text
POST /api/auth/login  { userName, password }
GET  /api/auth/me     -> { id, userName }
POST /api/auth/logout -> 204
```

Use `public sealed record CurrentUserDto(string Id, string UserName);`. Successful login returns 204, not the upstream token.

Login calls Backend `/api/Account/Login`, then calls authenticated Backend `/api/Session/Me` with the returned bearer token. It uses that verified response to create an `AuthSession` and calls `HttpContext.SignInAsync`. Logout revokes the session row and calls `SignOutAsync`.

- [ ] **Step 5: Create the database migration and run tests**

Run:

```bash
dotnet ef migrations add InitialAuthSession --project src/FlowAgent.Api
dotnet test FlowAgent.slnx
```

Expected: PASS for login, me, logout, invalid credentials, and expired session tests.

- [ ] **Step 6: Commit the FlowAgent authentication slice**

```bash
git add .
git commit -m "Create FlowAgent authentication BFF"
```

## Task 4: Add projects, members, conversations, and empty runs to FlowAgent

**Files:**
- Create: `../FlowAgent/src/FlowAgent.Api/Projects/Project.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Projects/ProjectMember.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Projects/ProjectRole.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Projects/ProjectEndpoints.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Conversations/Conversation.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Conversations/AgentRun.cs`
- Create: `../FlowAgent/src/FlowAgent.Api/Conversations/ConversationEndpoints.cs`
- Modify: `../FlowAgent/src/FlowAgent.Api/Persistence/FlowAgentDbContext.cs`
- Test: `../FlowAgent/test/FlowAgent.Api.Tests/ProjectEndpointsTest.cs`
- Test: `../FlowAgent/test/FlowAgent.Api.Tests/ConversationEndpointsTest.cs`

- [ ] **Step 1: Write project access tests**

Cover these exact behaviors:

```csharp
// creator becomes Administrator
Assert.Equal(ProjectRole.Administrator, created.CurrentUserRole);
// a different authenticated user receives 404, not project metadata
Assert.Equal(HttpStatusCode.NotFound, otherUserResponse.StatusCode);
// duplicate code is rejected
Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);
```

Also verify only an administrator can add or change members, an unknown user name is rejected with 404, and the final administrator cannot be removed.

- [ ] **Step 2: Run project tests and verify they fail**

Run: `dotnet test FlowAgent.slnx --filter ProjectEndpointsTest`

Expected: FAIL because no project model or endpoints exist.

- [ ] **Step 3: Implement the project aggregate**

Use these contracts:

```csharp
public enum ProjectRole { Administrator, FlowDesigner, WarehouseOperator }
public sealed record CreateProjectRequest(string Code, string Name, string CustomerName, string WarehouseCode);
public sealed record ProjectDto(Guid Id, string Code, string Name, string CustomerName,
    string WarehouseCode, ProjectRole CurrentUserRole, DateTimeOffset CreatedAt);
```

`Project` owns a unique normalized `Code`; `ProjectMember` has composite key `(ProjectId, UserId)`. Creating a project and its administrator member occurs in one EF transaction. Every project lookup scopes by the current `NameIdentifier` before loading details.

Expose member management using users already synchronized by a successful login:

```text
GET    /api/projects/{projectId}/members
POST   /api/projects/{projectId}/members          { userName, role }
PUT    /api/projects/{projectId}/members/{userId} { role }
DELETE /api/projects/{projectId}/members/{userId}
```

Only `Administrator` can mutate membership. Reject removal or demotion of the final administrator with 409.

- [ ] **Step 4: Write conversation and empty-run tests**

Verify a project member can create/list conversations and create an AgentRun with status `Created`, while a non-member receives 404. The run request is:

```csharp
public sealed record CreateAgentRunRequest(string Prompt);
```

The response must not claim a model ran; it returns `Status = "Created"` and the persisted prompt only.

- [ ] **Step 5: Implement conversation and run skeleton endpoints**

Expose:

```text
GET  /api/projects
POST /api/projects
GET  /api/projects/{projectId}
GET  /api/projects/{projectId}/conversations
POST /api/projects/{projectId}/conversations
GET  /api/conversations/{conversationId}
POST /api/conversations/{conversationId}/runs
```

Conversation titles are required and capped at 120 characters. Prompts are required and capped at 20,000 characters. AgentRun status is limited to `Created` in this phase.

- [ ] **Step 6: Migrate, test, and commit**

Run:

```bash
dotnet ef migrations add AddProjectsAndConversations --project src/FlowAgent.Api
dotnet test FlowAgent.slnx
```

Expected: PASS.

Commit:

```bash
git add .
git commit -m "Add FlowAgent project workspace model"
```

## Task 5: Add FlowView authentication and protected routing

**Files:**
- Create: `src/agent/types.ts`
- Create: `src/agent/api.ts`
- Create: `src/auth/AuthProvider.tsx`
- Create: `src/auth/ProtectedRoute.tsx`
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/LoginPage.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the login page test**

Install the interaction helper first:

```bash
npm install --save-dev @testing-library/user-event
```

```tsx
it('logs in and returns to projects', async () => {
  const user = userEvent.setup()
  renderApp('/login', { login: vi.fn().mockResolvedValue(undefined) })
  await user.type(screen.getByLabelText('Username'), 'flow-admin')
  await user.type(screen.getByLabelText('Password'), 'secret')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Projects')).toBeTruthy()
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/pages/LoginPage.test.tsx`

Expected: FAIL because the route and provider do not exist.

- [ ] **Step 3: Implement the credentialed Agent API client**

Define `AGENT_API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL ?? 'http://127.0.0.1:5090'`. Every request uses `credentials: 'include'`, JSON content negotiation, and a typed `AgentApiError`.

Expose `login`, `logout`, `getMe`, `getProjects`, `createProject`, `getProject`, `getProjectMembers`, `addProjectMember`, `updateProjectMember`, `removeProjectMember`, `getConversations`, `createConversation`, and `createRun`.

- [ ] **Step 4: Implement AuthProvider and ProtectedRoute**

AuthProvider bootstraps `/api/auth/me` once and exposes:

```ts
type AuthContextValue = {
  user: CurrentUser | null
  loading: boolean
  login(userName: string, password: string): Promise<void>
  logout(): Promise<void>
}
```

ProtectedRoute renders the localized loading state, redirects unauthenticated users to `/login`, and preserves the requested location in router state.

- [ ] **Step 5: Implement LoginPage and route composition**

Keep `/login` outside AppShell. Wrap protected routes with ProtectedRoute, and redirect the protected index route to `/projects`. Do not connect SignalR notifications until authentication bootstrap succeeds.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/pages/LoginPage.test.tsx src/components/AppShell.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/agent src/auth src/pages/LoginPage* src/App.tsx src/main.tsx
git commit -m "Add FlowView authenticated routing"
```

## Task 6: Build the FlowView project and Agent workspace shell

**Files:**
- Create: `src/pages/ProjectsPage.tsx`
- Create: `src/pages/ProjectsPage.test.tsx`
- Create: `src/pages/AgentWorkspacePage.tsx`
- Create: `src/pages/AgentWorkspacePage.test.tsx`
- Create: `src/components/AgentShell.tsx`
- Create: `src/components/ProjectMembersPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/i18n/messages.en-US.ts`
- Modify: `src/i18n/messages.zh-Hans-CN.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Write the projects page tests**

Verify loading, empty, populated, and creation states. The creation form requires project code, name, customer, and warehouse code. After creation, navigate to `/projects/{id}/agent`.

- [ ] **Step 2: Run project page tests and verify they fail**

Run: `npm test -- src/pages/ProjectsPage.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement ProjectsPage**

Render each project as a keyboard-accessible link with name, customer, warehouse, and current user's project role. Keep creation in an inline dialog and surface API conflicts as localized errors.

- [ ] **Step 4: Write the Agent workspace test**

Mock one project and two conversations. Assert the selected project is in the top bar, conversations appear in the left rail, the main panel shows the empty Agent prompt, and submitting a prompt creates a conversation if necessary followed by a `Created` run card.

- [ ] **Step 5: Implement AgentShell and AgentWorkspacePage**

Use the approved task-center layout:

```text
top bar: project / environment / user
left rail: flows placeholder / conversations / pending changes placeholder / executions placeholder
main: conversation header / run cards / prompt composer
```

Placeholders must say the capability is coming in a later phase and must not be clickable fake actions. A created run card displays `Queued for a future model-provider phase`; it must never simulate streaming or a completed answer.

- [ ] **Step 6: Add English and Simplified Chinese messages and styles**

Add a project-members panel for administrators. It lists members, adds a previously signed-in user by user name, changes among `Administrator`, `FlowDesigner`, and `WarehouseOperator`, and reports the final-administrator conflict. Non-administrators can view the list but see no mutation controls.

Add keys for login, projects, roles, members, conversations, new task, empty workspace, created run, logout, and API error states. Add responsive CSS so the left rail collapses below 900px without hiding project navigation.

- [ ] **Step 7: Run FlowView verification and commit**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

Commit:

```bash
git add src
git commit -m "Add FlowView Agent project workspace"
```

## Task 7: Cross-service integration and handoff documentation

**Files:**
- Create: `../FlowAgent/README.md`
- Create: `../FlowAgent/.env.example`
- Modify: `README.md`
- Create if required: `docs/integration-issues/2026-07-10-backend-identity-gap.md`

- [ ] **Step 1: Write the three-service startup contract**

Document ports and configuration:

```text
Backend Demo: http://127.0.0.1:5086
FlowAgent:    http://127.0.0.1:5090
FlowView:     http://127.0.0.1:5173

FlowAgent__BackendBaseUrl=http://127.0.0.1:5086
ConnectionStrings__FlowAgent=Data Source=flow-agent.db
Cors__Origins__0=http://127.0.0.1:5173
VITE_AGENT_API_BASE_URL=http://127.0.0.1:5090
```

- [ ] **Step 2: Run the integrated login smoke test**

Start Backend and FlowAgent with development secrets, then run:

```bash
curl -i -c /tmp/flowagent-cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"userName":"flow-admin","password":"<configured-development-password>"}' \
  http://127.0.0.1:5090/api/auth/login
curl -i -b /tmp/flowagent-cookie.txt http://127.0.0.1:5090/api/auth/me
```

Expected: login returns 204 with `flowagent.session`; `/api/auth/me` returns the configured user and no JWT.

- [ ] **Step 3: Run browser acceptance checks**

Verify manually or with the in-app browser:

1. Anonymous navigation redirects to login.
2. Valid credentials open the project list.
3. Creating a project opens its Agent workspace.
4. Refresh preserves the session and current project route.
5. Logout clears the session and returns to login.
6. Browser storage contains no JWT or model credential.

- [ ] **Step 4: Record a dependency issue only if CentreX/FlowEngine blocks the contract**

If packaged `FlowEngine.Server` cannot create identity tables, expose `/api/Account/Login`, or authenticate SignalR without an upstream source change, create `docs/integration-issues/2026-07-10-backend-identity-gap.md` with the failing command, exception, affected package version, required API behavior, compatibility constraint, and acceptance test. Do not add an authentication bypass.

- [ ] **Step 5: Run final verification**

Run:

```bash
cd ../Backend && dotnet test src/Backend.Demo.Tests/Backend.Demo.Tests.csproj
cd ../FlowAgent && dotnet test FlowAgent.slnx
cd ../FlowView && npm test && npm run lint && npm run build
```

Expected: every command exits 0.

- [ ] **Step 6: Commit documentation in each affected repository**

```bash
cd ../FlowAgent && git add README.md .env.example && git commit -m "Document FlowAgent local setup"
cd ../FlowView && git add README.md docs/integration-issues && git commit -m "Document Agent workspace integration"
```

Skip the second commit when no integration issue or FlowView README change exists; never create an empty commit.
