"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { registerSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import FormMessage from "@/components/auth/FormMessage";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useRegister } from "@/hooks/auth/useRegister";
import { apiFieldErrors, zodFieldErrors, type FieldErrors } from "@/lib/formErrors";

const EMPTY_FORM = { name: "", email: "", password: "", confirmPassword: "" };

export default function SignUpPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { mutate: signUp, isPending, isSuccess, data } = useRegister();

  const update = (field: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    signUp(parsed.data, {
      onError: (error) => {
        setFieldErrors(apiFieldErrors(error));
        setFormError(error.message);
      },
    });
  };

  if (isSuccess) {
    return (
      <AuthCard
        title="Check your inbox"
        footer={
          <Link href="/sign-in" className="font-semibold text-brand hover:underline">
            Back to sign in
          </Link>
        }
      >
        <FormMessage
          type="success"
          title={data?.data.title ?? "Account created"}
          message={data?.data.message ?? "We've sent an activation link to your email address."}
        />
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
          <Link href="/sign-in" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <FormMessage type="error" message={formError} />}
        <FormField id="name" label="Name" autoComplete="name" placeholder="Ada Lovelace" value={form.name} onChange={(event) => update("name")(event.target.value)} error={fieldErrors.name} />
        <FormField id="email" label="Email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(event) => update("email")(event.target.value)} error={fieldErrors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => update("password")(event.target.value)} error={fieldErrors.password} />
        <FormField id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" value={form.confirmPassword} onChange={(event) => update("confirmPassword")(event.target.value)} error={fieldErrors.confirmPassword} />
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <LoadingDots /> : "Create account"}
        </Button>
      </form>
      <GoogleSignInButton onError={setFormError} />
    </AuthCard>
  );
}
