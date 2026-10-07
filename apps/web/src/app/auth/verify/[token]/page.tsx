"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { emailSchema } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import FormMessage from "@/components/auth/FormMessage";
import { useVerifyEmail } from "@/hooks/auth/useVerifyEmail";
import { useResendVerification } from "@/hooks/auth/useResendVerification";
import { zodFieldErrors, type FieldErrors } from "@/lib/formErrors";

// Opened from the activation email. A valid link verifies the account and signs the user in.
export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const { mutate: verify, isPending, isSuccess, isError, error } = useVerifyEmail();
  const resend = useResendVerification();
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // A verify link is single-use: StrictMode's double effect must not spend it twice.
  const attempted = useRef(false);

  useEffect(() => {
    if (token && !attempted.current) {
      attempted.current = true;
      verify(token);
    }
  }, [token, verify]);

  const handleResend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    resend.mutate(parsed.data.email);
  };

  return (
    <AuthShell>
      {(isPending || (!isSuccess && !isError)) && (
        <AuthCard title="Verifying your email" description="This only takes a moment.">
          <div className="flex justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        </AuthCard>
      )}

      {isSuccess && (
        <AuthCard title="Account verified" description="Taking you to your workspace…">
          <div className="flex justify-center py-4">
            <CheckCircle2 className="h-8 w-8 text-state-success" />
          </div>
        </AuthCard>
      )}

      {isError && (
        <AuthCard
          title="This link has expired"
          description={error.message || "Verification links are single-use and expire after 10 minutes."}
          footer={
            <Link href="/sign-in" className="font-semibold text-brand hover:underline">
              Back to sign in
            </Link>
          }
        >
          <div className="mb-4 flex justify-center">
            <XCircle className="h-8 w-8 text-state-error" />
          </div>
          <form onSubmit={handleResend} className="space-y-4" noValidate>
            {resend.isSuccess && <FormMessage type="success" message={resend.data.data.message} />}
            {resend.isError && <FormMessage type="error" message={resend.error.message} />}
            <FormField id="email" label="Send a new link to" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} />
            <Button type="submit" disabled={resend.isPending} className="w-full">
              {resend.isPending ? <LoadingDots /> : "Send new link"}
            </Button>
          </form>
        </AuthCard>
      )}
    </AuthShell>
  );
}
