"use client";

import { useParams } from "next/navigation";
import { LayoutTemplate, MessageSquare, PanelLeftClose, PanelLeftOpen, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandMark from "@/components/common/BrandMark";
import { useGetProject } from "@/hooks/project/useGetProject";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor.store";
import SaveButton from "./SaveButton";
import UserMenu from "./UserMenu";

/*
  Shared by the editor home and the workspace. Workspace-only actions (Save, Templates, Share, AI)
  appear when a room is open; the account menu shows on the home only, because in the workspace it
  sits with the presence avatars on the canvas.
 */
const EditorNavbar = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  const { data: project } = useGetProject(roomId ?? "");
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const aiSidebarOpen = useEditorStore((state) => state.aiSidebarOpen);
  const toggleAiSidebar = useEditorStore((state) => state.toggleAiSidebar);
  const openDialog = useEditorStore((state) => state.openDialog);

  const inWorkspace = Boolean(roomId && project);

  return (
    <header className="z-40 h-14 w-full shrink-0 border-b border-surface-border bg-surface">
      <div className="flex h-full items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9 text-copy-secondary hover:text-copy-primary"
            aria-label={sidebarOpen ? "Close projects panel" : "Open projects panel"}
          >
            {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
          <BrandMark />
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {inWorkspace ? (
            <span className="truncate rounded-xl border border-surface-border-subtle bg-base px-3 py-1 font-mono text-sm font-semibold tracking-tight text-copy-primary">
              {project?.name}
            </span>
          ) : (
            <span className="hidden rounded-xl border border-surface-border-subtle bg-base px-2.5 py-1 font-mono text-xs text-copy-muted sm:inline">
              Collaborative Canvas Workspace
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {inWorkspace && project ? (
            <>
              <SaveButton />
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog("templates", project)}
                className="hidden h-8 gap-1.5 border-surface-border-subtle px-3 font-mono text-xs text-copy-secondary hover:text-copy-primary sm:inline-flex"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                <span>Templates</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog("share", project)}
                className="h-8 gap-1.5 border-surface-border-subtle px-3 font-mono text-xs text-copy-secondary hover:text-copy-primary"
              >
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
          ) : (
            <UserMenu />
          )}
        </div>
      </div>
    </header>
  );
};

export default EditorNavbar;
