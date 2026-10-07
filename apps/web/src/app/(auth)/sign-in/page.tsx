"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { loginInSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import FormMessage from "@/components/auth/FormMessage";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useLogin } from "@/hooks/auth/useLogin";
import { apiFieldErrors, zodFieldErrors, type FieldErrors } from "@/lib/formErrors";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { mutate: signIn, isPending } = useLogin();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = loginInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    signIn(parsed.data, {
      onError: (error) => {
        setFieldErrors(apiFieldErrors(error));
        setFormError(error.message || "Invalid credentials. Please try again.");
      },
    });
  };

  return (
    <AuthCard
      title="Sign in to Ghost AI"
      description="Welcome back. Pick up where your team left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-semibold text-brand hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <FormMessage type="error" message={formError} />}
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-copy-muted hover:text-copy-primary">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <LoadingDots /> : "Sign in"}
        </Button>
      </form>
      <GoogleSignInButton onError={setFormError} />
    </AuthCard>
  );
}
