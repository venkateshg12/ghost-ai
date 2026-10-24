"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Edit2, Folder, Plus, Trash2, Users, X } from "lucide-react";
import type { ProjectSummary } from "@repo/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetProjects } from "@/hooks/project/useGetProjects";
import { useProjectQuota } from "@/hooks/project/useProjectQuota";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useEditorStore } from "@/store/editor.store";

const EmptyState = ({ icon: Icon, title, text }: { icon: typeof Folder; title: string; text: string }) => (
  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border-subtle bg-subtle/30 p-6 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-border-subtle bg-elevated text-copy-muted">
      <Icon className="h-6 w-6" />
    </div>
    <h3 className="text-sm font-semibold text-copy-primary">{title}</h3>
    <p className="mt-1 max-w-[180px] text-xs text-copy-muted">{text}</p>
  </div>
);

const ProjectRow = ({ project, active }: { project: ProjectSummary; active: boolean }) => {
  const openDialog = useEditorStore((state) => state.openDialog);
  const isOwner = project.role === "owner";
  const Icon = isOwner ? Folder : Users;

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-xl border border-transparent p-2 transition-colors hover:border-surface-border-subtle hover:bg-elevated",
        active && "border-surface-border-subtle bg-elevated"
      )}
    >
      <Link href={ROUTES.project(project.id)} className="flex flex-1 items-center gap-2 overflow-hidden">
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-copy-secondary")} />
        <span className={cn("truncate font-mono text-sm", active ? "font-semibold text-brand" : "text-copy-primary")}>
          {project.name}
        </span>
      </Link>

      {/* Rename/delete are owner-only — the server enforces it, the UI just doesn't offer it. */}
      {isOwner && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDialog("rename", project)}
            className="h-7 w-7 text-copy-muted hover:text-copy-primary"
            aria-label={`Rename ${project.name}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDialog("delete", project)}
            className="h-7 w-7 text-copy-muted hover:bg-state-error/10 hover:text-state-error"
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

/*
  Floats over the page (fixed, under the navbar) so opening it never resizes the canvas. On small
  screens a scrim behind it closes it on tap.
 */
const ProjectSidebar = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  const isOpen = useEditorStore((state) => state.sidebarOpen);
  const setSidebarOpen = useEditorStore((state) => state.setSidebarOpen);
  const openDialog = useEditorStore((state) => state.openDialog);
  const user = useAuthStore((state) => state.user);
  const { data: projects = [], isLoading } = useGetProjects();
  const { used, max, atLimit } = useProjectQuota();

  const owned = projects.filter((project) => project.role === "owner");
  const shared = projects.filter((project) => project.role === "collaborator");

  // Projects belong to accounts; a signed-out visitor only has the canvas.
  if (!user) return null;

  const renderList = (list: ProjectSummary[], empty: React.ReactNode) => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      );
    }
    if (list.length === 0) return empty;
    return (
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {list.map((project) => (
          <ProjectRow key={project.id} project={project} active={project.id === roomId} />
        ))}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 top-14 z-20 bg-base/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-14 z-30 flex w-80 flex-col border-r border-surface-border bg-surface/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full shadow-none"
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-surface-border p-4">
          <span className="font-mono text-sm font-semibold tracking-tight text-copy-primary">Projects</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="h-8 w-8 text-copy-muted hover:text-copy-primary"
            aria-label="Close projects panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <Tabs defaultValue="mine" className="flex h-full flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-2 rounded-xl bg-elevated p-1">
              <TabsTrigger value="mine" className="rounded-xl">
                My Projects
              </TabsTrigger>
              <TabsTrigger value="shared" className="rounded-xl">
                Shared
              </TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="mt-4 flex flex-1 flex-col overflow-hidden outline-hidden">
              {renderList(
                owned,
                <EmptyState icon={Folder} title="No projects" text="Get started by creating your first system design project." />
              )}
            </TabsContent>
            <TabsContent value="shared" className="mt-4 flex flex-1 flex-col overflow-hidden outline-hidden">
              {renderList(
                shared,
                <EmptyState icon={Users} title="No shared projects" text="Projects other people share with you will appear here." />
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="shrink-0 border-t border-surface-border p-4">
          <div className="mb-3 flex items-center justify-between font-mono text-xs">
            <span className={cn("text-copy-muted", atLimit && "text-state-error")}>
              {used} / {max} projects
            </span>
            {atLimit && <span className="text-copy-muted">Delete one to add more</span>}
          </div>
          <Button onClick={() => openDialog("create")} disabled={atLimit} className="w-full gap-2 py-5">
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
        </div>
      </aside>
    </>
  );
};

export default ProjectSidebar;
