import posthog from 'posthog-js'
import { POSTHOG_HOST, POSTHOG_KEY } from './lib/env.ts'
import { isAdminUrl } from './lib/analytics.ts'

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2026-08-30',
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    before_send: (event) => (event && isAdminUrl(event.properties?.$current_url) ? null : event),
  })
}
