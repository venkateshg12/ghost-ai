import ScratchCanvas from "@/components/editor/workspace/ScratchCanvas";

/*
  `/` opens straight onto a canvas — no landing page, no sign-in. Signed out, it is a draft kept in this
  browser; signing in unlocks saving it as a project (up to 5), sharing and the AI assistant.
 */
export default function Home() {
  return <ScratchCanvas />;
}
