import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeadingProps) => (
  <div
    className={cn(
      "max-w-2xl space-y-4",
      align === "center" && "mx-auto text-center",
    )}
  >
    <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-brand">
      {eyebrow}
    </p>
    <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-copy-primary sm:text-4xl">
      {title}
    </h2>
    {description && (
      <p className="text-[1rem] leading-relaxed text-copy-muted">
        {description}
      </p>
    )}
  </div>
);

export default SectionHeading;
