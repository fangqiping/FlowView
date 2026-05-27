import type { PagedResponse } from '../types'

export function buildPaginationQuery({
  pageIndex,
  pageSize,
}: {
  pageIndex: number
  pageSize: number
}) {
  const params = new URLSearchParams()
  params.set('ShouldPaginate', 'true')
  params.set('PageIndex', String(pageIndex))
  params.set('PageSize', String(pageSize))
  return `?${params.toString()}`
}

export function coercePagedResult<T>(result: PagedResponse<T>) {
  return {
    items: result.items,
    totalCount: result.totalCount,
    pageIndex: result.pageIndex,
    pageSize: result.pageSize,
  }
}
