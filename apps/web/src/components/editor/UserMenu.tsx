"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/hooks/auth/useLogout";
import { initialsOf } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

// The signed-in user's avatar and account menu. Same 28px size as the collaborator avatars.
const UserMenu = () => {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none ring-offset-2 ring-offset-base focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="Account menu"
      >
        <Avatar className="h-7 w-7 border border-surface-border-subtle">
          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
          <AvatarFallback className="bg-elevated font-mono text-[10px] font-bold text-copy-secondary">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-surface-border bg-elevated">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-semibold text-copy-primary">{user.name}</p>
          <p className="truncate font-mono text-[11px] font-normal text-copy-muted">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-surface-border" />
        <DropdownMenuItem
          onSelect={() => logout()}
          disabled={isPending}
          className="text-copy-secondary focus:text-state-error"
        >
          <LogOut />
          <span>{isPending ? "Signing out…" : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
