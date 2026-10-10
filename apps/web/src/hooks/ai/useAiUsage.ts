import { getAiUsage } from "@/api/ai";
import { useAuthStore } from "@/store/auth.store";
import type { ApiError, SuccessResponse } from "@/types";
import type { AiUsageSummary } from "@repo/types";
import { useQuery } from "@tanstack/react-query";

// Not auto-refreshed: the panel refetches when it is opened and after each run settles.
export const useAiUsage = (projectId: string) => {
  const user = useAuthStore((state) => state.user);
  return useQuery<SuccessResponse<AiUsageSummary>, ApiError>({
    queryKey: ["ai-usage", projectId],
    queryFn: () => getAiUsage(projectId),
    enabled: Boolean(user) && Boolean(projectId),
    staleTime: 10_000,
  });
};
