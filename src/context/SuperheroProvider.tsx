import { useAtom } from "jotai";
import React, { useCallback, useEffect } from "react";

import { minimumTokenThresholdAtom, verifiedAccountsAtom, botAccountsAtom } from "../atoms";

type BotAccounts = {
    domain: string;
    communityBot: {
        userId: string;
    };
    superheroBot: {
        userId: string;
    };
    blockchainBot: {
        userId: string;
    };
};

const useMinimumTokenThreshold = (config: any): void => {
    const [, setMinimumTokenThreshold] = useAtom(minimumTokenThresholdAtom);

    const loadMinimumTokenThreshold = useCallback(() => {
        if (config.bots_backend_url) {
            fetch(`${config.bots_backend_url}/ui/minimum-token-threshold`, {
                method: "GET",
            })
                .then((res) => res.json())
                .then(setMinimumTokenThreshold)
                .catch((e) => {
                    console.error("Error loading minimum token threshold", e);
                });
        }
    }, [setMinimumTokenThreshold, config.bots_backend_url]);

    useEffect(() => {
        loadMinimumTokenThreshold();

        const interval = setInterval(() => {
            loadMinimumTokenThreshold();
        }, 10000);

        return (): void => clearInterval(interval);
    }, [loadMinimumTokenThreshold]);
};

/**
 * Provides the superhero context to its children components.
 * @param children The child components to be wrapped by the provider.
 * @param config The SDK config
 * @returns The superhero provider component.
 */
export const SuperheroProvider = ({ children, config }: any): any => {
    const [verifiedAccounts, setVerifiedAccounts] = useAtom(verifiedAccountsAtom);
    const [, setBotAccounts] = useAtom(botAccountsAtom);

    function loadVerifiedAccounts(): void {
        if (config.bots_backend_url) {
            fetch(`${config.bots_backend_url}/ui/get-verified-accounts`, {
                method: "POST",
            })
                .then((res) => res.json())
                .then(setVerifiedAccounts)
                .catch(() => {
                    //
                });
        }
    }

    useEffect(() => {
        if (config.bots_backend_url) {
            fetch(`${config.bots_backend_url}/ui/bot-accounts`, {
                method: "GET",
            })
                .then((res) => res.json())
                .then((data: BotAccounts) => {
                    setBotAccounts({
                        communityBot: "@" + data.communityBot.userId + ":" + data.domain,
                        superheroBot: "@" + data.superheroBot.userId + ":" + data.domain,
                        blockchainBot: "@" + data.blockchainBot.userId + ":" + data.domain,
                    });
                })
                .catch(() => {
                    //
                });
        }
    }, [config.bots_backend_url, setBotAccounts]);

    useEffect(() => {
        if (!verifiedAccounts?.length) {
            loadVerifiedAccounts();
        }

        const interval = setInterval(() => {
            loadVerifiedAccounts();
        }, 10000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load minimum token threshold
    useMinimumTokenThreshold(config);

    return <>{children}</>;
};
