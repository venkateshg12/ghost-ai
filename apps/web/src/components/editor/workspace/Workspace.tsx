"use client";

import { ReactFlowProvider } from "@xyflow/react";
import type { ProjectSummary } from "@repo/types";
import { useEditorStore } from "@/store/editor.store";
import AiSidebar from "../ai/AiSidebar";
import WorkspaceCanvas from "./WorkspaceCanvas";
import WorkspaceRoom from "./WorkspaceRoom";

/*
  One project's room. The canvas and the AI sidebar both live inside the realtime room (the
  sidebar reads its feeds and presence), and the sidebar floats over the canvas rather than
  shrinking it.
 */
const Workspace = ({ project }: { project: ProjectSummary }) => {
  const aiSidebarOpen = useEditorStore((state) => state.aiSidebarOpen);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      <WorkspaceRoom roomId={project.id}>
        <ReactFlowProvider>
          <WorkspaceCanvas project={project} />
          {aiSidebarOpen && <AiSidebar project={project} />}
        </ReactFlowProvider>
      </WorkspaceRoom>
    </div>
  );
};

export default Workspace;
