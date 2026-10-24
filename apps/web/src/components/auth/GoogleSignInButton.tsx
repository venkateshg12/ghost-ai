"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useGoogleLogin } from "@/hooks/auth/useGoogleLogin";
import { GOOGLE_CLIENT_ID, IS_DEV } from "@/constants/env";
import type { GoogleCredentialResponse } from "@/lib/google/google";
import { loadGoogleSdk } from "@/lib/google/loadGsi";
import { useTheme, type ResolvedTheme } from "@/lib/theme";

// Google caps the rendered button at 400px wide.
const MAX_BUTTON_WIDTH = 400;

function initializeGoogleSignIn(
  buttonContainer: HTMLDivElement,
  onCredential: (response: GoogleCredentialResponse) => void,
  theme: ResolvedTheme,
): boolean {
  const id = window.google?.accounts?.id;
  if (!id) return false;

  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onCredential,
    auto_select: false,
    error_callback: (error: unknown) => {
      console.error("[Google Identity Services Error]:", error);
    },
  });

  id.renderButton(buttonContainer, {
    theme: theme === "light" ? "outline" : "filled_black",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    width: Math.min(buttonContainer.clientWidth || 320, MAX_BUTTON_WIDTH),
  });
  return true;
}

type Status = "loading" | "ready" | "failed";

const Divider = () => (
  <div className="my-5 flex items-center gap-3">
    <div className="h-px flex-1 bg-surface-border" />
    <span className="font-mono text-[10px] uppercase tracking-widest text-copy-faint">
      or
    </span>
    <div className="h-px flex-1 bg-surface-border" />
  </div>
);

/*
  Google hands the browser a signed ID token; the API verifies it with Google, then creates the
  session and sets the same cookies a password sign-in does.

  Without a client id the button cannot work. In production it is simply left out; in development a
  visible notice says what to set, so a missing variable is never mistaken for "the feature isn't built".
 */
export const GoogleSignInButton = ({
  onError,
}: {
  onError?: (message: string) => void;
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const { mutate: loginWithGoogle } = useGoogleLogin();
  const { resolved: theme } = useTheme();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const handleCredentialResponse = (response: GoogleCredentialResponse) => {
      if (response.credential) {
        loginWithGoogle(response.credential, {
          onError: (error) => onError?.(error.message),
        });
      }
    };

    let cancelled = false;

    loadGoogleSdk()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        setStatus(
          initializeGoogleSignIn(buttonRef.current, handleCredentialResponse, theme)
            ? "ready"
            : "failed",
        );
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, onError, theme]);

  if (!GOOGLE_CLIENT_ID) {
    if (!IS_DEV) return null;
    return (
      <>
        <Divider />
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-state-warning/40 bg-state-warning/5 px-3 py-2.5 text-xs leading-relaxed text-state-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Google sign-in is off in development: set{" "}
            <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{" "}
            <code className="font-mono">apps/web/.env</code> and restart.
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <Divider />
      <div className="relative min-h-10 w-full">
        {/* Holds the space until Google's button is drawn, so the form doesn't jump. */}
        {status === "loading" && (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-pulse rounded-xl border border-surface-border-subtle bg-elevated"
          />
        )}
        <div
          ref={buttonRef}
          className={
            status === "failed"
              ? "hidden"
              : "flex w-full justify-center overflow-hidden rounded-xl"
          }
        />
        {status === "failed" && (
          <p
            role="alert"
            className="rounded-xl border border-surface-border-subtle bg-elevated px-3 py-2.5 text-center text-xs text-copy-muted"
          >
            Google sign-in couldn&apos;t load. Check your connection or ad
            blocker, or use your email and password.
          </p>
        )}
      </div>
    </>
  );
};

export default GoogleSignInButton;
