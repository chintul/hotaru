import { HttpLink } from '@apollo/client'
import { ApolloClient, InMemoryCache, registerApolloClient } from '@apollo/client-integration-nextjs'
import { SUPABASE_ANON_KEY, SUPABASE_GRAPHQL_URL } from '../env.ts'

const CATALOG_REVALIDATE_SECONDS = 60

export const { getClient, query, PreloadQuery } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: SUPABASE_GRAPHQL_URL,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        fetchOptions: { next: { revalidate: CATALOG_REVALIDATE_SECONDS } },
      }),
    }),
)
