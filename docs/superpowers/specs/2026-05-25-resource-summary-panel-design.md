# Resource Summary Panel Design

## Goal

Expose the new warehouse resource semantics from `wmsDemo` in `FlowView` so users can understand:

- which location was requested
- which location was actually acquired
- whether the selection came from the preferred location or a fallback rule match
- which pallet and SKU are currently involved
- whether a resource is still locked
- how a node changes resource state before and after execution

This work should improve both the business-facing order experience and the execution-facing task graph experience without turning either page into a low-level debugging surface.

## Scope

This design covers:

- inbound and outbound order detail presentation on `/orders/inbound` and `/orders/outbound`
- execution graph detail presentation on `/tasks/:taskId`
- one reusable `ResourceSummaryPanel` component
- client-side resource summary derivation from existing backend responses

This design does not cover:

- new backend APIs
- raw diagnostic tabs for variable ids and resource ids
- a full event-replay timeline
- editing resource assignments from the UI

## Recommended Approach

Use a reusable `ResourceSummaryPanel` component that can render two related but distinct views:

1. **Order view**
   - business-oriented summary of the order's current resolved warehouse resources
2. **Execution view**
   - node-oriented summary of resource state before and after the selected node

This approach is preferred over page-specific ad hoc markup because the resource concepts are now shared across order details and task execution details, but the surrounding context differs. A shared panel keeps the vocabulary aligned while allowing each page to emphasize different fields.

## UX Design

### Orders Page

The order detail sidebar should show a `ResourceSummaryPanel` below the existing flow task summary.

For inbound and outbound orders, the panel should display:

- `Requested Location`
- `Resolved Location`
- `Location Status`
- `Pallet`
- `SKU`
- `Lock State`
- `Selection Source`

The meaning of those fields is:

- `Requested Location`: the location encoded on the order line
- `Resolved Location`: the actual acquired location inferred from the running or completed flow
- `Location Status`: `Empty`, `Occupied`, or other known location state
- `Pallet`: current pallet code if present
- `SKU`: current SKU code if present
- `Lock State`: `Locked` while the flow still holds the resource, otherwise `Unlocked`
- `Selection Source`:
  - `Preferred location` when requested and resolved locations match
  - `Fallback rule match` when the resolved location differs

The key business outcome is that an outbound order can clearly show that it requested `RACK-A1` but actually resolved to `RACK-A2`, and an inbound order can show that a pallet was created and bound to the destination location.

### Task Execution Page

The execution graph detail pane should show a `ResourceSummaryPanel` for the selected executable when resource semantics are relevant.

For resource-related nodes, the panel should display:

- `Rule Match`
- `Requested Location`
- `Resolved Location`
- `Location Status`
- `Pallet`
- `SKU`
- `Lock State`
- `Before`
- `After`

`Before` and `After` are compact, human-readable summaries rather than a raw diff.

Examples:

- `AcquireTargetLocation`
  - `Rule Match`: `empty-rack-location`
  - `Before`: `Requested RACK-A2`
  - `After`: `Locked RACK-A1 (fallback)`
- `AcquireSourceLocation`
  - `Rule Match`: `occupied-rack-location`
  - `Before`: `Requested RACK-A1 for SKU-001`
  - `After`: `Locked RACK-A2 with pallet PLT-SEED-RACK-A2`
- `Store`
  - `Before`: `RACK-A1 empty`
  - `After`: `RACK-A1 occupied, pallet created`
- `Retrieve`
  - `Before`: `RACK-A2 occupied, pallet bound`
  - `After`: `RACK-A2 empty, pallet released`

Non-resource nodes like `Receive` and `Deliver` should not render fake warehouse state. They may either hide the panel or render a neutral "No warehouse resource change" summary depending on implementation simplicity.

## Data Sources

No backend API changes are required in this slice.

### Orders Page Data

The orders page should derive its resource summary from:

- order detail data
- associated `FlowTaskDetail`
- `resourceDetails`
- `variableEntities`

The derivation rules are:

- requested location comes from the order line
- resolved location comes from the flow variables after resource acquisition
- lock state comes from whether the selected resource still appears as actively held by the running flow
- pallet and SKU come from resolved flow variables where available
- selection source is based on requested vs resolved location comparison

### Execution Page Data

The execution page should derive its node summary from:

- selected executable detail
- root flow variables
- current `resourceDetails`
- known node ids and their semantics

This slice intentionally uses semantic inference instead of event replay. For example, `AcquireTargetLocation` is known to represent the `empty-rack-location` rule and `AcquireSourceLocation` is known to represent the `occupied-rack-location` rule.

## Frontend Structure

Add a shared component layer:

- `ResourceSummaryPanel`
- lightweight formatting helpers for resource labels and status strings

Add a derivation layer in `src/lib`:

- order resource summary builder
- execution node resource summary builder

This keeps page components focused on composition rather than resource interpretation logic.

## Error Handling and Fallbacks

When some resource fields are unavailable:

- do not render misleading placeholders
- render `Unknown` only when the backend state is genuinely incomplete
- keep `Selection Source` hidden if there is no resolved location yet
- keep `Before/After` hidden for nodes that do not participate in warehouse resource transitions

If a flow task is absent, the order page should continue to work and simply omit the resource panel.

## Testing Strategy

### Unit Tests

Add unit coverage for:

- requested vs resolved location comparison
- selection source classification
- lock state derivation
- pallet and SKU summary formatting
- `Before/After` summaries for:
  - `AcquireTargetLocation`
  - `AcquireSourceLocation`
  - `Store`
  - `Retrieve`

### Page-Level Tests

Add page-focused tests to verify:

- order detail shows resolved resource information
- outbound order shows fallback location behavior correctly
- execution detail shows rule match and node before/after summaries

## Success Criteria

This slice is successful when:

- an order detail clearly shows requested vs resolved location
- pallet and SKU state are visible from the order workflow
- execution details clearly explain resource selection and resource transitions
- the feature works without backend API expansion
- existing order and execution graph behavior remains intact
