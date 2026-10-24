import type { ReactNode } from "react";
import EditorLayout from "@/components/editor/EditorLayout";

// Everything with the editor chrome: the open canvas at `/` and saved projects under `/editor`.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <EditorLayout>{children}</EditorLayout>;
}
