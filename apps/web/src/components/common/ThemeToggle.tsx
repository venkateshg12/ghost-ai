"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// Light / Dark / System picker. The icon shows the theme in effect right now.
const ThemeToggle = ({ className }: { className?: string }) => {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === "light" ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change theme"
        title="Theme"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl text-copy-secondary outline-none transition-colors hover:bg-subtle hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand",
          className
        )}
      >
        <Icon className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 border-surface-border bg-elevated">
        {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setPreference(value)}
            className="gap-2 text-copy-secondary focus:text-copy-primary"
          >
            <OptionIcon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {preference === value && <Check className="h-4 w-4 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
