"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { useEditorStore } from "@/store/editor.store";
import type { AuthModalReason } from "@/types";
import FormMessage from "./FormMessage";
import SignInForm from "./SignInForm";
import SignUpForm, { type RegisteredNotice } from "./SignUpForm";

const REASON_COPY: Record<AuthModalReason, string> = {
  save: "Sign in to save your canvas as a project. What you've drawn so far stays right here and comes with you.",
  share: "Sharing is for signed-in users. Sign in to invite collaborators to your canvas.",
  ai: "The AI assistant is for signed-in users. Sign in to design, review and write specs with AI.",
};

const linkButtonClass = "font-semibold text-brand hover:underline";

/*
  The "you need to be logged in" popup for signed-out visitors who reach for Save, Share or the AI
  assistant. It sits over the canvas so nothing they drew is lost. Signing in closes it and, because
  every one of those actions needs a saved project, opens the create-project dialog next.
 */
const AuthModal = () => {
  const { open, mode, reason } = useEditorStore((state) => state.authModal);
  const closeAuthModal = useEditorStore((state) => state.closeAuthModal);
  const setAuthModalMode = useEditorStore((state) => state.setAuthModalMode);
  const openDialog = useEditorStore((state) => state.openDialog);
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState<RegisteredNotice | null>(null);

  useEffect(() => {
    if (open && user) {
      closeAuthModal();
      // They were stopped at something that needs a saved project; carry on with making one.
      if (reason) openDialog("create");
    }
  }, [open, user, reason, closeAuthModal, openDialog]);

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    closeAuthModal();
    setNotice(null);
  };

  const switchMode = (next: "sign-in" | "sign-up") => {
    setNotice(null);
    setAuthModalMode(next);
  };

  return (
    <Dialog open={open && !user} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-surface-border bg-surface text-copy-primary backdrop-blur-md sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {notice
              ? "Check your inbox"
              : mode === "sign-up"
                ? "Create your account"
                : reason
                  ? "You need to be logged in"
                  : "Sign in to Plano"}
          </DialogTitle>
          <DialogDescription className="text-copy-muted">
            {notice
              ? "Your canvas is safe in this browser — come back after you verify."
              : reason
                ? REASON_COPY[reason]
                : "Sign in to continue."}
          </DialogDescription>
        </DialogHeader>

        {notice ? (
          <FormMessage type="success" title={notice.title} message={notice.message} />
        ) : mode === "sign-in" ? (
          <SignInForm
            forgotPassword={
              <Link href={ROUTES.forgotPassword} className="text-xs text-copy-muted hover:text-copy-primary">
                Forgot your password?
              </Link>
            }
          />
        ) : (
          <SignUpForm onRegistered={setNotice} />
        )}

        {!notice && (
          <p className="text-center text-sm text-copy-muted">
            {mode === "sign-in" ? (
              <>
                New to Plano?{" "}
                <button type="button" onClick={() => switchMode("sign-up")} className={linkButtonClass}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("sign-in")} className={linkButtonClass}>
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
