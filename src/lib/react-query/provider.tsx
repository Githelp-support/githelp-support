'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

const THREE_HOURS = 3 * 60 * 60 * 1000;

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
              // Refetch stale queries when the browser comes back online so a
              // thread/ticket that changed while the socket was down catches up
              // (Supabase realtime does not replay missed events).
              refetchOnReconnect: true,
              refetchOnWindowFocus: true,
              retry: 1,
              staleTime: THREE_HOURS
          },
        }
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

