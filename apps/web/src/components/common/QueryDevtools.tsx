"use client";

import { lazy, Suspense } from "react";

// Lazy, so the devtools code isn't even in the production bundle.
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? lazy(() =>
        import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools }))
      )
    : null;

const QueryDevtools = () =>
  ReactQueryDevtools && (
    <Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </Suspense>
  );

export default QueryDevtools;
