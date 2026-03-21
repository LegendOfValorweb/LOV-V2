import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useGame } from "@/lib/game-context";

export function useZoneDiscovery(zoneId: string) {
  const { account } = useGame();
  const discovered = useRef(false);

  useEffect(() => {
    if (!account?.id || discovered.current) return;
    discovered.current = true;
    apiRequest("POST", `/api/accounts/${account.id}/valorpedia/discover`, {
      category: "zones",
      entryId: zoneId,
    }).catch(() => {});
  }, [account?.id, zoneId]);
}
