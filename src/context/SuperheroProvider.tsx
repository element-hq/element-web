import { useAtom } from "jotai";
import React, { useEffect } from "react";

import { verifiedAccountsAtom } from "../atoms";

/**
 * Provides the superhero context to its children components.
 * @param children The child components to be wrapped by the provider.
 * @returns The superhero provider component.
 */
export const SuperheroProvider = ({ children, config }: any): any => {
    const [verifiedAccounts, setVerifiedAccounts] = useAtom(verifiedAccountsAtom);

    function loadVerifiedAccounts(): void {
        if (config.bots_backend_url) {
            fetch(`${config.bots_backend_url}/ae-wallet-bot/get-verified-accounts`, {
                method: "POST",
            })
                .then((res) => res.json())
                .then(setVerifiedAccounts);
        }
    }

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

    return <>{children}</>;
};
