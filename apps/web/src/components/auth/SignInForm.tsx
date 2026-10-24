"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { loginInSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useLogin } from "@/hooks/auth/useLogin";
import { apiFieldErrors, zodFieldErrors, type FieldErrors } from "@/lib/formErrors";
import FormField from "./FormField";
import FormMessage from "./FormMessage";
import GoogleSignInButton from "./GoogleSignInButton";

/*
  The sign-in fields and Google button, shared by the /sign-in page and the sign-in popup. A successful
  login puts the user in the auth store; whoever hosts the form reacts to that (PublicRoute redirects,
  the popup closes).
 */
const SignInForm = ({ forgotPassword }: { forgotPassword: ReactNode }) => {
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
    <>
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
        <div className="flex justify-end">{forgotPassword}</div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <LoadingDots /> : "Sign in"}
        </Button>
      </form>
      <GoogleSignInButton onError={setFormError} />
    </>
  );
};

export default SignInForm;
