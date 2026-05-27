import { describe, expect, it } from 'vitest'
import { buildPaginationQuery, coercePagedResult } from './masterData'

describe('masterData helpers', () => {
  it('builds backend pagination query strings', () => {
    expect(buildPaginationQuery({ pageIndex: 2, pageSize: 25 })).toBe(
      '?ShouldPaginate=true&PageIndex=2&PageSize=25',
    )
  })

  it('normalizes paged responses into list state', () => {
    expect(
      coercePagedResult<{ id: number }>({
        items: [{ id: 1 }, { id: 2 }],
        totalCount: 18,
        pageIndex: 3,
        pageSize: 10,
      }),
    ).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      totalCount: 18,
      pageIndex: 3,
      pageSize: 10,
    })
  })
})
