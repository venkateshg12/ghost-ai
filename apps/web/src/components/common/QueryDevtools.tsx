"use client";

import { useEffect, useState } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { IS_DEV } from "@/constants/env";

// TanStack Query Devtools is automatically tree-shaken in production.
// We only mount on the client during development.
const QueryDevtools = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !IS_DEV) {
    return null;
  }

  return <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />;
};

export default QueryDevtools;

