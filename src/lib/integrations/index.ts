import { jira } from './jira'
import { linear } from './linear'
import { datadog } from './datadog'
import { servicenow } from './servicenow'
import { grafana } from './grafana'

export const INTEGRATIONS = { jira, linear, datadog, servicenow, grafana }
export type IntegrationId = keyof typeof INTEGRATIONS

export function isIntegrationId(id: string): id is IntegrationId {
  return id in INTEGRATIONS
}

export * from './types'
