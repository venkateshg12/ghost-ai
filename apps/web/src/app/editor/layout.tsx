import type { ReactNode } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import EditorLayout from "@/components/editor/EditorLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <EditorLayout>{children}</EditorLayout>
    </ProtectedRoute>
  );
}
