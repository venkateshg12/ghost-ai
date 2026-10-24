"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { PROJECT_LIMIT_ERROR_CODE, slugify } from "@repo/types";
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
import { Label } from "@/components/ui/label";
import AuthModal from "@/components/auth/AuthModal";
import FormMessage from "@/components/auth/FormMessage";
import { useCreateProject } from "@/hooks/project/useCreateProject";
import { useProjectQuota } from "@/hooks/project/useProjectQuota";
import { hasGuestDraft } from "@/lib/guestDraft";
import { useDeleteProject } from "@/hooks/project/useDeleteProject";
import { useRenameProject } from "@/hooks/project/useRenameProject";
import { useEditorStore } from "@/store/editor.store";
import ShareDialog from "./ShareDialog";

const dialogClassName = "rounded-3xl border-surface-border bg-surface text-copy-primary backdrop-blur-md sm:max-w-[425px]";

const ProjectLimitNotice = () => {
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const { max } = useProjectQuota();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Project limit reached</DialogTitle>
        <DialogDescription className="text-copy-muted">
          You&apos;re using all {max} of your projects. Delete one from the Projects panel to make room for a new one.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-4 border-t border-surface-border-subtle pt-4">
        <Button onClick={closeDialog}>Got it</Button>
      </DialogFooter>
    </>
  );
};

const CreateProjectDialog = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const [name, setName] = useState("");
  const { used, max, atLimit } = useProjectQuota();
  // Created from the canvas at `/` (not from inside a project): take the drawing along.
  const [importDraft] = useState(() => !roomId && hasGuestDraft());
  const { mutate: create, isPending, isSuccess, error } = useCreateProject({ importDraft });
  const slug = slugify(name);

  if (atLimit && !isPending && !isSuccess) return <ProjectLimitNotice />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    create({ name: name.trim() }, { onSuccess: closeDialog });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create Project</DialogTitle>
        <DialogDescription className="text-copy-muted">
          {importDraft
            ? "Name your project — the canvas you've drawn is saved into it."
            : "Enter a name for your new architecture design project."}{" "}
          <span className="font-mono text-xs">
            ({used}/{max} projects used)
          </span>
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {error && (
          <FormMessage
            type="error"
            message={error.code === PROJECT_LIMIT_ERROR_CODE ? "You've reached your project limit. Delete one to create another." : error.message}
          />
        )}
        <div className="space-y-2">
          <Label htmlFor="create-name" className="font-mono text-xs text-copy-secondary">
            Project Name
          </Label>
          <Input
            id="create-name"
            placeholder="e.g. Event Driven Architecture"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
            maxLength={120}
            autoFocus
          />
        </div>
        {slug && (
          <div className="space-y-1 rounded-xl border border-surface-border-subtle bg-base p-3">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-copy-muted">Live Slug Preview</span>
            <span className="block break-all font-mono text-xs text-brand">{slug}</span>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2 border-t border-surface-border-subtle pt-4">
        <Button type="button" variant="ghost" onClick={closeDialog} disabled={isPending} className="text-copy-muted">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Creating..." : "Create Project"}
        </Button>
      </DialogFooter>
    </form>
  );
};

const RenameProjectDialog = () => {
  const project = useEditorStore((state) => state.dialogProject);
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const [name, setName] = useState(project?.name ?? "");
  const { mutate: rename, isPending, error } = useRenameProject();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project || !name.trim() || name.trim() === project.name) return;
    rename({ projectId: project.id, name: name.trim() }, { onSuccess: closeDialog });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Rename Project</DialogTitle>
        <DialogDescription className="text-copy-muted">Enter a new name for &quot;{project?.name}&quot;.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {error && <FormMessage type="error" message={error.message} />}
        <div className="space-y-2">
          <Label htmlFor="rename-name" className="font-mono text-xs text-copy-secondary">
            New Project Name
          </Label>
          <Input
            id="rename-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
            maxLength={120}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      </div>
      <DialogFooter className="gap-2 border-t border-surface-border-subtle pt-4">
        <Button type="button" variant="ghost" onClick={closeDialog} disabled={isPending} className="text-copy-muted">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !name.trim() || name.trim() === project?.name}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
};

const DeleteProjectDialog = () => {
  const project = useEditorStore((state) => state.dialogProject);
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const { mutate: remove, isPending, error } = useDeleteProject();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogDescription className="text-copy-muted">
          Are you sure you want to delete &quot;{project?.name}&quot;? Its canvas, specs and collaborator access
          are removed for everyone. This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <div className="pt-4">
          <FormMessage type="error" message={error.message} />
        </div>
      )}
      <DialogFooter className="mt-4 gap-2 border-t border-surface-border-subtle pt-4">
        <Button variant="ghost" onClick={closeDialog} disabled={isPending} className="text-copy-muted">
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={isPending || !project}
          onClick={() => project && remove(project.id, { onSuccess: closeDialog })}
        >
          {isPending ? "Deleting..." : "Delete Project"}
        </Button>
      </DialogFooter>
    </>
  );
};

/*
  All project dialogs, driven by the editor store. Each form mounts fresh when its dialog opens (the
  `key`), so a reopened dialog never shows the previous project's name or error.
 */
const ProjectDialogs = () => {
  const dialog = useEditorStore((state) => state.dialog);
  const dialogProject = useEditorStore((state) => state.dialogProject);
  const closeDialog = useEditorStore((state) => state.closeDialog);

  const formDialog = dialog === "create" || dialog === "rename" || dialog === "delete" ? dialog : null;

  return (
    <>
      <Dialog open={Boolean(formDialog)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className={dialogClassName}>
          {formDialog === "create" && <CreateProjectDialog key="create" />}
          {formDialog === "rename" && <RenameProjectDialog key={`rename-${dialogProject?.id}`} />}
          {formDialog === "delete" && <DeleteProjectDialog key={`delete-${dialogProject?.id}`} />}
        </DialogContent>
      </Dialog>
      <ShareDialog />
      <AuthModal />
    </>
  );
};

export default ProjectDialogs;
