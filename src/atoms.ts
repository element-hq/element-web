import { atomWithStorage } from "jotai/utils";

export const verifiedAccountsAtom = atomWithStorage<Record<string, string>>("VERIFIED_ACCOUNTS", {});
