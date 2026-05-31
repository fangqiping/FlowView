# Flow Branch Route Editor Design

## Context

FlowEngine already supports route shapes that make cyclic and branching graphs possible:

- `Path` (`kind = 0`) for direct transitions.
- `ConditionPath` (`kind = 1`) for boolean branches. The route `condition` is a bool variable reference, `targets[0]` is the true branch, and `targets[1]` is the optional false branch.
- `SwitchPath` (`kind = 2`) for indexed branches. The route `condition` is an int variable reference, and `targets` are ordered by case index.

FlowView currently converts draft `routes` into ReactFlow edges, but it saves outgoing edges back as direct routes only. That means users can draw simple edges, but cannot author FlowEngine's branch semantics from the UI.

## Goal

Add first-version route editing support in the Flow Editor so a user can select a node and configure its outgoing routine from the Inspector. The editor must keep the visual graph and the route model synchronized immediately.

## User Experience

When a non-root node is selected, the Inspector shows an `Outgoing routes` section. The same section can later be reused for root if root selection is enabled, but the first version focuses on editable operation and subflow nodes.

The section has a route mode control:

- `Direct`: choose one or more target nodes. Edges render without labels.
- `Condition`: choose a bool variable, then choose true and false targets. Edges render labels like `Flag: true` and `Flag: false`.
- `Switch`: choose an int variable, then edit an ordered case target list. Edges render labels like `Branch: 0`, `Branch: 1`, and so on.

Changing this section updates ReactFlow edges immediately. Saving the draft then serializes the visible graph into FlowEngine-compatible `routes`.

Canvas-created edges remain supported. When the user connects nodes on the canvas, FlowView treats those edges as direct outgoing routes by default and the Inspector reflects that route state when the source node is selected.

## Data Model

FlowView should preserve the existing draft JSON contract:

```json
{
  "type": 0,
  "source": "StepA",
  "targets": ["StepB", "StepC"],
  "kind": 1,
  "condition": "Flag"
}
```

ReactFlow edge state needs enough metadata to round-trip this contract:

- `routeKind`: `direct`, `condition`, or `switch`.
- `routeCondition`: variable id used by condition and switch routes.
- `routeTargetIndex`: target order in the route.
- `routeTargetRole`: `true`, `false`, or `case` for display.

These fields can live in `edge.data` so ReactFlow remains the visible editing surface, while `buildDraftDocument` can produce exact `DraftRoute` objects.

## Synchronization Rules

`buildFlowGraph` converts each `DraftRoute` into labeled edges with route metadata.

`buildDraftDocument` groups edges by `source`, sorts them by `routeTargetIndex`, and emits one `DraftRoute` per source and route kind. Direct edges from the same source can be grouped as a direct route. Condition and switch routes must keep the condition variable and ordered targets.

Inspector updates replace the selected node's outgoing edges as a single route. This prevents stale direct edges from remaining after a node is switched to a condition or switch route.

Node deletion removes incoming and outgoing edges as it does today.

## Validation

The UI should guide valid authoring without duplicating all FlowEngine validation:

- Condition routes list only bool variables.
- Switch routes list only int variables.
- Targets cannot include an empty target when saved from the Inspector.
- A node cannot target itself accidentally through the dropdown unless the user explicitly chooses it after self-target support is made visible. First version may omit the selected node from target dropdowns.

FlowEngine preflight remains the authoritative validator for missing nodes, type mismatch, and publish-time constraints.

## Testing

Add focused tests for:

- Parsing a condition route into two labeled ReactFlow edges.
- Serializing condition and switch route edges back to `DraftRoute`.
- Updating outgoing routes from the Inspector and saving the expected draft JSON.
- Preserving direct canvas edges as direct routes.

## Out Of Scope

This first version does not add a full expression builder. FlowEngine's current compiler reads `condition` as a variable reference, so FlowView will not author expressions such as `Flag == true && Count > 1` yet.

This first version does not simulate branch execution or render Gantt timelines.
