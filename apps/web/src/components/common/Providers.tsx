"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "@/lib/queryClient";
import QueryDevtools from "@/components/common/QueryDevtools";
import AuthLoader from "@/components/auth/AuthLoader";
import "@/store";

// Everything that needs the browser and wraps the whole app: server data, then the session.
const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <QueryDevtools />
    <AuthLoader>{children}</AuthLoader>
  </QueryClientProvider>
);

export default Providers;
