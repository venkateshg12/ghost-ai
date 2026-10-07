"use client";

import { useEffect, useRef } from "react";
import { useGoogleLogin } from "@/hooks/auth/useGoogleLogin";
import { GOOGLE_CLIENT_ID } from "@/constants/env";
import type { GoogleCredentialResponse } from "@/lib/google/google";
import { loadGoogleSdk } from "@/lib/google/loadGsi";

function initializeGoogleSignIn(
  buttonContainer: HTMLDivElement,
  onCredential: (response: GoogleCredentialResponse) => void
): void {
  const id = window.google?.accounts?.id;
  if (!id) return;

  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onCredential,
    auto_select: false,
    error_callback: (error: unknown) => {
      console.error("[Google Identity Services Error]:", error);
    },
  });

  id.renderButton(buttonContainer, {
    theme: "filled_black",
    size: "large",
    text: "continue_with",
    shape: "pill",
    width: buttonContainer.clientWidth || 320,
  });
}

/*
  Google hands the browser a signed ID token; the API verifies it with Google, then creates the
  session and sets the same cookies a password sign-in does. Not rendered without a client id.
 */
export const GoogleSignInButton = ({ onError }: { onError?: (message: string) => void }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { mutate: loginWithGoogle } = useGoogleLogin();

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
        if (!cancelled && buttonRef.current) {
          initializeGoogleSignIn(buttonRef.current, handleCredentialResponse);
        }
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, onError]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-border" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-copy-faint">or</span>
        <div className="h-px flex-1 bg-surface-border" />
      </div>
      <div ref={buttonRef} className="flex min-h-10 w-full justify-center" />
    </>
  );
};

export default GoogleSignInButton;
