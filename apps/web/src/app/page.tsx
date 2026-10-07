"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useAuthStore } from "@/store/auth.store";

// `/` has no page of its own: signed-in users go to the editor, everyone else to sign in.
export default function Home() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    router.replace(user ? "/editor" : "/sign-in");
  }, [router, user]);

  return <FullScreenLoader />;
}
