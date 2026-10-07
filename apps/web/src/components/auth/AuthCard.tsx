import type { ReactNode } from "react";
import BrandMark from "@/components/common/BrandMark";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const AuthCard = ({ title, description, children, footer }: AuthCardProps) => (
  <div className="space-y-6">
    <BrandMark className="lg:hidden" />
    <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-xl">
      <div className="mb-6 space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-copy-primary">{title}</h2>
        {description && <p className="text-sm leading-relaxed text-copy-muted">{description}</p>}
      </div>
      {children}
    </div>
    {footer && <div className="text-center text-sm text-copy-muted">{footer}</div>}
  </div>
);

export default AuthCard;
