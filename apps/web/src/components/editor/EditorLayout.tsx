import type { ReactNode } from "react";
import EditorNavbar from "./EditorNavbar";
import ProjectDialogs from "./ProjectDialogs";
import ProjectSidebar from "./ProjectSidebar";

// Full-viewport frame for every editor screen: navbar on top, the page below, sidebar floating over it.
const EditorLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex h-screen flex-col overflow-hidden bg-base font-sans text-copy-primary">
    <EditorNavbar />
    <ProjectSidebar />
    <main className="relative flex flex-1 overflow-hidden">{children}</main>
    <ProjectDialogs />
  </div>
);

export default EditorLayout;
