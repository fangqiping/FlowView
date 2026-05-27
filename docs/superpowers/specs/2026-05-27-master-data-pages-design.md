# Master Data Pages Design

## Goal

Expand `FlowView` beyond flows and orders by adding dedicated list pages for:

- `Location`
- `Port`
- `Pallet`
- `Sku`

These pages should directly validate and exercise the backend demo's generic `FlowEngine.Server` CRUD and pagination surface.

The immediate goal is not a full admin system. The goal is to make `FlowView` feel more like a `FlowEngine`-native plugin by letting operators and implementers browse and maintain the core warehouse master data inside the same application.

## Product Intent

`FlowView` is evolving toward a dedicated plugin for `FlowEngine`. That means it should not only:

- edit flow definitions
- inspect runtime execution
- operate on nodes

It should also expose the surrounding configuration data that real flow editing and runtime validation depend on.

For the current demo, the most important master-data domains are:

- rack and station locations
- inbound and outbound ports
- pallets as movable resource containers
- SKUs as inventory identity

These pages help close the loop between flow design, runtime resource behavior, and the data that drives both.

## Scope

This design covers:

- four separate list pages
- backend-backed pagination
- create/edit modal forms
- direct delete actions
- explicit enable/disable actions where the entity supports `Enabled`
- consistent success/error feedback

This design does not cover:

- detail pages
- bulk operations
- advanced filters
- column sorting
- import/export
- relationship drill-down pages

## Routes and Page Structure

Add four independent routes:

- `/master-data/locations`
- `/master-data/ports`
- `/master-data/pallets`
- `/master-data/skus`

Each route uses the same screen shape:

- top `PageHeader`
- list table in the main panel
- `New` button in the header
- row-level actions
- footer pagination controls

This is preferred over a tabbed all-in-one resource page because:

- it mirrors backend controller boundaries cleanly
- each resource can evolve independently
- route-level separation is easier to expand later into detail pages if needed

## Interaction Model

Each page supports the same core interaction set.

### List

- load page `1` by default
- display the current page of rows from the backend
- show current page, page size, and total count
- allow refresh

### Create and Edit

Use a shared modal pattern per resource:

- `New` opens an empty form
- `Edit` opens the selected row in the same modal shape
- submit writes to backend
- success closes the modal and refreshes the current page

### Delete

- row-level `Delete`
- confirmation prompt before deletion
- call backend delete directly
- on success, refresh current page
- if deletion empties the current page and earlier pages exist, move back one page

### Enable and Disable

For entities with an `Enabled` field:

- show `Enable` or `Disable` as a separate row action
- implement this as a normal update call with flipped `enabled`
- refresh current page after success

This keeps delete semantics explicit while still giving the user the softer operational toggle they will often want in warehouse master data.

## Resource-Specific Fields

Each page should show only the fields needed for first-pass maintenance.

### Locations

List columns:

- `Code`
- `Name`
- `Type`
- `Status`
- `Warehouse`
- `Current Pallet`
- `Enabled`
- `Acquired`

Form fields:

- `Code`
- `Name`
- `LocationType`
- `Status`
- `WarehouseId`
- `CurrentPalletId`
- `Enabled`

### Ports

List columns:

- `Code`
- `Name`
- `Port Type`
- `Status`
- `Warehouse`
- `Current Pallet`
- `Enabled`
- `Acquired`

Form fields:

- `Code`
- `Name`
- `PortType`
- `Status`
- `WarehouseId`
- `CurrentPalletId`
- `Enabled`

### Pallets

List columns:

- `Code`
- `SKU`
- `Quantity`
- `Enabled`
- `Acquired`

Form fields:

- `Code`
- `SkuId`
- `Quantity`
- `Enabled`

### Skus

List columns:

- `Code`
- `Name`
- `Spec`

Form fields:

- `Code`
- `Name`
- `Spec`

These fields are intentionally lean. They are enough to maintain demo correctness without turning this slice into a large master-data product.

## API Integration

The frontend should align directly with the backend demo controllers built on `FlowEngine.Server.WebApi.ApiController`.

Add resource APIs for:

- paged list
- get-by-id if needed for edit hydration
- create
- update
- delete

Pagination must use backend pagination rather than client-side slicing. The frontend should keep:

- `pageIndex`
- `pageSize`
- `totalCount`
- `items`

The UI should assume backend pagination is the source of truth.

## Frontend Architecture

Use a reusable list-page pattern rather than four unrelated implementations.

Recommended pieces:

- a shared `MasterDataListPage` shell or equivalent hook-based composition
- small resource-specific column definitions
- small resource-specific form configuration
- a reusable pager footer
- a reusable confirm-delete flow

The point is not to over-abstract. The point is to avoid copy-pasting four tables that drift apart immediately.

The shared layer should handle:

- loading and error states
- pagination state
- modal open/close
- delete confirmation
- post-save and post-delete refresh

Resource-specific pages should mostly define:

- title text
- columns
- form fields
- API bindings

## Error Handling and UX

The pages should be forgiving and direct.

- show inline banner errors when requests fail
- show short success confirmations after create/edit/delete/enable/disable
- keep the current page after successful updates
- preserve the selected page size during refresh

The design should avoid hidden mutations. If a row was deleted, disabled, or edited, the refreshed table should make that visible immediately.

## Testing Strategy

This slice should be validated primarily through frontend tests.

### Unit and Component Tests

Add tests for:

- list-page pagination state changes
- create modal submission
- edit modal hydration and submission
- delete flow refresh behavior
- enable/disable action updates

### API Layer Tests

Add targeted tests that:

- build correct pagination query strings
- send proper create/update payloads
- call correct delete endpoints

### Build Verification

The slice is not complete without:

- `npm test`
- `npm run lint`
- `npm run build`

## Success Criteria

This slice is successful when:

- `FlowView` has four separate master-data pages
- each page supports backend-backed pagination
- each page supports create, edit, delete
- `Enabled` can be toggled where applicable
- the pages feel consistent with the rest of the app
- the implementation clearly exercises the backend demo's `FlowEngine.Server` CRUD and paging support
