"use client";

import { useOthers } from "@liveblocks/react/suspense";
import UserMenu from "@/components/editor/UserMenu";
import { initialsOf } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const MAX_VISIBLE = 5;

/*
  Top-right of the canvas: who else is in the room, then the current user's own menu. The current
  user is never drawn from presence (a second tab of theirs would otherwise appear as a collaborator);
  the divider only shows when there is someone to divide from.
 */
const RoomPresence = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const others = useOthers((list) => list.filter((other) => other.id !== userId));

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - visible.length;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full border border-surface-border-subtle bg-surface/85 py-1 pl-1.5 pr-1.5 shadow-xl backdrop-blur-xl">
      {others.length > 0 && (
        <>
          <div className="flex items-center -space-x-2">
            {visible.map((other) => {
              const name = other.info?.name ?? "Collaborator";
              const color = other.info?.color ?? "#00c8d4";
              return (
                <div
                  key={other.connectionId}
                  title={name}
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-elevated ring-2 ring-surface"
                  style={{ borderColor: color }}
                >
                  {other.info?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary per user
                    <img src={other.info.avatar} alt={name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[10px] font-bold" style={{ color }}>
                      {initialsOf(name)}
                    </span>
                  )}
                </div>
              );
            })}
            {overflow > 0 && (
              <div
                title={`${overflow} more`}
                className="relative flex h-7 w-7 items-center justify-center rounded-full border border-surface-border-subtle bg-subtle font-mono text-[10px] font-bold text-copy-secondary ring-2 ring-surface"
              >
                +{overflow}
              </div>
            )}
          </div>
          <div className="h-4 w-px bg-surface-border-subtle" />
        </>
      )}
      <UserMenu />
    </div>
  );
};

export default RoomPresence;
