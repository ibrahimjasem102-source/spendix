"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/ui/PullToRefreshIndicator";

export default function PullToRefreshWrapper() {
  const qc = useQueryClient();

  const { pulling, refreshing, progress } = usePullToRefresh({
    onRefresh: async () => {
      await qc.invalidateQueries({ refetchType: "active" });
    },
    threshold: 75,
  });

  return <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} progress={progress} />;
}
