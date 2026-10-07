"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { emailSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import FormMessage from "@/components/auth/FormMessage";
import { useForgotPassword } from "@/hooks/auth/useForgotPassword";
import { zodFieldErrors, type FieldErrors } from "@/lib/formErrors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { mutate: requestReset, isPending, isSuccess, isError, error, data } = useForgotPassword();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    requestReset(parsed.data.email);
  };

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <Link href="/sign-in" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {isSuccess && (
          <FormMessage type="success" message={data?.data.message ?? "If that account exists, a reset link is on its way."} />
        )}
        {isError && <FormMessage type="error" message={error.message} />}
        <FormField id="email" label="Email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} />
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <LoadingDots /> : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
