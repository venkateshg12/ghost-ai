"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor.store";

const EditorHome = () => {
  const openDialog = useEditorStore((state) => state.openDialog);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-copy-primary">Create a project or open an existing one</h1>
          <p className="text-sm leading-relaxed text-copy-muted">
            Start a new architecture workspace, or choose a project from the sidebar.
          </p>
        </div>
        <Button onClick={() => openDialog("create")} className="gap-2 px-6 py-5">
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </Button>
      </div>
    </div>
  );
};

export default EditorHome;
