import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormMessageProps {
  type: "error" | "success";
  title?: string;
  message: string;
}

const FormMessage = ({ type, title, message }: FormMessageProps) => {
  const Icon = type === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
        type === "error"
          ? "border-state-error/30 bg-state-error/10 text-state-error"
          : "border-state-success/30 bg-state-success/10 text-state-success"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
      </div>
    </div>
  );
};

export default FormMessage;
