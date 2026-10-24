"use client";

import { useParams } from "next/navigation";
import { LayoutTemplate, MessageSquare, PanelLeftClose, PanelLeftOpen, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import BrandMark from "@/components/common/BrandMark";
import ThemeToggle from "@/components/common/ThemeToggle";
import { useGetProject } from "@/hooks/project/useGetProject";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useEditorStore } from "@/store/editor.store";
import type { AuthModalReason } from "@/types";
import SaveButton from "./SaveButton";
import UserMenu from "./UserMenu";

const outlineButtonClass =
  "h-8 gap-1.5 border-surface-border-subtle px-3 font-mono text-xs text-copy-secondary hover:text-copy-primary";

/*
  Shared by the canvas at `/` and every project workspace.

  In a project (a roomId is open) it offers Save, Templates, Share and AI. On the canvas at `/` those
  same buttons are shown, but Save, Share and AI need an account and a saved project: a guest gets the
  "you need to be logged in" popup, and a signed-in user is asked to create a project from the canvas.
  The account menu sits here on `/`; inside a project it sits with the presence avatars on the canvas.
 */
const EditorNavbar = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  const { data: project } = useGetProject(roomId ?? "");
  const user = useAuthStore((state) => state.user);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const aiSidebarOpen = useEditorStore((state) => state.aiSidebarOpen);
  const toggleAiSidebar = useEditorStore((state) => state.toggleAiSidebar);
  const openDialog = useEditorStore((state) => state.openDialog);
  const openAuthModal = useEditorStore((state) => state.openAuthModal);

  const inWorkspace = Boolean(roomId && project);
  const onCanvas = !roomId;

  // On the canvas at `/`: sign in first if needed, otherwise start a project from what's drawn.
  const needsProject = (reason: AuthModalReason) => () => (user ? openDialog("create") : openAuthModal(reason));

  const renderAccount = () => {
    if (!isBootstrapped) return <Skeleton className="h-8 w-24 rounded-xl" />;
    if (user) return <UserMenu />;
    return (
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => openAuthModal()} className="h-8 px-3 font-mono text-xs">
          Sign in
        </Button>
        <Button size="sm" onClick={() => openAuthModal(undefined, "sign-up")} className="h-8 px-3 font-mono text-xs">
          Sign up
        </Button>
      </div>
    );
  };

  return (
    <header className="z-40 h-14 w-full shrink-0 border-b border-surface-border bg-surface">
      <div className="flex h-full items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9 text-copy-secondary hover:text-copy-primary"
              aria-label={sidebarOpen ? "Close projects panel" : "Open projects panel"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
          )}
          <BrandMark />
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {inWorkspace ? (
            <span className="truncate rounded-xl border border-surface-border-subtle bg-base px-3 py-1 font-mono text-sm font-semibold tracking-tight text-copy-primary">
              {project?.name}
            </span>
          ) : onCanvas ? (
            <span className="hidden rounded-xl border border-surface-border-subtle bg-base px-2.5 py-1 font-mono text-xs text-copy-muted sm:inline">
              {user ? "Untitled canvas · not saved to a project" : "Untitled canvas · saved in this browser"}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          {inWorkspace && project ? (
            <>
              <SaveButton />
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog("templates", project)}
                className={cn(outlineButtonClass, "hidden sm:inline-flex")}
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                <span>Templates</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => openDialog("share", project)} className={outlineButtonClass}>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleAiSidebar}
                className={cn(
                  "h-8 w-8 text-copy-secondary hover:text-copy-primary",
                  aiSidebarOpen && "bg-ai/15 text-ai-text"
                )}
                aria-label="Toggle AI assistant"
                aria-pressed={aiSidebarOpen}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </>
          ) : onCanvas ? (
            <>
              <Button variant="outline" size="sm" onClick={needsProject("save")} className={outlineButtonClass}>
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog("templates")}
                className={cn(outlineButtonClass, "hidden sm:inline-flex")}
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                <span>Templates</span>
              </Button>
              <Button variant="outline" size="sm" onClick={needsProject("share")} className={outlineButtonClass}>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={needsProject("ai")}
                className="h-8 w-8 text-copy-secondary hover:text-copy-primary"
                aria-label="AI assistant"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              {renderAccount()}
            </>
          ) : (
            <UserMenu />
          )}
        </div>
      </div>
    </header>
  );
};

export default EditorNavbar;
