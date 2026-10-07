"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { resetPasswordSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import FormMessage from "@/components/auth/FormMessage";
import { useResetPassword } from "@/hooks/auth/useResetPassword";
import { apiFieldErrors, zodFieldErrors, type FieldErrors } from "@/lib/formErrors";

// Opened from the reset email. Success signs every device out, so the next step is signing in.
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { mutate: reset, isPending, isSuccess, isError, error } = useResetPassword();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    reset({ ...parsed.data, token }, { onError: (failure) => setFieldErrors(apiFieldErrors(failure)) });
  };

  return (
    <AuthShell>
      <AuthCard
        title={isSuccess ? "Password updated" : "Choose a new password"}
        description={isSuccess ? "You've been signed out everywhere. Sign in with your new password." : undefined}
        footer={
          <Link href="/sign-in" className="font-semibold text-brand hover:underline">
            {isSuccess ? "Sign in" : "Back to sign in"}
          </Link>
        }
      >
        {isSuccess ? (
          <FormMessage type="success" message="Your password has been reset." />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isError && <FormMessage type="error" message={error.message} />}
            <FormField id="password" label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} error={fieldErrors.password} />
            <FormField id="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" placeholder="Repeat it" value={form.confirmPassword} onChange={(event) => setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))} error={fieldErrors.confirmPassword} />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? <LoadingDots /> : "Reset password"}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
