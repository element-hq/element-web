import { useMemo } from "react";
import { useAtom } from "jotai";

import { verifiedAccountsAtom } from "../atoms";

/**
 * Custom hook to check if a user is verified.
 * @param userId - The ID of the user to check.
 * @returns A boolean indicating whether the user is verified or not.
 */
export function useVerifiedUser(userId?: string): boolean {
    const [verifiedAccounts] = useAtom(verifiedAccountsAtom);

    const isVerifiedUser: boolean = useMemo(() => {
        return !!(userId && !!verifiedAccounts[userId]);
    }, [userId, verifiedAccounts]);

    return isVerifiedUser;
}
