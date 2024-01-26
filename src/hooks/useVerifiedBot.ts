import { useMemo } from "react";
import { useAtom } from "jotai";

import { verifiedBotsAtom } from "../atoms";

/**
 * Custom hook to check if a bot is verified.
 * @param botId - The ID of the bot to check.
 * @returns A boolean indicating whether the bot is verified or not.
 */
export function useVerifiedBot(botId?: string): boolean {
    const [verifiedBots] = useAtom(verifiedBotsAtom);

    const isVerifiedBot: boolean = useMemo(() => {
        return !!(botId && !!verifiedBots[botId]);
    }, [botId, verifiedBots]);

    return isVerifiedBot;
}
