export type MessageKey =
  | 'app.subtitle'
  | 'app.backend'
  | 'nav.inboundOrders'
  | 'nav.outboundOrders'
  | 'nav.flowDefinitions'
  | 'nav.flowEditor'
  | 'nav.locations'
  | 'nav.ports'
  | 'nav.pallets'
  | 'nav.skus'
  | 'language.label'
  | 'language.enUS'
  | 'language.zhHansCN'
  | 'table.edit'
  | 'table.enable'
  | 'table.disable'
  | 'table.delete'
  | 'table.pageSize'
  | 'table.previousPage'
  | 'table.nextPage'
  | 'actions.create'
  | 'actions.cancel'
  | 'actions.save'
  | 'actions.refresh'
  | 'flow.newFlow'
  | 'flow.code'
  | 'flow.name'
  | 'flow.description'
  | 'flow.create'
  | 'flow.editorTitle'
  | 'common.loading'
  | 'common.empty'

export type Messages = Record<MessageKey, string>

export function formatMessage(template: string, params?: Record<string, string | number>) {
  if (!params) {
    return template
  }

  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  )
}
