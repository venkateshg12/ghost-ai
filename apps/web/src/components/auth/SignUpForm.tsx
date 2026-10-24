"use client";

import { useState, type FormEvent } from "react";
import { registerSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useRegister } from "@/hooks/auth/useRegister";
import { apiFieldErrors, zodFieldErrors, type FieldErrors } from "@/lib/formErrors";
import FormField from "./FormField";
import FormMessage from "./FormMessage";
import GoogleSignInButton from "./GoogleSignInButton";

const EMPTY_FORM = { name: "", email: "", password: "", confirmPassword: "" };

export interface RegisteredNotice {
  title: string;
  message: string;
}

/*
  The sign-up fields and Google button, shared by the /sign-up page and the sign-in popup. Sign-up does
  not sign the user in (the email must be verified first), so success is handed to the host as a notice
  to show in its own layout.
 */
const SignUpForm = ({ onRegistered }: { onRegistered: (notice: RegisteredNotice) => void }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { mutate: signUp, isPending } = useRegister();

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
      onSuccess: (response) =>
        onRegistered({
          title: response.data.title ?? "Account created",
          message: response.data.message ?? "We've sent an activation link to your email address.",
        }),
      onError: (error) => {
        setFieldErrors(apiFieldErrors(error));
        setFormError(error.message);
      },
    });
  };

  return (
    <>
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
    </>
  );
};

export default SignUpForm;
