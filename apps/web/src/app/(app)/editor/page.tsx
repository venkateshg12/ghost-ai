import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

// There is no project index any more: the projects list is the sidebar, and `/` is the canvas.
export default function EditorIndex() {
  redirect(ROUTES.home);
}
