import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown for a project that doesn't exist and for one the user can't open — deliberately the same.
const AccessDenied = () => (
  <div className="flex flex-1 items-center justify-center px-4">
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-surface-border-subtle bg-surface p-8 text-center shadow-xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-brand">
        <Lock className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-copy-primary">Access Denied</h2>
        <p className="text-sm leading-relaxed text-copy-muted">
          You don&apos;t have access to this project, or it doesn&apos;t exist. Check the link or ask the owner to
          invite you.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link href="/editor">Back to Editor Home</Link>
      </Button>
    </div>
  </div>
);

export default AccessDenied;
