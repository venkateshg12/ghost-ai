"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import type { ProjectSpecSummary } from "@repo/types";
import { specDownloadPath } from "@/api/project";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSpecContent } from "@/hooks/spec/useSpecContent";
import { downloadFromApi } from "@/lib/download";
import MarkdownView from "./MarkdownView";

interface SpecPreviewModalProps {
  spec: ProjectSpecSummary | null;
  onClose: () => void;
}

// Content is fetched through the API (access-checked) only while the modal is open. Esc closes it.
const SpecPreviewModal = ({ spec, onClose }: SpecPreviewModalProps) => {
  const { data, isLoading, error } = useSpecContent(spec?.projectId ?? "", spec?.id ?? null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!spec) return;
    setDownloading(true);
    try {
      await downloadFromApi(specDownloadPath(spec.projectId, spec.id), spec.fileName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={Boolean(spec)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl rounded-3xl border-surface-border bg-elevated p-6 text-copy-primary shadow-2xl sm:max-w-3xl">
        <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-surface-border-subtle pb-4 pr-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ai/30 bg-ai/15 text-ai-text">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate font-mono text-sm font-bold">{spec?.fileName}</DialogTitle>
              <DialogDescription className="font-mono text-xs text-copy-muted">
                {spec && new Date(spec.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </DialogDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => void handleDownload()} disabled={downloading} className="h-8 shrink-0 gap-1.5 rounded-xl px-3 font-mono text-xs">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span>Download .md</span>
          </Button>
        </DialogHeader>

        <ScrollArea className="h-[60vh] max-h-[560px] w-full rounded-2xl border border-surface-border-subtle bg-base/80 p-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-xs text-copy-muted">
              <Loader2 className="h-5 w-5 animate-spin text-ai-text" />
              <span>Loading spec…</span>
            </div>
          ) : error ? (
            <p className="p-4 text-center font-mono text-xs text-state-error">{error.message}</p>
          ) : data ? (
            <MarkdownView content={data.content} />
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SpecPreviewModal;
