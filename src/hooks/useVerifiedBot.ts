import { useMemo } from "react";
import { useAtom } from "jotai";

import { botAccountsAtom, getBotAccountData } from "../atoms";

/**
 * Custom hook to check if a bot is verified.
 * @param botId - The ID of the bot to check.
 * @returns A boolean indicating whether the bot is verified or not.
 */
export function useVerifiedBot(botId?: string): boolean {
    const [botAccounts] = useAtom(botAccountsAtom);

    return useMemo(() => {
        return !!(
            botId &&
            (botId === botAccounts?.communityBot ||
                botId === botAccounts?.superheroBot ||
                botId === botAccounts?.blockchainBot)
        );
    }, [botId, botAccounts]);
}

export function isVerifiedBot(botId?: string): boolean {
    const botAccounts = getBotAccountData();

    return !!(
        botId &&
        (botId === botAccounts?.communityBot ||
            botId === botAccounts?.superheroBot ||
            botId === botAccounts?.blockchainBot)
    );
}
