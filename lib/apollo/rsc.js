import { HttpLink } from '@apollo/client'
import { ApolloClient, InMemoryCache, registerApolloClient } from '@apollo/client-integration-nextjs'

/**
 * Apollo for React Server Components.
 *
 * Catalog only. It authenticates with the publishable anon key, so it sees
 * exactly what a logged-out visitor sees — which is the whole catalog and
 * nothing else, because grants remove customer tables from the anon schema
 * entirely (see migration 08). Anything user-specific is fetched client-side
 * with the visitor's own token instead.
 */
export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_SUPABASE_GRAPHQL_URL,
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      // Catalog changes rarely; revalidate rather than hitting Tokyo per render.
      fetchOptions: { next: { revalidate: 60 } },
    }),
  })
})
