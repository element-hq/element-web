import { useAtom } from "jotai";
import React, { useCallback, useEffect } from "react";

import { minimumTokenThresholdAtom, verifiedAccountsAtom, botAccountsAtom, botCommandsAtom } from "../atoms";

type BotAccounts = {
    domain: string;
    communityBot: {
        userId: string;
        apiPrefix: string;
    };
    superheroBot: {
        userId: string;
        apiPrefix: string;
    };
    blockchainBot: {
        userId: string;
        apiPrefix: string;
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
    const [, setBotCommands] = useAtom(botCommandsAtom);

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
                    fetchBotCommands(data.communityBot);
                    fetchBotCommands(data.superheroBot);
                })
                .catch(() => {
                    //
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    function fetchBotCommands(bot: { userId: string; apiPrefix: string }): void {
        fetch(`${config.bots_backend_url}${bot.apiPrefix}/commands`, {
            method: "GET",
        })
            .then((res) => res.json())
            .then((data: any) => {
                setBotCommands((prev) => ({
                    ...prev,
                    [bot.userId]: data.commands,
                }));
            })
            .catch(() => {
                //
            });
    }

    /**
     * Handles the click event on an element.
     * If the target element's host is 'wallet.superhero.com', it prevents the default behavior and opens the target URL in a new window with specific dimensions.
     * @param e - The MouseEvent object representing the click event.
     */
    function onElementClick(e: MouseEvent): void {
        const target = e.target as HTMLAnchorElement;
        if (target?.host === "wallet.superhero.com") {
            e.preventDefault();
            window.open(target.href, "superhero_wallet", "width=360,height=600");
        }
    }

    useEffect(() => {
        document.addEventListener("click", onElementClick);
        return () => document.removeEventListener("click", onElementClick);
    }, []);

    // Load minimum token threshold
    useMinimumTokenThreshold(config);

    return <>{children}</>;
};
