"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep data warm between page transitions; avoid refetch spam.
            staleTime: 30_000,
            // Avoid surprise refreshes while a user is editing forms.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    // React Query context for app-wide caching and mutations.
    <QueryClientProvider client={queryClient}>
      {children}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}
