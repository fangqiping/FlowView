import { describe, expect, it } from 'vitest'
import { appendBinding, removeBinding, updateBinding } from './bindingEditor'

describe('bindingEditor helpers', () => {
  it('appends an empty binding row', () => {
    expect(appendBinding([{ source: 'OrderCode', destination: 'OrderCode' }])).toEqual([
      { source: 'OrderCode', destination: 'OrderCode' },
      { source: '', destination: '' },
    ])
  })

  it('updates a specific binding field', () => {
    expect(
      updateBinding(
        [
          { source: 'OrderCode', destination: 'OrderCode' },
          { source: 'SkuCode', destination: 'SkuCode' },
        ],
        1,
        'destination',
        'PayloadSkuCode',
      ),
    ).toEqual([
      { source: 'OrderCode', destination: 'OrderCode' },
      { source: 'SkuCode', destination: 'PayloadSkuCode' },
    ])
  })

  it('removes a binding row by index', () => {
    expect(
      removeBinding(
        [
          { source: 'OrderCode', destination: 'OrderCode' },
          { source: 'SkuCode', destination: 'SkuCode' },
        ],
        0,
      ),
    ).toEqual([{ source: 'SkuCode', destination: 'SkuCode' }])
  })
})
