"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Check, Copy, Shield, Trash2, Users } from "lucide-react";
import { inviteCollaboratorSchema, type ProjectMember } from "@repo/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import FormMessage from "@/components/auth/FormMessage";
import { useGetMembers } from "@/hooks/collaborator/useGetMembers";
import { useInviteCollaborator } from "@/hooks/collaborator/useInviteCollaborator";
import { useRemoveCollaborator } from "@/hooks/collaborator/useRemoveCollaborator";
import { initialsOf } from "@/lib/utils";
import { useEditorStore } from "@/store/editor.store";

const COPIED_FEEDBACK_MS = 2000;

const MemberAvatar = ({ member }: { member: ProjectMember }) =>
  member.avatarUrl ? (
    <Image
      src={member.avatarUrl}
      alt={member.displayName || member.email}
      width={28}
      height={28}
      className="h-7 w-7 rounded-full border border-surface-border object-cover"
      unoptimized
    />
  ) : (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-border bg-elevated font-mono text-[10px] font-semibold text-copy-secondary">
      {initialsOf(member.displayName || member.email)}
    </div>
  );

const MemberInfo = ({ member }: { member: ProjectMember }) => (
  <div className="flex items-center gap-2.5 overflow-hidden">
    <MemberAvatar member={member} />
    <div className="flex flex-col overflow-hidden text-left">
      {member.displayName && <span className="truncate text-xs font-semibold text-copy-primary">{member.displayName}</span>}
      <span className="truncate font-mono text-[10px] text-copy-muted">{member.email}</span>
    </div>
  </div>
);

/*
  Owners invite and remove collaborators by email; collaborators see the list read-only. The server
  enforces the same rule — this only decides what to offer.
 */
const ShareDialog = () => {
  const dialog = useEditorStore((state) => state.dialog);
  const project = useEditorStore((state) => state.dialogProject);
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const isOpen = dialog === "share" && Boolean(project);
  const isOwner = project?.role === "owner";

  const [email, setEmail] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: members, isLoading, error: loadError } = useGetMembers(project?.id, isOpen);
  const invite = useInviteCollaborator();
  const remove = useRemoveCollaborator();
  const actionError = invite.error ?? remove.error;

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project) return;
    const parsed = inviteCollaboratorSchema.safeParse({ email });
    if (!parsed.success) {
      setInputError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setInputError(null);
    remove.reset();
    invite.mutate({ projectId: project.id, email: parsed.data.email }, { onSuccess: () => setEmail("") });
  };

  const handleCopyLink = () => {
    if (!project) return;
    void navigator.clipboard.writeText(`${window.location.origin}/editor/${project.id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setEmail("");
    setInputError(null);
    invite.reset();
    remove.reset();
    closeDialog();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-surface-border-subtle bg-surface text-copy-primary">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-[1rem]">
            <Users className="h-4 w-4 text-brand" />
            <span>Project Sharing</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-copy-muted">
            Manage who has access to &quot;{project?.name}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isOwner ? (
            <form onSubmit={handleInvite} className="flex gap-2" noValidate>
              <Input
                type="email"
                placeholder="Enter collaborator email..."
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={invite.isPending}
                className="flex-1 bg-base text-xs"
                aria-invalid={Boolean(inputError)}
              />
              <Button type="submit" disabled={invite.isPending || !email.trim()} className="shrink-0 px-4 text-xs">
                {invite.isPending ? "Inviting..." : "Invite"}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl border border-surface-border-subtle bg-base p-3 text-xs text-copy-muted">
              Only the project owner can invite and remove collaborators.
            </div>
          )}

          {(inputError || actionError || loadError) && (
            <FormMessage type="error" message={inputError ?? actionError?.message ?? loadError?.message ?? ""} />
          )}

          <div className="space-y-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-copy-muted">Members with access</p>
            <ScrollArea className="h-48 rounded-2xl border border-surface-border-subtle bg-base p-2">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center font-mono text-xs text-copy-muted animate-pulse">
                  Loading collaborators...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {members?.owner && (
                    <div className="flex items-center justify-between rounded-xl border border-surface-border-subtle/40 bg-elevated/40 p-2">
                      <MemberInfo member={members.owner} />
                      <span className="flex items-center gap-1 rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-brand">
                        <Shield className="h-2.5 w-2.5" />
                        Owner
                      </span>
                    </div>
                  )}

                  {members?.collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center justify-between rounded-xl p-2 transition-colors hover:bg-elevated/30">
                      <MemberInfo member={collaborator} />
                      {isOwner ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={remove.isPending}
                          onClick={() => {
                            invite.reset();
                            remove.mutate({ projectId: project!.id, email: collaborator.email });
                          }}
                          className="h-7 w-7 shrink-0 text-copy-muted hover:bg-state-error/10 hover:text-state-error"
                          aria-label={`Remove collaborator ${collaborator.email}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="rounded-full border border-surface-border bg-elevated px-2 py-0.5 font-mono text-[10px] uppercase text-copy-muted">
                          Editor
                        </span>
                      )}
                    </div>
                  ))}

                  {members && members.collaborators.length === 0 && (
                    <div className="py-8 text-center text-xs text-copy-muted">No collaborators invited yet.</div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-2 flex w-full flex-row items-center justify-between border-t border-surface-border pt-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleCopyLink} className="h-9 gap-1.5 border-surface-border-subtle px-4 text-xs text-copy-secondary">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-state-success" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} className="text-xs text-copy-muted">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
