import { Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

const BrandMark = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-ai text-white">
      <Ghost className="h-4 w-4" />
    </div>
    <span className="font-mono text-[1rem] font-bold tracking-tight text-brand">plano</span>
  </div>
);

export default BrandMark;
