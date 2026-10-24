"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import AccessDenied from "@/components/editor/AccessDenied";
import Workspace from "@/components/editor/workspace/Workspace";
import { useGetProject } from "@/hooks/project/useGetProject";

// The project id is the realtime room id. The API decides access; 403 and 404 look the same here.
export default function ProjectPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: project, isLoading, isError } = useGetProject(roomId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    );
  }

  if (isError || !project) {
    return <AccessDenied />;
  }

  return <Workspace key={project.id} project={project} />;
}
