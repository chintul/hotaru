'use client'

import type { ReactNode } from 'react'
import { HttpLink } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from '@apollo/client-integration-nextjs'
import { supabaseBrowser } from '../supabase/browser.ts'
import { SUPABASE_ANON_KEY, SUPABASE_GRAPHQL_URL } from '../env.ts'

async function currentAccessToken(): Promise<string> {
  const supabase = await supabaseBrowser()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? SUPABASE_ANON_KEY
}

function makeClient() {
  const httpLink = new HttpLink({ uri: SUPABASE_GRAPHQL_URL })

  const authLink = new SetContextLink(async (prevContext) => ({
    headers: {
      ...prevContext.headers,
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${await currentAccessToken()}`,
    },
  }))

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authLink.concat(httpLink),
  })
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
}
