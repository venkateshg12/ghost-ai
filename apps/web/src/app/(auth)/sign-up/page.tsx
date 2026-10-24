"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import FormMessage from "@/components/auth/FormMessage";
import SignUpForm, { type RegisteredNotice } from "@/components/auth/SignUpForm";
import { ROUTES } from "@/constants/routes";

export default function SignUpPage() {
  const [notice, setNotice] = useState<RegisteredNotice | null>(null);

  if (notice) {
    return (
      <AuthCard
        title="Check your inbox"
        footer={
          <Link href={ROUTES.signIn} className="font-semibold text-brand hover:underline">
            Back to sign in
          </Link>
        }
      >
        <FormMessage type="success" title={notice.title} message={notice.message} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start designing systems with your team."
      footer={
        <>
          Already have an account?{" "}
          <Link href={ROUTES.signIn} className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm onRegistered={setNotice} />
    </AuthCard>
  );
}
