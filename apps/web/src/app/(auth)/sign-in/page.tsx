"use client";

import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import SignInForm from "@/components/auth/SignInForm";
import { ROUTES } from "@/constants/routes";

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in to Plano"
      description="Welcome back. Pick up where your team left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={ROUTES.signUp} className="font-semibold text-brand hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <SignInForm
        forgotPassword={
          <Link href={ROUTES.forgotPassword} className="text-xs text-copy-muted hover:text-copy-primary">
            Forgot your password?
          </Link>
        }
      />
    </AuthCard>
  );
}
