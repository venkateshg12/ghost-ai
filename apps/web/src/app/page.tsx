"use client";

import { Suspense } from "react";
import PublicRoute from "@/components/auth/PublicRoute";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import LandingPage from "@/components/landing/LandingPage";

/*
  `/` is the marketing page, for signed-out visitors only. PublicRoute holds the page back until the
  session has resolved and sends a signed-in user straight on to the editor, so the landing page is
  never shown to someone who is logged in. (It reads `?from=`, hence the Suspense boundary.)
 */
export default function Home() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <PublicRoute>
        <LandingPage />
      </PublicRoute>
    </Suspense>
  );
}
