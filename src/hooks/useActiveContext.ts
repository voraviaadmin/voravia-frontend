import { useCallback, useEffect, useState } from "react";
import { getActiveContext, setActiveContext, ActiveContext } from "@/src/storage/context";

export function useActiveContext() {
  const [ctx, setCtx] = useState<ActiveContext>({ type: "individual" });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getActiveContext();
    setCtx(next);
    setReady(true);
  }, []);

  const update = useCallback(async (next: ActiveContext) => {
    setCtx(next);
    await setActiveContext(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ctx, ready, setCtx: update, refresh };
}
