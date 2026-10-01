import type { ApolloClient, OperationVariables, TypedDocumentNode } from '@apollo/client'
import { getClient } from './rsc.ts'

export type SafeQueryResult<TData> =
  | { data: TData | null; error: null }
  | { data: null; error: unknown }

const describeError = (error: unknown): unknown =>
  error instanceof Error ? error.message : error

export async function safeQuery<TData, TVariables extends OperationVariables = OperationVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<SafeQueryResult<TData>> {
  try {
    const options = { query: document, variables } as ApolloClient.QueryOptions<TData, TVariables>
    const { data } = await getClient().query(options)
    return { data: data ?? null, error: null }
  } catch (error) {
    console.error('[graphql]', describeError(error))
    return { data: null, error }
  }
}
