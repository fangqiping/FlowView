import type { DraftBinding } from '../types'

export function appendBinding(bindings: DraftBinding[]): DraftBinding[] {
  return [...bindings, { source: '', destination: '' }]
}

export function updateBinding(
  bindings: DraftBinding[],
  index: number,
  field: keyof DraftBinding,
  value: string,
): DraftBinding[] {
  return bindings.map((binding, bindingIndex) =>
    bindingIndex === index ? { ...binding, [field]: value } : binding,
  )
}

export function removeBinding(bindings: DraftBinding[], index: number): DraftBinding[] {
  return bindings.filter((_, bindingIndex) => bindingIndex !== index)
}
