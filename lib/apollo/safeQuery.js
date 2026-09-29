import { getClient } from './rsc'

/**
 * Server-side query that degrades instead of exploding.
 *
 * The storefront must still render if the database is unreachable or the schema
 * has not been pushed yet — a catalog page showing "no products" is recoverable,
 * a 500 on the home page is not. Errors are logged so this never hides a real
 * outage silently.
 *
 * Uses getClient() rather than the `query` shortcut. The shortcut warns at
 * build time that it must not be used in Server Action or Middleware
 * environments, because calling it repeatedly there builds a fresh
 * ApolloClient each time; getClient() is the shape the integration recommends
 * and is correct in every environment.
 */
export async function safeQuery(document, variables) {
  try {
    const { data } = await getClient().query({ query: document, variables })
    return { data, error: null }
  } catch (error) {
    console.error('[graphql]', error?.message ?? error)
    return { data: null, error }
  }
}
