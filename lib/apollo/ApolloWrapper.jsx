'use client'

import { HttpLink } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from '@apollo/client-integration-nextjs'
import { supabaseBrowser } from '@/lib/supabase/browser'

function makeClient() {
  const httpLink = new HttpLink({
    uri: process.env.NEXT_PUBLIC_SUPABASE_GRAPHQL_URL,
  })

  /**
   * Attach the visitor's access token to every request.
   *
   * This is what makes RLS work: Postgres resolves auth.uid() from this JWT,
   * so `orderCollection` returns the caller's orders and nobody else's. The
   * token is read fresh per operation because Supabase rotates it — caching it
   * at client-construction time would start failing after the first refresh.
   */
  const authLink = new SetContextLink(async (prevContext) => {
    const { data: { session } } = await supabaseBrowser().auth.getSession()
    const token = session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return {
      headers: {
        ...prevContext.headers,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`,
      },
    }
  })

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authLink.concat(httpLink),
  })
}

export function ApolloWrapper({ children }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
}
