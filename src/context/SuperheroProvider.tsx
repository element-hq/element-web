import { useAtom } from "jotai";
import React, { useCallback, useEffect } from "react";

import { communityBotAtom, minimumTokenThresholdAtom, verifiedAccountsAtom, verifiedBotsAtom } from "../atoms";

const useMinimumTokenThreshold = (config: any): void => {
    const [, setMinimumTokenThreshold] = useAtom(minimumTokenThresholdAtom);
    const [isLoading, setIsLoading] = React.useState(false);

    const loadMinimumTokenThreshold = useCallback(() => {
        if (config.bots_backend_url && !isLoading) {
            setIsLoading(true);
            fetch(`${config.bots_backend_url}/ui/minimum-token-threshold`, {
                method: "GET",
            })
                .then((res) => res.json())
                .then(setMinimumTokenThreshold)
                .catch((e) => {
                    console.error("Error loading minimum token threshold", e);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [config.bots_backend_url, isLoading, setMinimumTokenThreshold]);

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
    const [, setVerifiedBots] = useAtom(verifiedBotsAtom);
    const [, setCommunityBot] = useAtom(communityBotAtom);

    useEffect(() => {
        setCommunityBot({
            userId: config.community_bot_user_id,
            rawDisplayName: "Community DAO Room Bot",
        });
    }, [setCommunityBot, config.community_bot_user_id]);

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

    function loadVerifiedBots(): void {
        if (config.bots_backend_url) {
            fetch(`${config.bots_backend_url}/ui/get-verified-bots`, {
                method: "POST",
            })
                .then((res) => res.json())
                .then(setVerifiedBots)
                .catch(() => {
                    setVerifiedBots({
                        "@walletbot:superhero.chat": "true",
                        "@communitybot:superhero.chat": "true",
                    });
                });
        }
    }

    useEffect(() => {
        loadVerifiedBots();
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
