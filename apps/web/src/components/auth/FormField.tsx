"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

// A labelled input with an optional show/hide toggle for passwords and an inline error line.
const FormField = ({ id, label, error, type = "text", className, ...props }: FormFieldProps) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-mono text-xs text-copy-secondary">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={Boolean(error)}
          className={cn("bg-base", isPassword && "pr-10", error && "border-state-error", className)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-copy-muted hover:text-copy-primary"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-state-error">{error}</p>}
    </div>
  );
};

export default FormField;
