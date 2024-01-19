import { atomWithStorage } from "jotai/utils";

type TokenThreshold = {
    threshold: string;
    symbol: string;
}

export type BareUser = {
    userId: string;
    rawDisplayName: string;
}

export const verifiedAccountsAtom = atomWithStorage<Record<string, string>>("VERIFIED_ACCOUNTS", {});
export const minimumTokenThresholdAtom = atomWithStorage<Record<string, TokenThreshold>>("TOKEN_THRESHOLD", {});
export const communityBotAtom = atomWithStorage<BareUser>("COMMUNITY_BOT", {
    userId: "",
    rawDisplayName: "",
});
