import Link from "next/link";
import { Button } from "@/components/ui/button";
import BrandMark from "@/components/common/BrandMark";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#templates", label: "Templates" },
  { href: "#specs", label: "Specs" },
];

// Sticky top bar: the same dark surface and bottom border as the editor navbar, with a blur so the
// page can scroll beneath it.
const LandingNav = () => (
  <header className="sticky top-0 z-50 border-b border-surface-border bg-base/80 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
      <Link
        href="/"
        aria-label="Ghost AI home"
        className="rounded-xl focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
      >
        <BrandMark />
      </Link>

      <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-xl px-3 py-2 text-sm font-medium text-copy-muted transition-colors hover:bg-elevated hover:text-copy-primary"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          className="h-9 text-copy-secondary hover:text-copy-primary"
        >
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild className="h-9 px-4 font-semibold">
          <Link href="/sign-up">Get started</Link>
        </Button>
      </div>
    </div>
  </header>
);

export default LandingNav;
