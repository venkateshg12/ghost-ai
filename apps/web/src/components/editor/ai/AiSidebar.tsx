"use client";

import { Sparkles, X } from "lucide-react";
import type { ProjectSummary } from "@repo/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorStore } from "@/store/editor.store";
import type { AiTab } from "@/types";
import ArchitectTab from "./ArchitectTab";
import ReviewTab from "./ReviewTab";
import SpecsTab from "./SpecsTab";

const TAB_TRIGGER_CLASS =
  "rounded-xl font-mono text-xs font-semibold text-copy-muted transition-colors data-[state=active]:bg-ai data-[state=active]:text-white";

// Floating panel on the right of the canvas; it overlays the canvas instead of resizing it.
const AiSidebar = ({ project }: { project: ProjectSummary }) => {
  const setAiSidebarOpen = useEditorStore((state) => state.setAiSidebarOpen);
  const aiTab = useEditorStore((state) => state.aiTab);
  const setAiTab = useEditorStore((state) => state.setAiTab);

  return (
    <aside className="absolute bottom-14 right-3 top-3 z-40 flex w-80 animate-slide-in-right select-none flex-col overflow-hidden rounded-2xl border border-surface-border bg-base/95 shadow-2xl backdrop-blur-md">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border bg-elevated/40 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-ai text-white shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold leading-none text-copy-primary">
              AI Workspace
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-copy-muted">
              Collaborate with Ghost AI
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAiSidebarOpen(false)}
          className="h-7 w-7 text-copy-secondary hover:text-copy-primary"
          aria-label="Close AI sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs
        value={aiTab}
        onValueChange={(value) => setAiTab(value as AiTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="border-b border-surface-border-subtle bg-elevated/20 px-4 pb-2 pt-3">
          <TabsList className="grid w-full grid-cols-3 rounded-xl border border-surface-border-subtle bg-base/80 p-1">
            <TabsTrigger value="architect" className={TAB_TRIGGER_CLASS}>
              AI Architect
            </TabsTrigger>
            <TabsTrigger value="review" className={TAB_TRIGGER_CLASS}>
              Review
            </TabsTrigger>
            <TabsTrigger value="specs" className={TAB_TRIGGER_CLASS}>
              Specs
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="architect"
          forceMount
          className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <ArchitectTab project={project} />
        </TabsContent>
        <TabsContent
          value="review"
          forceMount
          className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <ReviewTab project={project} />
        </TabsContent>
        <TabsContent
          value="specs"
          forceMount
          className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <SpecsTab project={project} />
        </TabsContent>
      </Tabs>
    </aside>
  );
};

export default AiSidebar;
