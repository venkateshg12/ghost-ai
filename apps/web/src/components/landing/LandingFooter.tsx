import Link from "next/link";
import BrandMark from "@/components/common/BrandMark";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#templates", label: "Templates" },
  { href: "#specs", label: "Specs" },
];

const LandingFooter = () => (
  <footer className="border-t border-surface-border bg-surface/60">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
      <div className="max-w-xs space-y-3">
        <BrandMark />
        <p className="text-sm leading-relaxed text-copy-muted">
          A real-time collaborative workspace for designing systems with AI.
        </p>
      </div>

      <nav
        aria-label="Footer"
        className="grid grid-cols-2 gap-x-14 gap-y-3 text-sm"
      >
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-copy-muted transition-colors hover:text-copy-primary"
          >
            {link.label}
          </a>
        ))}
        <Link
          href="/sign-in"
          className="text-copy-muted transition-colors hover:text-copy-primary"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="text-copy-muted transition-colors hover:text-copy-primary"
        >
          Create account
        </Link>
      </nav>
    </div>
    <div className="border-t border-surface-border py-5 text-center font-mono text-xs text-copy-faint">
      © {new Date().getFullYear()} Ghost AI. All rights reserved.
    </div>
  </footer>
);

export default LandingFooter;
